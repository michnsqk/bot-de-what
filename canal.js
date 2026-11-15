// Qué chats atiende el bot — Ronda 4 (15/11, decisión de Mich).
// Grupos: siempre. Privados: solo si config.soloGrupos es false.
// Los avisos programados, en cambio, solo van a grupos (ver avisos.js):
// un privado nunca recibe avisos, aunque le haya escrito al bot.

function esGrupo(chatId) {
  return typeof chatId === 'string' && chatId.endsWith('@g.us')
}

// ¿El bot responde en este chat? En grupos, siempre. En privado, solo
// si soloGrupos es false (hay que ponerlo así a propósito en config.js).
// Si el ajuste no está, por seguridad no responde en privado.
function respondeEn(chatId, config) {
  if (!chatId) return false
  if (esGrupo(chatId)) return true
  return config.soloGrupos === false
}

module.exports = { esGrupo, respondeEn }
