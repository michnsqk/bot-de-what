// Datos del equipo — EDITA AQUÍ cuando el coach cambie algo.
// El bot responde solo con lo que está en este archivo: si algo no está
// aquí, no lo inventa, dice que le pregunten al coach.
// También vive aquí extraerTexto: saca el texto de un mensaje, venga como
// venga (texto, respuesta a otro mensaje, o pie de foto/video).

// Saca el texto de un mensaje de WhatsApp. Si es foto, video o sticker
// sin texto, devuelve ''.
function extraerTexto(msg) {
  const m = msg.message || {}
  return m.conversation
    || m.extendedTextMessage?.text
    || m.imageMessage?.caption
    || m.videoMessage?.caption
    || ''
}

const HORARIO = 'Entrenamientos: lunes a viernes, 3:30 a 5:30 pm.\nJuegos: los domingos.'

const COSTOS = 'Mensualidad: $500\nSemana: $150\nPor clase: $70'

const MENU = '🏀 Bot del equipo\n'
  + 'Pregúntame por:\n'
  + '• horario — entrenamientos y juegos\n'
  + '• costos — mensualidad, semana y por clase\n'
  + '• juegos — partidos del domingo\n'
  + '• ubicación — dónde entrenamos\n'
  + '• voy — confirmar asistencia al próximo evento\n'
  + '• no voy — quitarme de la lista\n'
  + '• lista — ver quiénes van al próximo evento\n'
  + '• próximo — cuándo es el próximo entreno o juego\n'
  + '• coach — quién es el coach'

// Cada regla: si el mensaje contiene alguna de sus claves, el bot
// responde con ese texto. Si ninguna regla coincide, el bot no contesta
// (para no spamear el grupo).
//
// EL ORDEN IMPORTA: lo específico va primero y lo general al final.
// - Ubicación va antes que horario: "¿dónde entrenan?" debe responder
//   lo de la ubicación, no el horario (la palabra "entrenan" está en ambas).
// - Menú va AL FINAL: "Hola, ¿cuánto cuesta?" responde costos, no el menú.
//   "Hola" solo sí responde el menú.
const reglas = [
  { claves: ['donde', 'ubicacion', 'lugar', 'cancha', 'direccion'], respuesta: 'La ubicación aún no está cargada en el bot. Pregúntale directo al coach.' },
  { claves: ['horario', 'entrenamiento', 'entrenan', 'cuando'], respuesta: HORARIO },
  { claves: ['costo', 'precio', 'cuanto', 'mensualidad', 'semana', 'clase', 'pagar', 'pago', 'cuesta'], respuesta: COSTOS },
  { claves: ['juego', 'partido', 'domingo'], respuesta: 'Los juegos son los domingos. Entrenamientos de lunes a viernes, 3:30 a 5:30 pm.' },
  { claves: ['coach', 'entrenador', 'profe'], respuesta: 'El coach es Javier. Si necesitas algo, escríbele directo en el grupo y te contesta.' },
  { claves: ['menu', 'ayuda', 'info', 'hola', 'bot'], respuesta: MENU },
]

module.exports = { reglas, extraerTexto }
