let currentUser      = null;
let productos        = [];
let stockData        = {};
let todosMovimientos = [];

// ── AUTH GUARD ────────────────────────────────────────────────
auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  const doc = await dbStock.collection('usuarios').doc(user.uid).get();
  if (!doc.exists || doc.data().rol !== 'admin') {
    await auth.signOut(); window.location.href = 'index.html'; return;
  }
  currentUser = { uid: user.uid, ...doc.data() };
  document.getElementById('user-name').textContent   = currentUser.nombre;
  document.getElementById('user-avatar').textContent = currentUser.nombre.charAt(0).toUpperCase();
  await cargarProductos();
  iniciarListeners();
});

// ── TABS ───────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await auth.signOut(); window.location.href = 'index.html';
});

// ── CARGAR PRODUCTOS (romero-env) ──────────────────────────────
async function cargarProductos() {
  try {
    const snap = await dbEnvase.collection(COLECCION_PRODUCTOS).orderBy(CAMPO_NOMBRE).get();
    productos = snap.docs.map(doc => ({
      id:     doc.id,
      nombre: doc.data()[CAMPO_NOMBRE] || '(sin nombre)',
      codigo: doc.data()[CAMPO_CODIGO] || '',
      unidad: doc.data()[CAMPO_UNIDAD] || ''
    }));
    poblarSelects();
    await cargarStock();
  } catch (e) {
    document.getElementById('stock-loading').innerHTML =
      `<div class="empty-icon">⚠️</div><p>Error al cargar productos.<br>
       <small>Verificá la colección <strong>${COLECCION_PRODUCTOS}</strong> en Firestore de romero-env.</small></p>`;
    console.error(e);
  }
}

function poblarSelects() {
  ['mov-producto', 'hist-filtro-prod'].forEach(id => {
    const sel   = document.getElementById(id);
    const first = sel.options[0];
    sel.innerHTML = '';
    sel.appendChild(first);
    productos.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = (p.codigo ? p.codigo + ' · ' : '') + p.nombre;
      sel.appendChild(opt);
    });
  });
}

// ── CARGAR STOCK (appstock-a009e) ──────────────────────────────
async function cargarStock() {
  const snap = await dbStock.collection('stock').get();
  stockData  = {};
  snap.docs.forEach(doc => { stockData[doc.id] = doc.data(); });
  renderStockTable();
  renderStats();
}

function renderStats() {
  const total    = productos.length;
  const sinStock = productos.filter(p => (stockData[p.id]?.cantidad ?? 0) <= 0).length;
  const conStock = total - sinStock;
  document.getElementById('stats-row').innerHTML = `
    <div class="stat-chip gold">
      <div class="stat-label">Productos</div>
      <div class="stat-value">${total}</div>
    </div>
    <div class="stat-chip success">
      <div class="stat-label">Con stock</div>
      <div class="stat-value">${conStock}</div>
    </div>
    <div class="stat-chip danger">
      <div class="stat-label">Sin stock</div>
      <div class="stat-value">${sinStock}</div>
    </div>
  `;
}

