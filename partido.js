// Partido anunciado por el coach — Ronda 7 (20/11, pedido de Mich).
// El coach avisa el partido en el grupo bueno con un mensaje normal
// ("jugamos el domingo a las 1:00 Hechiceros vs Rezball") y el bot lo
// lee: saca el día, la hora y el rival, confirma lo que entendió y crea
// tres recordatorios: 12 h, 2 h y 30 min antes del partido.
// El de 12 h nunca sale de noche: si cae entre las 10 pm y las 8 am,
// sale a las 8 am (decisión de Mich 20/11).
// El partido y sus recordatorios viven en data/partido.json, así
// sobreviven a reinicios: al arrancar, el bot rearma los que falten.
// Si el coach anuncia otro partido, el nuevo reemplaza al anterior.

const fs = require('fs')
const path = require('path')
const { normalizar } = require('./respuestas')
const avisos = require('./avisos')
const asistencia = require('./asistencia')

const ARCHIVO = process.env.PARTIDO_ARCHIVO || path.join(__dirname, 'data', 'partido.json')
const ZONA_MEXICO = 'America/Mexico_City'
// México ya no cambia de horario (sin horario de verano desde 2022),
// así que la diferencia con UTC es fija: -6 h todo el año.
const MEXICO_OFFSET_MIN = -360

// Partes civiles de una fecha en hora de México (sin importar la zona
// del servidor), igual que en asistencia.js.
function partesMexico(fecha) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_MEXICO,
    weekday: 'short',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(fecha)
  const get = (t) => partes.find((p) => p.type === t).value
  const dias = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    diaSemana: dias[get('weekday')],
    y: Number(get('year')),
    m: Number(get('month')),
    d: Number(get('day')),
    hora: Number(get('hour')),
    minuto: Number(get('minute')),
  }
}

// Construye una fecha a partir de partes civiles de México
// (año, mes, día, hora, minuto).
function fechaMexico(y, m, d, h = 0, min = 0) {
  return new Date(Date.UTC(y, m - 1, d, h - MEXICO_OFFSET_MIN / 60, min))
}

// "1:00 pm", "3:30 pm", "10:00 am".
function formatearHora(h, min) {
  const h12 = h % 12 === 0 ? 12 : h % 12
  const ampm = h < 12 ? 'am' : 'pm'
  return `${h12}:${String(min).padStart(2, '0')} ${ampm}`
}

const DIAS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 }
const MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 }

// ¿Qué día dice el mensaje? Devuelve { y, m, d } o null si no trae día.
function resolverDia(limpio, ahora) {
  const p = partesMexico(ahora)
  const avanzar = (dias) => {
    const s = new Date(Date.UTC(p.y, p.m - 1, p.d + dias))
    return { y: s.getUTCFullYear(), m: s.getUTCMonth() + 1, d: s.getUTCDate() }
  }
  if (/\bhoy\b/.test(limpio)) return { y: p.y, m: p.m, d: p.d }
  if (/\bmanana\b/.test(limpio)) return avanzar(1)
  for (const [nombre, num] of Object.entries(DIAS)) {
    if (limpio.includes(nombre)) {
      // "el próximo domingo" es el de la semana que viene, no el de hoy.
      const proximo = /\bproximo\b/.test(limpio)
      let delta = (num - p.diaSemana + 7) % 7
      if (delta === 0 && proximo) delta = 7
      return avanzar(delta)
    }
  }
  const mMes = limpio.match(/\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/)
  if (mMes) {
    const d = Number(mMes[1])
    const m = MESES[mMes[2]]
    let y = p.y
    if (m < p.m || (m === p.m && d < p.d)) y++
    return fechaValida(y, m, d) ? { y, m, d } : null
  }
  const mDia = limpio.match(/\bel\s+(\d{1,2})\b/)
  if (mDia) {
    const d = Number(mDia[1])
    let m = p.m
    let y = p.y
    if (d < p.d) {
      m++
      if (m > 12) { m = 1; y++ }
    }
    return fechaValida(y, m, d) ? { y, m, d } : null
  }
  return null
}

function fechaValida(y, m, d) {
  if (d < 1 || d > 31) return false
  const f = new Date(Date.UTC(y, m - 1, d))
  return f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d
}

// ¿A qué hora? Devuelve { h, min } en 24 h, o null si no trae hora.
// "a las 1:00", "a la 1", "13:00", "a las 3 pm", "a las 8 am".
// Sin am/pm: los partidos son de día, así que 7–12 es de la mañana y
// 1–6 es de la tarde (la 1 es la 1 pm, no la 1 am).
function resolverHora(limpio) {
  const m = limpio.match(/a\s+las?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\s*m|p\s*m)?/)
    || limpio.match(/\b(\d{1,2}):(\d{2})\b/)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2] || 0)
  if (h < 0 || h > 23 || min > 59) return null
  const marca = (m[3] || '').replace(/\s+/g, '')
  if (marca === 'pm' && h < 12) h += 12
  if (marca === 'am' && h === 12) h = 0
  if (!marca) {
    if (h === 0) return null
    if (h >= 1 && h <= 6) h += 12
  }
  return { h, min }
}

