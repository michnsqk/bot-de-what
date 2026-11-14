// Datos del equipo — EDITA AQUÍ cuando el coach cambie algo.
// El bot responde solo con lo que está en este archivo: si algo no está
// aquí, no lo inventa, dice que le pregunten al coach.
// También viven aquí extraerTexto y normalizar: extraerTexto saca el texto
// de un mensaje, venga como venga (texto, respuesta a otro mensaje, o pie
// de foto/video); normalizar lo deja listo para comparar.

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

// Normaliza un mensaje para compararlo: minúsculas, sin acentos y con las
// abreviaturas de chat escritas completas ("q" → "que", "xq" → "porque").
// Solo palabras completas: la "q" de "queso" no se toca.
const ABREVIATURAS = [
  [/\bq\b/g, 'que'],
  [/\b(xq|pq)\b/g, 'porque'],
  [/\btmb\b/g, 'tambien'],
]

function normalizar(texto) {
  let limpio = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  for (const [patron, completa] of ABREVIATURAS) {
    limpio = limpio.replace(patron, completa)
  }
  return limpio
}

const HORARIO = 'Entrenamientos: lunes a viernes, 3:30 a 5:30 pm.\nJuegos: los domingos.'

const COSTOS = 'Mensualidad: $500\nSemana: $150\nPor clase: $70'

const MENU = '🏀 Bot del equipo\n'
  + 'Pregúntame por:\n'
  + '• horario — entrenamientos y juegos\n'
  + '• costos — mensualidad, semana y por clase\n'
  + '• juegos — partidos del domingo\n'
  + '• ubicación — dónde entrenamos\n'
  + '• entrar al equipo — cómo inscribirse\n'
  + '• qué llevar — pregúntale al coach\n'
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
// - "Qué llevar" va antes que horario: "qué llevo al entrenamiento"
//   pregunta qué llevar, no a qué hora es.
// - Inscripción va antes que "gracias": "gracias, ¿cómo me inscribo?"
//   debe responder lo de inscribirse.
// - Menú va AL FINAL: "Hola, ¿cuánto cuesta?" responde costos, no el menú.
//   "Hola" solo sí responde el menú.
// - "Gracias" va justo antes del menú: "gracias, ¿cuánto cuesta?"
//   responde costos, no "de nada".
const reglas = [
  { claves: ['donde', 'ubicacion', 'hubicacion', 'lugar', 'cancha', 'direccion'], respuesta: 'La ubicación aún no está cargada en el bot. Pregúntale directo al coach.' },
  { claves: ['llevar', 'llevo'], respuesta: 'Pregúntale directo al coach Javier en el grupo, él te dice qué llevar.' },
  { claves: ['horario', 'orario', 'entrenamiento', 'entrenan', 'cuando'], respuesta: HORARIO },
  { claves: ['costo', 'precio', 'cuanto', 'mensualidad', 'semana', 'clase', 'pagar', 'pago', 'cuesta'], respuesta: COSTOS },
  { claves: ['juego', 'partido', 'domingo'], respuesta: 'Los juegos son los domingos. Entrenamientos de lunes a viernes, 3:30 a 5:30 pm.' },
  { claves: ['coach', 'entrenador', 'profe'], respuesta: 'El coach es Javier. Si necesitas algo, escríbele directo en el grupo y te contesta.' },
  { claves: ['inscrib', 'entrar al equipo', 'quiero entrar', 'me quiero unir', 'quiero unirme', 'como entro'], respuesta: 'Para entrar al equipo, habla directo con el coach Javier en el grupo. Él te dice cómo inscribirte.\n' + COSTOS },
  { claves: ['gracias'], respuesta: '¡De nada! Nos vemos en el entreno. 🏀' },
  { claves: ['menu', 'ayuda', 'info', 'hola', 'bot'], respuesta: MENU },
]

module.exports = { reglas, extraerTexto, normalizar, HORARIO, COSTOS }
