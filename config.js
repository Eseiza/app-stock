const RAIZ = location.pathname.includes('/pages/') ? '../' : '';
// ============================================================
// AppStock - configuración central
// romero-env: SOLO LECTURA (Realtime Database)
// app-stock: LECTURA / ESCRITURA (Realtime Database)
// ============================================================

const COLECCION_PRODUCTOS = 'productos'; // compatibilidad con código anterior

// Datos que llegan desde romero-env/tareas.
const CAMPO_MARCA = 'marca';
const CAMPO_LINEA = 'linea';
const CAMPO_PRODUCTO = 'producto';
const CAMPO_CANTIDAD = 'total';

const firebaseConfigEnvase = {
  apiKey: "AIzaSyAJgnFCKt_8TT4BpWrDwqy--Oep0raYA18",
  authDomain: "romero-env.firebaseapp.com",
  projectId: "romero-env",
  storageBucket: "romero-env.firebasestorage.app",
  messagingSenderId: "350498956335",
  appId: "1:350498956335:web:901f91c4d7b983308252da",
  databaseURL: "https://romero-env-default-rtdb.firebaseio.com"
};

const firebaseConfigStock = {
  apiKey: "AIzaSyCtMcTuEtRiR05bPQFWcFaXaVfL5hjy-Og",
  authDomain: "appstock-a009e.firebaseapp.com",
  projectId: "appstock-a009e",
  storageBucket: "appstock-a009e.firebasestorage.app",
  messagingSenderId: "908675947079",
  appId: "1:908675947079:web:672cc8896eb3ccd015ef62",
  databaseURL: "https://appstock-a009e-default-rtdb.firebaseio.com"
};

const appEnvase = firebase.initializeApp(firebaseConfigEnvase, "envase");
const appStock = firebase.initializeApp(firebaseConfigStock, "stock");

// MUY IMPORTANTE: romero-env queda expuesto únicamente como lectura.
const dbEnvase = firebase.database(appEnvase);
const dbStock = firebase.database(appStock);

// ============================================================
// Sesión local (por ahora). Los permisos reales deberán reforzarse
// con reglas de Firebase antes de producción.
// ============================================================
function checkSesion(rolRequerido) {
  const rol = sessionStorage.getItem('rol');
  if (!rol) { window.location.href = RAIZ + 'index.html'; return false; }
  if (rolRequerido && rol !== rolRequerido) { window.location.href = RAIZ + 'index.html'; return false; }
  return true;
}

function getUsuario() {
  return sessionStorage.getItem('usuario') || '';
}

function getRol() {
  return sessionStorage.getItem('rol') || '';
}

function logout() {
  sessionStorage.clear();
  window.location.href = RAIZ + 'index.html';
}

function fmt(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function showToast(msg, esError = false) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = (esError ? '✕ ' : '✓ ') + msg;
  t.classList.toggle('error', esError);
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function normalizarTexto(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function buscarProductoCatalogo(marca, linea, producto) {
  const nm = normalizarTexto(marca);
  const nl = normalizarTexto(linea);
  const np = normalizarTexto(producto);

  for (const [m, lineas] of Object.entries(CATALOGO)) {
    if (normalizarTexto(m) !== nm) continue;
    for (const [l, productos] of Object.entries(lineas)) {
      if (nl && normalizarTexto(l) !== nl) continue;
      const encontrado = productos.find(p => normalizarTexto(p) === np);
      if (encontrado) return { marca: m, linea: l, producto: encontrado };
    }
  }
  return null;
}

function claveProducto(marca, linea, producto) {
  return [marca, linea, producto].join('|');
}

function obtenerRefStock(marca, linea, producto) {
  return dbStock.ref(`stock/${claveProducto(marca, linea, producto)}`);
}
