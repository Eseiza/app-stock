// ============================================================
// Núcleo de AppStock - Realtime Database
// ============================================================

function refStockProducto(marca, linea, producto) {
  return dbStock.ref(`stock/${claveProducto(marca, linea, producto)}`);
}

function escucharStock(callback) {
  return dbStock.ref('stock').on('value', snap => callback(snap.val() || {}));
}

function escucharMovimientos(callback, limite = 300) {
  return dbStock.ref('movimientos').orderByChild('fecha').limitToLast(limite).on('value', snap => {
    const data = snap.val() || {};
    const rows = Object.entries(data)
      .map(([id, movimiento]) => ({ id, ...movimiento }))
      .sort((a, b) => Number(b.fecha || 0) - Number(a.fecha || 0));
    callback(rows);
  });
}

function timestampAhora() {
  return Date.now();
}

async function registrarMovimiento({ marca, linea, producto, tipo, cantidad, usuario, origen = 'app-stock', referencia = null, stockAnterior = null, stockFinal = null, delta = null }) {
  const ref = dbStock.ref('movimientos').push();
  await ref.set({
    marca, linea, producto, tipo,
    cantidad: Number(cantidad),
    fecha: timestampAhora(),
    usuario: usuario || 'sistema',
    origen,
    ...(referencia ? { referencia } : {}),
    ...(Number.isFinite(stockAnterior) ? { stockAnterior } : {}),
    ...(Number.isFinite(stockFinal) ? { stockFinal } : {}),
    ...(Number.isFinite(delta) ? { delta } : {})
  });
  return ref.key;
}

async function moverStock({ marca, linea, producto, tipo, cantidad, usuario, origen = 'app-stock', referencia = null }) {
  const qty = Number(cantidad);
  if (!Number.isInteger(qty) || qty <= 0) throw new Error('La cantidad debe ser un número entero mayor a 0.');

  const ref = refStockProducto(marca, linea, producto);
  const resultado = await ref.transaction(actual => {
    const stock = Number(actual?.cantidad || 0);
    const nuevo = tipo === 'entrada' || tipo === 'produccion' ? stock + qty : stock - qty;
    if (nuevo < 0) return;
    return {
      marca, linea, producto,
      cantidad: nuevo,
      ultimaActualizacion: timestampAhora()
    };
  });

  if (!resultado.committed) throw new Error('Stock insuficiente o cambio simultáneo. Actualizá la pantalla e intentá nuevamente.');

  const stockFinal = Number(resultado.snapshot.val()?.cantidad || 0);
  const stockAnterior = (tipo === 'salida') ? stockFinal + qty : stockFinal - qty;
  await registrarMovimiento({
    marca, linea, producto, tipo, cantidad: qty, usuario, origen, referencia,
    stockAnterior, stockFinal,
    delta: tipo === 'salida' ? -qty : qty
  });
  return stockFinal;
}

async function ajustarStock({ marca, linea, producto, cantidad, usuario }) {
  const qty = Number(cantidad);
  if (!Number.isInteger(qty) || qty < 0) {
    throw new Error('La cantidad debe ser un entero igual o mayor a 0.');
  }

  const ref = refStockProducto(marca, linea, producto);
  let stockAnterior = 0;

  const resultado = await ref.transaction(actual => {
    const actualData = actual && typeof actual === 'object' ? actual : {};
    stockAnterior = Number(actualData.cantidad || 0);

    return {
      ...actualData,
      marca, linea, producto,
      cantidad: qty,
      ultimaActualizacion: timestampAhora()
    };
  });

  if (!resultado.committed) {
    throw new Error('No se pudo ajustar el stock. Actualizá la pantalla e intentá nuevamente.');
  }

  const stockFinal = Number(resultado.snapshot.val()?.cantidad || 0);
  const delta = stockFinal - stockAnterior;

  // Un ajuste que no cambia nada no genera ruido en el historial.
  if (delta !== 0) {
    await registrarMovimiento({
      marca, linea, producto,
      tipo: 'ajuste',
      cantidad: Math.abs(delta),
      usuario,
      origen: 'admin',
      stockAnterior,
      stockFinal,
      delta
    });
  }

  return stockFinal;
}

// Devuelve una instantánea del stock de un producto. Se usa para validaciones
// y para evitar que cada pantalla implemente su propia lectura.
async function obtenerStockProducto(marca, linea, producto) {
  const snap = await refStockProducto(marca, linea, producto).once('value');
  return snap.val() || { marca, linea, producto, cantidad: 0 };
}

// Escucha solo un producto cuando una pantalla necesita una actualización puntual.
function escucharStockProducto(marca, linea, producto, callback) {
  return refStockProducto(marca, linea, producto).on('value', snap => {
    callback(snap.val() || { marca, linea, producto, cantidad: 0 });
  });
}

function todosLosProductos() {
  const result = [];
  Object.entries(CATALOGO).forEach(([marca, lineas]) => {
    Object.entries(lineas).forEach(([linea, productos]) => {
      productos.forEach(producto => result.push({ marca, linea, producto, key: claveProducto(marca, linea, producto) }));
    });
  });
  return result;
}

function escaparHTML(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderCatalogoStock(tbody, stockData, opciones = {}) {
  tbody.innerHTML = '';
  const mostrarUbicacion = Boolean(opciones.mostrarUbicacion);
  todosLosProductos().forEach(({ marca, linea, producto, key }) => {
    const s = stockData[key] || {};
    const qty = Number(s.cantidad || 0);
    const cls = qty > 0 ? 'qty-ok' : 'qty-zero';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escaparHTML(marca)}</td>
      <td>${escaparHTML(linea)}</td>
      <td class="product-name">${escaparHTML(producto)}</td>
      <td><div class="qty-display ${cls}"><span class="qty-number">${qty}</span><span class="qty-unit">bandejas</span></div></td>
      ${mostrarUbicacion ? `<td>${escaparHTML(s.ubicacion?.fila || '—')}</td><td>${escaparHTML(s.ubicacion?.torre || '—')}</td>` : ''}
    `;
    tbody.appendChild(tr);
  });
}

function poblarFiltroMarcas(select) {
  Object.keys(CATALOGO).forEach(marca => {
    const opt = document.createElement('option');
    opt.value = marca;
    opt.textContent = marca;
    select.appendChild(opt);
  });
}

// Guarda ubicación física sin alterar la cantidad de stock.
async function guardarUbicacion({ marca, linea, producto, fila = '', torre = '', usuario = 'admin' }) {
  const ref = refStockProducto(marca, linea, producto);
  await ref.update({
    ubicacion: {
      fila: String(fila || '').trim(),
      torre: String(torre || '').trim()
    },
    ubicacionActualizadaEn: timestampAhora(),
    ubicacionActualizadaPor: usuario
  });
}
