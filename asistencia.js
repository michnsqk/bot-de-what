// Asistencia — Fase 2.
// "voy" anota a la persona para el próximo evento; "no voy" la quita;
// "lista" muestra quiénes van.
//
// Dónde se guarda: data/asistencia.json. Es un archivo
// simple (sin base de datos): la clave es el evento
// ("entreno-2026-11-11" o "juego-2026-11-15") y el valor es la lista de
// personas { telefono, nombre }.
// NUNCA se sube al repo (está en .gitignore): tiene nombres y teléfonos
// del equipo.
//
// Qué es "el próximo evento":
// - Entreno: lunes a viernes, 3:30 a 5:30 pm. Si ya pasó la hora (después
//   de las 5:30), el próximo es el del día siguiente.
// - Juego: domingo (sin hora fija, el coach no la pasó).
// - Sábado: el próximo evento es el juego del domingo.
// Cada evento tiene su propia lista: al cambiar de día, la lista es nueva.
//
// Reglas de oro:
// - Una persona solo se anota una vez por evento (se identifica por su
//   número, no por su nombre).
// - "voy" significa el próximo evento, no pregunta cuál: en el grupo la
//   gente escribe "voy" y ya.
// - Si el bot no entiende, no contesta (igual que en la Fase 1).

const fs = require('fs')
const path = require('path')

const ARCHIVO = process.env.ASISTENCIA_ARCHIVO || path.join(__dirname, 'data', 'asistencia.json')

// Palabras que activan cada intención. Se revisan en este orden:
// cancelar primero ("no voy" contiene "voy"), luego confirmar, luego lista.
const INTENCIONES = {
  cancelar: ['no voy', 'no puedo', 'no asisto', 'me bajo', 'cancelo', 'no voy a ir'],
  confirmar: ['confirmo', 'asisto', 'me apunto', 'apuntame'],
  lista: ['lista', 'quienes van', 'quien va', 'cuantos van', 'asistencia'],
}

// Detecta la intención en un texto ya normalizado (minúsculas, sin acentos).
function detectarIntencion(texto) {
  for (const clave of INTENCIONES.cancelar) {
    if (texto.includes(clave)) return 'cancelar'
  }
  if (esConfirmar(texto)) return 'confirmar'
  for (const clave of INTENCIONES.confirmar) {
    if (texto.includes(clave)) return 'confirmar'
  }
  for (const clave of INTENCIONES.lista) {
    if (texto.includes(clave)) return 'lista'
  }
  return null
}

// ¿El mensaje confirma asistencia? "voy" solo, "yo voy", "voy al entreno".
// "me voy de vacaciones" o "ya me voy" es irse, NO confirmar...
// ...salvo "me voy al entreno/juego" o "me voy a entrenar": ir al evento
// sí es confirmar.
function esConfirmar(texto) {
  if (!/\bvoy\b/.test(texto)) return false
  if (/me\s+voy\b/.test(texto)
    && !/me\s+voy\s+al\b/.test(texto)
    && !/me\s+voy\s+a\s/.test(texto)) return false
  return true
}

// "Ahora" en hora de México, sin importar la zona del servidor.
// En Railway el servidor está en UTC: las 13:00 de México son las 19:00 UTC,
// y sin esto un "voy" de la 1 pm caería en el evento del día siguiente.
// Se lee con Intl (fecha civil de México) y se avanza de día en día en UTC,
// así el resultado no depende de dónde corra el bot.
const ZONA_MEXICO = 'America/Mexico_City'

function partesMexico(ahora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_MEXICO,
    weekday: 'short',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(ahora)
  const get = (t) => partes.find((p) => p.type === t).value
  const dias = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    diaSemana: dias[get('weekday')],
    minutos: Number(get('hour')) * 60 + Number(get('minute')),
    y: Number(get('year')),
    m: Number(get('month')),
    d: Number(get('day')),
  }
}

// El próximo evento a partir de una fecha (por defecto: ahora, en México).
// tipoDeseado: null (cualquiera), 'entreno' o 'juego'.
// Devuelve { tipo, clave, nombre, hora } o null si algo raro pasa.
function buscarEvento(ahora, tipoDeseado) {
  let { y, m, d, diaSemana, minutos } = partesMexico(ahora)
  for (let i = 0; i < 8; i++) {
    const dia = diaSemana // 0 dom, 1 lun, ..., 6 sáb
    const esDomingo = dia === 0
    const esEntreno = dia >= 1 && dia <= 5 // lun–vie
    const tipo = esDomingo ? 'juego' : (esEntreno ? 'entreno' : null)
    if (tipo && (!tipoDeseado || tipo === tipoDeseado)) {
      if (i === 0 && tipo === 'entreno') {
        // Hoy es entreno: solo vale si aún no terminó (antes de las 5:30 pm).
        if (minutos < 17 * 60 + 30) return armarEvento({ y, m, d }, 'entreno')
        // Ya terminó: sigue buscando el siguiente día.
      } else {
        return armarEvento({ y, m, d }, tipo)
      }
    }
    // Avanza un día (en UTC para no depender de la zona del servidor).
    const sig = new Date(Date.UTC(y, m - 1, d + 1))
    y = sig.getUTCFullYear()
    m = sig.getUTCMonth() + 1
    d = sig.getUTCDate()
    diaSemana = sig.getUTCDay()
  }
  return null
}

