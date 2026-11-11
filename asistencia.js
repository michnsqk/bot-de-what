// Asistencia — Fase 2.
// "voy" anota a la persona para el próximo evento; "no voy" la quita;
// "lista" muestra quiénes van.
//
// Dónde se guarda: asistencia.json, en esta misma carpeta. Es un archivo
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

const ARCHIVO = process.env.ASISTENCIA_ARCHIVO || path.join(__dirname, 'asistencia.json')

// Palabras que activan cada intención. Se revisan en este orden:
// cancelar primero ("no voy" contiene "voy"), luego confirmar, luego lista.
const INTENCIONES = {
  cancelar: ['no voy', 'no puedo', 'no asisto', 'me bajo', 'cancelo', 'no voy a ir'],
  confirmar: ['confirmo', 'asisto', 'me apunto', 'apuntame'],
  lista: ['lista', 'quienes van', 'quien va', 'cuantos van', 'asistencia'],
}

// Detecta la intención en un texto ya normalizado (minúsculas, sin acentos).
// "voy" se busca como palabra completa: "voy al entreno" sí, "voy" solo sí.
// Ojo: "me voy de vacaciones" también cuenta como confirmar; en el grupo
// del equipo casi nadie escribe eso, y si pasa, se quita con "no voy".
function detectarIntencion(texto) {
  for (const clave of INTENCIONES.cancelar) {
    if (texto.includes(clave)) return 'cancelar'
  }
  if (/\bvoy\b/.test(texto)) return 'confirmar'
  for (const clave of INTENCIONES.confirmar) {
    if (texto.includes(clave)) return 'confirmar'
  }
  for (const clave of INTENCIONES.lista) {
    if (texto.includes(clave)) return 'lista'
  }
  return null
}

// El próximo evento a partir de una fecha (por defecto: ahora).
// Devuelve { tipo, clave, nombre, hora } o null si algo raro pasa.
function proximoEvento(ahora = new Date()) {
  const fecha = new Date(ahora)
  for (let i = 0; i < 8; i++) {
    const dia = fecha.getDay() // 0 dom, 1 lun, ..., 6 sáb
    const esDomingo = dia === 0
    const esEntreno = dia >= 1 && dia <= 5 // lun–vie
    if (esDomingo || esEntreno) {
      if (i === 0 && esEntreno) {
        // Hoy es entreno: solo vale si aún no terminó (antes de las 5:30 pm).
        const minutos = fecha.getHours() * 60 + fecha.getMinutes()
        if (minutos < 17 * 60 + 30) return armarEvento(fecha, 'entreno')
        // Ya terminó: sigue buscando el siguiente día.
      } else {
        return armarEvento(fecha, esDomingo ? 'juego' : 'entreno')
      }
    }
    fecha.setDate(fecha.getDate() + 1)
  }
  return null
}

function armarEvento(fecha, tipo) {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  const etiqueta = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(fecha)
  return {
    tipo,
    clave: `${tipo}-${y}-${m}-${d}`,
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
  fs.writeFileSync(archivo, JSON.stringify(datos, null, 2) + '\n')
}

// Anota a una persona para el próximo evento.
// Devuelve { estado: 'nuevo' | 'ya', evento, total }.
function confirmar(telefono, nombre, ahora = new Date(), archivo = ARCHIVO) {
  const evento = proximoEvento(ahora)
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

// Quita a una persona de la lista del próximo evento.
// Devuelve { estado: 'quitado' | 'no-estaba', evento, total }.
function cancelar(telefono, ahora = new Date(), archivo = ARCHIVO) {
  const evento = proximoEvento(ahora)
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

// La lista del próximo evento. Devuelve { evento, nombres, total }.
function lista(ahora = new Date(), archivo = ARCHIVO) {
  const evento = proximoEvento(ahora)
  const datos = cargar(archivo)
  const personas = datos[evento.clave] || []
  return { evento, nombres: personas.map((p) => p.nombre), total: personas.length }
}

module.exports = { detectarIntencion, proximoEvento, confirmar, cancelar, lista }
