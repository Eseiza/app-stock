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

async function registrarMovimiento({ marca, linea, producto, tipo, cantidad, usuario, origen = 'app-stock', referencia = null, stockAnterior = null, stockFinal = null, delta = null, extra = null }) {
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
    ...(Number.isFinite(delta) ? { delta } : {}),
    ...(extra && typeof extra === 'object' ? extra : {})
  });
  return ref.key;
}

async function moverStock({ marca, linea, producto, tipo, cantidad, usuario, origen = 'app-stock', referencia = null }) {
  const qty = Number(cantidad);
  if (!Number.isInteger(qty) || qty <= 0) throw new Error('La cantidad debe ser un número entero mayor a 0.');

  const ref = refStockProducto(marca, linea, producto);
  let stockAnterior = 0;
  let paquetesAnteriores = 0;

  const resultado = await ref.transaction(actual => {
    const actualData = actual && typeof actual === 'object' ? actual : {};
    stockAnterior = Number(actualData.cantidad || 0);
    paquetesAnteriores = Number(actualData.paquetesSueltos || 0);
    const nuevo = tipo === 'entrada' || tipo === 'produccion' ? stockAnterior + qty : stockAnterior - qty;
    if (nuevo < 0) return;
    return {
      ...actualData,
      marca, linea, producto,
      cantidad: nuevo,
      paquetesSueltos: paquetesAnteriores,
      ultimaActualizacion: timestampAhora()
    };
  });

  if (!resultado.committed) throw new Error('Stock insuficiente o cambio simultáneo. Actualizá la pantalla e intentá nuevamente.');

  const stockFinal = Number(resultado.snapshot.val()?.cantidad || 0);
  await registrarMovimiento({
    marca, linea, producto, tipo, cantidad: qty, usuario, origen, referencia,
    stockAnterior, stockFinal,
    delta: tipo === 'salida' ? -qty : qty
  });
  return stockFinal;
}

async function ajustarStock({ marca, linea, producto, delta, usuario }) {
  const cambio = Number(delta);
  if (!Number.isInteger(cambio) || cambio === 0) {
    throw new Error('El ajuste debe ser un número entero distinto de 0.');
  }

  const ref = refStockProducto(marca, linea, producto);
  let stockAnterior = 0;
  let stockFinal = 0;

  const resultado = await ref.transaction(actual => {
    const actualData = actual && typeof actual === 'object' ? actual : {};
    stockAnterior = Number(actualData.cantidad || 0);
    const nuevo = stockAnterior + cambio;
    if (nuevo < 0) return;
    return {
      ...actualData,
      marca, linea, producto,
      cantidad: nuevo,
      paquetesSueltos: Number(actualData.paquetesSueltos || 0),
      ultimaActualizacion: timestampAhora()
    };
  });

  if (!resultado.committed) {
    throw new Error(cambio < 0
      ? 'No se puede restar más bandejas de las disponibles.'
      : 'No se pudo ajustar el stock. Actualizá la pantalla e intentá nuevamente.');
  }

  stockFinal = Number(resultado.snapshot.val()?.cantidad || 0);
  await registrarMovimiento({
    marca, linea, producto,
    tipo: 'ajuste',
    cantidad: Math.abs(cambio),
    usuario,
    origen: 'admin',
    stockAnterior,
    stockFinal,
    delta: cambio
  });

  return stockFinal;
}

// Ajuste manual detallado: suma o resta filas, bandejas y paquetes en una sola operación.
// Todo se convierte a paquetes totales, se aplica en una transaction y se vuelve a
// repartir en bandejas completas + paquetes sueltos.
async function ajustarStockDetallado({ marca, linea, producto, signo, filas = 0, bandejas = 0, paquetes = 0, usuario, origen = 'admin' }) {
  const f = Number(filas), b = Number(bandejas), p = Number(paquetes);
  if (![f, b, p].every(n => Number.isInteger(n) && n >= 0)) {
    throw new Error('Filas, bandejas y paquetes deben ser números enteros (0 o más).');
  }
  if (f + b + p === 0) throw new Error('Indicá al menos una cantidad mayor a 0.');
  if (signo !== 1 && signo !== -1) throw new Error('Operación inválida.');

  const porBandeja = paquetesPorBandeja(marca, linea, producto);
  const deltaPaquetes = signo * (((f * BANDEJAS_POR_FILA) + b) * porBandeja + p);

  const ref = refStockProducto(marca, linea, producto);
  let anterior = { cantidad: 0, paquetesSueltos: 0 };
  let final = { cantidad: 0, paquetesSueltos: 0 };

  const resultado = await ref.transaction(actual => {
    const actualData = actual && typeof actual === 'object' ? actual : {};
    const bandejasActuales = Number(actualData.cantidad || 0);
    const sueltosActuales = Number(actualData.paquetesSueltos || 0);
    anterior = { cantidad: bandejasActuales, paquetesSueltos: sueltosActuales };

    const totalNuevo = bandejasActuales * porBandeja + sueltosActuales + deltaPaquetes;
    if (totalNuevo < 0) return;

    final = { cantidad: Math.floor(totalNuevo / porBandeja), paquetesSueltos: totalNuevo % porBandeja };
    return {
      ...actualData,
      marca, linea, producto,
      cantidad: final.cantidad,
      paquetesSueltos: final.paquetesSueltos,
      ultimaActualizacion: timestampAhora()
    };
  });

  if (!resultado.committed) {
    throw new Error(signo < 0
      ? 'No se puede restar más de lo que hay en stock.'
      : 'No se pudo ajustar el stock. Actualizá la pantalla e intentá nuevamente.');
  }

  const stockFinalData = resultado.snapshot.val() || {};
  const bandejasDelta = stockFinalData.cantidad - anterior.cantidad;
  await registrarMovimiento({
    marca, linea, producto,
    tipo: 'ajuste',
    cantidad: Math.abs(bandejasDelta) || Math.abs(deltaPaquetes),
    usuario,
    origen,
    stockAnterior: anterior.cantidad,
    stockFinal: Number(stockFinalData.cantidad || 0),
    delta: bandejasDelta,
    extra: {
      deltaPaquetes,
      paquetesPorBandeja: porBandeja,
      detalle: { signo, filas: f, bandejas: b, paquetes: p },
      paquetesSueltosAnterior: anterior.paquetesSueltos,
      paquetesSueltosFinal: Number(stockFinalData.paquetesSueltos || 0)
    }
  });

  return { cantidad: Number(stockFinalData.cantidad || 0), paquetesSueltos: Number(stockFinalData.paquetesSueltos || 0) };
}

