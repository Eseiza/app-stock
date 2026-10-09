// ============================================================
// Editor de stock compartido (admin y operario)
// Modal para sumar / restar filas, bandejas y paquetes.
// Uso: const editor = initEditorStock({ getStock: () => stockData, usuario, origen });
//      editor.abrir(key)  ·  editor.refrescar()
// ============================================================
function initEditorStock({ getStock, usuario, origen = 'admin' }) {
  const cont = document.createElement('div');
  cont.innerHTML = `<div class="modal hidden" id="modal-editar" role="dialog" aria-modal="true" aria-labelledby="edit-titulo">
  <div class="modal-box">
    <div class="modal-head">
      <div>
        <div class="modal-kicker" id="edit-marca"></div>
        <h3 id="edit-titulo"></h3>
      </div>
      <button type="button" class="modal-x" id="edit-cerrar" aria-label="Cerrar">✕</button>
    </div>
    <div class="edit-actual">
      <span class="stat-label">Stock actual</span>
      <strong id="edit-actual"></strong>
      <span class="cell-muted" id="edit-equiv"></span>
    </div>
    <div class="chips seg" id="edit-signo">
      <button type="button" class="chip on" data-signo="1">+ Sumar</button>
      <button type="button" class="chip" data-signo="-1">− Restar</button>
    </div>
    <div class="edit-campos">
      <div class="form-group"><label for="edit-filas">Filas</label>
        <div class="stepper"><button type="button" class="step-btn" data-step="edit-filas" data-d="-1" aria-label="Menos filas">−</button><input type="number" id="edit-filas" min="0" step="1" value="0"><button type="button" class="step-btn" data-step="edit-filas" data-d="1" aria-label="Más filas">+</button></div>
        <span class="field-hint" id="hint-filas"></span></div>
      <div class="form-group"><label for="edit-bandejas">Bandejas</label>
        <div class="stepper"><button type="button" class="step-btn" data-step="edit-bandejas" data-d="-1" aria-label="Menos bandejas">−</button><input type="number" id="edit-bandejas" min="0" step="1" value="0"><button type="button" class="step-btn" data-step="edit-bandejas" data-d="1" aria-label="Más bandejas">+</button></div>
        <span class="field-hint" id="hint-bandejas"></span></div>
      <div class="form-group"><label for="edit-paquetes">Paquetes</label>
        <div class="stepper"><button type="button" class="step-btn" data-step="edit-paquetes" data-d="-1" aria-label="Menos paquetes">−</button><input type="number" id="edit-paquetes" min="0" step="1" value="0"><button type="button" class="step-btn" data-step="edit-paquetes" data-d="1" aria-label="Más paquetes">+</button></div>
        <span class="field-hint" id="hint-paquetes"></span></div>
    </div>
    <div class="alert alert-info" id="edit-preview"></div>
    <div class="modal-actions">
      <button type="button" class="btn" id="edit-cancelar">Cancelar</button>
      <button type="button" class="btn btn-primary" id="edit-guardar">Aplicar ajuste</button>
    </div>
  </div>
</div>`;
  const modal = cont.firstElementChild;
  document.body.appendChild(modal);

  const $ = id => modal.querySelector('#' + id);
  const inputs = { filas: $('edit-filas'), bandejas: $('edit-bandejas'), paquetes: $('edit-paquetes') };
  const btnGuardar = $('edit-guardar');
  let editando = null; // { key, marca, linea, producto, porBandeja }
  let signo = 1;

  const leer = input => {
    const n = Number(input.value);
    return Number.isInteger(n) && n >= 0 ? n : NaN;
  };

  function abrir(key) {
    const [marca, linea, producto] = key.split('|');
    editando = { key, marca, linea, producto, porBandeja: paquetesPorBandeja(marca, linea, producto) };
    signo = 1;
    Object.values(inputs).forEach(i => { i.value = 0; });
    $('edit-marca').textContent = `${marca} · ${linea}`;
    $('edit-titulo').textContent = producto;
    modal.querySelectorAll('#edit-signo .chip').forEach(c => c.classList.toggle('on', Number(c.dataset.signo) === 1));
    $('hint-filas').textContent = `1 fila = ${BANDEJAS_POR_FILA} bandejas`;
    $('hint-bandejas').textContent = `1 bandeja = ${editando.porBandeja} paquetes`;
    $('hint-paquetes').textContent = 'paquetes sueltos';
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    refrescar();
    inputs.bandejas.focus();
    inputs.bandejas.select();
  }

  function cerrar() {
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    editando = null;
  }

  function refrescar() {
    if (!editando) return;
    const s = getStock()[editando.key] || {};
    const bandejas = Number(s.cantidad || 0);
    const filasCompletas = Math.floor(bandejas / BANDEJAS_POR_FILA);
    const resto = bandejas % BANDEJAS_POR_FILA;
    $('edit-actual').textContent = formatearStock(s);
    $('edit-equiv').textContent = filasCompletas > 0
      ? `≈ ${filasCompletas} fila${filasCompletas === 1 ? '' : 's'} y ${resto} bandeja${resto === 1 ? '' : 's'}`
      : '';

    const preview = $('edit-preview');
    const filas = leer(inputs.filas), band = leer(inputs.bandejas), paq = leer(inputs.paquetes);
    preview.className = 'alert';
    btnGuardar.disabled = true;
    if ([filas, band, paq].some(Number.isNaN)) {
      preview.classList.add('alert-error');
      preview.textContent = 'Usá números enteros (0 o más).';
      return;
    }
    if (filas + band + paq === 0) {
      preview.classList.add('alert-info');
      preview.textContent = 'Indicá cuánto querés sumar o restar.';
      return;
    }
    const sim = simularAjusteDetallado({ ...editando, stock: s, signo, filas, bandejas: band, paquetes: paq });
    if (!sim.valido) {
      preview.classList.add('alert-error');
      preview.textContent = 'No se puede restar más de lo que hay en stock.';
      return;
    }
    preview.classList.add('alert-ok');
    preview.textContent = `Quedará: ${formatearStock(sim)}`;
    btnGuardar.disabled = false;
  }

  modal.querySelectorAll('#edit-signo .chip').forEach(c => c.addEventListener('click', () => {
    signo = Number(c.dataset.signo);
    modal.querySelectorAll('#edit-signo .chip').forEach(x => x.classList.toggle('on', x === c));
    refrescar();
  }));
  Object.values(inputs).forEach(i => i.addEventListener('input', refrescar));
  modal.addEventListener('click', e => {
    const st = e.target.closest('[data-step]');
    if (st) {
      const input = $(st.dataset.step);
      input.value = Math.max(0, (Number(input.value) || 0) + Number(st.dataset.d));
      refrescar();
      return;
    }
    if (e.target === modal) cerrar();
  });
  $('edit-cerrar').addEventListener('click', cerrar);
  $('edit-cancelar').addEventListener('click', cerrar);
  addEventListener('keydown', e => {
    if (!editando) return;
    if (e.key === 'Escape') cerrar();
    if (e.key === 'Enter' && !btnGuardar.disabled) btnGuardar.click();
  });

  btnGuardar.addEventListener('click', async () => {
    if (!editando) return;
    const { marca, linea, producto } = editando;
    const filas = leer(inputs.filas), bandejas = leer(inputs.bandejas), paquetes = leer(inputs.paquetes);
    btnGuardar.disabled = true;
    try {
      const nuevo = await ajustarStockDetallado({ marca, linea, producto, signo, filas, bandejas, paquetes, usuario, origen });
      cerrar();
      showToast(`${producto}: stock ahora ${formatearStock(nuevo)}`);
    } catch (e) {
      console.error(e);
      showToast(e.message || 'No se pudo ajustar el stock', true);
      refrescar();
    }
  });

  return { abrir, cerrar, refrescar };
}
