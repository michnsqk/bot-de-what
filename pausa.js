// Pausa del bot — la pone y la quita el coach con !pausa y !activa.
// Mientras está en pausa, el bot no responde preguntas ni asistencia.
// Los avisos programados SIGUEN saliendo: son anuncios del coach, no
// respuestas. El estado vive en data/pausa.json, así sobrevive a
// reinicios y redeploys. Nunca se sube al repo (está en .gitignore:
// data/ completa está ignorada).

const fs = require('fs')
const path = require('path')

const ARCHIVO = process.env.PAUSA_ARCHIVO || path.join(__dirname, 'data', 'pausa.json')

// ¿Está el bot en pausa? Si no hay archivo (nunca se pausó), no.
function estaEnPausa(archivo = ARCHIVO) {
  try {
    return JSON.parse(fs.readFileSync(archivo, 'utf8')).pausa === true
  } catch {
    return false
  }
}

// Guarda el estado. Escritura atómica: primero a un temporal y luego se
// renombra, igual que en asistencia.js.
function ponerPausa(valor, archivo = ARCHIVO) {
  fs.mkdirSync(path.dirname(archivo), { recursive: true })
  const tmp = `${archivo}.tmp`
  fs.writeFileSync(tmp, JSON.stringify({ pausa: !!valor }, null, 2) + '\n')
  fs.renameSync(tmp, archivo)
  return !!valor
}

module.exports = { estaEnPausa, ponerPausa }
