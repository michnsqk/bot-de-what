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
const { reglas, extraerTexto } = require('./respuestas')
const config = require('./config')
const asistencia = require('./asistencia')
const avisos = require('./avisos')

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

// Quita acentos y pasa a minúsculas para comparar sin importar cómo escriban
function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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
      if (msg.key.fromMe) continue

      // Fase 3 — el bot aprende el grupo: ahí mandará los avisos.
      if (avisos.registrarGrupo(chatId)) {
        console.log('Grupo detectado:', chatId, '(ahí se mandarán los avisos)')
      }

      const texto = extraerTexto(msg)
      if (!texto) continue

      // Fase 2 — Asistencia. Se revisa ANTES que las preguntas frecuentes:
      // "voy al entreno" es confirmar asistencia, no preguntar el horario.
      // Quien escribe es msg.key.participant en grupos (su número).
      const remitente = msg.key.participant || msg.key.remoteJid
      const nombre = msg.pushName || remitente.split('@')[0]
      const intencion = asistencia.detectarIntencion(normalizar(texto))
      let respuesta = null
      if (intencion === 'confirmar') {
        const r = asistencia.confirmar(remitente, nombre)
        respuesta = r.estado === 'nuevo'
          ? `Listo, ${nombre}. Te anoté para el ${r.evento.nombre}${r.evento.hora ? ` (${r.evento.hora})` : ''}. Van ${r.total} hasta ahora.`
          : `Ya estabas anotado para el ${r.evento.nombre}, ${nombre}.`
      } else if (intencion === 'cancelar') {
        const r = asistencia.cancelar(remitente)
        respuesta = r.estado === 'quitado'
          ? `Listo, ${nombre}. Te quité de la lista del ${r.evento.nombre}.`
          : `No estabas anotado para el ${r.evento.nombre}, ${nombre}.`
      } else if (intencion === 'lista') {
        // "lista" sola: el próximo evento. "lista del juego" o "lista del
        // entreno": ese evento aunque no sea el próximo.
        const limpio = normalizar(texto)
        let eventoFijo = null
        if (limpio.includes('juego') || limpio.includes('domingo') || limpio.includes('partido')) {
          eventoFijo = asistencia.proximoJuego()
        } else if (limpio.includes('entreno')) {
          eventoFijo = asistencia.proximoEntreno()
        }
        const r = asistencia.lista(undefined, undefined, eventoFijo)
        respuesta = r.total === 0
          ? `Para el ${r.evento.nombre} nadie ha confirmado todavía. Escribe "voy" para anotarte.`
          : `Para el ${r.evento.nombre} van ${r.total}:\n${r.nombres.map((n, i) => `${i + 1}. ${n}`).join('\n')}`
      }

      // "¿Cuándo es el próximo juego?" — responde con el evento real.
      if (!respuesta && asistencia.esPreguntaProximo(normalizar(texto))) {
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
