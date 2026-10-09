if (!checkSesion('admin')) throw new Error('Sin acceso');

const currentUser = getUsuario();
document.getElementById('user-name').textContent = currentUser;
document.getElementById('user-avatar').textContent = currentUser.charAt(0).toUpperCase();
document.getElementById('btn-logout').addEventListener('click', logout);

let stockData = {};
let todosMovimientos = [];
let filtroStock = '';
let editorStock = null;

// Navegación

document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-' + btn.dataset.tab)?.classList.add('active');
}));

initCascada('mov-marca', 'mov-linea', 'mov-producto');
poblarFiltroMarcas(document.getElementById('hist-filtro-marca'));

// Stock en tiempo real
escucharStock(data => {
  stockData = data;
  renderStockTable();
  renderStats();
  renderResumenMarcas();
  actualizarStockSeleccionado();
  editorStock?.refrescar();
});

iniciarSincronizacionRomero();
escucharMovimientos(rows => {
  todosMovimientos = rows;
  renderHistorial();
});

function getKey() {
  const marca = document.getElementById('mov-marca').value;
  const linea = document.getElementById('mov-linea').value;
  const producto = document.getElementById('mov-producto').value;
  return marca && linea && producto ? claveProducto(marca, linea, producto) : null;
}

function actualizarStockSeleccionado() {
  const key = getKey();
  const div = document.getElementById('mov-stock-actual');
  if (!key) return div.classList.add('hidden');
  div.textContent = `Stock actual: ${formatearStock(stockData[key])}`;
  div.classList.remove('hidden');
}

document.getElementById('mov-producto').addEventListener('change', actualizarStockSeleccionado);


function renderResumenMarcas() {
  const cont = document.getElementById('brand-summary');
  if (!cont) return;
  const totales = {};
  todosLosProductos().forEach(({ marca, key }) => {
    totales[marca] = (totales[marca] || 0) + Number(stockData[key]?.cantidad || 0);
  });
  cont.innerHTML = Object.entries(totales).map(([marca, total]) =>
    `<span class="brand-chip"><strong>${escaparHTML(marca)}</strong> ${total} bandejas</span>`).join('');
}

const buscadorStock = document.getElementById('stock-busqueda');
if (buscadorStock) {
  buscadorStock.addEventListener('input', e => {
    filtroStock = e.target.value;
    renderStockTable();
  });
}

function renderStats() {
  const productos = todosLosProductos();
  const conStock = productos.filter(p => Number(stockData[p.key]?.cantidad || 0) > 0).length;
  const totalBandejas = productos.reduce((sum, p) => sum + Number(stockData[p.key]?.cantidad || 0), 0);
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const produccionHoy = todosMovimientos.filter(m => m.tipo === 'produccion' && Number(m.fecha || 0) >= hoy.getTime())
    .reduce((sum, m) => sum + Number(m.cantidad || 0), 0);
  const salidasHoy = todosMovimientos.filter(m => m.tipo === 'salida' && Number(m.fecha || 0) >= hoy.getTime())
    .reduce((sum, m) => sum + Number(m.cantidad || 0), 0);
  document.getElementById('stats-row').innerHTML = `
    <div class="stat-chip gold"><div class="stat-label">Productos</div><div class="stat-value">${productos.length}</div></div>
    <div class="stat-chip success"><div class="stat-label">Con stock</div><div class="stat-value">${conStock}</div></div>
    <div class="stat-chip gold"><div class="stat-label">Bandejas</div><div class="stat-value">${totalBandejas}</div></div>
    <div class="stat-chip success"><div class="stat-label">Producción hoy</div><div class="stat-value">+${produccionHoy}</div></div>
    <div class="stat-chip"><div class="stat-label">Salidas hoy</div><div class="stat-value">-${salidasHoy}</div></div>
  `;
}

let renderStockPendiente = false;

