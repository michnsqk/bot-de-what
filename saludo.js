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

const ARCHIVO = process.env.SALUDADOS_ARCHIVO || path.join(__dirname, 'data', 'saludados.json')

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
  fs.mkdirSync(path.dirname(archivo), { recursive: true })
  const tmp = `${archivo}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(lista, null, 2) + '\n')
  fs.renameSync(tmp, archivo)
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

module.exports = { yaSaludado, marcarSaludado, debeSaludar }
