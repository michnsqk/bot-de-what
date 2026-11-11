// Pruebas del bot. Corre con: npm test
// No necesita WhatsApp: prueba la lógica (respuestas, asistencia, avisos)
// con archivos temporales. Sale con código 1 si algo falla.

const fs = require('fs')
const os = require('os')
const path = require('path')
const { reglas } = require('./respuestas')
const A = require('./asistencia')
const V = require('./avisos')
const cron = require('node-cron')

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-test-'))
const tmpA = path.join(tmpDir, 'asistencia.json')
const tmpG = path.join(tmpDir, 'grupos.json')

let total = 0
let fails = 0
function check(ok, label) {
  total++
  if (ok) console.log('OK  ', label)
  else { fails++; console.log('FALLO', label) }
}
function norm(t) {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  // 1. Preguntas frecuentes (Fase 1): lo específico gana, el menú va al final.
  const faq = [
    ['¿Cuál es el horario?', 'Entrenamientos'],
    ['cuanto cuesta la mensualidad', 'Mensualidad'],
    ['donde entrenan', 'ubicación'],
    ['a qué hora entrenan', 'Entrenamientos'],
    ['hola', 'Bot del equipo'],
    ['hola, ¿cuánto cuesta?', 'Mensualidad'],
    ['bot, ¿cuál es el horario?', 'Entrenamientos'],
    ['juegos el domingo', 'domingos'],
    ['donde es la cancha', 'ubicación'],
    ['cuánto cuesta por clase', 'Por clase'],
    ['algo random sin sentido', null],
  ]
  for (const [msg, expected] of faq) {
    const limpio = norm(msg)
    const hit = reglas.find((r) => r.claves.some((c) => limpio.includes(c)))
    check(expected ? (hit && hit.respuesta.includes(expected)) : !hit, 'FAQ ' + JSON.stringify(msg))
  }

  // 2. Próximo evento (Fase 2): con horas explícitas de México (-06:00),
  // así la prueba vale en cualquier zona horaria del servidor.
  const ev = (s) => A.proximoEvento(new Date(s))
  check(ev('2026-11-10T10:00:00-06:00').clave === 'entreno-2026-11-10', 'mar 10am -> entreno hoy')
  check(ev('2026-11-10T13:00:00-06:00').clave === 'entreno-2026-11-10', 'mar 1pm -> entreno hoy')
  check(ev('2026-11-10T19:00:00Z').clave === 'entreno-2026-11-10', 'mar 1pm México (=19:00 UTC) -> entreno hoy, también en UTC')
  check(ev('2026-11-10T18:00:00-06:00').clave === 'entreno-2026-11-11', 'mar 6pm -> entreno mié')
  check(ev('2026-11-13T18:00:00-06:00').clave === 'juego-2026-11-15', 'vie 6pm -> juego dom')
  check(ev('2026-11-14T12:00:00-06:00').clave === 'juego-2026-11-15', 'sáb -> juego dom')
  check(ev('2026-11-15T12:00:00-06:00').clave === 'juego-2026-11-15', 'dom -> juego hoy')
  check(ev('2026-11-16T10:00:00-06:00').clave === 'entreno-2026-11-16', 'lun 10am -> entreno hoy')
  check(ev('2026-11-10T10:00:00-06:00').hora === '3:30 a 5:30 pm', 'entreno trae hora')
  check(ev('2026-11-15T12:00:00-06:00').hora === null, 'juego sin hora (no inventada)')

  // 3. Intenciones (Fase 2): "me voy de vacaciones" NO confirma.
  const di = (t) => A.detectarIntencion(norm(t))
  check(di('voy al entreno') === 'confirmar', 'intención: voy al entreno')
  check(di('voy') === 'confirmar', 'intención: voy')
  check(di('me voy de vacaciones') === null, 'intención: me voy de vacaciones -> nada')
  check(di('ya me voy') === null, 'intención: ya me voy -> nada')
  check(di('me voy al entreno') === 'confirmar', 'intención: me voy al entreno')
  check(di('me voy a entrenar') === 'confirmar', 'intención: me voy a entrenar')
  check(di('no voy') === 'cancelar', 'intención: no voy')
  check(di('no puedo ir hoy') === 'cancelar', 'intención: no puedo')
  check(di('quiénes van') === 'lista', 'intención: quiénes van')
  check(di('lista') === 'lista', 'intención: lista')
  check(di('¿cuánto cuesta?') === null, 'intención: costos -> null (lo atiende FAQ)')
  check(di('hola') === null, 'intención: hola -> null (lo atiende FAQ)')
  check(di('voy, ¿cuánto cuesta?') === 'confirmar', 'intención: voy + costos -> confirmar (asistencia primero)')

  // 4. Flujo confirmar/cancelar/lista (Fase 2).
  const ahora = new Date('2026-11-10T10:00:00-06:00')
  let r = A.confirmar('5215511111111@s.whatsapp.net', 'Mich', ahora, tmpA)
  check(r.estado === 'nuevo' && r.total === 1, 'confirmar Mich -> nuevo, total 1')
  r = A.confirmar('5215511111111@s.whatsapp.net', 'Mich', ahora, tmpA)
  check(r.estado === 'ya' && r.total === 1, 'confirmar Mich otra vez -> ya, sin duplicado')
  r = A.confirmar('5215522222222@s.whatsapp.net', 'Javier', ahora, tmpA)
  check(r.estado === 'nuevo' && r.total === 2, 'confirmar Javier -> total 2')
  let l = A.lista(ahora, tmpA)
  check(l.total === 2 && l.nombres.join() === 'Mich,Javier', 'lista trae a los dos')
  r = A.cancelar('5215511111111@s.whatsapp.net', ahora, tmpA)
  check(r.estado === 'quitado' && r.total === 1, 'cancelar Mich -> quitado, total 1')
  r = A.cancelar('5215511111111@s.whatsapp.net', ahora, tmpA)
  check(r.estado === 'no-estaba', 'cancelar Mich otra vez -> no-estaba')
  l = A.lista(new Date('2026-11-11T10:00:00-06:00'), tmpA)
  check(l.total === 0, 'al día siguiente la lista es nueva (vacía)')

  // 5. Avisos (Fase 3): mensajes, grupos y destinos.
  const evE = A.proximoEvento(new Date('2026-11-10T10:00:00-06:00'))
  const mE = V.mensajeRecordatorioEntreno(evE, 2)
  check(mE.includes('Hoy entrenamos') && mE.includes('3:30 a 5:30 pm') && mE.includes('Van 2 confirmados') && mE.includes('"voy"'), 'aviso entreno: texto completo')
  const evJ = A.proximoEvento(new Date('2026-11-14T12:00:00-06:00'))
  const mJ = V.mensajeRecordatorioJuego(evJ, 0)
  check(mJ.includes('Mañana es el juego') && mJ.includes('Van 0 confirmados') && mJ.includes('"voy"'), 'aviso juego: texto completo')
  check(V.registrarGrupo('12345@g.us', tmpG) === true, 'grupo nuevo se guarda')
  check(V.registrarGrupo('12345@g.us', tmpG) === false, 'grupo repetido no se duplica')
  V.registrarGrupo('67890@g.us', tmpG)
  check(V.cargarGrupos(tmpG).length === 2, 'dos grupos guardados')
  const dest = V.gruposDestino({ grupoId: '99999@g.us' }, tmpG)
  check(dest.length === 3 && dest[0] === '99999@g.us', 'destino = config + aprendidos, sin repetir')
  const dest2 = V.gruposDestino({ grupoId: '12345@g.us' }, tmpG)
  check(dest2.length === 2, 'config repetido no duplica')
  const li = A.lista(ahora, tmpA)
  const mInt = V.mensajeRecordatorioEntreno(li.evento, li.total)
  check(mInt.includes('Van 1 confirmados'), 'aviso usa el conteo real de la lista')

  // 6. El cron dispara (cada segundo, 2.5 s).
  let disparos = 0
  const job = cron.schedule('* * * * * *', () => { disparos++ })
  await sleep(2500)
  job.stop()
  check(disparos >= 2, `cron dispara cada segundo (${disparos} veces en 2.5s)`)

  // 7. Tras una reconexión, los avisos usan la conexión NUEVA, no la vieja.
  // Se prueba con dos conexiones falsas y la lista fingida.
  const tmpG2 = path.join(tmpDir, 'grupos2.json')
  fs.writeFileSync(tmpG2, JSON.stringify(['111@g.us']))
  process.env.GRUPOS_ARCHIVO = tmpG2
  const rutaAsistencia = require.resolve('./asistencia')
  const realAsistencia = require.cache[rutaAsistencia]
  require.cache[rutaAsistencia] = {
    exports: {
      lista: () => ({
        evento: { tipo: 'entreno', nombre: 'entreno del martes 11 de noviembre', hora: '3:30 a 5:30 pm' },
        total: 2,
      }),
    },
  }
  delete require.cache[require.resolve('./avisos')]
  const V2 = require('./avisos')
  const recibidos1 = []
  const recibidos2 = []
  const sock1 = { sendMessage: async (chatId, m) => { recibidos1.push(m.text) } }
  const sock2 = { sendMessage: async (chatId, m) => { recibidos2.push(m.text) } }
  const cfg = {
    recordatorioEntreno: '* * * * * *',
    recordatorioJuego: '0 0 29 2 *', // 29 de febrero: válido, no dispara en la prueba
    zonaHoraria: 'America/Mexico_City',
    grupoId: null,
  }
  V2.programarAvisos(sock1, cfg) // primera conexión
  V2.programarAvisos(sock2, cfg) // reconexión: debe usar esta
  await sleep(2500)
  check(recibidos2.length >= 2, `avisos tras reconexión llegan por la conexión nueva (${recibidos2.length} avisos)`)
  check(recibidos1.length === 0, 'la conexión vieja ya no recibe avisos')
  check(recibidos2[0] && recibidos2[0].includes('Hoy entrenamos'), 'el aviso tras reconexión trae el texto correcto')
  require.cache[rutaAsistencia] = realAsistencia

  fs.rmSync(tmpDir, { recursive: true, force: true })
  console.log(fails === 0 ? `TODAS LAS PRUEBAS PASAN (${total}/${total})` : `${fails} FALLOS de ${total}`)
  process.exit(fails ? 1 : 0)
}

main()
