// Comandos del coach — Ronda 3.
// El coach escribe desde su propio teléfono, el mismo número del bot.
// Esos mensajes llegan al bot como fromMe (son del propio número), así
// que la autorización es esa: solo quien tiene el teléfono del equipo
// puede mandar desde ese número. Por eso estos comandos solo se atienden
// si el mensaje empieza con "!" y solo en el grupo del equipo; en privado
// el bot no responde nada, nunca.
//
// - !pausa → el bot deja de responder preguntas y asistencia.
// - !activa → vuelve a responder.
// - !info → estado actual: horario, costos, próximo evento y pausa.
// - !recordatorio → manda ahora mismo el recordatorio del próximo evento.
// No hay "!aviso <texto>": el coach ya puede escribir directo en el
// grupo, no aporta nada.
//
// Los avisos programados SIGUEN saliendo aunque el bot esté en pausa:
// son anuncios del coach, no respuestas a preguntas.

const pausa = require('./pausa')
const avisos = require('./avisos')
const asistencia = require('./asistencia')
const { HORARIO, COSTOS } = require('./respuestas')

// Atiende un comando del coach. Devuelve el texto para responder en el
// grupo, o null si ya se mandó el mensaje (como el recordatorio).
// opciones (solo para las pruebas): { ahora, archivoAsistencia, archivoPausa }.
async function manejarComando(texto, sock, chatId, opciones = {}) {
  const ahora = opciones.ahora || new Date()
  const cmd = texto.trim().toLowerCase().replace(/^!\s+/, '!').split(/\s+/)[0]

  if (cmd === '!pausa') {
    if (pausa.estaEnPausa(opciones.archivoPausa)) return 'El bot ya estaba en pausa.'
    pausa.ponerPausa(true, opciones.archivoPausa)
    return 'Bot en pausa. Ya no respondo preguntas ni asistencia. Los avisos programados siguen saliendo. Escribe "!activa" para volver.'
  }

  if (cmd === '!activa') {
    if (!pausa.estaEnPausa(opciones.archivoPausa)) return 'El bot ya estaba activo.'
    pausa.ponerPausa(false, opciones.archivoPausa)
    return 'Bot activo de nuevo. Ya respondo preguntas y asistencia.'
  }

  if (cmd === '!info') {
    const { evento, nombres, total } = asistencia.lista(ahora, opciones.archivoAsistencia)
    const estado = pausa.estaEnPausa(opciones.archivoPausa) ? 'en pausa' : 'activo'
    return `🤖 Bot del equipo — ${estado}\n${HORARIO}\n${COSTOS}\nPróximo: ${evento.nombre}${evento.hora ? ` (${evento.hora})` : ''} — ${avisos.textoConfirmados(total, nombres)}`
  }

  if (cmd === '!recordatorio') {
    // El recordatorio va solo al grupo donde el coach lo pidió, no a
    // todos los grupos que el bot conoce.
    const mensaje = avisos.mensajeRecordatorioProximo(ahora, opciones.archivoAsistencia)
    await sock.sendMessage(chatId, { text: mensaje })
    return null
  }

  return 'Comandos del coach: !pausa, !activa, !info, !recordatorio'
}

module.exports = { manejarComando }
