# Bot de WhatsApp — Equipo de básquetbol

Bot con Baileys v7 (librería no oficial, por QR). Responde en el grupo del
equipo a preguntas de horarios y costos. No responde en chats privados y no
contesta cuando no sabe la respuesta, para no spamear el grupo.

## Qué responde

Todo está en `respuestas.js` (edítalo ahí, no toques `index.js`). Los ajustes
generales —solo grupos, nombre del equipo, espera entre reintentos— están
en `config.js`.

- **horario** — Entrenamientos lunes a viernes, 3:30 a 5:30 pm. Juegos los domingos.
- **costos** — Mensualidad $500, semana $150, por clase $70.
- **juegos** — Los domingos.
- **ubicación** — Aún no cargada: el bot dice que le pregunten al coach.
- **menu / ayuda / hola** — Muestra el menú.

## Asistencia (Fase 2)

- **voy** — Te anota para el próximo evento. "Voy" solo significa el
  próximo evento: si es lunes a viernes antes de las 5:30 pm, el entreno
  de hoy; si ya pasó la hora, el del día siguiente; el sábado, el juego
  del domingo. Cada quien se anota una sola vez.
- **no voy** — Te quita de la lista del próximo evento.
- **lista** — Muestra quiénes van al próximo evento.

La asistencia se guarda en `asistencia.json` (un archivo, sin base de
datos). Ese archivo **nunca se sube al repo**: tiene nombres y teléfonos
del equipo. Si quieres empezar de cero, borra el archivo y el bot crea
otro en la siguiente confirmación. La lista es por evento: cada día tiene
su propia lista.

## Avisos programados (Fase 3)

El bot manda solo dos avisos por semana, al grupo del equipo:

- **Entreno:** lunes a viernes a la 1:00 pm. "Hoy entrenamos... Confirma
  con 'voy'."
- **Juego:** sábado a las 6:00 pm. "Mañana es el juego... Confirma con
  'voy'."

El aviso dice cuántos van confirmados hasta ahora. Las horas se cambian
en `config.js` (`recordatorioEntreno` y `recordatorioJuego`, formato cron,
zona `America/Mexico_City`).

El bot aprende el grupo solo: cuando alguien escribe en el grupo, guarda
su ID en `grupos.json` (tampoco se sube al repo) y ahí manda los avisos.
También puedes pegar el ID a mano en `config.grupoId`.

**Ojo:** el aviso solo sale si el bot está prendido a esa hora. Si la
compu está apagada, no hay aviso. Por eso existe la Fase 4.

## Hosting 24/7 (Fase 4)

Para que el bot no se apague con tu compu, vive en un servidor. Los pasos
están en `DEPLOY.md` (Railway, lo más simple). Lo importante: hay que
crear un volumen en `/app/auth` para que la sesión sobreviva a los
reinicios; sin volumen, cada redeploy pide escanear el QR otra vez. El
despliegue en sí lo haces tú con tu cuenta (ahí se escanea el QR con el
teléfono del equipo).

## Cómo correrlo

Requisitos: Node.js 20 o más, y el teléfono del equipo.

```bash
npm install
node index.js
```

1. Al arrancar muestra un QR en la terminal.
2. En el teléfono del equipo: WhatsApp > Dispositivos vinculados >
   Vincular un dispositivo, y escanea el QR.
3. La sesión queda guardada en la carpeta `auth/`. La próxima vez que
   arranques ya no pide QR.

**Prueba primero en un grupo de prueba**: crea un grupo con el número del
equipo y tu número, escribe "horario" y "costos", y revisa que responda
bien antes de dejarlo en el grupo real de 30 personas.

## Cosas honestas que debes saber

- **La conexión en vivo NO está verificada desde aquí.** Mi entorno
  bloquea el WebSocket de WhatsApp, así que en mi prueba el bot no pudo
  llegar a mostrar el QR. El código carga bien y las respuestas están
  probadas (11/11 casos), pero la primera conexión real la haces tú en tu
  compu escaneando el QR. Si al arrancar no sale el QR, revisa tu internet
  y que Node.js sea 20 o más.
- **Si apagas la compu, el bot se apaga.** Para que esté 24/7 necesitas
  dejarlo corriendo en un servidor (una VPS, Railway, etc.). Eso es otro
  paso, no está en esta versión.
- **El número sigue funcionando normal en el teléfono.** Baileys se conecta
  como un dispositivo vinculado (multi-dispositivo): el coach puede seguir
  chateando desde su teléfono mientras el bot corre.
- **Riesgo de bloqueo.** Baileys no es oficial y va contra las reglas de
  WhatsApp: el número puede ser bloqueado temporal o permanentemente. El
  coach ya eligió esta opción sabiéndolo. No compartas la carpeta `auth/`
  con nadie: es la sesión del número del equipo.
- **Si WhatsApp cierra la sesión**, borra la carpeta `auth/` y vuelve a
  escanear el QR.

## Cómo actualizar la info

Edita los textos en `respuestas.js` (horarios, costos, ubicación cuando el
coach la pase) y reinicia el bot (`Ctrl+C` y otra vez `node index.js`).
