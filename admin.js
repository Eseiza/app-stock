if (!checkSesion('admin')) throw new Error('Sin acceso');

const currentUser = getUsuario();
document.getElementById('user-name').textContent   = currentUser;
document.getElementById('user-avatar').textContent = currentUser.charAt(0).toUpperCase();
document.getElementById('btn-logout').addEventListener('click', logout);

let stockData        = {};
let todosMovimientos = [];

// ── TABS ──────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ── INIT ──────────────────────────────────────────────────────
initCascada('mov-marca', 'mov-linea', 'mov-producto');

// Poblar filtro marca historial
Object.keys(CATALOGO).forEach(marca => {
  const opt = document.createElement('option');
  opt.value = marca; opt.textContent = marca;
  document.getElementById('hist-filtro-marca').appendChild(opt);
});

// Mostrar stock al elegir producto
document.getElementById('mov-producto').addEventListener('change', () => {
  const key = getKey('mov-marca', 'mov-linea', 'mov-producto');
  const div = document.getElementById('mov-stock-actual');
  if (!key) { div.classList.add('hidden'); return; }
  const qty = stockData[key]?.cantidad ?? 0;
  div.textContent = `Stock actual: ${qty}`;
  div.classList.remove('hidden');
});

cargarStock().then(iniciarListeners);

// ── STOCK ─────────────────────────────────────────────────────
async function cargarStock() {
  const snap = await dbStock.collection('stock').get();
  stockData  = {};
  snap.docs.forEach(doc => { stockData[doc.id] = doc.data(); });
  renderStockTable();
  renderStats();
}

function getKey(idMarca, idLinea, idProducto) {
  const marca    = document.getElementById(idMarca).value;
  const linea    = document.getElementById(idLinea).value;
  const producto = document.getElementById(idProducto).value;
  if (!marca || !linea || !producto) return null;
  return `${marca}|${linea}|${producto}`;
}

function renderStats() {
  const todas     = [];
  Object.entries(CATALOGO).forEach(([marca, lineas]) => {
    Object.entries(lineas).forEach(([linea, prods]) => {
      prods.forEach(prod => todas.push(`${marca}|${linea}|${prod}`));
    });
  });
  const sinStock = todas.filter(k => (stockData[k]?.cantidad ?? 0) <= 0).length;
  document.getElementById('stats-row').innerHTML = `
    <div class="stat-chip gold">
      <div class="stat-label">Productos</div>
      <div class="stat-value">${todas.length}</div>
    </div>
    <div class="stat-chip success">
      <div class="stat-label">Con stock</div>
      <div class="stat-value">${todas.length - sinStock}</div>
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
  Object.entries(CATALOGO).forEach(([marca, lineas]) => {
    Object.entries(lineas).forEach(([linea, productos]) => {
      productos.forEach(prod => {
        const key   = `${marca}|${linea}|${prod}`;
        const s     = stockData[key] || {};
        const qty   = s.cantidad ?? 0;
        const cls   = qty > 0 ? 'qty-ok' : 'qty-zero';
        const fecha = s.ultimaActualizacion ? fmt(s.ultimaActualizacion.toDate()) : '—';
        const tr    = document.createElement('tr');
        tr.innerHTML = `
          <td>${marca}</td>
          <td>${linea}</td>
          <td class="product-name">${prod}</td>
          <td>
            <div class="qty-display ${cls}">
              <span class="qty-number">${qty}</span>
            </div>
          </td>
          <td style="color:var(--muted);font-size:12.5px">${fecha}</td>
          <td>
            <div class="adj-row">
              <input type="number" class="adj-input" id="adj-${CSS.escape(key)}" value="${qty}" min="0" />
              <button class="btn btn-gold btn-sm" onclick="ajustarStock('${key.replace(/'/g,"\\'")}')">Ajustar</button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    });
  });
  document.getElementById('stock-loading').classList.add('hidden');
  document.getElementById('stock-table').classList.remove('hidden');
}

window.ajustarStock = async function(key) {
  const parts    = key.split('|');
  const [marca, linea, producto] = parts;
  const input    = document.querySelector(`[id="adj-${key}"]`);
  const cantidad = parseInt(input.value);
  if (isNaN(cantidad) || cantidad < 0) { showToast('Cantidad inválida'); return; }
  const ahora = firebase.firestore.Timestamp.fromDate(new Date());
  const batch = dbStock.batch();
  batch.set(dbStock.collection('stock').doc(key), {
    marca, linea, producto, cantidad, ultimaActualizacion: ahora
  });
  batch.set(dbStock.collection('movimientos').doc(), {
    marca, linea, producto, tipo: 'ajuste', cantidad, fecha: ahora, usuario: currentUser
  });
  await batch.commit();
  stockData[key] = { marca, linea, producto, cantidad, ultimaActualizacion: ahora };
  renderStockTable(); renderStats();
  showToast(`"${producto}" → ${cantidad}`);
};

