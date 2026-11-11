# Bot de WhatsApp del equipo — Fase 4 (hosting 24/7).
# Imagen pequeña con Node 20. La sesión (auth/) NO se copia en la imagen:
# vive en un volumen del hosting para que sobreviva a reinicios y redeploys.
# Ver DEPLOY.md para los pasos.
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY index.js respuestas.js config.js asistencia.js avisos.js ./
CMD ["node", "index.js"]
