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
}
