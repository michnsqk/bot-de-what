# Despliegue 24/7 en Google Cloud — e2-micro gratis (casi)

El bot solo funciona mientras la compu donde corre está prendida. Para que
esté siempre activo (y los avisos salgan a su hora) sin pagar casi nada,
vive en una maquinita e2-micro de Google Cloud. Tu laptop descansa.

## Lo que necesitas antes de empezar

- Una cuenta de Google.
- Una tarjeta de crédito o débito: Google la pide para verificarte. Pone
  un cargo temporal de $0 a $1 USD que no es un cobro.

## 1. Crear la cuenta y el proyecto

1. Entra a [console.cloud.google.com](https://console.cloud.google.com).
2. Crea la cuenta: te dan **$300 USD de crédito por 90 días** (prueba) y
   aparte el tier gratis. Crea un proyecto, por ejemplo `bot-basquet`.

## 2. Crear la máquina virtual (gratis)

1. En la consola: **Compute Engine → VM instances → Create instance**.
2. Nombre: `bot-basquet`.
3. Región: **us-central1 (Iowa)** — es una de las tres donde la e2-micro
   es gratis (las otras son us-west1 Oregon y us-east1 South Carolina).
4. Tipo de máquina: **e2-micro** (2 vCPU compartidas, 1 GB de RAM).
   Sobra para el bot.
5. Disco de arranque: **Ubuntu 24.04 LTS**, **30 GB, Standard persistent
   disk**. Ojo: que sea Standard, no SSD ni Balanced, porque esos se
   cobran.
6. Firewall: no necesitas abrir nada. **Create** y espera a que diga
   Running.

## 3. Entrar a la máquina e instalar Node

En la lista de VMs, dale al botón **SSH** de tu instancia: se abre una
terminal en el navegador. Ya dentro:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
node -v && npm -v
```

## 4. Bajar el bot y correrlo la primera vez (para el QR)

```bash
git clone https://github.com/michnsqk/bot-de-what.git
cd bot-de-what
npm install
node index.js
```

Sale el QR en la terminal. El coach lo escanea con el teléfono del
equipo (WhatsApp → Dispositivos vinculados → Vincular un dispositivo).
Cuando diga "Bot conectado", para el bot con **Ctrl+C**.

## 5. Dejarlo prendido 24/7 con pm2

pm2 lo mantiene corriendo y lo reinicia solo si se cae o si la máquina
se reinicia:

```bash
sudo npm install -g pm2
pm2 start index.js --name bot-basquet
pm2 startup   # sigue el comando con sudo que te imprime
pm2 save
pm2 logs bot-basquet   # para ver que está conectado
```

Listo. La sesión del número del equipo, la asistencia y los grupos viven
en el disco de la máquina (`data/`), así que sobreviven a reinicios. El
bot no necesita ningún puerto abierto: solo sale a WhatsApp, no recibe
conexiones. Los avisos usan la zona `America/Mexico_City` (en
`config.js`), no importa que el servidor esté en UTC.

## Costos (honesto, esto importa)

- La **e2-micro es gratis para siempre** dentro del límite (una sola VM
  en esas tres regiones, 30 GB de disco estándar, 1 GB de salida al mes).
- **La IP pública sí se cobra: ~$3.65 USD al mes.** El crédito de $300
  de la prueba cubre los primeros 90 días; después, eso es lo que pagas.
- **Al terminar la prueba hay que activar la cuenta de pago**
  (Billing → Upgrade). Si no lo haces, Google apaga la VM y a los 30
  días la borra. Con la cuenta de pago activa y solo usando lo gratis,
  la factura queda en ~$3.65 USD/mes por la IP.
- No crees una segunda VM ni discos extra: eso sí se cobra.

## Si algo falla

- **El bot no responde:** `pm2 logs bot-basquet` dice qué pasó.
  `pm2 restart bot-basquet` lo reinicia.
- **"Sesión cerrada" en los logs:** hay que volver a vincular: borra
  `data/auth` en la máquina, corre `node index.js` y escanea el QR otra
  vez. No compartas la carpeta `auth/` con nadie: es la sesión del
  número del equipo.
- **Cambios al bot:** en la máquina, `cd bot-de-what && git pull` y
  `pm2 restart bot-basquet`.
