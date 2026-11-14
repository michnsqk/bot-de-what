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
- **entrar al equipo** — Cómo inscribirse: hablar con el coach Javier, más los costos.
- **qué llevar** — El bot no lo inventa: dice que le pregunten al coach.
- **gracias** — Responde corto. "Gracias, ¿cuánto cuesta?" responde los costos.
- **menu / ayuda / hola** — Muestra el menú.
- **próximo** — Cuándo es el próximo entreno o juego (con cuántos van).
- **coach** — Quién es el coach (Javier).

El bot también entiende abreviaturas de chat ("q", "xq", "pq", "tmb") y
algún typo ("orario"). Si no entiende el mensaje, no contesta nada.

El bot también lee el pie de las fotos y videos: si mandas una foto con
el texto "horario", responde igual.

## Asistencia (Fase 2)

- **voy** — Te anota para el próximo evento. "Voy" solo significa el
  próximo evento: si es lunes a viernes antes de las 5:30 pm, el entreno
  de hoy; si ya pasó la hora, el del día siguiente; el sábado, el juego
  del domingo. Cada quien se anota una sola vez.
- **voy al juego / voy al entreno** — Te anota para ese evento aunque
  no sea el próximo: "voy al juego" un martes te anota para el domingo.
  Igual con "no voy al juego" / "no voy al entreno" para quitarte.
- **no voy** — Te quita de la lista del próximo evento.
- **lista** — Muestra quiénes van al próximo evento. "Lista del juego"
  muestra la del domingo y "lista del entreno" la del próximo entreno.

La asistencia se guarda en `data/asistencia.json` (un archivo, sin base de
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

El aviso dice cuántos van confirmados hasta ahora y sus nombres (máx.
15, luego "y N más"). Las horas se cambian
en `config.js` (`recordatorioEntreno` y `recordatorioJuego`, formato cron,
zona `America/Mexico_City`).

El bot aprende el grupo solo: cuando alguien escribe en el grupo, guarda
su ID en `data/grupos.json` (tampoco se sube al repo) y ahí manda los avisos.
También puedes pegar el ID a mano en `config.grupoId`.

**Ojo:** el aviso solo sale si el bot está prendido a esa hora. Si la
compu está apagada, no hay aviso. Por eso existe la Fase 4.

## Hosting 24/7 (Fase 4)

Para que el bot no se apague con tu compu, vive en un servidor. Los pasos
están en `DEPLOY.md` (Railway, lo más simple). Lo importante: hay que
crear un volumen en `/app/data` para que la sesión y los datos sobrevivan
a los reinicios; sin volumen, cada redeploy pide escanear el QR otra vez y
se borran las listas. El despliegue en sí lo haces tú con tu cuenta (ahí
se escanea el QR con el teléfono del equipo).

## Cómo funciona el QR, el grupo y el coach

- **El QR solo inicia sesión como el número del equipo.** El bot se
  conecta como un dispositivo vinculado (multi-dispositivo): el coach
  sigue chateando normal desde su teléfono mientras el bot corre.
- **El número ya tiene que estar en el grupo.** Si el número del equipo
  no está en el grupo del equipo, Javier lo agrega (él es admin). El bot
  no puede meterse solo a un grupo.
- **El bot solo responde en grupos.** En privado nunca contesta, a
  propósito: ese mismo número es el teléfono personal del coach, y el
  bot no se mete en sus chats privados.
- **Los chats privados del coach no se tocan.** El bot solo lee y
  responde en el grupo del equipo. Lo que el coach escriba en privado
  es solo suyo.

## Comandos del coach (desde su propio teléfono)

El coach escribe en el grupo desde el número del equipo. Esos mensajes
los ve el bot como propios, así que solo los que empiezan con `!` son
comandos; lo demás que escriba el coach es su chat normal y el bot no
se mete.

- **!pausa** — El bot deja de responder preguntas y asistencia. Los
  avisos programados siguen saliendo.
- **!activa** — Vuelve a responder.
- **!info** — Estado actual: horario, costos, próximo evento con
  confirmados y si está en pausa o activo.
- **!recordatorio** — Manda ahora mismo el recordatorio del próximo
  evento, en ese grupo.

**Si el bot no responde:** revisa en este orden: 1) ¿la compu o el
servidor donde corre sigue prendido? 2) ¿el coach puso !pausa?
(!info lo dice; !activa lo quita) 3) ¿la sesión sigue viva? Si
WhatsApp cerró la sesión, borra `data/auth/` y vuelve a escanear el
QR. 4) ¿el bot está en el grupo? Si lo sacaron del grupo, hay que
volver a agregarlo.

## Cómo correrlo

Requisitos: Node.js 20 o más, y el teléfono del equipo.

```bash
npm install
node index.js
```

1. Al arrancar muestra un QR en la terminal.
2. En el teléfono del equipo: WhatsApp > Dispositivos vinculados >
   Vincular un dispositivo, y escanea el QR.
3. La sesión queda guardada en la carpeta `data/auth/`. La próxima vez que
   arranques ya no pide QR.

**Prueba primero en un grupo de prueba**: crea un grupo con el número del
equipo y tu número, escribe "horario" y "costos", y revisa que responda
bien antes de dejarlo en el grupo real de 30 personas.

Para probar la lógica sin conectar WhatsApp: `npm test` (134 casos:
respuestas, asistencia, avisos, pausa, comandos del coach y reconexión).

## Cosas honestas que debes saber

- **La conexión en vivo NO está verificada desde aquí.** Mi entorno
  bloquea el WebSocket de WhatsApp, así que en mi prueba el bot no pudo
  llegar a mostrar el QR. El código carga bien y la lógica está probada
  (134 casos con `npm test`), pero la primera conexión real la haces tú en tu
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
  coach ya eligió esta opción sabiéndolo. No compartas la carpeta
  `data/auth/` con nadie: es la sesión del número del equipo.
- **Si WhatsApp cierra la sesión**, borra la carpeta `data/auth/` y vuelve a
  escanear el QR.

## Cómo actualizar la info

Edita los textos en `respuestas.js` (horarios, costos, ubicación cuando el
coach la pase) y reinicia el bot (`Ctrl+C` y otra vez `node index.js`).
