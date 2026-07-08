if (!checkSesion('carga')) throw new Error('Sin acceso');

const currentUser = getUsuario();
document.getElementById('user-name').textContent   = currentUser;
document.getElementById('user-avatar').textContent = currentUser.charAt(0).toUpperCase();
document.getElementById('btn-logout').addEventListener('click', logout);

let stockData = {};

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// Iniciar cascada
initCascada('mov-marca', 'mov-linea', 'mov-producto');

// Mostrar stock actual al elegir producto
document.getElementById('mov-producto').addEventListener('change', () => {
  const key = getKey();
  const div = document.getElementById('mov-stock-actual');
  if (!key) { div.classList.add('hidden'); return; }
  const qty = stockData[key]?.cantidad ?? 0;
  div.textContent = `Stock actual: ${qty}`;
  div.classList.remove('hidden');
});

cargarStock();

async function cargarStock() {
  const snap = await dbStock.collection('stock').get();
  stockData  = {};
  snap.docs.forEach(doc => { stockData[doc.id] = doc.data(); });
  renderStockTable();
  document.getElementById('stock-loading').classList.add('hidden');
  document.getElementById('stock-table').classList.remove('hidden');
}

// La key del documento de stock es "Marca|Línea|Producto"
function getKey() {
  const marca    = document.getElementById('mov-marca').value;
  const linea    = document.getElementById('mov-linea').value;
  const producto = document.getElementById('mov-producto').value;
  if (!marca || !linea || !producto) return null;
  return `${marca}|${linea}|${producto}`;
}

function renderStockTable() {
  const tbody = document.getElementById('stock-tbody');
  tbody.innerHTML = '';
  // Armar filas desde el catálogo
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

document.getElementById('btn-registrar').addEventListener('click', async () => {
  const marca    = document.getElementById('mov-marca').value;
  const linea    = document.getElementById('mov-linea').value;
  const producto = document.getElementById('mov-producto').value;
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

  if (cantidad > stockActual) {
    errDiv.textContent = `Stock insuficiente. Stock actual: ${stockActual}`;
    errDiv.classList.remove('hidden'); return;
  }

  const nuevoStock = stockActual - cantidad;
  const ahora      = firebase.firestore.Timestamp.fromDate(new Date());
  const batch      = dbStock.batch();

  batch.set(dbStock.collection('stock').doc(key), {
    marca, linea, producto, cantidad: nuevoStock, ultimaActualizacion: ahora
  });
  batch.set(dbStock.collection('movimientos').doc(), {
    marca, linea, producto, tipo: 'salida',
    cantidad, fecha: ahora, usuario: currentUser
  });
  await batch.commit();

  stockData[key] = { marca, linea, producto, cantidad: nuevoStock, ultimaActualizacion: ahora };
  renderStockTable();
  document.getElementById('mov-cantidad').value = '';
  document.getElementById('mov-stock-actual').classList.add('hidden');
  showToast('Salida registrada');
  okDiv.textContent = `Nuevo stock de "${producto}": ${nuevoStock}`;
  okDiv.classList.remove('hidden');
});
