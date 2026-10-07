if (!checkSesion('visor')) throw new Error('Sin acceso');

const currentUser = getUsuario();
document.getElementById('user-name').textContent = currentUser;
document.getElementById('user-avatar').textContent = currentUser.charAt(0).toUpperCase();
document.getElementById('btn-logout').addEventListener('click', logout);

let stockData = {};
let todosMovimientos = [];

document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-' + btn.dataset.tab)?.classList.add('active');
}));

poblarFiltroMarcas(document.getElementById('hist-filtro-marca'));
escucharStock(data => {
  stockData = data;
  renderStockTable();
});
escucharMovimientos(rows => {
  todosMovimientos = rows;
  renderHistorial();
});

function renderStockTable() {
  renderCatalogoStock(document.getElementById('stock-tbody'), stockData);
  document.getElementById('stock-loading').classList.add('hidden');
  document.getElementById('stock-table').classList.remove('hidden');
}

function renderHistorial() {
  const fm = document.getElementById('hist-filtro-marca').value;
  const ft = document.getElementById('hist-filtro-tipo').value;
  const rows = todosMovimientos.filter(m => (!fm || m.marca === fm) && (!ft || m.tipo === ft));
  const tbody = document.getElementById('hist-tbody');
  const labels = { entrada: '↑ Entrada', salida: '↓ Salida', ajuste: '⚙ Ajuste', produccion: '🏭 Producción' };
  tbody.innerHTML = rows.length ? rows.map(m => `
    <tr><td class="cell-muted">${m.fecha ? fmt(m.fecha) : '—'}</td>
    <td>${escaparHTML(m.marca || '—')}</td><td>${escaparHTML(m.linea || '—')}</td><td class="product-name">${escaparHTML(m.producto || '—')}</td>
    <td><span class="badge badge-${escaparHTML(m.tipo)}">${escaparHTML(labels[m.tipo] || m.tipo)}</span></td>
    <td style="font-weight:700">${escaparHTML(m.cantidad)}</td><td>${escaparHTML(m.usuario || m.origen || '—')}</td></tr>`).join('') : '<tr><td colspan="7" class="empty-row">Sin movimientos</td></tr>';
}

document.getElementById('hist-filtro-marca').addEventListener('change', renderHistorial);
document.getElementById('hist-filtro-tipo').addEventListener('change', renderHistorial);
