if (!checkSesion('operario')) throw new Error('Sin acceso');

const currentUser = getUsuario();
document.getElementById('user-name').textContent = currentUser;
document.getElementById('user-avatar').textContent = currentUser.charAt(0).toUpperCase();
document.getElementById('btn-logout').addEventListener('click', logout);

let stockData = {};

// El Operario solo puede registrar SALIDAS.
document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-' + btn.dataset.tab)?.classList.add('active');
}));

initCascada('mov-marca', 'mov-linea', 'mov-producto');
iniciarSincronizacionRomero();
escucharStock(data => {
  stockData = data;
  renderStockTable();
  actualizarStockSeleccionado();
});

function renderStockTable() {
  renderCatalogoStock(document.getElementById('stock-tbody'), stockData);
  document.getElementById('stock-loading').classList.add('hidden');
  document.getElementById('stock-table').classList.remove('hidden');
}

function getKey() {
  const m = document.getElementById('mov-marca').value;
  const l = document.getElementById('mov-linea').value;
  const p = document.getElementById('mov-producto').value;
  return m && l && p ? claveProducto(m, l, p) : null;
}

function actualizarStockSeleccionado() {
  const key = getKey();
  const div = document.getElementById('mov-stock-actual');
  if (!key) return div.classList.add('hidden');
  div.textContent = `Stock actual: ${Number(stockData[key]?.cantidad || 0)} bandejas`;
  div.classList.remove('hidden');
}

document.getElementById('mov-producto').addEventListener('change', actualizarStockSeleccionado);

document.getElementById('btn-registrar').addEventListener('click', async () => {
  const marca = document.getElementById('mov-marca').value;
  const linea = document.getElementById('mov-linea').value;
  const producto = document.getElementById('mov-producto').value;
  const cantidad = Number(document.getElementById('mov-cantidad').value);
  const err = document.getElementById('mov-error');
  const ok = document.getElementById('mov-ok');
  err.classList.add('hidden'); ok.classList.add('hidden');

  if (!marca || !linea || !producto || !Number.isInteger(cantidad) || cantidad <= 0) {
    err.textContent = 'Completá marca, línea, producto y una cantidad válida en bandejas.';
    err.classList.remove('hidden'); return;
  }
  try {
    const nuevo = await moverStock({ marca, linea, producto, tipo: 'salida', cantidad, usuario: currentUser });
    document.getElementById('mov-cantidad').value = '';
    ok.textContent = `Salida registrada. Nuevo stock: ${nuevo} bandejas.`;
    ok.classList.remove('hidden');
  } catch (e) {
    err.textContent = e.message || 'No se pudo registrar la salida.';
    err.classList.remove('hidden');
  }
});
