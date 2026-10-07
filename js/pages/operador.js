if (!checkSesion('operario')) throw new Error('Sin acceso');

const currentUser = getUsuario();
document.getElementById('user-name').textContent = currentUser;
document.getElementById('user-avatar').textContent = currentUser.charAt(0).toUpperCase();
document.getElementById('btn-logout').addEventListener('click', logout);

let stockData = {};

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
  div.textContent = `Stock disponible: ${actual} bandejas`;
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
