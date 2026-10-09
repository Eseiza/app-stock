// ── MARCAS / LÍNEAS / PRODUCTOS ───────────────────────────────
// Catálogo alineado con los productos que llegan desde romero-env.
const CATALOGO = {
  "The Roxy": {
    "Bollería": ["Pancho", "Hamburguesa", "Super", "Max"],
    "Pan de Molde": ["Lactal Chico"]
  },
  "Romero": {
    "Bollería": ["Pancho", "Hamburguesa", "Super", "Max"],
    "Pan de Molde": ["Lactal Familiar", "Lactal Chico", "Salvado Familiar", "Salvado Chico", "Integral", "Multicereal"]
  }
};

// ── CONFIGURACIÓN DE PAQUETES ─────────────────────────────────
// Estos son los valores que usa romero-env para cada producto.
// AppStock recibe TOTAL en paquetes y convierte a bandejas completas.
const BANDEJAS_POR_FILA = 14;

const PRODUCTOS = {
  romero: {
    bolleria: {
      label: "Bollería",
      productos: {
        "Pancho":      { paq: 16 },
        "Hamburguesa": { paq: 21 },
        "Super":       { paq: 16 },
        "Max":         { paq: 16 }
      }
    },
    pan: {
      label: "Pan de Molde",
      productos: {
        "Lactal Familiar":  { paq: 10 },
        "Lactal Chico":     { paq: 15 },
        "Salvado Familiar": { paq: 10 },
        "Salvado Chico":    { paq: 15 },
        "Integral":         { paq: 15 },
        "Multicereal":      { paq: 15 }
      }
    }
  },
  roxy: {
    bolleria: {
      label: "Bollería",
      productos: {
        "Pancho":      { paq: 16 },
        "Hamburguesa": { paq: 15 },
        "Super":       { paq: 16 },
        "Max":         { paq: 16 }
      }
    },
    pan: {
      label: "Pan de Molde",
      productos: {
        "Lactal Chico": { paq: 15 }
      }
    }
  }
};

// Equivalencias usadas por la sincronización: paquetes recibidos -> bandejas.
// Se derivan directamente de PRODUCTOS para que no haya dos configuraciones distintas.
function paquetesPorBandeja(marca, linea, producto) {
  const nm = normalizarTexto(marca);
  const nl = normalizarTexto(linea);
  const np = normalizarTexto(producto);

  let marcaConfig = null;
  if (nm === 'romero') marcaConfig = PRODUCTOS.romero;
  else if (nm === 'roxy' || nm === 'the roxy') marcaConfig = PRODUCTOS.roxy;

  if (marcaConfig) {
    for (const grupo of Object.values(marcaConfig)) {
      if (normalizarTexto(grupo.label) !== nl) continue;
      for (const [nombre, config] of Object.entries(grupo.productos)) {
        if (normalizarTexto(nombre) === np && Number(config.paq) > 0) {
          return Number(config.paq);
        }
      }
    }
  }

  return 1;
}

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