// ── MOVIMIENTO ────────────────────────────────────────────────
document.getElementById('btn-registrar').addEventListener('click', async () => {
  const marca    = document.getElementById('mov-marca').value;
  const linea    = document.getElementById('mov-linea').value;
  const producto = document.getElementById('mov-producto').value;
  const tipo     = document.getElementById('mov-tipo').value;
  const cantidad = parseInt(document.getElementById('mov-cantidad').value);
  const errDiv   = document.getElementById('mov-error');
  const okDiv    = document.getElementById('mov-ok');
  errDiv.classList.add('hidden'); okDiv.classList.add('hidden');

  if (!marca || !linea || !producto) {
    errDiv.textContent = 'Seleccioná marca, línea y producto.'; errDiv.classList.remove('hidden'); return;
  }
  if (!cantidad || cantidad <= 0) {
    errDiv.textContent = 'Ingresá una cantidad válida.'; errDiv.classList.remove('hidden'); return;
  }

  const key         = `${marca}|${linea}|${producto}`;
  const stockActual = stockData[key]?.cantidad ?? 0;

  if (tipo === 'salida' && cantidad > stockActual) {
    errDiv.textContent = `Stock insuficiente. Stock actual: ${stockActual}`;
    errDiv.classList.remove('hidden'); return;
  }

  const nuevoStock = tipo === 'entrada' ? stockActual + cantidad : stockActual - cantidad;
  const ahora      = firebase.firestore.Timestamp.fromDate(new Date());
  const batch      = dbStock.batch();

  batch.set(dbStock.collection('stock').doc(key), {
    marca, linea, producto, cantidad: nuevoStock, ultimaActualizacion: ahora
  });
  batch.set(dbStock.collection('movimientos').doc(), {
    marca, linea, producto, tipo, cantidad, fecha: ahora, usuario: currentUser
  });
  await batch.commit();

  stockData[key] = { marca, linea, producto, cantidad: nuevoStock, ultimaActualizacion: ahora };
  renderStockTable(); renderStats();
  document.getElementById('mov-cantidad').value = '';
  document.getElementById('mov-stock-actual').classList.add('hidden');
  showToast(`${tipo === 'entrada' ? 'Entrada' : 'Salida'} registrada`);
  okDiv.textContent = `Nuevo stock de "${producto}": ${nuevoStock}`;
  okDiv.classList.remove('hidden');
});

// ── HISTORIAL ─────────────────────────────────────────────────
function iniciarListeners() {
  dbStock.collection('movimientos').orderBy('fecha', 'desc').limit(300)
    .onSnapshot(snap => {
      todosMovimientos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderHistorial();
    });
  renderUsuarios();
}

function renderHistorial() {
  const fm     = document.getElementById('hist-filtro-marca').value;
  const ft     = document.getElementById('hist-filtro-tipo').value;
  const rows   = todosMovimientos.filter(m => {
    if (fm && m.marca !== fm) return false;
    if (ft && m.tipo !== ft) return false;
    return true;
  });
  const tbody  = document.getElementById('hist-tbody');
  const labels = { entrada: '↑ Entrada', salida: '↓ Salida', ajuste: '⚙ Ajuste' };
  tbody.innerHTML = '';
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Sin movimientos</td></tr>'; return;
  }
  rows.forEach(m => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-size:12.5px;color:var(--muted)">${m.fecha ? fmt(m.fecha.toDate()) : '—'}</td>
      <td>${m.marca || '—'}</td>
      <td>${m.linea || '—'}</td>
      <td class="product-name">${m.producto || m.productoNombre || '—'}</td>
      <td><span class="badge badge-${m.tipo}">${labels[m.tipo] || m.tipo}</span></td>
      <td style="font-weight:700">${m.cantidad}</td>
      <td style="font-size:12.5px;color:var(--muted)">${m.usuario || '—'}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById('hist-filtro-marca').addEventListener('change', renderHistorial);
document.getElementById('hist-filtro-tipo').addEventListener('change', renderHistorial);

// ── USUARIOS (solo lectura) ───────────────────────────────────
const USUARIOS_LISTA = [
  { usuario: 'admin', rol: 'admin' },
  { usuario: 'carga', rol: 'carga' },
  { usuario: 'visor', rol: 'visor' },
];

function renderUsuarios() {
  const tbody = document.getElementById('usr-tbody');
  tbody.innerHTML = '';
  USUARIOS_LISTA.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="product-name">${u.usuario}</td>
      <td><span class="badge badge-${u.rol}">${u.rol}</span></td>
    `;
    tbody.appendChild(tr);
  });
}
