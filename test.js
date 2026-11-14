// Pruebas del bot. Corre con: npm test
// No necesita WhatsApp: prueba la lógica (respuestas, asistencia, avisos)
// con archivos temporales. Sale con código 1 si algo falla.

const fs = require('fs')
const os = require('os')
const path = require('path')
const { reglas, extraerTexto, normalizar } = require('./respuestas')
const A = require('./asistencia')
const V = require('./avisos')
const P = require('./pausa')
const C = require('./coach')
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
const norm = normalizar
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
    ['quién es el coach', 'Javier'],
    ['algo random sin sentido', null],
    // Ronda 3: inscripción, cuánto debo/es, qué llevar, gracias,
    // abreviaturas de chat y typos.
    ['cómo me inscribo', 'cómo inscribirte'],
    ['quiero entrar al equipo', 'Mensualidad'],
    ['me quiero unir', 'coach Javier'],
    ['cómo entro al equipo', 'inscribirte'],
    ['cuánto debo', 'Mensualidad'],
    ['cuánto es', 'Mensualidad'],
    ['qué necesito llevar', 'coach Javier'],
    ['qué llevo al entreno', 'coach Javier'],
    ['qué llevo al entrenamiento', 'coach Javier'],
    ['gracias', 'De nada'],
    ['gracias, ¿cuánto cuesta?', 'Mensualidad'],
    ['muchas gracias', 'De nada'],
    ['q es el horario', 'Entrenamientos'],
    ['q cuesta la mensualidad', 'Mensualidad'],
    ['tmb quiero saber el horario', 'Entrenamientos'],
    ['orario de los entrenamientos', 'Entrenamientos'],
  ]
  for (const [msg, expected] of faq) {
    const limpio = norm(msg)
    const hit = reglas.find((r) => r.claves.some((c) => limpio.includes(c)))
    check(expected ? (hit && hit.respuesta.includes(expected)) : !hit, 'FAQ ' + JSON.stringify(msg))
  }

  // 1b. Normalización: abreviaturas de chat como palabra completa.
  check(norm('Q es el horario') === 'que es el horario', 'norm: q -> que')
  check(norm('xq cuesta?') === 'porque cuesta?', 'norm: xq -> porque')
  check(norm('pq no vienes tmb') === 'porque no vienes tambien', 'norm: pq y tmb')
  check(norm('QUESO') === 'queso', 'norm: la q dentro de una palabra no se toca')
  check(norm('¿Cuánto Cuesta?') === '¿cuanto cuesta?', 'norm: minúsculas y sin acentos')

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
  check(di('quién va') === 'lista', 'intención: quién va')
  check(di('lista') === 'lista', 'intención: lista')
  check(di('¿cuánto cuesta?') === null, 'intención: costos -> null (lo atiende FAQ)')
  check(di('hola') === null, 'intención: hola -> null (lo atiende FAQ)')
  check(di('voy, ¿cuánto cuesta?') === 'confirmar', 'intención: voy + costos -> confirmar (asistencia primero)')

  // 3b. Próximo evento: qué es, cuándo es el próximo juego/entreno.
  const ahora = new Date('2026-11-10T10:00:00-06:00')
  const esP = (t) => A.esPreguntaProximo(norm(t))
  check(esP('¿cuándo es el próximo juego?') === true, 'próximo: ¿cuándo es el próximo juego?')
  check(esP('qué sigue') === true, 'próximo: qué sigue')
  check(esP('cuál es el siguiente entreno') === true, 'próximo: siguiente entreno')
  check(esP('¿a qué hora entrenan?') === false, 'próximo: ¿a qué hora entrenan? -> no (es horario)')
  check(esP('¿cuánto cuesta?') === false, 'próximo: ¿cuánto cuesta? -> no')
  const mP1 = A.mensajeProximo(ahora, tmpA)
  check(mP1.includes('entreno del martes, 10 de noviembre') && mP1.includes('Van 0 confirmados'), 'mensaje próximo: entreno de hoy sin confirmados aún')
  const mP2 = A.mensajeProximo(new Date('2026-11-14T12:00:00-06:00'), tmpA)
  check(mP2.includes('juego del domingo, 15 de noviembre') && mP2.includes('Van 0 confirmados'), 'mensaje próximo: juego del domingo sin confirmados')
  check(A.proximoJuego(new Date('2026-11-10T10:00:00-06:00')).clave === 'juego-2026-11-15', 'próximo juego desde martes -> domingo')
  check(A.proximoEntreno(new Date('2026-11-10T10:00:00-06:00')).clave === 'entreno-2026-11-10', 'próximo entreno martes 10am -> hoy')
  check(A.proximoEntreno(new Date('2026-11-10T18:00:00-06:00')).clave === 'entreno-2026-11-11', 'próximo entreno martes 6pm -> mié')
  check(A.proximoJuego(new Date('2026-11-15T12:00:00-06:00')).clave === 'juego-2026-11-15', 'próximo juego domingo -> hoy')
  // "lista del juego" y "lista del entreno" muestran ese evento, no el próximo.
  const tmpA3b = path.join(tmpDir, 'asistencia-3b.json')
  A.confirmar('5215522222222@s.whatsapp.net', 'Javier', new Date('2026-11-14T12:00:00-06:00'), tmpA3b)
  A.confirmar('5215511111111@s.whatsapp.net', 'Mich', ahora, tmpA3b)
  const lj = A.lista(ahora, tmpA3b, A.proximoJuego(ahora))
  check(lj.total === 1 && lj.evento.tipo === 'juego', 'lista del juego: trae la lista del domingo')
  const le = A.lista(ahora, tmpA3b, A.proximoEntreno(ahora))
  check(le.total === 1 && le.evento.tipo === 'entreno', 'lista del entreno: trae la lista de hoy')

  // 3c. El menú ya trae los comandos nuevos.
  const menu = reglas.find((r) => r.claves.includes('menu')).respuesta
  check(menu.includes('próximo') && menu.includes('coach'), 'menú: trae próximo y coach')

  // 3d. Leer el texto venga como venga: texto, respuesta, pie de foto/video.
  check(extraerTexto({ message: { conversation: 'hola' } }) === 'hola', 'texto: mensaje normal')
  check(extraerTexto({ message: { extendedTextMessage: { text: 'horario' } } }) === 'horario', 'texto: respuesta a otro mensaje')
  check(extraerTexto({ message: { imageMessage: { caption: 'costos' } } }) === 'costos', 'texto: pie de foto')
  check(extraerTexto({ message: { videoMessage: { caption: 'voy' } } }) === 'voy', 'texto: pie de video')
  check(extraerTexto({ message: { stickerMessage: {} } }) === '', 'texto: sticker sin texto -> vacío')
  check(extraerTexto({ message: {} }) === '', 'texto: mensaje sin texto -> vacío')

  // 4. Flujo confirmar/cancelar/lista (Fase 2).
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

  // 4b. Asistencia con objetivo: "voy al juego" anota para el domingo
  // aunque el próximo evento sea un entreno (y al revés).
  const tmpA4b = path.join(tmpDir, 'asistencia-4b.json')
  const martes = new Date('2026-11-10T10:00:00-06:00')
  check(A.eventoPedido(norm('voy al juego')) === 'juego', 'objetivo: voy al juego -> juego')
  check(A.eventoPedido(norm('voy al partido')) === 'juego', 'objetivo: voy al partido -> juego')
  check(A.eventoPedido(norm('voy al entreno')) === 'entreno', 'objetivo: voy al entreno -> entreno')
  check(A.eventoPedido(norm('me voy a entrenar')) === 'entreno', 'objetivo: me voy a entrenar -> entreno')
  check(A.eventoPedido(norm('voy')) === null, 'objetivo: voy solo -> null (próximo)')
  check(A.eventoPedido(norm('lista del juego')) === 'juego', 'objetivo: lista del juego -> juego')
  check(A.eventoPedido(norm('lista del entreno')) === 'entreno', 'objetivo: lista del entreno -> entreno')
  check(A.eventoPedido(norm('lista')) === null, 'objetivo: lista sola -> null')
  let r4 = A.confirmar('5215511111111@s.whatsapp.net', 'Mich', martes, tmpA4b, 'juego')
  check(r4.estado === 'nuevo' && r4.evento.clave === 'juego-2026-11-15', 'voy al juego el martes -> anota para el domingo')
  r4 = A.confirmar('5215522222222@s.whatsapp.net', 'Javier', martes, tmpA4b, 'entreno')
  check(r4.estado === 'nuevo' && r4.evento.clave === 'entreno-2026-11-10', 'voy al entreno el martes -> anota para hoy')
  r4 = A.confirmar('5215533333333@s.whatsapp.net', 'Ana', martes, tmpA4b)
  check(r4.estado === 'nuevo' && r4.evento.clave === 'entreno-2026-11-10', 'voy solo el martes -> próximo (entreno de hoy)')
  let l4 = A.lista(martes, tmpA4b, A.proximoJuego(martes))
  check(l4.total === 1 && l4.nombres[0] === 'Mich', 'lista del juego: solo Mich')
  r4 = A.cancelar('5215511111111@s.whatsapp.net', martes, tmpA4b, 'juego')
  check(r4.estado === 'quitado' && r4.evento.clave === 'juego-2026-11-15', 'no voy al juego -> se quita del domingo')
  l4 = A.lista(martes, tmpA4b, A.proximoEntreno(martes))
  check(l4.total === 2, 'cancelar del juego no toca la lista del entreno')

  // 4c. Pausa del coach: empieza inactiva, se guarda en archivo y
  // sobrevive (se lee de vuelta del archivo).
  const tmpP = path.join(tmpDir, 'pausa.json')
  check(P.estaEnPausa(tmpP) === false, 'pausa: sin archivo -> no hay pausa')
  P.ponerPausa(true, tmpP)
  check(P.estaEnPausa(tmpP) === true, 'pausa: !pausa -> en pausa')
  P.ponerPausa(false, tmpP)
  check(P.estaEnPausa(tmpP) === false, 'pausa: !activa -> sin pausa')
  check(!fs.existsSync(`${tmpP}.tmp`), 'pausa: escritura atómica, sin temporal')
  check(JSON.parse(fs.readFileSync(tmpP, 'utf8')).pausa === false, 'pausa: el archivo guarda el estado')

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

  // 5b. Avisos con nombres: el recordatorio dice quiénes van (máx. 15).
  const mN1 = V.mensajeRecordatorioEntreno(evE, 2, ['Mich', 'Javier'])
  check(mN1.includes('Van 2 confirmados: Mich, Javier'), 'aviso entreno: trae los nombres')
  const mN0 = V.mensajeRecordatorioEntreno(evE, 0, [])
  check(mN0.includes('Van 0 confirmados hasta ahora.'), 'aviso entreno: sin confirmados no trae nombres')
  const muchos = Array.from({ length: 17 }, (_, i) => `Persona${i + 1}`)
  const mN17 = V.mensajeRecordatorioEntreno(evE, 17, muchos)
  check(mN17.includes('Persona15') && mN17.includes('y 2 más') && !mN17.includes('Persona16'), 'aviso entreno: máx. 15 nombres y "y 2 más"')
  const mNJ = V.mensajeRecordatorioJuego(evJ, 1, ['Ana'])
  check(mNJ.includes('Van 1 confirmados: Ana'), 'aviso juego: trae el nombre')
  // El recordatorio del próximo evento (para !recordatorio).
  const tmpA5b = path.join(tmpDir, 'asistencia-5b.json')
  A.confirmar('5215511111111@s.whatsapp.net', 'Mich', new Date('2026-11-10T10:00:00-06:00'), tmpA5b)
  const mProxE = V.mensajeRecordatorioProximo(new Date('2026-11-10T10:00:00-06:00'), tmpA5b)
  check(mProxE.includes('Hoy entrenamos') && mProxE.includes('Mich') && mProxE.includes('Van 1 confirmados'), 'recordatorio próximo (martes): entreno con Mich')
  A.confirmar('5215522222222@s.whatsapp.net', 'Javier', new Date('2026-11-14T12:00:00-06:00'), tmpA5b)
  const mProxJ = V.mensajeRecordatorioProximo(new Date('2026-11-14T12:00:00-06:00'), tmpA5b)
  check(mProxJ.includes('Mañana es el juego') && mProxJ.includes('Javier'), 'recordatorio próximo (sábado): juego con Javier')

  // 5c. Comandos del coach (!pausa, !activa, !info, !recordatorio).
  const tmpA5c = path.join(tmpDir, 'asistencia-5c.json')
  const tmpP5c = path.join(tmpDir, 'pausa-5c.json')
  const martes5c = new Date('2026-11-10T10:00:00-06:00')
  const sockFalso = { enviados: [], sendMessage: async (chatId, m) => { sockFalso.enviados.push(m.text) } }
  const opc5c = { ahora: martes5c, archivoAsistencia: tmpA5c, archivoPausa: tmpP5c }
  let rC = await C.manejarComando('!info', sockFalso, '111@g.us', opc5c)
  check(rC.includes('activo') && rC.includes('Mensualidad') && rC.includes('entreno del martes, 10 de noviembre') && rC.includes('Van 0 confirmados'), '!info: estado, horario, costos y próximo sin confirmados')
  rC = await C.manejarComando('!pausa', sockFalso, '111@g.us', opc5c)
  check(rC.includes('en pausa') && P.estaEnPausa(tmpP5c) === true, '!pausa: pone en pausa y lo guarda')
  rC = await C.manejarComando('!pausa', sockFalso, '111@g.us', opc5c)
  check(rC.includes('ya estaba en pausa'), '!pausa dos veces: avisa que ya estaba')
  rC = await C.manejarComando('!info', sockFalso, '111@g.us', opc5c)
  check(rC.includes('en pausa'), '!info en pausa: dice que está en pausa')
  A.confirmar('5215511111111@s.whatsapp.net', 'Mich', martes5c, tmpA5c)
  rC = await C.manejarComando('!recordatorio', sockFalso, '111@g.us', opc5c)
  check(rC === null && sockFalso.enviados.length === 1 && sockFalso.enviados[0].includes('Hoy entrenamos') && sockFalso.enviados[0].includes('Mich'), '!recordatorio: manda el aviso al grupo y no responde nada más')
  rC = await C.manejarComando('!activa', sockFalso, '111@g.us', opc5c)
  check(rC.includes('activo de nuevo') && P.estaEnPausa(tmpP5c) === false, '!activa: quita la pausa')
  rC = await C.manejarComando('!activa', sockFalso, '111@g.us', opc5c)
  check(rC.includes('ya estaba activo'), '!activa dos veces: avisa que ya estaba')
  rC = await C.manejarComando('!aviso hola', sockFalso, '111@g.us', opc5c)
  check(rC.includes('Comandos del coach'), 'comando desconocido: lista los comandos')
  rC = await C.manejarComando('! pausa', sockFalso, '111@g.us', opc5c)
  check(rC.includes('en pausa'), '"! pausa" con espacio también funciona')

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

  // 8. Una hora inválida en config no tumba el bot: se registra el error y
  // el otro aviso sigue funcionando.
  const tmpG3 = path.join(tmpDir, 'grupos3.json')
  fs.writeFileSync(tmpG3, JSON.stringify(['222@g.us']))
  process.env.GRUPOS_ARCHIVO = tmpG3
  require.cache[rutaAsistencia] = {
    exports: {
      lista: () => ({
        evento: { tipo: 'entreno', nombre: 'entreno del martes 11 de noviembre', hora: '3:30 a 5:30 pm' },
        total: 2,
      }),
    },
  }
  delete require.cache[require.resolve('./avisos')]
  const V3 = require('./avisos')
  const recibidos3 = []
  const sock3 = { sendMessage: async (chatId, m) => { recibidos3.push(m.text) } }
  let noTumbo = true
  try {
    V3.programarAvisos(sock3, {
      recordatorioEntreno: '* * * * * *',
      recordatorioJuego: 'basura-no-es-cron',
      zonaHoraria: 'America/Mexico_City',
      grupoId: null,
    })
  } catch { noTumbo = false }
  check(noTumbo, 'hora inválida en config no tumba el bot')
  await sleep(2500)
  check(recibidos3.length >= 1, `el aviso válido sigue funcionando aunque el otro sea inválido (${recibidos3.length} avisos)`)
  require.cache[rutaAsistencia] = realAsistencia

  // 9. Escrituras atómicas: 20 confirmaciones rápidas no corrompen el archivo.
  const tmpA2 = path.join(tmpDir, 'asistencia2.json')
  const fechaAtom = new Date('2026-11-10T10:00:00-06:00')
  for (let i = 0; i < 20; i++) {
    A.confirmar(`52155000000${String(i).padStart(2, '0')}@s.whatsapp.net`, `Persona${i}`, fechaAtom, tmpA2)
  }
  let atomOk = false
  try {
    const datos = JSON.parse(fs.readFileSync(tmpA2, 'utf8'))
    atomOk = datos['entreno-2026-11-10'].length === 20
  } catch { atomOk = false }
  check(atomOk, '20 confirmaciones rápidas: archivo válido con 20 personas')
  check(!fs.existsSync(`${tmpA2}.tmp`), 'no quedan archivos temporales tras escribir')

  fs.rmSync(tmpDir, { recursive: true, force: true })
  console.log(fails === 0 ? `TODAS LAS PRUEBAS PASAN (${total}/${total})` : `${fails} FALLOS de ${total}`)
  process.exit(fails ? 1 : 0)
}

main()
