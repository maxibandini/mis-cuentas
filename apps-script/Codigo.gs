// ===================== CONFIGURACIÓN =====================
// 1) Poné tu clave acá (la vas a escribir una vez en cada dispositivo).
// 2) Elegí la función "configurar" arriba y tocá Ejecutar.
// 3) Después podés borrar la clave de esta línea si querés, ya queda guardada.
const CLAVE_INICIAL = 'cambiame'

const HOJA_MOV = 'Movimientos'
const HOJA_CAT = 'Categorias'

// Solo se usan si la hoja Categorias no existe todavía
const CATEGORIAS_BASE = [
  ['Gasto', 'Vivienda', '🏠', ''],
  ['Gasto', 'Comida', '🍽️', ''],
  ['Gasto', 'Supermercado', '🛒', ''],
  ['Gasto', 'Servicios', '💡', ''],
  ['Gasto', 'Transporte', '🚗', ''],
  ['Gasto', 'Compras', '🛍️', ''],
  ['Gasto', 'Ropa', '👕', ''],
  ['Gasto', 'Salir', '🍻', ''],
  ['Gasto', 'Entretenimiento', '🍿', ''],
  ['Gasto', 'Suscripciones', '📅', ''],
  ['Gasto', 'Extras', '🤷', ''],
  ['Ingreso', 'Salario', '💰', ''],
  ['Ingreso', 'Inversiones', '📊', ''],
]
// =========================================================

function configurar() {
  if (!CLAVE_INICIAL || CLAVE_INICIAL === 'cambiame') throw new Error('Primero cambiá CLAVE_INICIAL por tu clave')
  PropertiesService.getScriptProperties().setProperty('CLAVE', CLAVE_INICIAL)
  const h = hojas_()
  // Planillas de la versión vieja no tenían la columna Presupuesto
  if (h.cat.getRange(1, 4).getValue() !== 'Presupuesto') h.cat.getRange(1, 4).setValue('Presupuesto')
  Logger.log('Listo. Clave guardada y hojas verificadas.')
}

// Abrir la URL en el navegador sirve para comprobar que la API responde
function doGet() {
  return ContentService.createTextOutput('La API de Mis cuentas está funcionando.')
}

// Toda la comunicación con la app pasa por acá.
// Body JSON  { clave, accion, datos }            → responde JSON { ok, data } o { ok:false, error }
// Body JSON  { clave, atajo:true, accion, ... }  → responde texto simple (para Atajos de iPhone)
function doPost(e) {
  let d = {}
  try { d = JSON.parse(e.postData.contents) } catch (err) { return json_({ ok: false, error: 'Formato inválido' }) }

  if (!claveValida_(d.clave)) {
    return d.atajo ? texto_('Clave incorrecta') : json_({ ok: false, error: 'CLAVE' })
  }

  try {
    if (d.atajo) return texto_(atajo_(d))
    return json_({ ok: true, data: ejecutar_(d.accion, d.datos || {}) })
  } catch (err) {
    return d.atajo ? texto_('Error, ' + err.message) : json_({ ok: false, error: err.message })
  }
}

function ejecutar_(accion, datos) {
  switch (accion) {
    case 'cargar': return cargar_()
    case 'agregar': return conLock_(() => agregar_(datos))
    case 'editar': return conLock_(() => editar_(datos))
    case 'borrar': return conLock_(() => borrar_(String(datos.id)))
    case 'guardarCategoria': return conLock_(() => guardarCategoria_(datos))
    case 'borrarCategoria': return conLock_(() => borrarCategoria_(datos))
  }
  throw new Error('Acción desconocida')
}

