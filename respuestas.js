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

// Categorías por edad — Ronda 6 (16/11, datos del coach Stephen Mercado).
// Rangos dados por el coach. "Chupón" es la categoría de 4 a 7 años
// (Mich escribió "cupón"; se usa Chupón, el nombre habitual en básquet
// infantil — si el coach la llama distinto, se corrige aquí).
const CATEGORIAS = [
  { min: 4, max: 7, nombre: 'Chupón' },
  { min: 8, max: 9, nombre: 'Benjamín' },
  { min: 10, max: 11, nombre: 'Infantil' },
  { min: 12, max: 13, nombre: 'U-13' },
  { min: 14, max: 15, nombre: 'U-15' },
  { min: 16, max: 17, nombre: 'U-17' },
  { min: 18, max: 19, nombre: 'U-19' },
  { min: 20, max: 21, nombre: 'Sub-21' },
  { min: 22, max: 22, nombre: 'Sub-22' },
]

const LISTA_CATEGORIAS = 'Categorías por edad:\n'
  + '• Chupón: 4 a 7 años\n'
  + '• Benjamín: 8 a 9 años\n'
  + '• Infantil: 10 a 11 años\n'
  + '• U-13: 12 a 13 años\n'
  + '• U-15: 14 a 15 años\n'
  + '• U-17: 16 a 17 años\n'
  + '• U-19: 18 a 19 años\n'
  + '• Sub-21: 20 a 21 años\n'
  + '• Sub-22: 22 años\n'
  + '• Categoría Libre: 23 años en adelante'

// ¿En qué categoría cae esta edad? Devuelve { nombre, rango } o null si
// es menor de 4 años (el equipo recibe desde los 4).
function categoriaParaEdad(edad) {
  if (typeof edad !== 'number' || !Number.isFinite(edad)) return null
  for (const c of CATEGORIAS) {
    if (edad >= c.min && edad <= c.max) {
      return { nombre: c.nombre, rango: c.min === c.max ? `${c.min} años` : `${c.min} a ${c.max} años` }
    }
  }
  if (edad >= 23) return { nombre: 'Categoría Libre', rango: '23 años en adelante' }
  return null
}

const MENU = '🏀 Bot del equipo\n'
  + 'Pregúntame por:\n'
  + '• horario — entrenamientos y juegos\n'
  + '• costos — mensualidad, semana y por clase\n'
  + '• juegos — partidos del domingo\n'
  + '• ubicación — dónde entrenamos\n'
  + '• entrar al equipo — inscripción $100 anuales, primer entreno gratis\n'
  + '• qué llevar — hidratación, ropa deportiva y balón\n'
  + '• categorías — Chupón, Benjamín, Infantil, U-13 a Sub-22 y Libre\n'
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
// - Categorías va antes que inscripción: "¿qué categoría le toca a mi
//   hijo de 10 años para entrar?" debe responder las categorías, no la
//   inscripción.
// - Inscripción va antes que "gracias": "gracias, ¿cómo me inscribo?"
//   debe responder lo de inscribirse.
// - Menú va AL FINAL: "Hola, ¿cuánto cuesta?" responde costos, no el menú.
//   "Hola" solo sí responde el menú.
// - "Gracias" va justo antes del menú: "gracias, ¿cuánto cuesta?"
//   responde costos, no "de nada".
const reglas = [
  { claves: ['donde', 'ubicacion', 'hubicacion', 'lugar', 'cancha', 'direccion'], respuesta: 'La ubicación es Berriozabal Manzana 001, Los Héroes Coacalco, 55712 San Francisco Coacalco, Méx.' },
  { claves: ['llevar', 'llevo'], respuesta: 'Hidratación, ropa deportiva y balón de basketball.' },
  { claves: ['categoria', 'chupon', 'benjamin', 'infantil', 'u-13', 'u-15', 'u-17', 'u-19', 'u13', 'u15', 'u17', 'u19', 'sub-21', 'sub-22', 'sub 21', 'sub 22', 'libre'], respuesta: LISTA_CATEGORIAS },
  { claves: ['horario', 'orario', 'entrenamiento', 'entrenan', 'cuando'], respuesta: HORARIO },
  { claves: ['costo', 'precio', 'cuanto', 'mensualidad', 'semana', 'clase', 'pagar', 'pago', 'cuesta'], respuesta: COSTOS },
  { claves: ['juego', 'partido', 'domingo'], respuesta: 'Los juegos son los domingos. Entrenamientos de lunes a viernes, 3:30 a 5:30 pm.' },
  { claves: ['coach', 'entrenador', 'profe'], respuesta: 'El coach es Stephen Mercado. Si necesitas algo, escríbele directo en el grupo y te contesta.' },
  { claves: ['inscrib', 'entrar al equipo', 'quiero entrar', 'me quiero unir', 'quiero unirme', 'como entro'], respuesta: 'La inscripción es de $100 anuales y el primer entrenamiento es de cortesía, gratis.\n' + COSTOS },
  { claves: ['gracias'], respuesta: '¡De nada! Nos vemos en el entreno. 🏀' },
  { claves: ['menu', 'ayuda', 'info', 'hola', 'bot'], respuesta: MENU },
]

module.exports = { reglas, extraerTexto, normalizar, HORARIO, COSTOS, MENU, categoriaParaEdad, LISTA_CATEGORIAS }