function renderStockTable() {
  const tbody = document.getElementById('stock-tbody');
  tbody.innerHTML = '';
  if (!productos.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Sin productos</td></tr>'; return;
  }
  productos.forEach(p => {
    const s   = stockData[p.id] || {};
    const qty = s.cantidad ?? 0;
    const cls = qty > 0 ? 'qty-ok' : 'qty-zero';
    const fecha = s.ultimaActualizacion ? fmt(s.ultimaActualizacion.toDate()) : '—';
    const tr  = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="product-name">${p.nombre}</div>
        ${p.codigo ? `<div class="product-code">${p.codigo}</div>` : ''}
      </td>
      <td>${p.unidad || '—'}</td>
      <td>
        <div class="qty-display ${cls}">
          <span class="qty-number">${qty}</span>
          ${p.unidad ? `<span class="qty-unit">${p.unidad}</span>` : ''}
        </div>
      </td>
      <td style="color:var(--muted);font-size:12.5px">${fecha}</td>
      <td>
        <div class="adj-row">
          <input type="number" class="adj-input" id="adj-${p.id}" value="${qty}" min="0" />
          <button class="btn btn-gold btn-sm" onclick="ajustarStock('${p.id}')">Ajustar</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  document.getElementById('stock-loading').classList.add('hidden');
  document.getElementById('stock-table').classList.remove('hidden');
}

// ── AJUSTE MANUAL ──────────────────────────────────────────────
window.ajustarStock = async function(productoId) {
  const p      = productos.find(x => x.id === productoId);
  const input  = document.getElementById('adj-' + productoId);
  const cantidad = parseInt(input.value);
  if (isNaN(cantidad) || cantidad < 0) { showToast('Cantidad inválida'); return; }

  const ahora = firebase.firestore.Timestamp.fromDate(new Date());
  const batch = dbStock.batch();

  batch.set(dbStock.collection('stock').doc(productoId), {
    nombre: p.nombre, codigo: p.codigo, unidad: p.unidad,
    cantidad, ultimaActualizacion: ahora
  });
  batch.set(dbStock.collection('movimientos').doc(), {
    productoId, productoNombre: p.nombre, tipo: 'ajuste',
    cantidad, fecha: ahora,
    usuarioId: currentUser.uid, usuarioNombre: currentUser.nombre
  });
  await batch.commit();

  stockData[productoId] = { nombre: p.nombre, codigo: p.codigo, unidad: p.unidad, cantidad, ultimaActualizacion: ahora };
  renderStockTable();
  renderStats();
  showToast(`"${p.nombre}" → ${cantidad} ${p.unidad}`);
};

// ── REGISTRAR MOVIMIENTO ───────────────────────────────────────
document.getElementById('mov-producto').addEventListener('change', () => {
  const id  = document.getElementById('mov-producto').value;
  const div = document.getElementById('mov-stock-actual');
  if (!id) { div.classList.add('hidden'); return; }
  const p   = productos.find(x => x.id === id);
  const qty = stockData[id]?.cantidad ?? 0;
  div.textContent = `Stock actual de "${p.nombre}": ${qty} ${p.unidad}`;
  div.classList.remove('hidden');
});

document.getElementById('btn-registrar').addEventListener('click', async () => {
  const productoId = document.getElementById('mov-producto').value;
  const tipo       = document.getElementById('mov-tipo').value;
  const cantidad   = parseInt(document.getElementById('mov-cantidad').value);
  const errDiv     = document.getElementById('mov-error');
  const okDiv      = document.getElementById('mov-ok');
  errDiv.classList.add('hidden'); okDiv.classList.add('hidden');

  if (!productoId) {
    errDiv.textContent = 'Seleccioná un producto.'; errDiv.classList.remove('hidden'); return;
  }
  if (!cantidad || cantidad <= 0) {
    errDiv.textContent = 'Ingresá una cantidad válida.'; errDiv.classList.remove('hidden'); return;
  }

  const p           = productos.find(x => x.id === productoId);
  const stockActual = stockData[productoId]?.cantidad ?? 0;

  if (tipo === 'salida' && cantidad > stockActual) {
    errDiv.textContent = `Stock insuficiente. Stock actual: ${stockActual} ${p.unidad}`;
    errDiv.classList.remove('hidden'); return;
  }

  const nuevoStock = tipo === 'entrada' ? stockActual + cantidad : stockActual - cantidad;
  const ahora      = firebase.firestore.Timestamp.fromDate(new Date());
  const batch      = dbStock.batch();

  batch.set(dbStock.collection('stock').doc(productoId), {
    nombre: p.nombre, codigo: p.codigo, unidad: p.unidad,
    cantidad: nuevoStock, ultimaActualizacion: ahora
  });
  batch.set(dbStock.collection('movimientos').doc(), {
    productoId, productoNombre: p.nombre, tipo, cantidad, fecha: ahora,
    usuarioId: currentUser.uid, usuarioNombre: currentUser.nombre
  });
  await batch.commit();

  stockData[productoId] = { nombre: p.nombre, codigo: p.codigo, unidad: p.unidad, cantidad: nuevoStock, ultimaActualizacion: ahora };
  renderStockTable(); renderStats();
  document.getElementById('mov-cantidad').value = '';
  document.getElementById('mov-stock-actual').classList.add('hidden');
  showToast(`${tipo === 'entrada' ? 'Entrada' : 'Salida'} registrada`);
  okDiv.textContent = `Nuevo stock de "${p.nombre}": ${nuevoStock} ${p.unidad}`;
  okDiv.classList.remove('hidden');
});

// ── HISTORIAL (tiempo real) ────────────────────────────────────
function iniciarListeners() {
  dbStock.collection('movimientos').orderBy('fecha', 'desc').limit(300)
    .onSnapshot(snap => {
      todosMovimientos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderHistorial();
    });
  dbStock.collection('usuarios')
    .onSnapshot(snap => renderUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

function renderHistorial() {
  const fp   = document.getElementById('hist-filtro-prod').value;
  const ft   = document.getElementById('hist-filtro-tipo').value;
  const rows = todosMovimientos.filter(m => {
    if (fp && m.productoId !== fp) return false;
    if (ft && m.tipo !== ft) return false;
    return true;
  });
  const tbody  = document.getElementById('hist-tbody');
  const labels = { entrada: '↑ Entrada', salida: '↓ Salida', ajuste: '⚙ Ajuste' };
  tbody.innerHTML = '';
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Sin movimientos</td></tr>'; return;
  }
  rows.forEach(m => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-size:12.5px;color:var(--muted)">${m.fecha ? fmt(m.fecha.toDate()) : '—'}</td>
      <td class="product-name">${m.productoNombre}</td>
      <td><span class="badge badge-${m.tipo}">${labels[m.tipo] || m.tipo}</span></td>
      <td style="font-weight:700">${m.cantidad}</td>
      <td style="font-size:12.5px;color:var(--muted)">${m.usuarioNombre || '—'}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById('hist-filtro-prod').addEventListener('change', renderHistorial);
document.getElementById('hist-filtro-tipo').addEventListener('change', renderHistorial);

// ── USUARIOS ───────────────────────────────────────────────────
function renderUsuarios(usuarios) {
  const tbody = document.getElementById('usr-tbody');
  tbody.innerHTML = '';
  if (!usuarios.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-row">Sin usuarios</td></tr>'; return;
  }
  usuarios.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="product-name">${u.nombre}</td>
      <td style="font-size:12.5px;color:var(--muted)">${u.email}</td>
      <td><span class="badge badge-${u.rol}">${u.rol}</span></td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="cambiarRol('${u.id}','${u.rol === 'admin' ? 'operador' : 'admin'}')">
          → ${u.rol === 'admin' ? 'operador' : 'admin'}
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.cambiarRol = async function(uid, nuevoRol) {
  await dbStock.collection('usuarios').doc(uid).update({ rol: nuevoRol });
  showToast('Rol actualizado');
};

document.getElementById('btn-crear-usuario').addEventListener('click', async () => {
  const nombre   = document.getElementById('usr-nombre').value.trim();
  const email    = document.getElementById('usr-email').value.trim();
  const password = document.getElementById('usr-password').value;
  const rol      = document.getElementById('usr-rol').value;
  const errDiv   = document.getElementById('usr-error');
  errDiv.classList.add('hidden');

  if (!nombre || !email || !password) {
    errDiv.textContent = 'Completá todos los campos.'; errDiv.classList.remove('hidden'); return;
  }

  try {
    // App temporal para no cerrar la sesión del admin actual
    const appTemp  = firebase.initializeApp(firebaseConfigStock, 'temp_' + Date.now());
    const authTemp = firebase.auth(appTemp);
    const cred     = await authTemp.createUserWithEmailAndPassword(email, password);
    await dbStock.collection('usuarios').doc(cred.user.uid).set({ nombre, email, rol });
    await authTemp.signOut();
    ['usr-nombre', 'usr-email', 'usr-password'].forEach(id => document.getElementById(id).value = '');
    showToast(`Usuario "${nombre}" creado`);
  } catch (e) {
    errDiv.textContent = e.message; errDiv.classList.remove('hidden');
  }
});
