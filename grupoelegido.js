// Grupo elegido — Ronda 7 (20/11, pedido de Mich y del coach).
// El coach manda !grupo dentro del grupo bueno y el bot lo guarda aquí
// como el único grupo al que sirve: en los demás grupos no contesta ni
// manda avisos. En privado sigue contestando igual.
// El archivo vive en data/grupo-elegido.json, así sobrevive a reinicios
// y redeploys. Nunca se sube al repo (data/ completa está ignorada).
// Si config.grupoId está puesto, ese manda (es el ajuste a mano); si no,
// manda lo guardado aquí. Para cambiar el grupo, el coach manda !grupo
// en otro grupo.

const fs = require('fs')
const path = require('path')

const ARCHIVO = process.env.GRUPO_ELEGIDO_ARCHIVO || path.join(__dirname, 'data', 'grupo-elegido.json')

function esGrupoId(id) {
  return typeof id === 'string' && id.endsWith('@g.us')
}

// ¿Hay un grupo guardado? Si no hay archivo (nadie mandó !grupo), null.
function cargar(archivo = ARCHIVO) {
  try {
    const datos = JSON.parse(fs.readFileSync(archivo, 'utf8'))
    return esGrupoId(datos.grupoId) ? datos.grupoId : null
  } catch {
    return null
  }
}

// Guarda el grupo elegido. Escritura atómica: primero a un temporal y
// luego se renombra, igual que en pausa.js y asistencia.js.
function guardar(grupoId, archivo = ARCHIVO) {
  if (!esGrupoId(grupoId)) return null
  fs.mkdirSync(path.dirname(archivo), { recursive: true })
  const tmp = `${archivo}.tmp`
  fs.writeFileSync(tmp, JSON.stringify({ grupoId }, null, 2) + '\n')
  fs.renameSync(tmp, archivo)
  return grupoId
}

// Borra el grupo elegido (el bot vuelve a servir a todos los grupos,
// como antes de la Ronda 7).
function limpiar(archivo = ARCHIVO) {
  try {
    fs.unlinkSync(archivo)
    return true
  } catch {
    return false
  }
}

// El grupo elegido efectivo: el de config (a mano) manda sobre el
// guardado con !grupo.
function elegido(config, archivo = ARCHIVO) {
  if (config && esGrupoId(config.grupoId)) return config.grupoId
  return cargar(archivo)
}

module.exports = { cargar, guardar, limpiar, elegido }
