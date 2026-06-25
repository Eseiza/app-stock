let currentUser = null;
let productos   = [];
let stockData   = {};

// ── AUTH GUARD ────────────────────────────────────────────────
auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  const doc = await dbStock.collection('usuarios').doc(user.uid).get();
  if (!doc.exists) { await auth.signOut(); window.location.href = 'index.html'; return; }
  if (doc.data().rol === 'admin') { window.location.href = 'admin.html'; return; }
  currentUser = { uid: user.uid, ...doc.data() };
  document.getElementById('user-name').textContent   = currentUser.nombre;
  document.getElementById('user-avatar').textContent = currentUser.nombre.charAt(0).toUpperCase();
  await cargarProductos();
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

// ── CARGAR PRODUCTOS ──────────────────────────────────────────
async function cargarProductos() {
  try {
    const snap = await dbEnvase.collection(COLECCION_PRODUCTOS).orderBy(CAMPO_NOMBRE).get();
    productos = snap.docs.map(doc => ({
      id:     doc.id,
      nombre: doc.data()[CAMPO_NOMBRE] || '(sin nombre)',
      codigo: doc.data()[CAMPO_CODIGO] || '',
      unidad: doc.data()[CAMPO_UNIDAD] || ''
    }));
    const sel = document.getElementById('mov-producto');
    productos.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = (p.codigo ? p.codigo + ' · ' : '') + p.nombre;
      sel.appendChild(opt);
    });
    await cargarStock();
  } catch (e) {
    document.getElementById('stock-loading').innerHTML =
      `<div class="empty-icon">⚠️</div><p>Error al cargar productos.</p>`;
    console.error(e);
  }
}

// ── CARGAR STOCK ──────────────────────────────────────────────
async function cargarStock() {
  const snap = await dbStock.collection('stock').get();
  stockData  = {};
  snap.docs.forEach(doc => { stockData[doc.id] = doc.data(); });
  renderStockTable();
}

function renderStockTable() {
  const tbody = document.getElementById('stock-tbody');
  tbody.innerHTML = '';
  productos.forEach(p => {
    const qty = stockData[p.id]?.cantidad ?? 0;
    const cls = qty > 0 ? 'qty-ok' : 'qty-zero';
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
    `;
    tbody.appendChild(tr);
  });
  document.getElementById('stock-loading').classList.add('hidden');
  document.getElementById('stock-table').classList.remove('hidden');
}

// ── REGISTRAR MOVIMIENTO ──────────────────────────────────────
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
  renderStockTable();
  document.getElementById('mov-cantidad').value = '';
  document.getElementById('mov-stock-actual').classList.add('hidden');
  showToast(`${tipo === 'entrada' ? 'Entrada' : 'Salida'} registrada`);
  okDiv.textContent = `Nuevo stock de "${p.nombre}": ${nuevoStock} ${p.unidad}`;
  okDiv.classList.remove('hidden');
});
