// Comandos del coach — Ronda 3.
// El coach escribe desde su propio teléfono, el mismo número del bot.
// Esos mensajes llegan al bot como fromMe (son del propio número), así
// que la autorización es esa: solo quien tiene el teléfono del equipo
// puede mandar desde ese número. Por eso estos comandos solo se atienden
// si el mensaje empieza con "!".
// Se atienden en cualquier chat (grupo o privado): así el coach puede
// mover el grupo elegido con !grupo desde donde esté.
//
// - !pausa → el bot deja de responder preguntas y asistencia.
// - !activa → vuelve a responder.
// - !info → estado actual: horario, costos, próximo evento y pausa.
// - !recordatorio → manda ahora mismo el recordatorio del próximo evento.
// - !grupo → este grupo pasa a ser EL grupo del bot (Ronda 7): solo ahí
//   contesta y manda avisos; en los demás grupos se ignora. En privado
//   sigue contestando igual.
// - !grupos → lista los grupos que el bot conoce y cuál es el elegido.
// No hay "!aviso <texto>": el coach ya puede escribir directo en el
// grupo, no aporta nada.
//
// Los avisos programados SIGUEN saliendo aunque el bot esté en pausa:
// son anuncios del coach, no respuestas a preguntas.

const pausa = require('./pausa')
const avisos = require('./avisos')
const asistencia = require('./asistencia')
const canal = require('./canal')
const grupoElegido = require('./grupoelegido')
const config = require('./config')
const { HORARIO, COSTOS } = require('./respuestas')

// Atiende un comando del coach. Devuelve el texto para responder en el
// grupo, o null si ya se mandó el mensaje (como el recordatorio).
// opciones (solo para las pruebas): { ahora, archivoAsistencia, archivoPausa, archivoGrupoElegido, archivoGrupos }.
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
    return `🤖 *Bot del equipo — ${estado}*\n\n${HORARIO}\n\n${COSTOS}\n\nPróximo: ${evento.nombre}${evento.hora ? ` (${evento.hora})` : ''} — ${avisos.textoConfirmados(total, nombres)}`
  }

  if (cmd === '!recordatorio') {
    // El recordatorio va solo al grupo donde el coach lo pidió, no a
    // todos los grupos que el bot conoce.
    const mensaje = avisos.mensajeRecordatorioProximo(ahora, opciones.archivoAsistencia)
    await sock.sendMessage(chatId, { text: mensaje })
    return null
  }

  if (cmd === '!grupo') {
    // El grupo donde el coach manda esto pasa a ser EL grupo del bot.
    if (!canal.esGrupo(chatId)) return 'Mándame !grupo dentro del grupo del equipo, no en privado: ahí es donde el bot tiene que trabajar.'
    if (config.grupoId) return 'El grupo está fijado en config.js; !grupo no lo cambia. Pídele a Mich que lo cambie ahí.'
    grupoElegido.guardar(chatId, opciones.archivoGrupoElegido)
    let nombre = chatId
    try {
      const meta = await sock.groupMetadata(chatId)
      if (meta && meta.subject) nombre = meta.subject
    } catch { /* si no se puede leer el nombre, se muestra el ID */ }
    return `Listo, coach. Este es el grupo del bot: ${nombre}. Aquí seguiré mandando avisos y atendiendo voy / no voy / lista. En los demás grupos ya no contesto ni mando avisos.`
  }

  if (cmd === '!grupos') {
    const elegidoId = grupoElegido.elegido(config, opciones.archivoGrupoElegido)
    const conocidos = avisos.cargarGrupos(opciones.archivoGrupos)
    const ids = [...new Set([elegidoId, ...conocidos].filter(Boolean))]
    if (ids.length === 0) return 'Todavía no conozco ningún grupo.'
    const lineas = []
    for (const id of ids) {
      let nombre = id
      try {
        const meta = await sock.groupMetadata(id)
        if (meta && meta.subject) nombre = meta.subject
      } catch { /* si no se puede leer el nombre, se muestra el ID */ }
      lineas.push(`• ${nombre}${id === elegidoId ? ' — grupo del bot' : ''}`)
    }
    return `Grupos que conozco:\n\n${lineas.join('\n')}`
  }

  return 'Comandos del coach: !pausa, !activa, !info, !recordatorio, !grupo, !grupos'
}

module.exports = { manejarComando }