// Calcula cómo quedaría el stock sin escribir nada (vista previa del modal).
function simularAjusteDetallado({ marca, linea, producto, stock, signo, filas = 0, bandejas = 0, paquetes = 0 }) {
  const porBandeja = paquetesPorBandeja(marca, linea, producto);
  const delta = signo * (((Number(filas) * BANDEJAS_POR_FILA) + Number(bandejas)) * porBandeja + Number(paquetes));
  const total = Number(stock?.cantidad || 0) * porBandeja + Number(stock?.paquetesSueltos || 0) + delta;
  if (total < 0) return { valido: false, porBandeja };
  return { valido: true, porBandeja, cantidad: Math.floor(total / porBandeja), paquetesSueltos: total % porBandeja };
}

// Texto legible de lo que se ajustó, para el historial.
function formatearDetalleAjuste(m) {
  const d = m?.detalle;
  if (!d && m?.tipo === 'ajuste' && m?.origen === 'romero-env' && Number.isFinite(Number(m.deltaPaquetes))) {
    const dp = Number(m.deltaPaquetes);
    return `${dp < 0 ? '−' : '+'}${Math.abs(dp)} paq. (${m.motivo || 'sobrante'})`;
  }
  if (!d) return null;
  const sg = d.signo < 0 ? '−' : '+';
  const partes = [];
  if (d.filas) partes.push(`${sg}${d.filas} fila${d.filas === 1 ? '' : 's'}`);
  if (d.bandejas) partes.push(`${sg}${d.bandejas} bandeja${d.bandejas === 1 ? '' : 's'}`);
  if (d.paquetes) partes.push(`${sg}${d.paquetes} paquete${d.paquetes === 1 ? '' : 's'}`);
  return partes.join(', ');
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

function formatearStock(s) {
  const bandejas = Number(s?.cantidad || 0);
  const paquetes = Number(s?.paquetesSueltos || 0);
  if (bandejas <= 0 && paquetes <= 0) return '0 bandejas';
  if (paquetes > 0) return `${bandejas} bandejas y ${paquetes} paquetes`;
  return `${bandejas} bandejas`;
}

// Versión HTML para las tablas: bandejas y paquetes en partes separadas.
// Solo .qty-number (bandejas) se anima con el contador; los paquetes van aparte
// para que nunca se mezclen los dígitos.
function formatearStockHTML(s) {
  const bandejas = Number(s?.cantidad || 0);
  const paquetes = Number(s?.paquetesSueltos || 0);
  const uBand = bandejas === 1 ? 'bandeja' : 'bandejas';
  const uPaq = paquetes === 1 ? 'paquete' : 'paquetes';
  let html = `<span class="qty-number">${bandejas}</span><span class="qty-unit">${uBand}</span>`;
  if (paquetes > 0) html += `<span class="qty-sep">+</span><span class="qty-pack">${paquetes}</span><span class="qty-unit">${uPaq}</span>`;
  return html;
}

function renderCatalogoStock(tbody, stockData, opciones = {}) {
  tbody.innerHTML = '';
  todosLosProductos().forEach(({ marca, linea, producto, key }) => {
    const s = stockData[key] || {};
    const qty = Number(s.cantidad || 0);
    const paquetes = Number(s.paquetesSueltos || 0);
    const cls = qty > 0 || paquetes > 0 ? 'qty-ok' : 'qty-zero';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escaparHTML(marca)}</td>
      <td>${escaparHTML(linea)}</td>
      <td class="product-name">${escaparHTML(producto)}</td>
      <td><div class="qty-display ${cls}">${formatearStockHTML(s)}</div></td>
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