function proximoEvento(ahora = new Date()) {
  return buscarEvento(ahora, null)
}

function proximoJuego(ahora = new Date()) {
  return buscarEvento(ahora, 'juego')
}

function proximoEntreno(ahora = new Date()) {
  return buscarEvento(ahora, 'entreno')
}

// ¿Para qué evento es el mensaje? "voy al juego" → 'juego',
// "lista del entreno" → 'entreno', "voy" solo → null (el próximo).
// Se usa para confirmar, cancelar y ver la lista de ese evento.
function eventoPedido(texto) {
  if (texto.includes('juego') || texto.includes('partido') || texto.includes('domingo')) return 'juego'
  if (texto.includes('entreno') || texto.includes('entrenar')) return 'entreno'
  return null
}

// ¿El mensaje pregunta por el próximo evento? ("¿cuándo es el próximo
// juego?", "qué sigue", "cuándo jugamos"...). 'cuando' solo no basta:
// "¿a qué hora entrenan?" es horario, no próximo evento.
function esPreguntaProximo(texto) {
  return texto.includes('proximo')
    || texto.includes('siguiente')
    || texto.includes('que sigue')
    || (texto.includes('cuando') && (texto.includes('juego') || texto.includes('partido')))
}

// El texto con el que el bot responde a "¿cuándo es el próximo evento?".
function mensajeProximo(ahora = new Date(), archivo = ARCHIVO) {
  const { evento, total } = lista(ahora, archivo)
  return `El próximo evento es el ${evento.nombre}${evento.hora ? ` (${evento.hora})` : ''}. Van ${total} confirmados. Escribe "voy" para confirmar.`
}

function armarEvento({ y, m, d }, tipo) {
  const etiqueta = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(Date.UTC(y, m - 1, d)))
  return {
    tipo,
    clave: `${tipo}-${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    nombre: tipo === 'entreno' ? `entreno del ${etiqueta}` : `juego del ${etiqueta}`,
    hora: tipo === 'entreno' ? '3:30 a 5:30 pm' : null,
  }
}

function cargar(archivo = ARCHIVO) {
  try {
    return JSON.parse(fs.readFileSync(archivo, 'utf8'))
  } catch {
    return {}
  }
}

function guardar(datos, archivo = ARCHIVO) {
  fs.mkdirSync(path.dirname(archivo), { recursive: true })
  // Escritura atómica: primero a un temporal y luego se renombra. Si el
  // proceso muere a la mitad, el archivo original queda intacto.
  const tmp = `${archivo}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(datos, null, 2) + '\n')
  fs.renameSync(tmp, archivo)
}

// Anota a una persona para un evento.
// tipo: null (el próximo evento), 'entreno' (el próximo entreno) o
// 'juego' (el próximo juego). Así "voy al juego" anota para el domingo
// aunque el próximo evento sea un entreno.
// Devuelve { estado: 'nuevo' | 'ya', evento, total }.
function confirmar(telefono, nombre, ahora = new Date(), archivo = ARCHIVO, tipo = null) {
  const evento = tipo === 'juego' ? proximoJuego(ahora)
    : tipo === 'entreno' ? proximoEntreno(ahora)
    : proximoEvento(ahora)
  const datos = cargar(archivo)
  const lista = datos[evento.clave] || []
  if (lista.some((p) => p.telefono === telefono)) {
    return { estado: 'ya', evento, total: lista.length }
  }
  lista.push({ telefono, nombre })
  datos[evento.clave] = lista
  guardar(datos, archivo)
  return { estado: 'nuevo', evento, total: lista.length }
}

// Quita a una persona de la lista de un evento.
// tipo: igual que en confirmar (null = el próximo evento).
// Devuelve { estado: 'quitado' | 'no-estaba', evento, total }.
function cancelar(telefono, ahora = new Date(), archivo = ARCHIVO, tipo = null) {
  const evento = tipo === 'juego' ? proximoJuego(ahora)
    : tipo === 'entreno' ? proximoEntreno(ahora)
    : proximoEvento(ahora)
  const datos = cargar(archivo)
  const lista = datos[evento.clave] || []
  const nueva = lista.filter((p) => p.telefono !== telefono)
  if (nueva.length === lista.length) {
    return { estado: 'no-estaba', evento, total: lista.length }
  }
  datos[evento.clave] = nueva
  guardar(datos, archivo)
  return { estado: 'quitado', evento, total: nueva.length }
}

// La lista de un evento. Devuelve { evento, nombres, total }.
// Sin eventoFijo es el próximo evento; con eventoFijo ("lista del juego")
// es ese evento.
function lista(ahora = new Date(), archivo = ARCHIVO, eventoFijo = null) {
  const evento = eventoFijo || proximoEvento(ahora)
  const datos = cargar(archivo)
  const personas = datos[evento.clave] || []
  return { evento, nombres: personas.map((p) => p.nombre), total: personas.length }
}

module.exports = { detectarIntencion, eventoPedido, proximoEvento, proximoJuego, proximoEntreno, esPreguntaProximo, mensajeProximo, confirmar, cancelar, lista }
