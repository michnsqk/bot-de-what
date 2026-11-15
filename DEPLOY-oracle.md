# Despliegue 24/7 en Oracle Cloud — gratis para siempre

El bot solo funciona mientras la compu donde corre está prendida. Para que
esté siempre activo (y los avisos salgan a su hora) sin pagar nada, vive
en una máquina virtual gratis de Oracle Cloud (Always Free). Tu laptop
descansa.

## Lo que necesitas antes de empezar

- Un correo (el de Gmail sirve).
- Una tarjeta de crédito o débito: Oracle la pide solo para verificar tu
  identidad. No te cobran por los recursos Always Free; ponen un cargo
  temporal de $1 USD que se libera.
- Tu teléfono, para un código de verificación.

## 1. Crear la cuenta

1. Entra a [cloud.oracle.com](https://cloud.oracle.com) → **Start for free**.
2. Pon tu correo, nombre, país y crea la contraseña.
3. Verifica el teléfono con el código que te llega.
4. Registra la tarjeta (verificación de identidad).
5. Elige tu región principal (**home region**): si te sale Querétaro
   (México), esa; si no, US East (Ashburn). Los recursos gratis solo se
   crean en esa región, así que elígela bien desde el inicio.

## 2. Crear la máquina virtual (gratis)

1. En la consola: **Compute → Instances → Create instance**.
2. Nombre: `bot-basquet`.
3. Imagen: **Ubuntu 24.04** (o 22.04).
4. Shape: **VM.Standard.E2.1.Micro** — es la gratis (la consola la marca
   como Always Free). Tiene 1 GB de RAM, sobra para el bot. Si te sale
   "out of capacity", inténtalo más tarde o en otra región.
5. Red: deja la VCN por defecto y que le asigne una **IPv4 pública**.
6. Llave SSH: **Generate a key pair** y descarga la llave privada.
   Guárdala bien, es la única forma de entrar a la máquina.
7. **Create** y espera a que diga Running. Anota la **IP pública**.

## 3. Entrar a la máquina e instalar Node

Desde tu terminal (PowerShell en Windows sirve):

```bash
ssh -i <ruta-a-tu-llave> ubuntu@<IP-publica>
```

Ya dentro:

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

## Si algo falla

- **El bot no responde:** `pm2 logs bot-basquet` dice qué pasó.
  `pm2 restart bot-basquet` lo reinicia.
- **"Sesión cerrada" en los logs:** hay que volver a vincular: borra
  `data/auth` en la máquina, corre `node index.js` y escanea el QR otra
  vez. No compartas la carpeta `auth/` con nadie: es la sesión del
  número del equipo.
- **La máquina se detuvo sola:** Oracle puede reclamar instancias
  Always Free que llevan 7 días casi sin uso. El bot tiene avisos y
  mensajes todos los días, así que normalmente no pasa. Si pasa, en la
  consola de Oracle: Instances → la instancia → **Start**.
- **Cambios al bot:** en la máquina, `cd bot-de-what && git pull` y
  `pm2 restart bot-basquet`.

## Costos (honesto)

Los recursos Always Free no caducan y no te cobran mientras te quedes
dentro de sus límites (la Micro de 1 GB es Always Free). No actives nada
que diga "paid" o fuera del tier gratis, porque eso sí se cobra. Revisa
de vez en cuando **Billing → Cost Analysis** en la consola.
