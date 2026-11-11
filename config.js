// Ajustes del bot. Cambia aquí el comportamiento general
// sin tocar la lógica de index.js ni los textos de respuestas.js.

module.exports = {
  // Nombre del equipo. Sale en el mensaje de arranque y en el menú.
  nombreEquipo: 'Equipo de básquetbol',

  // Solo responde en grupos (true = recomendado).
  // El equipo se comunica por grupo; en privado el bot no contesta.
  soloGrupos: true,

  // Espera en milisegundos antes de reintentar si se cae la conexión.
  esperaReconexionMs: 5000,

  // Avisos programados (Fase 3). Horas en formato cron, zona horaria de México.
  // Entreno: lunes a viernes a la 1:00 pm (2.5 h antes del entreno).
  // Juego: sábado a las 6:00 pm (la noche antes del juego del domingo).
  zonaHoraria: 'America/Mexico_City',
  recordatorioEntreno: '0 13 * * 1-5',
  recordatorioJuego: '0 18 * * 6',

  // Grupo del equipo (opcional). Si lo dejas en null, el bot aprende el
  // grupo solo: cuando alguien escriba en el grupo, guarda su ID en
  // grupos.json y ahí manda los avisos. El ID sale en la consola como
  // "Grupo detectado".
  grupoId: null,
}
