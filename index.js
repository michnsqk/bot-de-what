// Bot de WhatsApp para el equipo de básquetbol.
// Librería: Baileys v7 (no oficial, por QR). Solo responde en grupos.

const qrcode = require('qrcode-terminal')
const pino = require('pino')
const { Boom } = require('@hapi/boom')
const makeWASocket = require('@whiskeysockets/baileys').default
const {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} = require('@whiskeysockets/baileys')
const { reglas } = require('./respuestas')
const config = require('./config')

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
    iniciar()
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
  const { state, saveCreds } = await useMultiFileAuthState('auth')
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
        console.log('Sesión cerrada. Borra la carpeta auth/ y vuelve a escanear el QR.')
      } else {
        programarReconexion()
      }
    }

    if (connection === 'open') {
      console.log('Bot conectado como:', sock.user?.id)
      console.log('Listo. Solo responde en grupos. Equipo:', config.nombreEquipo)
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

      const texto = msg.message?.conversation
        || msg.message?.extendedTextMessage?.text
        || ''
      if (!texto) continue

      const respuesta = buscarRespuesta(texto)
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

iniciar()
