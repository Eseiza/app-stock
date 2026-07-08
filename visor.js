if (!checkSesion('visor')) throw new Error('Sin acceso');

const currentUser = getUsuario();
document.getElementById('user-name').textContent   = currentUser;
document.getElementById('user-avatar').textContent = currentUser.charAt(0).toUpperCase();
document.getElementById('btn-logout').addEventListener('click', logout);

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

// Poblar filtro marca
Object.keys(CATALOGO).forEach(marca => {
  const opt = document.createElement('option');
  opt.value = marca; opt.textContent = marca;
  document.getElementById('hist-filtro-marca').appendChild(opt);
});

cargarStock().then(iniciarListeners);

async function cargarStock() {
  const snap = await dbStock.collection('stock').get();
  stockData  = {};
  snap.docs.forEach(doc => { stockData[doc.id] = doc.data(); });
  renderStockTable();
  document.getElementById('stock-loading').classList.add('hidden');
  document.getElementById('stock-table').classList.remove('hidden');
}

function renderStockTable() {
  const tbody = document.getElementById('stock-tbody');
  tbody.innerHTML = '';
  Object.entries(CATALOGO).forEach(([marca, lineas]) => {
    Object.entries(lineas).forEach(([linea, productos]) => {
      productos.forEach(prod => {
        const key = `${marca}|${linea}|${prod}`;
        const qty = stockData[key]?.cantidad ?? 0;
        const cls = qty > 0 ? 'qty-ok' : 'qty-zero';
        const tr  = document.createElement('tr');
        tr.innerHTML = `
          <td>${marca}</td>
          <td>${linea}</td>
          <td class="product-name">${prod}</td>
          <td>
            <div class="qty-display ${cls}">
              <span class="qty-number">${qty}</span>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    });
  });
}

function iniciarListeners() {
  dbStock.collection('movimientos').orderBy('fecha', 'desc').limit(300)
    .onSnapshot(snap => {
      todosMovimientos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderHistorial();
    });
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
