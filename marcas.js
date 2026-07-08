// ── MARCAS / LÍNEAS / PRODUCTOS ───────────────────────────────
const CATALOGO = {
  "The Roxy": {
    "Bollería": ["Pancho", "Super", "Hamburguesa", "Max"]
  },
  "Romero": {
    "Bollería":     ["Pancho", "Super", "Hamburguesa", "Max"],
    "Pan de Molde": ["Lacteado Familiar", "Lacteado Chico", "Salvado Familiar", "Salvado Chico", "Integral", "Multicereal"]
  }
};

function initCascada(idMarca, idLinea, idProducto) {
  const selMarca    = document.getElementById(idMarca);
  const selLinea    = document.getElementById(idLinea);
  const selProducto = document.getElementById(idProducto);

  Object.keys(CATALOGO).forEach(marca => {
    const opt = document.createElement('option');
    opt.value = marca; opt.textContent = marca;
    selMarca.appendChild(opt);
  });

  function actualizarLineas() {
    const marca = selMarca.value;
    selLinea.innerHTML   = '<option value="">Seleccioná línea...</option>';
    selProducto.innerHTML = '<option value="">Seleccioná producto...</option>';
    if (!marca) return;
    const lineas = Object.keys(CATALOGO[marca]);
    lineas.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l; opt.textContent = l;
      selLinea.appendChild(opt);
    });
    // Si hay una sola línea, la selecciona automáticamente
    if (lineas.length === 1) {
      selLinea.value = lineas[0];
      actualizarProductos();
    }
  }

  function actualizarProductos() {
    const marca = selMarca.value;
    const linea = selLinea.value;
    selProducto.innerHTML = '<option value="">Seleccioná producto...</option>';
    if (!marca || !linea) return;
    CATALOGO[marca][linea].forEach(prod => {
      const opt = document.createElement('option');
      opt.value = prod; opt.textContent = prod;
      selProducto.appendChild(opt);
    });
  }

  selMarca.addEventListener('change', actualizarLineas);
  selLinea.addEventListener('change', actualizarProductos);
}
