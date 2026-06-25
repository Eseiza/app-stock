// ============================================================
// ⚠️ AJUSTAR: nombre de colección y campos en romero-env
const COLECCION_PRODUCTOS = 'productos';
const CAMPO_NOMBRE        = 'nombre';
const CAMPO_CODIGO        = 'codigo';
const CAMPO_UNIDAD        = 'unidad';
// ============================================================

const firebaseConfigEnvase = {
  apiKey: "AIzaSyAJgnFCKt_8TT4BpWrDwqy--Oep0raYA18",
  authDomain: "romero-env.firebaseapp.com",
  projectId: "romero-env",
  storageBucket: "romero-env.firebasestorage.app",
  messagingSenderId: "350498956335",
  appId: "1:350498956335:web:901f91c4d7b983308252da"
};

const firebaseConfigStock = {
  apiKey: "AIzaSyCtMcTuEtRiR05bPQFWcFaXaVfL5hjy-Og",
  authDomain: "appstock-a009e.firebaseapp.com",
  projectId: "appstock-a009e",
  storageBucket: "appstock-a009e.firebasestorage.app",
  messagingSenderId: "908675947079",
  appId: "1:908675947079:web:672cc8896eb3ccd015ef62"
};

const appEnvase = firebase.initializeApp(firebaseConfigEnvase, "envase");
const appStock  = firebase.initializeApp(firebaseConfigStock, "stock");
const dbEnvase  = firebase.firestore(appEnvase);
const dbStock   = firebase.firestore(appStock);
const auth      = firebase.auth(appStock);

// ── Utilidades comunes ──────────────────────────────────────

function fmt(date) {
  return date.toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = '✓ ' + msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
