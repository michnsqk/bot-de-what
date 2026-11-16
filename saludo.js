// Saludo de bienvenida — Ronda 5 (15/11, pedido de Mich).
// WhatsApp no avisa cuando alguien solo ABRE el chat, así que el saludo
// sale con el primer mensaje de cada persona nueva en privado: si escribe
// algo que el bot no entiende, en vez de callar le muestra el menú.
// Si su mensaje sí tiene respuesta (horario, costos, "voy"...), se le
// responde eso y el saludo queda para la primera vez que no entienda.
// En grupos nunca saluda (sería spam para 30 personas). Si el bot está
// en pausa, tampoco saluda: la pausa manda.

const fs = require('fs')
const path = require('path')
const { normalizar } = require('./respuestas')

const ARCHIVO = process.env.SALUDADOS_ARCHIVO || path.join(__dirname, 'data', 'saludados.json')

// Mensaje de bienvenida — Ronda 6 (16/11, texto del coach Stephen Mercado).
// Se le muestra en privado a quien escribe por primera vez (si su mensaje
// no tiene respuesta) y se le pide el nombre y la edad del jugador para
// decirle su categoría. Queda marcado como "esperando datos" hasta que
// responda con nombre y edad (ver categorias.js).
const BIENVENIDA = '🏀 ¡Bienvenido a Hechiceros Coacalco!\n'
  + '\n'
  + 'Gracias por contactarnos.\n'
  + '\n'
  + 'Cuéntanos el nombre y edad del jugador, y te compartimos nuestros horarios y categorías disponibles.'

// Qué se le contesta en el grupo a quien saluda por primera vez: el
// saludo completo con nombre y edad va en privado (en un grupo de 30 no
// se pide el nombre y la edad de un menor), así que se le invita a
// escribir en privado. Solo una vez por persona.
const FUNNEL_GRUPO = '🏀 ¡Hola! Soy el bot de Hechiceros Coacalco.\n'
  + '\n'
  + 'Para inscribir a un jugador, escríbenos en privado a este número con su nombre y edad, y te decimos su categoría y horarios.'

const ARCHIVO_ESPERANDO = process.env.ESPERANDO_DATOS_ARCHIVO || path.join(__dirname, 'data', 'esperando-datos.json')

// Saludos en grupo: lista aparte de la de privado. Si se usara la misma,
// alguien que saludó en el grupo ya no recibiría la bienvenida cuando
// escribiera en privado (y ahí es donde va el flujo de nombre y edad).
const ARCHIVO_GRUPO = process.env.SALUDADOS_GRUPO_ARCHIVO || path.join(__dirname, 'data', 'saludados-grupo.json')

// Escritura atómica: se escribe un temporal y se renombra, igual que en
// pausa.js y asistencia.js, para no dejar el archivo a medias.
function guardar(archivo, lista) {
  fs.mkdirSync(path.dirname(archivo), { recursive: true })
  const tmp = `${archivo}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(lista, null, 2) + '\n')
  fs.renameSync(tmp, archivo)
}

function cargar(archivo = ARCHIVO) {
  try {
    const datos = JSON.parse(fs.readFileSync(archivo, 'utf8'))
    return Array.isArray(datos) ? datos : []
  } catch {
    return []
  }
}

// ¿A esta persona ya se le mostró el menú de bienvenida?
function yaSaludado(remitente, archivo = ARCHIVO) {
  return cargar(archivo).includes(remitente)
}

// Guarda que ya se le mostró el menú. Escritura atómica, igual que en
// pausa.js y asistencia.js.
function marcarSaludado(remitente, archivo = ARCHIVO) {
  const lista = cargar(archivo)
  if (lista.includes(remitente)) return false
  lista.push(remitente)
  guardar(archivo, lista)
  return true
}

// ¿A esta persona ya se le pidieron el nombre y la edad del jugador y
// todavía no responde? Se marca al mandarle la bienvenida y se quita
// cuando contesta con nombre y edad.
function cargarEsperando(archivo = ARCHIVO_ESPERANDO) {
  try {
    const datos = JSON.parse(fs.readFileSync(archivo, 'utf8'))
    return Array.isArray(datos) ? datos : []
  } catch {
    return []
  }
}

function esperandoDatos(remitente, archivo = ARCHIVO_ESPERANDO) {
  return cargarEsperando(archivo).includes(remitente)
}

function marcarEsperandoDatos(remitente, archivo = ARCHIVO_ESPERANDO) {
  const lista = cargarEsperando(archivo)
  if (lista.includes(remitente)) return false
  lista.push(remitente)
  guardar(archivo, lista)
  return true
}

function quitarEsperandoDatos(remitente, archivo = ARCHIVO_ESPERANDO) {
  const lista = cargarEsperando(archivo)
  if (!lista.includes(remitente)) return false
  guardar(archivo, lista.filter((r) => r !== remitente))
  return true
}

// ¿Toca saludar a esta persona en este chat? Solo en privado, solo la
// primera vez. Si soloGrupos es true no hay privados que saludar.
function debeSaludar(chatId, remitente, config, archivo = ARCHIVO) {
  if (typeof chatId !== 'string' || chatId.endsWith('@g.us')) return false
  if (config.soloGrupos) return false
  if (!remitente) return false
  return !yaSaludado(remitente, archivo)
}

// ¿El mensaje es solo un saludo ("hola", "buenas tardes")? Sirve para
// saludar a quien escribe por primera vez en vez de soltarle el menú.
// Tiene que ser SOLO el saludo: "hola, ¿cuánto cuesta?" es una pregunta,
// no un saludo, y se responde con los costos.
const SALUDOS = ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'buen dia', 'hello', 'hey', 'que tal', 'saludos', 'hola bot', 'bot hola']

function esSaludo(texto) {
  if (typeof texto !== 'string' || !texto.trim()) return false
  const limpio = normalizar(texto).replace(/[^a-zñ ]/g, '').replace(/\s+/g, ' ').trim()
  return SALUDOS.includes(limpio)
}

// Saludos en grupo: ¿a esta persona ya se le invitó al privado una vez?
function yaSaludadoGrupo(remitente, archivo = ARCHIVO_GRUPO) {
  return cargar(archivo).includes(remitente)
}

function marcarSaludadoGrupo(remitente, archivo = ARCHIVO_GRUPO) {
  const lista = cargar(archivo)
  if (lista.includes(remitente)) return false
  lista.push(remitente)
  guardar(archivo, lista)
  return true
}

module.exports = { yaSaludado, marcarSaludado, debeSaludar, BIENVENIDA, FUNNEL_GRUPO, esSaludo, esperandoDatos, marcarEsperandoDatos, quitarEsperandoDatos, yaSaludadoGrupo, marcarSaludadoGrupo }
