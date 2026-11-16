// Nombre y edad del jugador → su categoría — Ronda 6 (16/11).
// Cuando alguien nuevo escribe en privado, el saludo le pide el nombre y
// la edad; con eso el bot le dice su categoría, los horarios y cómo
// entrar al equipo. Solo se usa en privado (ver index.js): en el grupo,
// "categorías" responde la lista completa (FAQ en respuestas.js).

const { normalizar, categoriaParaEdad } = require('./respuestas')

// Saca el nombre y la edad de un mensaje como "Juan, 12 años",
// "Pedro 10" o "Se llama Ana, tiene 8 años". Devuelve { nombre, edad }
// o null si no trae una edad clara.
//
// Para no confundir una hora o un número suelto con una edad, el número
// tiene que venir acompañado de "años", "tiene" o una coma, o el mensaje
// tiene que ser solo "nombre + edad" ("Pedro 10"). Un mensaje con ":"
// es una hora ("llego a las 5:30"), nunca una edad.
function extraerNombreEdad(texto) {
  if (typeof texto !== 'string' || !texto.trim()) return null
  const limpio = normalizar(texto)
  if (limpio.includes(':')) return null
  const numeros = limpio.match(/\b\d{1,2}\b/g)
  if (!numeros) return null
  const edad = parseInt(numeros[0], 10)
  if (edad < 3 || edad > 99) return null
  const tieneSenal = limpio.includes('ano') || limpio.includes('tiene') || limpio.includes(',')
    || /^\D{1,30}\s+\d{1,2}\s*$/.test(limpio)
    || /^\d{1,2}\s*(anos?)?\s*$/.test(limpio)
  if (!tieneSenal) return null
  const nombre = texto
    .replace(/\b\d{1,2}\b/g, '')
    .replace(/\baños?\b/gi, '')
    .replace(/\b(se llama|me llamo|mi hijo|mi hija|mi hermano|mi hermana|hermano|hermana|tengo|tiene|llama|llamo|es|me)\b/gi, '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || null
  return { nombre, edad }
}

// Respuesta completa para un jugador nuevo: su categoría, horarios,
// inscripción y qué llevar. Todo con datos del coach, nada inventado.
function mensajeCategoria(nombre, edad) {
  const categoria = categoriaParaEdad(edad)
  if (!categoria) {
    return 'El equipo recibe jugadores desde los 4 años. Si tiene menos, pregúntale directo al coach Stephen Mercado en el grupo.'
  }
  const quien = nombre ? `${nombre} queda` : 'Queda'
  return `¡Perfecto! ${quien} en la categoría *${categoria.nombre}* (${categoria.rango}).\n`
    + '\n'
    + 'Entrenamientos: lunes a viernes, 3:30 a 5:30 pm. Juegos: los domingos.\n'
    + '\n'
    + 'Para entrar al equipo: inscripción de $100 anuales y el primer entrenamiento es de cortesía, gratis.\n'
    + '\n'
    + 'Hay que llevar: hidratación, ropa deportiva y balón de basketball.\n'
    + '\n'
    + 'Mensualidad: $500. Semana: $150. Por clase: $70'
}

module.exports = { extraerNombreEdad, mensajeCategoria }
