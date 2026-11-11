// Avisos programados — Fase 3.
// El bot manda solo dos avisos por semana, al grupo del equipo:
// - Entreno: lunes a viernes a la 1:00 pm (2.5 h antes del entreno).
// - Juego: sábado a las 6:00 pm (la noche antes del juego del domingo).
// Las horas se cambian en config.js (recordatorioEntreno / recordatorioJuego).
//
// Para mandar el aviso el bot necesita saber el grupo. Hay dos formas:
// 1. Solo: cuando alguien escribe en el grupo, el bot guarda su ID en
//    grupos.json y ahí manda los avisos. El ID sale en la consola como
//    "Grupo detectado".
// 2. A mano: pega el ID del grupo en config.grupoId.
//
// OJO: el aviso solo sale si el bot está prendido a esa hora. Si la compu
// está apagada, no hay aviso: por eso existe la Fase 4 (hosting 24/7).
// Y el bot no sabe de días festivos: si no hay entreno un día, el coach
// lo avisa en el grupo como siempre.

const fs = require('fs')
const path = require('path')
const cron = require('node-cron')
const asistencia = require('./asistencia')

const ARCHIVO_GRUPOS = process.env.GRUPOS_ARCHIVO || path.join(__dirname, 'grupos.json')

function cargarGrupos(archivo = ARCHIVO_GRUPOS) {
  try {
    const datos = JSON.parse(fs.readFileSync(archivo, 'utf8'))
    return Array.isArray(datos) ? datos : []
  } catch {
    return []
  }
}

// Guarda el grupo si es nuevo. Devuelve true solo cuando lo acaba de aprender.
function registrarGrupo(chatId, archivo = ARCHIVO_GRUPOS) {
  const grupos = cargarGrupos(archivo)
  if (grupos.includes(chatId)) return false
  grupos.push(chatId)
  fs.writeFileSync(archivo, JSON.stringify(grupos, null, 2) + '\n')
  return true
}

// A qué grupos se mandan los avisos: el de config (si está puesto) más
// los que el bot aprendió solo, sin repetir.
function gruposDestino(config, archivo = ARCHIVO_GRUPOS) {
  const lista = cargarGrupos(archivo)
  if (config.grupoId && !lista.includes(config.grupoId)) lista.unshift(config.grupoId)
  return lista
}

function mensajeRecordatorioEntreno(evento, total) {
  return `🏀 Hoy entrenamos, ${evento.nombre} (${evento.hora}).\nConfirma con "voy". Van ${total} confirmados hasta ahora. Escribe "lista" para ver quiénes van.`
}

function mensajeRecordatorioJuego(evento, total) {
  return `🏀 Mañana es el ${evento.nombre}.\nConfirma con "voy". Van ${total} confirmados hasta ahora. Escribe "lista" para ver quiénes van.`
}

async function enviarATodos(sock, texto, config) {
  for (const grupo of gruposDestino(config)) {
    try {
      await sock.sendMessage(grupo, { text: texto })
      console.log('Aviso enviado a', grupo)
    } catch (err) {
      console.error('No se pudo mandar el aviso a', grupo, '-', err.message)
    }
  }
}

// Programa los dos avisos. Se llama una sola vez, al conectarse.
// El conteo de confirmados se lee en el momento de mandar el aviso.
let programado = false
function programarAvisos(sock, config) {
  if (programado) return
  programado = true

  cron.schedule(config.recordatorioEntreno, async () => {
    const { evento, total } = asistencia.lista()
    if (evento.tipo !== 'entreno') return // por si el cron y el evento no coinciden
    await enviarATodos(sock, mensajeRecordatorioEntreno(evento, total), config)
  }, { timezone: config.zonaHoraria })

  cron.schedule(config.recordatorioJuego, async () => {
    const { evento, total } = asistencia.lista()
    if (evento.tipo !== 'juego') return
    await enviarATodos(sock, mensajeRecordatorioJuego(evento, total), config)
  }, { timezone: config.zonaHoraria })

  console.log('Avisos programados: entreno', config.recordatorioEntreno, '| juego', config.recordatorioJuego, '| zona', config.zonaHoraria)
}

module.exports = { cargarGrupos, registrarGrupo, gruposDestino, mensajeRecordatorioEntreno, mensajeRecordatorioJuego, programarAvisos }
