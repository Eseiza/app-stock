if (!checkSesion('operario')) throw new Error('Sin acceso');

const currentUser = getUsuario();
document.getElementById('user-name').textContent = currentUser;
document.getElementById('user-avatar').textContent = currentUser.charAt(0).toUpperCase();
document.getElementById('btn-logout').addEventListener('click', logout);

let stockData = {};
let todosMovimientos = [];
let filtroStock = '';
let editorStock = null;

document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-' + btn.dataset.tab)?.classList.add('active');
}));

initCascada('mov-marca', 'mov-linea', 'mov-producto');
poblarFiltroMarcas(document.getElementById('hist-filtro-marca'));
iniciarSincronizacionRomero();
escucharStock(data => {
  stockData = data;
  renderStockTable();
  renderStats();
  renderResumenMarcas();
  actualizarStockSeleccionado();
  editorStock?.refrescar();
});
escucharMovimientos(rows => {
  todosMovimientos = rows;
  renderHistorial();
  renderStats();
}, 500);

function inicioDeHoy() {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function renderStockTable() {
  const tbody = document.getElementById('stock-tbody');
  tbody.innerHTML = '';
  const termino = normalizarTexto(filtroStock);
  todosLosProductos()
    .filter(({ marca, linea, producto }) => !termino || normalizarTexto(`${marca} ${linea} ${producto}`).includes(termino))
    .forEach(({ marca, linea, producto, key }) => {
      const s = stockData[key] || {};
      const qty = Number(s.cantidad || 0);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escaparHTML(marca)}</td><td>${escaparHTML(linea)}</td><td class="product-name">${escaparHTML(producto)}</td>
        <td><div class="qty-display ${qty > 0 || Number(s.paquetesSueltos || 0) > 0 ? 'qty-ok' : 'qty-zero'}">${formatearStockHTML(s)}</div></td>
        <td class="cell-muted">${s.ultimaActualizacion ? fmt(s.ultimaActualizacion) : '—'}</td>
        <td><button class="btn btn-sm btn-gold" data-action="editar" data-key="${escaparHTML(key)}">✎ Editar</button></td>`;
      tbody.appendChild(tr);
    });
  document.getElementById('stock-loading').classList.add('hidden');
  document.getElementById('stock-table').classList.remove('hidden');
}

editorStock = initEditorStock({ getStock: () => stockData, usuario: currentUser, origen: 'operario' });
document.getElementById('stock-tbody').addEventListener('click', e => {
  const btn = e.target.closest('button[data-action="editar"]');
  if (btn) editorStock.abrir(btn.dataset.key);
});

document.getElementById('stock-busqueda').addEventListener('input', e => {
  filtroStock = e.target.value;
  renderStockTable();
});

function renderStats() {
  const productos = todosLosProductos();
  const conStock = productos.filter(p => Number(stockData[p.key]?.cantidad || 0) > 0).length;
  const total = productos.reduce((sum, p) => sum + Number(stockData[p.key]?.cantidad || 0), 0);
  const hoy = inicioDeHoy();
  const suma = tipo => todosMovimientos
    .filter(m => m.tipo === tipo && Number(m.fecha || 0) >= hoy)
    .reduce((sum, m) => sum + Number(m.cantidad || 0), 0);
  document.getElementById('stats-row').innerHTML = `
    <div class="stat-chip gold"><div class="stat-label">Productos</div><div class="stat-value">${productos.length}</div></div>
    <div class="stat-chip success"><div class="stat-label">Con stock</div><div class="stat-value">${conStock}</div></div>
    <div class="stat-chip gold"><div class="stat-label">Bandejas</div><div class="stat-value">${total}</div></div>
    <div class="stat-chip success"><div class="stat-label">Producción hoy</div><div class="stat-value">+${suma('produccion')}</div></div>
    <div class="stat-chip"><div class="stat-label">Salidas hoy</div><div class="stat-value">-${suma('salida')}</div></div>`;
}

function renderResumenMarcas() {
  const totales = {};
  todosLosProductos().forEach(({ marca, key }) => {
    totales[marca] = (totales[marca] || 0) + Number(stockData[key]?.cantidad || 0);
  });
  document.getElementById('brand-summary').innerHTML = Object.entries(totales)
    .map(([marca, t]) => `<span class="brand-chip"><strong>${escaparHTML(marca)}</strong> ${t} bandejas</span>`).join('');
}

// ---------- Historial ----------
const LABELS_TIPO = { entrada: '↑ Entrada', salida: '↓ Salida', ajuste: '⚙ Ajuste', produccion: '🏭 Producción' };

function renderHistorial() {
  const fm = document.getElementById('hist-filtro-marca').value;
  const ft = document.getElementById('hist-filtro-tipo').value;
  const fu = document.getElementById('hist-filtro-usuario').value;
  const fp = document.getElementById('hist-filtro-periodo').value;
  const termino = normalizarTexto(document.getElementById('hist-busqueda').value);

  let desde = 0;
  if (fp === 'hoy') desde = inicioDeHoy();
  else if (fp) desde = Date.now() - Number(fp) * 86400000;

  const rows = todosMovimientos.filter(m =>
    (!fm || m.marca === fm) &&
    (!ft || m.tipo === ft) &&
    (!fu || m.usuario === currentUser) &&
    (!desde || Number(m.fecha || 0) >= desde) &&
    (!termino || normalizarTexto(`${m.marca} ${m.linea} ${m.producto}`).includes(termino)));

  // Resumen de lo que se está viendo
  const suma = tipo => rows.filter(m => m.tipo === tipo).reduce((s, m) => s + Number(m.cantidad || 0), 0);
  document.getElementById('hist-stats').innerHTML = `
    <div class="stat-chip"><div class="stat-label">Movimientos</div><div class="stat-value">${rows.length}</div></div>
    <div class="stat-chip success"><div class="stat-label">Producción</div><div class="stat-value">+${suma('produccion')}</div></div>
    <div class="stat-chip success"><div class="stat-label">Entradas</div><div class="stat-value">+${suma('entrada')}</div></div>
    <div class="stat-chip"><div class="stat-label">Salidas</div><div class="stat-value">-${suma('salida')}</div></div>`;

  const fmtDelta = m => {
    const detalle = formatearDetalleAjuste(m);
    if (detalle) return escaparHTML(detalle);
    const d = Number.isFinite(Number(m.delta)) && m.delta !== undefined ? Number(m.delta) : null;
    if (d === null) return escaparHTML(m.cantidad);
    return `<span style="color:${d < 0 ? 'var(--danger)' : 'var(--success)'}">${d > 0 ? '+' : ''}${d}</span>`;
  };
  const dato = v => (v === undefined || v === null) ? '—' : escaparHTML(v);

  document.getElementById('hist-tbody').innerHTML = rows.length ? rows.map(m => `
    <tr>
      <td class="cell-muted">${m.fecha ? fmt(m.fecha) : '—'}</td>
      <td>${escaparHTML(m.marca || '—')}</td><td>${escaparHTML(m.linea || '—')}</td>
      <td class="product-name">${escaparHTML(m.producto || '—')}</td>
      <td><span class="badge badge-${escaparHTML(m.tipo)}">${escaparHTML(LABELS_TIPO[m.tipo] || m.tipo)}</span></td>
      <td style="font-weight:700">${fmtDelta(m)}</td>
      <td class="cell-muted">${dato(m.stockAnterior)}</td>
      <td style="font-weight:600">${dato(m.stockFinal)}</td>
      <td>${escaparHTML(m.usuario || '—')}</td>
      <td class="cell-muted">${escaparHTML(m.origen || '—')}</td>
    </tr>`).join('') : '<tr><td colspan="10" class="empty-row">Sin movimientos</td></tr>';
}

['hist-filtro-marca', 'hist-filtro-tipo', 'hist-filtro-usuario', 'hist-filtro-periodo']
  .forEach(id => document.getElementById(id).addEventListener('change', renderHistorial));
document.getElementById('hist-busqueda').addEventListener('input', renderHistorial);

function getSeleccion() {
  return {
    marca: document.getElementById('mov-marca').value,
    linea: document.getElementById('mov-linea').value,
    producto: document.getElementById('mov-producto').value
  };
}

function getKey() {
  const { marca, linea, producto } = getSeleccion();
  return marca && linea && producto ? claveProducto(marca, linea, producto) : null;
}

function actualizarStockSeleccionado() {
  const key = getKey();
  const div = document.getElementById('mov-stock-actual');
  if (!key) {
    div.classList.add('hidden');
    return;
  }
  const actual = Number(stockData[key]?.cantidad || 0);
  div.textContent = `Stock disponible: ${formatearStock(stockData[key])}`;
  div.classList.remove('hidden');
}

document.getElementById('mov-marca').addEventListener('change', actualizarStockSeleccionado);
document.getElementById('mov-linea').addEventListener('change', actualizarStockSeleccionado);
document.getElementById('mov-producto').addEventListener('change', actualizarStockSeleccionado);

document.getElementById('btn-registrar').addEventListener('click', async () => {
  const { marca, linea, producto } = getSeleccion();
  const cantidadInput = document.getElementById('mov-cantidad');
  const cantidad = Number(cantidadInput.value);
  const err = document.getElementById('mov-error');
  const ok = document.getElementById('mov-ok');
  err.classList.add('hidden');
  ok.classList.add('hidden');

  if (!marca || !linea || !producto) {
    err.textContent = 'Seleccioná marca, línea y producto.';
    err.classList.remove('hidden');
    return;
  }
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    err.textContent = 'La cantidad debe ser un número entero mayor a 0.';
    err.classList.remove('hidden');
    cantidadInput.focus();
    return;
  }

  const key = claveProducto(marca, linea, producto);
  const disponible = Number(stockData[key]?.cantidad || 0);
  if (cantidad > disponible) {
    err.textContent = `No hay suficiente stock. Disponible: ${disponible} bandejas.`;
    err.classList.remove('hidden');
    return;
  }

  const boton = document.getElementById('btn-registrar');
  boton.disabled = true;
  boton.textContent = 'Registrando...';

  try {
    const nuevo = await moverStock({
      marca, linea, producto,
      tipo: 'salida',
      cantidad,
      usuario: currentUser,
      origen: 'operario'
    });
    cantidadInput.value = '';
    ok.textContent = `Salida registrada: -${cantidad} bandejas de ${producto}. Nuevo stock: ${nuevo} bandejas.`;
    ok.classList.remove('hidden');
    actualizarStockSeleccionado();
  } catch (e) {
    err.textContent = e.message || 'No se pudo registrar la salida.';
    err.classList.remove('hidden');
  } finally {
    boton.disabled = false;
    boton.textContent = 'Registrar salida';
  }
});

// Enter en cantidad registra la salida.
document.getElementById('mov-cantidad').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-registrar').click();
});
