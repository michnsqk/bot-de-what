// Bot de WhatsApp para el equipo de básquetbol.
// Librería: Baileys v7 (no oficial, por QR). Solo responde en grupos.

const qrcode = require('qrcode-terminal')
const fs = require('fs')
const pino = require('pino')
const { Boom } = require('@hapi/boom')
const makeWASocket = require('@whiskeysockets/baileys').default
const {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} = require('@whiskeysockets/baileys')
const { reglas, extraerTexto, normalizar } = require('./respuestas')
const config = require('./config')
const asistencia = require('./asistencia')
const avisos = require('./avisos')
const pausa = require('./pausa')
const coach = require('./coach')

const logger = pino({ level: 'silent' })

// Evita reintentar en bucle cerrado si la conexión se cae: un solo
// reintento programado, con 5 segundos de espera entre intentos.
let reconectando = false
function programarReconexion() {
  if (reconectando) return
  reconectando = true
  console.log('Conexión perdida, reintentando en', config.esperaReconexionMs / 1000, 'segundos...')
  setTimeout(() => {
    reconectando = false
    iniciar().catch((err) => {
      console.error('No se pudo arrancar el bot:', err.message)
      programarReconexion()
    })
  }, config.esperaReconexionMs)
}

// Busca la primera regla cuyas palabras clave aparecen en el mensaje
function buscarRespuesta(texto) {
  const limpio = normalizar(texto)
  for (const regla of reglas) {
    if (regla.claves.some((clave) => limpio.includes(clave))) {
      return regla.respuesta
    }
  }
  return null
}

async function iniciar() {
  // La sesión y los datos viven en data/ (en el servidor, esa carpeta es
  // el volumen: sobrevive a reinicios y redeploys).
  fs.mkdirSync('data/auth', { recursive: true })
  const { state, saveCreds } = await useMultiFileAuthState('data/auth')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger,
    auth: state,
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log('\nEscanea este QR con el teléfono del equipo:')
      console.log('(WhatsApp > Dispositivos vinculados > Vincular un dispositivo)\n')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'close') {
      const codigo = lastDisconnect?.error instanceof Boom
        ? lastDisconnect.error.output?.statusCode
        : null
      if (codigo === DisconnectReason.loggedOut) {
        console.log('Sesión cerrada. Borra la carpeta data/auth/ y vuelve a escanear el QR.')
      } else {
        programarReconexion()
      }
    }

    if (connection === 'open') {
      console.log('Bot conectado como:', sock.user?.id)
      console.log('Listo. Solo responde en grupos. Equipo:', config.nombreEquipo)
      console.log('Pausa:', pausa.estaEnPausa() ? 'sí (usa !activa para volver)' : 'no')
      const { evento } = asistencia.lista()
      console.log('Próximo evento:', evento.nombre, evento.hora ? `(${evento.hora})` : '')
      avisos.programarAvisos(sock, config)
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    for (const msg of messages) {
      // Solo grupos: el equipo se comunica por grupo.
      // Los grupos terminan en @g.us; los chats privados, no.
      const chatId = msg.key?.remoteJid || ''
      if (config.soloGrupos && !chatId.endsWith('@g.us')) continue

      const texto = extraerTexto(msg)

      // El coach escribe desde su propio teléfono (mismo número del bot):
      // sus mensajes llegan como fromMe. Solo los que empiezan con "!"
      // son comandos del coach; lo demás es su chat normal y el bot no
      // se mete. Los comandos se atienden aunque el bot esté en pausa
      // (si no, no habría cómo volver con !activa).
      if (msg.key.fromMe) {
        if (!texto || !texto.trim().startsWith('!')) continue
        try {
          const respuestaCoach = await coach.manejarComando(texto, sock, chatId)
          if (respuestaCoach) {
            await sock.sendMessage(chatId, { text: respuestaCoach }, { quoted: msg })
          }
          console.log('Comando del coach:', texto.trim().split(/\s+/)[0])
        } catch (err) {
          console.error('No se pudo ejecutar el comando:', err.message)
        }
        continue
      }

      if (!texto) continue

      // Fase 3 — el bot aprende el grupo: ahí mandará los avisos.
      if (avisos.registrarGrupo(chatId)) {
        console.log('Grupo detectado:', chatId, '(ahí se mandarán los avisos)')
      }

      // Pausa del coach (!pausa): no responde preguntas ni asistencia.
      // Los avisos programados siguen saliendo: son anuncios del coach.
      if (pausa.estaEnPausa()) continue

      // Fase 2 — Asistencia. Se revisa ANTES que las preguntas frecuentes:
      // "voy al entreno" es confirmar asistencia, no preguntar el horario.
      // Quien escribe es msg.key.participant en grupos (su número).
      const remitente = msg.key.participant || msg.key.remoteJid
      const nombre = msg.pushName || remitente.split('@')[0]
      const limpio = normalizar(texto)
      const intencion = asistencia.detectarIntencion(limpio)
      // ¿Para qué evento? "voy al juego" anota para el domingo aunque el
      // próximo evento sea un entreno; "voy" solo es el próximo evento.
      const pedido = asistencia.eventoPedido(limpio)
      let respuesta = null
      if (intencion === 'confirmar') {
        // undefined = usa la fecha y el archivo por defecto.
        const r = asistencia.confirmar(remitente, nombre, undefined, undefined, pedido)
        respuesta = r.estado === 'nuevo'
          ? `Listo, ${nombre}. Te anoté para el ${r.evento.nombre}${r.evento.hora ? ` (${r.evento.hora})` : ''}. Van ${r.total} hasta ahora.`
          : `Ya estabas anotado para el ${r.evento.nombre}, ${nombre}.`
      } else if (intencion === 'cancelar') {
        const r = asistencia.cancelar(remitente, undefined, undefined, pedido)
        respuesta = r.estado === 'quitado'
          ? `Listo, ${nombre}. Te quité de la lista del ${r.evento.nombre}.`
          : `No estabas anotado para el ${r.evento.nombre}, ${nombre}.`
      } else if (intencion === 'lista') {
        // "lista" sola: el próximo evento. "lista del juego" o "lista del
        // entreno": ese evento aunque no sea el próximo.
        const eventoFijo = pedido === 'juego'
          ? asistencia.proximoJuego()
          : pedido === 'entreno'
            ? asistencia.proximoEntreno()
            : null
        const r = asistencia.lista(undefined, undefined, eventoFijo)
        respuesta = r.total === 0
          ? `Para el ${r.evento.nombre} nadie ha confirmado todavía. Escribe "voy" para anotarte.`
          : `Para el ${r.evento.nombre} van ${r.total}:\n${r.nombres.map((n, i) => `${i + 1}. ${n}`).join('\n')}`
      }

      // "¿Cuándo es el próximo juego?" — responde con el evento real.
      if (!respuesta && asistencia.esPreguntaProximo(limpio)) {
        respuesta = asistencia.mensajeProximo()
      }

      // Fase 1 — Preguntas frecuentes (solo si no era asistencia ni próximo).
      if (!respuesta) respuesta = buscarRespuesta(texto)
      if (!respuesta) continue // si no sabe la respuesta, no contesta

      try {
        await sock.sendMessage(chatId, { text: respuesta }, { quoted: msg })
        console.log(`Respondido en el grupo: "${texto.slice(0, 60)}"`)
      } catch (err) {
        console.error('No se pudo responder:', err.message)
      }
    }
  })
}

// Si arrancar falla (por ejemplo, sin internet), reintenta en 5 segundos
// en lugar de morirse.
iniciar().catch((err) => {
  console.error('No se pudo arrancar el bot:', err.message)
  programarReconexion()
})