function renderStockTable() {
  const tbody = document.getElementById('stock-tbody');
  const activo = document.activeElement;
  if (activo && activo.tagName === 'INPUT' && tbody.contains(activo)) {
    renderStockPendiente = true;
    return;
  }
  renderStockPendiente = false;
  tbody.innerHTML = '';
  const termino = normalizarTexto(filtroStock);
  todosLosProductos()
    .filter(({ marca, linea, producto }) => !termino || normalizarTexto(`${marca} ${linea} ${producto}`).includes(termino))
    .forEach(({ marca, linea, producto, key }) => {
      const s = stockData[key] || {};
      const qty = Number(s.cantidad || 0);
      const paquetes = Number(s.paquetesSueltos || 0);
      const cls = qty > 0 || paquetes > 0 ? 'qty-ok' : 'qty-zero';
      const k = escaparHTML(key);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escaparHTML(marca)}</td>
        <td>${escaparHTML(linea)}</td>
        <td class="product-name">${escaparHTML(producto)}</td>
        <td><div class="qty-display ${cls}">${formatearStockHTML(s)}</div></td>
        <td class="cell-muted">${s.ultimaActualizacion ? fmt(s.ultimaActualizacion) : '—'}</td>
        <td><button class="btn btn-sm btn-gold" data-action="editar" data-key="${k}">✎ Editar</button></td>`;
      tbody.appendChild(tr);
    });
  document.getElementById('stock-loading').classList.add('hidden');
  document.getElementById('stock-table').classList.remove('hidden');
}

const stockTbody = document.getElementById('stock-tbody');
editorStock = initEditorStock({ getStock: () => stockData, usuario: currentUser, origen: 'admin' });
stockTbody.addEventListener('click', e => {
  const btn = e.target.closest('button[data-action="editar"]');
  if (btn) editorStock.abrir(btn.dataset.key);
});

// Movimiento manual del Admin.
document.getElementById('btn-registrar').addEventListener('click', async () => {
  const marca = document.getElementById('mov-marca').value;
  const linea = document.getElementById('mov-linea').value;
  const producto = document.getElementById('mov-producto').value;
  const tipo = document.getElementById('mov-tipo').value;
  const cantidad = Number(document.getElementById('mov-cantidad').value);
  const err = document.getElementById('mov-error');
  const ok = document.getElementById('mov-ok');
  err.classList.add('hidden'); ok.classList.add('hidden');

  if (!marca || !linea || !producto || !Number.isInteger(cantidad) || cantidad <= 0) {
    err.textContent = 'Completá marca, línea, producto y una cantidad válida en bandejas.';
    err.classList.remove('hidden'); return;
  }
  try {
    const nuevo = await moverStock({ marca, linea, producto, tipo, cantidad, usuario: currentUser });
    document.getElementById('mov-cantidad').value = '';
    ok.textContent = `Nuevo stock de "${producto}": ${nuevo} bandejas`;
    ok.classList.remove('hidden');
  } catch (e) {
    err.textContent = e.message || 'No se pudo registrar el movimiento.';
    err.classList.remove('hidden');
  }
});

function renderHistorial() {
  const fm = document.getElementById('hist-filtro-marca').value;
  const ft = document.getElementById('hist-filtro-tipo').value;
  const rows = todosMovimientos.filter(m => (!fm || m.marca === fm) && (!ft || m.tipo === ft));
  const tbody = document.getElementById('hist-tbody');
  const labels = { entrada: '↑ Entrada', salida: '↓ Salida', ajuste: '⚙ Ajuste', produccion: '🏭 Producción' };
  tbody.innerHTML = rows.length ? rows.map(m => `
    <tr>
      <td class="cell-muted">${m.fecha ? fmt(m.fecha) : '—'}</td>
      <td>${escaparHTML(m.marca || '—')}</td><td>${escaparHTML(m.linea || '—')}</td>
      <td class="product-name">${escaparHTML(m.producto || '—')}</td>
      <td><span class="badge badge-${escaparHTML(m.tipo)}">${escaparHTML(labels[m.tipo] || m.tipo)}</span></td>
      <td style="font-weight:700">${escaparHTML(formatearDetalleAjuste(m) || m.cantidad)}</td>
      <td class="cell-muted">${escaparHTML(m.usuario || m.origen || '—')}</td>
    </tr>`).join('') : '<tr><td colspan="7" class="empty-row">Sin movimientos</td></tr>';
}

document.getElementById('hist-filtro-marca').addEventListener('change', renderHistorial);
document.getElementById('hist-filtro-tipo').addEventListener('change', renderHistorial);

// Usuarios: roles del sistema. La autenticación real se reforzará antes de producción.
function renderUsuarios() {
  const tbody = document.getElementById('usr-tbody');
  if (!tbody) return;
  tbody.innerHTML = [
    ['admin', 'ADMIN', 'Acceso total'],
    ['operario', 'OPERARIO', 'Salidas, movimientos y edición de stock'],
    ['visor', 'VISOR', 'Stock + movimientos'],
    ['ventas', 'VENTAS', 'Solo stock disponible']
  ].map(u => `<tr><td>${u[0]}</td><td>${u[1]}</td><td>${u[2]}</td></tr>`).join('');
}
renderUsuarios();
