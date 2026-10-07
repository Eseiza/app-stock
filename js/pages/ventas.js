if (!checkSesion('ventas')) throw new Error('Sin acceso');

const currentUser = getUsuario();
document.getElementById('user-name').textContent = currentUser;
document.getElementById('user-avatar').textContent = currentUser.charAt(0).toUpperCase();
document.getElementById('btn-logout').addEventListener('click', logout);

let stockData = {};
iniciarSincronizacionRomero();
escucharStock(data => {
  stockData = data;
  renderStockTable();
});

function renderStockTable() {
  const tbody = document.getElementById('stock-tbody');
  renderCatalogoStock(tbody, stockData);
  document.getElementById('stock-loading').classList.add('hidden');
  document.getElementById('stock-table').classList.remove('hidden');
}
