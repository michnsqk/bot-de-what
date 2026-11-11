# Despliegue 24/7 — Fase 4

El bot solo funciona mientras la compu donde corre está prendida. Para que
esté siempre activo (y los avisos de la Fase 3 salgan a su hora), vive en
un servidor. La forma más simple es Railway.

## Opción recomendada: Railway

1. Crea una cuenta en [railway.app](https://railway.app) con tu GitHub.
2. **New Project → Deploy from GitHub repo** → elige
   `Aldo11cdmx/bot-de-what`.
3. Railway detecta el proyecto de Node y lo construye. El comando de
   arranque es `npm start` (ya está en `package.json`).
4. **El paso importante: el volumen.** Sin esto, cada redeploy borra la
   sesión y hay que escanear el QR otra vez. En el servicio → pestaña
   **Settings → Volumes → New Volume**, ruta `/app/data`. Ahí viven la
   sesión del número del equipo, la lista de asistencia y los grupos:
   todo sobrevive a reinicios y redeploys.
5. Espera a que el deploy termine y abre los logs (**Deployments → View
   Logs**). Debe salir el QR del bot.
6. Escanea el QR con el teléfono del equipo (WhatsApp → Dispositivos
   vinculados → Vincular un dispositivo).
7. Prueba en el grupo: escribe `horario` y `voy`. El bot debe responder.
8. Listo. El bot queda prendido 24/7. Si se cae, Railway lo reinicia solo.

## Si la sesión se cierra

Si en los logs ves "Sesión cerrada", hay que volver a vincular: borra el
volumen (Settings → Volumes → el volumen → Delete), redeploya el servicio
y escanea el QR otra vez. No compartas la carpeta `auth/` con nadie: es
la sesión del número del equipo.

## Costos (honesto)

Railway ya no tiene plan gratis permanente: al crear la cuenta te da
crédito de prueba ($5 USD). Cuando se acaba, el plan Hobby cuesta $5 USD
al mes más el uso. El bot es liviano (Node + unas librerías), así que el
uso es bajo, pero vigila el gasto en el panel de Railway. Alternativa: una
VPS (por ejemplo un droplet de DigitalOcean, ~$4–6 USD/mes) corriendo el
Dockerfile de este repo; es más trabajo de configurar.

## Notas

- Los avisos usan la zona horaria `America/Mexico_City` (en `config.js`),
  así que no importa que el servidor esté en UTC.
- El `Dockerfile` de este repo está escrito pero **no se probó construirlo
  aquí** (en este entorno no hay Docker). Railway lo construye al
  desplegar; si la construcción falla, el log del deploy dice qué pasó.
- `asistencia.json` y `grupos.json` viven en el volumen (`/app/data`),
  así que sobreviven a los redeploys. Si borras el servicio y su volumen,
  se pierden las listas: son solo archivos, no una base de datos.
- Railway puede quejarse de que el servicio no expone un puerto: ignóralo.
  El bot no es una página web, es un proceso que escucha WhatsApp; no
  necesita puerto.
