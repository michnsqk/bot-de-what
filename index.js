// Bot de WhatsApp para el equipo de básquetbol.
// Librería: Baileys v7 (no oficial, por QR). Responde en el grupo y en
// privado a quien le escriba al número (Ronda 4, decisión de Mich 15/11).
// Los avisos programados solo salen en grupos, nunca en privado.

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
const { reglas, extraerTexto, normalizar, INSCRIPCION } = require('./respuestas')
const config = require('./config')
const canal = require('./canal')
const grupoElegido = require('./grupoelegido')
const partido = require('./partido')
const saludo = require('./saludo')
const categorias = require('./categorias')
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

// Nombre del evento con hora y rival cuando hay un partido anunciado
// para esa fecha (Ronda 7); si no, el nombre normal del evento.
function nombreEvento(evento) {
  return partido.textoEventoJuego(evento)
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
      console.log('Listo. Responde en ' + (config.soloGrupos ? 'grupos' : 'grupos y en privado') + '. Equipo:', config.nombreEquipo)
      console.log('Pausa:', pausa.estaEnPausa() ? 'sí (usa !activa para volver)' : 'no')
      const { evento } = asistencia.lista()
      console.log('Próximo evento:', evento.nombre, evento.hora ? `(${evento.hora})` : '')
      avisos.programarAvisos(sock, config)
      // Ronda 7: si hay un partido anunciado guardado, se rearman sus
      // recordatorios (por si el bot se reinició).
      const armados = partido.programarRecordatorios(sock, grupoElegido.elegido(config))
      if (armados > 0) console.log('Recordatorios del partido rearmados:', armados)
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    for (const msg of messages) {
      // Grupos y privados (Ronda 4): el equipo se comunica por grupo,
      // pero cualquiera que le escriba al número también recibe
      // respuestas en su chat privado. Los grupos terminan en @g.us;
      // los chats privados, no. La decisión vive en config.soloGrupos
      // (ver canal.js).
      // Ronda 7: en grupos el bot solo sirve al grupo elegido (con
      // !grupo o en config); a los demás grupos los ignora.
      const chatId = msg.key?.remoteJid || ''
      const texto = extraerTexto(msg)
      const elegidoId = grupoElegido.elegido(config)

      // El coach escribe desde su propio teléfono (mismo número del bot):
      // sus mensajes llegan como fromMe. Solo los que empiezan con "!"
      // son comandos del coach. Se atienden en cualquier chat, incluso
      // en un grupo que el bot ignora: así el coach puede mover el
      // grupo elegido con !grupo desde donde esté. Los comandos se
      // atienden aunque el bot esté en pausa (si no, no habría cómo
      // volver con !activa).
      if (msg.key.fromMe && texto && texto.trim().startsWith('!')) {
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

      if (!canal.respondeEn(chatId, config, elegidoId)) continue

      // Mensaje normal del coach en el grupo elegido: ¿avisó un partido?
      // Si lo entendí, guardo el partido, armo sus recordatorios y le
      // confirmo lo que registré. Sus demás mensajes no se contestan.
      if (msg.key.fromMe) {
        if (canal.esGrupo(chatId) && texto) {
          const juego = partido.anunciar(texto, new Date())
          if (juego) {
            partido.programarRecordatorios(sock, chatId)
            try {
              await sock.sendMessage(chatId, { text: partido.mensajeConfirmacion(juego) }, { quoted: msg })
            } catch (err) {
              console.error('No se pudo confirmar el partido:', err.message)
            }
            console.log('Partido anunciado:', juego.fechaISO, juego.rival || '')
          }
        }
        continue
      }

      if (!texto) continue

      // Fase 3 — el bot aprende el grupo: ahí mandará los avisos.
      // Solo grupos: un privado nunca se aprende (ver avisos.js), así
      // los avisos programados solo salen en grupos.
      // Ronda 7: con grupo elegido, no se aprende ningún otro grupo.
      if (avisos.registrarGrupo(chatId, undefined, elegidoId)) {
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
          ? `Listo, ${nombre}. Te anoté para el ${nombreEvento(r.evento)}${r.evento.hora ? ` (${r.evento.hora})` : ''}. Van ${r.total} hasta ahora.`
          : `Ya estabas anotado para el ${nombreEvento(r.evento)}, ${nombre}.`
      } else if (intencion === 'cancelar') {
        const r = asistencia.cancelar(remitente, undefined, undefined, pedido)
        respuesta = r.estado === 'quitado'
          ? `Listo, ${nombre}. Te quité de la lista del ${nombreEvento(r.evento)}.`
          : `No estabas anotado para el ${nombreEvento(r.evento)}, ${nombre}.`
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
          ? `Para el ${nombreEvento(r.evento)} nadie ha confirmado todavía. Escribe "voy" para anotarte.`
          : `Para el ${nombreEvento(r.evento)} van ${r.total}:\n${r.nombres.map((n, i) => `${i + 1}. ${n}`).join('\n')}`
      }

      // Ronda 7 — en el grupo el bot solo atiende asistencia (voy, no
      // voy, lista): nada de preguntas, categorías ni saludos. En
      // privado todo sigue igual.
      if (!respuesta && canal.esGrupo(chatId)) continue

      // "¿Cuándo es el próximo juego?" — responde con el evento real.
      if (!respuesta && asistencia.esPreguntaProximo(limpio)) {
        respuesta = asistencia.mensajeProximo()
      }

      // Ronda 6b — Saludar al que saluda: en privado, si es la primera
      // vez de esa persona y solo saluda ("hola", "buenas"...), se le
      // muestra la bienvenida (que pide nombre y edad) en vez del menú.
      // Antes el "hola" caía en el menú y la bienvenida nunca salía.
      if (!respuesta && !canal.esGrupo(chatId) && saludo.debeSaludar(chatId, remitente, config) && saludo.esSaludo(texto)) {
        respuesta = saludo.BIENVENIDA
        saludo.marcarSaludado(remitente)
        saludo.marcarEsperandoDatos(remitente)
      }

      // Ronda 6b — En el grupo, a quien saluda por primera vez se le
      // contesta una vez invitándolo a escribir en privado: el saludo
      // completo (nombre y edad de un menor) no va en un grupo de 30.
      if (!respuesta && canal.esGrupo(chatId) && !saludo.yaSaludadoGrupo(remitente) && saludo.esSaludo(texto)) {
        respuesta = saludo.FUNNEL_GRUPO
        saludo.marcarSaludadoGrupo(remitente)
      }

      // Fase 1 — Preguntas frecuentes (solo si no era asistencia ni próximo).
      if (!respuesta) respuesta = buscarRespuesta(texto)
      // Ronda 6b — En el grupo, si preguntan por entrar al equipo se les
      // da la info y se les invita a pasar al privado con nombre y edad.
      // Solo la primera vez por persona.
      if (respuesta === INSCRIPCION && canal.esGrupo(chatId) && !saludo.yaSaludadoGrupo(remitente)) {
        respuesta += '\n\nSi es para inscribir a un jugador, escríbenos en privado a este número con su nombre y edad y te decimos su categoría.'
        saludo.marcarSaludadoGrupo(remitente)
      }
      // Ronda 6 — Categorías por edad: en privado, si el bot ya le pidió
      // el nombre y la edad (o es su primer mensaje) y el mensaje los
      // trae, responde con su categoría, horarios e inscripción. Si le
      // pidieron los datos y contesta otra cosa, se los vuelve a pedir.
      // Solo en privado: en el grupo, "categorías" responde la lista (FAQ).
      if (!respuesta && !canal.esGrupo(chatId)) {
        const datos = categorias.extraerNombreEdad(texto)
        if (datos && (saludo.esperandoDatos(remitente) || saludo.debeSaludar(chatId, remitente, config))) {
          respuesta = categorias.mensajeCategoria(datos.nombre, datos.edad)
          saludo.marcarSaludado(remitente)
          saludo.quitarEsperandoDatos(remitente)
        } else if (!datos && saludo.esperandoDatos(remitente)) {
          respuesta = 'Para decirte su categoría necesito el nombre y la edad del jugador. Por ejemplo: Juan, 12 años.'
        }
      }
      // Ronda 5/6 — Bienvenida: en privado, si es la primera vez de esa
      // persona y el bot no entendió el mensaje, le pide el nombre y la
      // edad del jugador en vez de callar. En grupos nunca saluda.
      if (!respuesta && saludo.debeSaludar(chatId, remitente, config)) {
        respuesta = saludo.BIENVENIDA
        saludo.marcarSaludado(remitente)
        saludo.marcarEsperandoDatos(remitente)
      }
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