// ---------- Atajo rápido de iPhone ----------
// Sin tipo, "categorias" devuelve todas (gastos primero) y al guardar el tipo sale de la categoría elegida.
// Abre las hojas y lee los movimientos una sola vez, cada llamada a la planilla suma tiempo.
function atajo_(d) {
  const h = hojas_()
  const cats = leerCategorias_(h)
  if (d.accion === 'categorias') {
    const lista = d.tipo
      ? cats.filter(c => c.tipo === normalizarTipo_(d.tipo))
      : cats.filter(c => c.tipo === 'Gasto').concat(cats.filter(c => c.tipo === 'Ingreso'))
    return lista.map(c => c.emoji + ' ' + c.nombre).join('\n')
  }
  const texto = String(d.categoria || '').trim()
  const coincide = c => c.emoji + ' ' + c.nombre === texto || c.nombre === texto
  const cat = cats.find(c => coincide(c) && (!d.tipo || c.tipo === normalizarTipo_(d.tipo))) || cats.find(coincide)
  const tipo = d.tipo || (cat ? cat.tipo : 'Gasto')
  const m = conLock_(() => agregar_({ tipo: tipo, monto: d.monto, categoria: cat ? cat.nombre : texto, nota: d.nota }, h))
  const filas = leer_(h.mov, 6)
  let msg = '✓ ' + m.tipo + ' de ' + fmt_(Math.abs(m.monto)) + ' en ' + m.categoria
  if (cat && cat.presupuesto && m.tipo === 'Gasto') {
    const hoy = new Date()
    const gastado = filas
      .filter(r => r[3] === cat.nombre && Number(r[4]) < 0 && mismoMes_(new Date(r[1]), hoy))
      .reduce((s, r) => s - Number(r[4]), 0)
    const resto = cat.presupuesto - gastado
    msg += resto >= 0 ? '\nTe quedan ' + fmt_(resto) + ' este mes' : '\nTe pasaste ' + fmt_(-resto) + ' este mes'
  }
  const saldo = filas.reduce((s, r) => s + (Number(r[4]) || 0), 0)
  return msg + '\nSaldo ' + fmt_(saldo)
}

// ---------- Hojas ----------
function hojas_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  let mov = ss.getSheetByName(HOJA_MOV)
  if (!mov) {
    mov = ss.insertSheet(HOJA_MOV)
    mov.appendRow(['ID', 'Fecha', 'Tipo', 'Categoría', 'Monto', 'Nota'])
    mov.setFrozenRows(1)
    mov.getRange('B2:B').setNumberFormat('dd/MM/yyyy HH:mm')
    mov.getRange('E2:E').setNumberFormat('#,##0.00')
  }
  let cat = ss.getSheetByName(HOJA_CAT)
  if (!cat) {
    cat = ss.insertSheet(HOJA_CAT)
    cat.appendRow(['Tipo', 'Nombre', 'Emoji', 'Presupuesto'])
    cat.setFrozenRows(1)
    cat.getRange(2, 1, CATEGORIAS_BASE.length, 4).setValues(CATEGORIAS_BASE)
  }
  return { ss: ss, mov: mov, cat: cat }
}

function claveValida_(clave) {
  const guardada = PropertiesService.getScriptProperties().getProperty('CLAVE')
  return !!guardada && String(clave || '') === guardada
}

function leer_(hoja, columnas) {
  const n = hoja.getLastRow() - 1
  if (n < 1) return []
  return hoja.getRange(2, 1, n, columnas || hoja.getLastColumn()).getValues()
}

function conLock_(fn) {
  const lock = LockService.getScriptLock()
  lock.waitLock(15000)
  try { return fn() } finally { lock.releaseLock() }
}

// ---------- Lectura ----------
function leerCategorias_(h) {
  return leer_((h || hojas_()).cat, 4)
    .filter(r => r[1] !== '')
    .map(r => ({ tipo: normalizarTipo_(r[0]), nombre: String(r[1]), emoji: String(r[2] || '•'), presupuesto: Number(r[3]) || 0 }))
}

function cargar_() {
  const h = hojas_()
  const filas = leer_(h.mov, 6)
  let faltaban = false
  filas.forEach(r => { if (!r[0]) { r[0] = Utilities.getUuid(); faltaban = true } })
  if (faltaban) h.mov.getRange(2, 1, filas.length, 1).setValues(filas.map(r => [r[0]]))

  const movs = filas
    .filter(r => r[4] !== '' && !isNaN(Number(r[4])))
    .map(r => ({
      id: String(r[0]), fecha: fechaIso_(r[1]), tipo: normalizarTipo_(r[2]),
      categoria: String(r[3] || 'Extras'), monto: Number(r[4]), nota: String(r[5] || ''),
    }))
  return { movs: movs, cats: leerCategorias_(h), url: h.ss.getUrl() }
}

// ---------- Movimientos ----------
function armar_(d) {
  const tipo = normalizarTipo_(d.tipo)
  const valor = Math.abs(parseMonto_(d.monto))
  if (!valor) throw new Error('El monto tiene que ser mayor a cero')
  let fecha = d.fecha ? new Date(d.fecha) : new Date()
  if (isNaN(fecha.getTime())) fecha = new Date()
  return {
    tipo: tipo,
    categoria: String(d.categoria || 'Extras').trim().slice(0, 60),
    monto: tipo === 'Gasto' ? -valor : valor,
    nota: String(d.nota || '').slice(0, 200),
    fecha: fecha,
  }
}

