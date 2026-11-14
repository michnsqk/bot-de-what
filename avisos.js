// Avisos programados — Fase 3.
// El bot manda solo dos avisos por semana, al grupo del equipo:
// - Entreno: lunes a viernes a la 1:00 pm (2.5 h antes del entreno).
// - Juego: sábado a las 6:00 pm (la noche antes del juego del domingo).
// Las horas se cambian en config.js (recordatorioEntreno / recordatorioJuego).
//
// Para mandar el aviso el bot necesita saber el grupo. Hay dos formas:
// 1. Solo: cuando alguien escribe en el grupo, el bot guarda su ID en
//    data/grupos.json y ahí manda los avisos. El ID sale en la consola como
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

const ARCHIVO_GRUPOS = process.env.GRUPOS_ARCHIVO || path.join(__dirname, 'data', 'grupos.json')

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
  fs.mkdirSync(path.dirname(archivo), { recursive: true })
  // Escritura atómica: primero a un temporal y luego se renombra.
  const tmp = `${archivo}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(grupos, null, 2) + '\n')
  fs.renameSync(tmp, archivo)
  return true
}

// A qué grupos se mandan los avisos: el de config (si está puesto) más
// los que el bot aprendió solo, sin repetir.
function gruposDestino(config, archivo = ARCHIVO_GRUPOS) {
  const lista = cargarGrupos(archivo)
  if (config.grupoId && !lista.includes(config.grupoId)) lista.unshift(config.grupoId)
  return lista
}

// Cuántos van confirmados y quiénes, para los avisos y para !info.
// Máximo 15 nombres: si son más, se dice cuántos faltan ("y N más").
function textoConfirmados(total, nombres = []) {
  if (total === 0) return 'Van 0 confirmados hasta ahora.'
  const visibles = nombres.slice(0, 15)
  let texto = `Van ${total} confirmados: ${visibles.join(', ')}`
  if (nombres.length > 15) texto += ` y ${nombres.length - 15} más`
  return texto + '.'
}

function mensajeRecordatorioEntreno(evento, total, nombres = []) {
  return `🏀 Hoy entrenamos, ${evento.nombre} (${evento.hora}).\nConfirma con "voy". ${textoConfirmados(total, nombres)} Escribe "lista" para ver quiénes van.`
}

function mensajeRecordatorioJuego(evento, total, nombres = []) {
  return `🏀 Mañana es el ${evento.nombre}.\nConfirma con "voy". ${textoConfirmados(total, nombres)} Escribe "lista" para ver quiénes van.`
}

// Mensaje del recordatorio del próximo evento (el que toque: entreno o
// juego). Lo usa el comando "!recordatorio" del coach.
function mensajeRecordatorioProximo(ahora = new Date(), archivo) {
  const { evento, total, nombres } = asistencia.lista(ahora, archivo)
  return evento.tipo === 'juego'
    ? mensajeRecordatorioJuego(evento, total, nombres)
    : mensajeRecordatorioEntreno(evento, total, nombres)
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

// Programa los dos avisos. Se programa una sola vez, pero la conexión se
// actualiza en cada llamada: si el bot se cae y se reconecta, los avisos
// deben usar la conexión nueva, no la vieja (que ya está muerta).
// El conteo de confirmados se lee en el momento de mandar el aviso.
let sockActual = null
let programado = false
function programarAvisos(sock, config) {
  sockActual = sock
  if (programado) return
  programado = true

  if (!cron.validate(config.recordatorioEntreno)) {
    console.error('Aviso de entreno: la hora en config no es válida:', config.recordatorioEntreno)
  } else {
    cron.schedule(config.recordatorioEntreno, async () => {
      if (!sockActual) return
      const { evento, total, nombres } = asistencia.lista()
      if (evento.tipo !== 'entreno') return // por si el cron y el evento no coinciden
      await enviarATodos(sockActual, mensajeRecordatorioEntreno(evento, total, nombres), config)
    }, { timezone: config.zonaHoraria })
  }

  if (!cron.validate(config.recordatorioJuego)) {
    console.error('Aviso de juego: la hora en config no es válida:', config.recordatorioJuego)
  } else {
    cron.schedule(config.recordatorioJuego, async () => {
      if (!sockActual) return
      const { evento, total, nombres } = asistencia.lista()
      if (evento.tipo !== 'juego') return
      await enviarATodos(sockActual, mensajeRecordatorioJuego(evento, total, nombres), config)
    }, { timezone: config.zonaHoraria })
  }

  console.log('Avisos programados: entreno', config.recordatorioEntreno, '| juego', config.recordatorioJuego, '| zona', config.zonaHoraria)
}

module.exports = { cargarGrupos, registrarGrupo, gruposDestino, textoConfirmados, mensajeRecordatorioEntreno, mensajeRecordatorioJuego, mensajeRecordatorioProximo, programarAvisos }