// El rival, del texto original (para conservar las mayúsculas):
// "vs Rezball" o "contra los Halcones". Máximo 3 palabras y se corta
// en el primer signo o en palabras de día/hora.
function extraerRival(texto) {
  const m = texto.match(/\bvs\.?\s+(.+)/i) || texto.match(/\bcontra\s+(.+)/i)
  if (!m) return null
  let resto = m[1]
  const corte = resto.search(/[.,!\n]|a\s+las?\s+\d|\b(hoy|manana|domingo|lunes|martes|miercoles|jueves|viernes|sabado|el\s+\d)/i)
  if (corte >= 0) resto = resto.slice(0, corte)
  const rival = resto.trim().split(/\s+/).slice(0, 3).join(' ').trim()
  return rival || null
}

// ¿Este mensaje avisa un partido? Tiene que hablar de un partido y
// traer día y hora. Si no, null (el bot se calla, como siempre).
// Devuelve { fecha, rival } con fecha en hora absoluta.
function parsearAnuncio(texto, ahora = new Date()) {
  if (typeof texto !== 'string' || !texto.trim()) return null
  const limpio = normalizar(texto)
  if (!/jugamos|partido|juego|\bvs\b|contra/.test(limpio)) return null
  const dia = resolverDia(limpio, ahora)
  if (!dia) return null
  const hora = resolverHora(limpio)
  if (!hora) return null
  const fecha = fechaMexico(dia.y, dia.m, dia.d, hora.h, hora.min)
  if (fecha.getTime() <= ahora.getTime()) return null
  return { fecha, rival: extraerRival(texto) }
}

// El de 12 h nunca sale de noche (10 pm–8 am): se mueve a las 8 am
// siguientes (decisión de Mich 20/11). Si cae a la 1 am del domingo,
// sale el domingo a las 8 am; si cae a las 10 pm del sábado, sale el
// domingo a las 8 am (y si choca con el de 2 h, se quita, ver abajo).
function ajustarNoche(fecha) {
  const p = partesMexico(fecha)
  if (p.hora >= 22) {
    const s = new Date(Date.UTC(p.y, p.m - 1, p.d + 1))
    return fechaMexico(s.getUTCFullYear(), s.getUTCMonth() + 1, s.getUTCDate(), 8, 0)
  }
  if (p.hora < 8) return fechaMexico(p.y, p.m, p.d, 8, 0)
  return fecha
}

// Los tres recordatorios del partido, ordenados. Si dos quedan a menos
// de 30 min, se queda solo el más cercano al partido (para no mandar
// dos avisos casi iguales).
function horariosRecordatorio(fechaJuego) {
  const t = fechaJuego.getTime()
  const lista = [
    { tipo: '12h', en: ajustarNoche(new Date(t - 12 * 3600 * 1000)) },
    { tipo: '2h', en: new Date(t - 2 * 3600 * 1000) },
    { tipo: '30m', en: new Date(t - 30 * 60 * 1000) },
  ].sort((a, b) => a.en - b.en)
  const fuera = []
  for (let i = lista.length - 1; i >= 0; i--) {
    const r = lista[i]
    // fuera[0] es el recordatorio más cercano al partido de los que ya
    // quedaron: si este queda a menos de 30 min de él, sobra.
    if (fuera.length && fuera[0].en - r.en < 30 * 60 * 1000) continue
    fuera.unshift(r)
  }
  return fuera
}

// Etiqueta del partido: "domingo, 22 de noviembre".
function etiquetaFecha(fecha) {
  const p = partesMexico(fecha)
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(Date.UTC(p.y, p.m - 1, p.d)))
}

// --- Persistencia (data/partido.json, nunca se sube al repo) ---

function cargar(archivo = ARCHIVO) {
  try {
    const d = JSON.parse(fs.readFileSync(archivo, 'utf8'))
    if (!d || typeof d.fechaISO !== 'string' || !Array.isArray(d.avisos)) return null
    return d
  } catch {
    return null
  }
}