function agregar_(d, h) {
  const m = armar_(d)
  const id = d.id && !String(d.id).startsWith('tmp') ? String(d.id) : Utilities.getUuid()
  const mov = (h || hojas_()).mov
  mov.appendRow([id, m.fecha, m.tipo, m.categoria, m.monto, m.nota])
  return salida_(id, m)
}

function editar_(d) {
  const mov = hojas_().mov
  const fila = filaDe_(mov, String(d.id))
  if (!fila) throw new Error('No encontré ese movimiento')
  const m = armar_(d)
  mov.getRange(fila, 2, 1, 5).setValues([[m.fecha, m.tipo, m.categoria, m.monto, m.nota]])
  return salida_(String(d.id), m)
}

function borrar_(id) {
  const mov = hojas_().mov
  const fila = filaDe_(mov, id)
  if (!fila) throw new Error('No encontré ese movimiento')
  mov.deleteRow(fila)
  return { ok: true }
}

function filaDe_(hoja, id) {
  const ids = leer_(hoja, 1)
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return i + 2
  return 0
}

function salida_(id, m) {
  return { id: id, fecha: m.fecha.toISOString(), tipo: m.tipo, categoria: m.categoria, monto: m.monto, nota: m.nota }
}

// ---------- Categorías ----------
function guardarCategoria_(d) {
  const h = hojas_()
  const tipo = normalizarTipo_(d.tipo)
  const nombre = String(d.nombre || '').trim().slice(0, 40)
  if (!nombre) throw new Error('Falta el nombre')
  const emoji = String(d.emoji || '•').slice(0, 8)
  const presupuesto = Math.abs(parseMonto_(d.presupuesto)) || ''
  const filas = leer_(h.cat, 4)
  const buscar = d.original || nombre
  const idx = filas.findIndex(r => normalizarTipo_(r[0]) === tipo && String(r[1]) === buscar)

  if (idx < 0) {
    if (filas.some(r => normalizarTipo_(r[0]) === tipo && String(r[1]) === nombre)) throw new Error('Esa categoría ya existe')
    h.cat.appendRow([tipo, nombre, emoji, presupuesto])
  } else {
    h.cat.getRange(idx + 2, 1, 1, 4).setValues([[tipo, nombre, emoji, presupuesto]])
    if (d.original && d.original !== nombre) renombrarEnMovimientos_(h.mov, tipo, d.original, nombre)
  }
  return { tipo: tipo, nombre: nombre, emoji: emoji, presupuesto: Number(presupuesto) || 0 }
}

function renombrarEnMovimientos_(mov, tipo, viejo, nuevo) {
  const n = mov.getLastRow() - 1
  if (n < 1) return
  const rango = mov.getRange(2, 3, n, 2)
  const vals = rango.getValues()
  let cambio = false
  vals.forEach(r => { if (normalizarTipo_(r[0]) === tipo && r[1] === viejo) { r[1] = nuevo; cambio = true } })
  if (cambio) rango.setValues(vals)
}

function borrarCategoria_(d) {
  const h = hojas_()
  const tipo = normalizarTipo_(d.tipo)
  const filas = leer_(h.cat, 4)
  const idx = filas.findIndex(r => normalizarTipo_(r[0]) === tipo && String(r[1]) === String(d.nombre))
  if (idx < 0) throw new Error('No encontré esa categoría')
  h.cat.deleteRow(idx + 2)
  return { ok: true }
}

// ---------- Utilidades ----------
function normalizarTipo_(t) { return String(t || '').trim().toLowerCase() === 'ingreso' ? 'Ingreso' : 'Gasto' }

function parseMonto_(v) {
  if (typeof v === 'number') return v
  let s = String(v || '').replace(/[^\d.,-]/g, '')
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  return Number(s) || 0
}

function fechaIso_(v) {
  const d = v instanceof Date ? v : new Date(v)
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

function mismoMes_(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() }

function fmt_(n) {
  const p = Math.abs(n).toFixed(2).split('.')
  return (n < 0 ? '-' : '') + '$ ' + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (p[1] === '00' ? '' : ',' + p[1])
}

function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON) }
function texto_(t) { return ContentService.createTextOutput(t).setMimeType(ContentService.MimeType.TEXT) }
