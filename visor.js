if (!checkSesion('visor')) throw new Error('Sin acceso');

const currentUser = getUsuario();
document.getElementById('user-name').textContent   = currentUser;
document.getElementById('user-avatar').textContent = currentUser.charAt(0).toUpperCase();
document.getElementById('btn-logout').addEventListener('click', logout);

let productos        = [];
let stockData        = {};
let todosMovimientos = [];

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

cargarProductos().then(iniciarListeners);

async function cargarProductos() {
  try {
    const snap = await dbEnvase.collection(COLECCION_PRODUCTOS).orderBy(CAMPO_NOMBRE).get();
    productos = snap.docs.map(doc => ({
      id:     doc.id,
      nombre: doc.data()[CAMPO_NOMBRE] || '(sin nombre)',
      codigo: doc.data()[CAMPO_CODIGO] || '',
      unidad: doc.data()[CAMPO_UNIDAD] || ''
    }));
    const sel = document.getElementById('hist-filtro-prod');
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

function iniciarListeners() {
  dbStock.collection('movimientos').orderBy('fecha', 'desc').limit(300)
    .onSnapshot(snap => {
      todosMovimientos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderHistorial();
    });
}

function renderHistorial() {
  const fp     = document.getElementById('hist-filtro-prod').value;
  const ft     = document.getElementById('hist-filtro-tipo').value;
  const rows   = todosMovimientos.filter(m => {
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
      <td style="font-size:12.5px;color:var(--muted)">${m.usuario || '—'}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById('hist-filtro-prod').addEventListener('change', renderHistorial);
document.getElementById('hist-filtro-tipo').addEventListener('change', renderHistorial);
