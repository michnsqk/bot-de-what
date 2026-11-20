// Ajustes del bot. Cambia aquí el comportamiento general
// sin tocar la lógica de index.js ni los textos de respuestas.js.

module.exports = {
  // Nombre del equipo. Sale en el mensaje de arranque y en el menú.
  nombreEquipo: 'Equipo de básquetbol',

  // Responde en grupos Y en privado (false, decisión de Mich 15/11):
  // cualquiera que le escriba al número recibe respuestas, en el grupo
  // y en su chat privado. Los avisos programados siguen saliendo SOLO
  // en grupos (ver avisos.js): un privado nunca recibe avisos.
  // Si se vuelve a poner true, el bot solo responde en grupos.
  soloGrupos: false,

  // Espera en milisegundos antes de reintentar si se cae la conexión.
  esperaReconexionMs: 5000,

  // Avisos programados (Fase 3). Horas en formato cron, zona horaria de México.
  // Entreno: lunes a viernes a la 1:00 pm (2.5 h antes del entreno).
  // Juego: sábado a las 6:00 pm (la noche antes del juego del domingo).
  zonaHoraria: 'America/Mexico_City',
  recordatorioEntreno: '0 13 * * 1-5',
  recordatorioJuego: '0 18 * * 6',

  // Grupo del equipo (opcional). Si lo pones aquí, ese es EL grupo del
  // bot: solo ahí contesta y manda avisos (Ronda 7). Si lo dejas en null,
  // el coach elige el grupo mandando !grupo dentro del grupo bueno, y el
  // bot lo guarda en data/grupo-elegido.json. Para cambiarlo, el coach
  // manda !grupo en otro grupo.
  grupoId: null,
}