function guardar(juego, archivo = ARCHIVO) {
  fs.mkdirSync(path.dirname(archivo), { recursive: true })
  const tmp = `${archivo}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(juego, null, 2) + '\n')
  fs.renameSync(tmp, archivo)
  return juego
}

function limpiar(archivo = ARCHIVO) {
  try {
    fs.unlinkSync(archivo)
    return true
  } catch {
    return false
  }
}

// Guarda un partido anunciado y sus recordatorios. El nuevo anuncio
// reemplaza al anterior.
function anunciar(texto, ahora = new Date(), archivo = ARCHIVO) {
  const p = parsearAnuncio(texto, ahora)
  if (!p) return null
  const juego = {
    fechaISO: p.fecha.toISOString(),
    rival: p.rival,
    avisos: horariosRecordatorio(p.fecha).map((r) => ({ tipo: r.tipo, enISO: r.en.toISOString(), enviado: false })),
  }
  guardar(juego, archivo)
  return juego
}

// --- Mensajes ---

const TEXTO_AVISO = { '12h': '12 h antes', '2h': '2 h antes', '30m': '30 min antes' }

function mensajeRecordatorioPartido(juego, aviso, total, nombres = []) {
  const fecha = new Date(juego.fechaISO)
  const p = partesMexico(fecha)
  const horaTxt = formatearHora(p.hora, p.minuto)
  const rivalTxt = juego.rival ? ` vs ${juego.rival}` : ''
  const en = new Date(aviso.enISO)
  const pe = partesMexico(en)
  const mismoDia = pe.y === p.y && pe.m === p.m && pe.d === p.d
  const cuando = mismoDia ? 'Hoy jugamos' : 'Mañana jugamos'
  const falta = aviso.tipo === '12h' ? '' : aviso.tipo === '2h' ? ' — faltan 2 horas' : ' — faltan 30 minutos'
  return `🏀 *${cuando}${falta}*\n\nEl juego es ${etiquetaFecha(fecha)} a las ${horaTxt}${rivalTxt}.\n\n${avisos.textoConfirmados(total, nombres)}\n\nConfirma con "voy". Escribe "lista" para ver quiénes van.`
}

// Lo que el bot le contesta al coach cuando entendió el anuncio, para
// que vea qué juego registró y a qué hora saldrá cada recordatorio.
function mensajeConfirmacion(juego) {
  const fecha = new Date(juego.fechaISO)
  const p = partesMexico(fecha)
  const horaTxt = formatearHora(p.hora, p.minuto)
  const rivalTxt = juego.rival ? ` vs ${juego.rival}` : ''
  const lineas = juego.avisos.map((a) => {
    const en = new Date(a.enISO)
    const pe = partesMexico(en)
    const dia = new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', weekday: 'long' }).format(new Date(Date.UTC(pe.y, pe.m - 1, pe.d)))
    return `• ${TEXTO_AVISO[a.tipo]}: ${dia} ${formatearHora(pe.hora, pe.minuto)}`
  })
  return `Entendido, coach. Juego el ${etiquetaFecha(fecha)} a las ${horaTxt}${rivalTxt}.\n\nLes avisaré:\n${lineas.join('\n')}`
}

// Para las respuestas de asistencia: si hay un partido anunciado para
// la fecha de este evento, se muestra con su hora y su rival;
// si no, el nombre normal del evento.
function textoEventoJuego(evento, archivo = ARCHIVO) {
  if (!evento || evento.tipo !== 'juego') return evento ? evento.nombre : ''
  const juego = cargar(archivo)
  if (!juego) return evento.nombre
  const f = new Date(juego.fechaISO)
  const p = partesMexico(f)
  const clave = `juego-${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`
  if (clave !== evento.clave) return evento.nombre
  const rivalTxt = juego.rival ? ` vs ${juego.rival}` : ''
  return `${evento.nombre} a las ${formatearHora(p.hora, p.minuto)}${rivalTxt}`
}

// --- Programación de los recordatorios ---

let timers = []

// Arma los recordatorios del partido guardado. Se llama al arrancar el
// bot (para rearmar tras un reinicio) y cuando el coach anuncia un
// partido nuevo. Devuelve cuántos quedaron armados.
// Un recordatorio con hasta 30 min de retraso sale ahora mismo (por si
// el bot estuvo apagado); si pasó hace más, se salta.
function programarRecordatorios(sock, grupoId, opciones = {}) {
  for (const t of timers) clearTimeout(t)
  timers = []
  if (!sock || !grupoId) return 0
  const ahora = opciones.ahora || new Date()
  const archivo = opciones.archivo || ARCHIVO
  const archivoAsistencia = opciones.archivoAsistencia
  const juego = cargar(archivo)
  if (!juego) return 0
  const fechaJuego = new Date(juego.fechaISO)
  if (fechaJuego.getTime() <= ahora.getTime()) {
    limpiar(archivo)
    return 0
  }
  let armados = 0
  for (const aviso of juego.avisos) {
    if (aviso.enviado) continue
    const en = new Date(aviso.enISO)
    let demora = en.getTime() - ahora.getTime()
    if (demora < -30 * 60 * 1000) {
      aviso.enviado = true
      continue
    }
    if (demora < 0) demora = 0
    timers.push(setTimeout(async () => {
      try {
        const { total, nombres } = asistencia.lista(fechaJuego, archivoAsistencia)
        await sock.sendMessage(grupoId, { text: mensajeRecordatorioPartido(juego, aviso, total, nombres) })
      } catch (err) {
        console.error('No se pudo mandar el recordatorio del partido:', err.message)
      }
      aviso.enviado = true
      guardar(juego, archivo)
    }, demora))
    armados++
  }
  guardar(juego, archivo)
  return armados
}

module.exports = {
  parsearAnuncio,
  horariosRecordatorio,
  anunciar,
  cargar,
  guardar,
  limpiar,
  programarRecordatorios,
  mensajeRecordatorioPartido,
  mensajeConfirmacion,
  textoEventoJuego,
}
