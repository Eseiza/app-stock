// ============================================================
// Mantenimiento (solo Admin): borrar lo cargado en la base de AppStock.
//
// - Trabaja ÚNICAMENTE sobre dbStock (appstock). romero-env no se toca nunca.
// - Borra con un solo update() multi-ruta, así es todo o nada.
// - Antes de borrar puede descargar un respaldo .json.
// - Al borrar el stock se reinicia el punto de partida de la sincronización
//   ("desde ahora"); si no, el respaldo de sincronización volvería a sumar los
//   sobrantes de envase que ya estaban cargados.
// ============================================================
if (!checkSesion('admin')) throw new Error('Sin acceso');

(() => {
  const PALABRA = 'BORRAR';
  // Nodos de la base que se borran con cada opción.
  const NODOS = {
    stock: ['stock', 'sincronizacion'],
    movimientos: ['movimientos']
  };

  const $ = id => document.getElementById(id);
  const chkStock = $('mant-stock');
  const chkMov = $('mant-movimientos');
  const chkRespaldo = $('mant-respaldo');
  const inputConf = $('mant-confirmacion');
  const btn = $('mant-borrar');
  const err = $('mant-error');
  const ok = $('mant-ok');
  if (!btn) return;

  const contar = v => (v && typeof v === 'object') ? Object.keys(v).length : 0;
  const leerNodo = async nodo => (await dbStock.ref(nodo).once('value')).val();

  async function actualizarCuentas() {
    try {
      const [stock, mov, sync] = await Promise.all([leerNodo('stock'), leerNodo('movimientos'), leerNodo('sincronizacion')]);
      $('mant-cuenta-stock').textContent = `${contar(stock)} productos · ${contar(sync)} sobrantes`;
      $('mant-cuenta-movimientos').textContent = `${contar(mov)} movimientos`;
    } catch (e) {
      console.error(e);
      $('mant-cuenta-stock').textContent = '—';
      $('mant-cuenta-movimientos').textContent = '—';
    }
  }

  function validar() {
    const alguno = chkStock.checked || chkMov.checked;
    btn.disabled = !(alguno && inputConf.value.trim().toUpperCase() === PALABRA);
  }

  async function descargarRespaldo(nodos) {
    const datos = {};
    for (const nodo of nodos) datos[nodo] = await leerNodo(nodo);
    const ahora = new Date();
    const pad = n => String(n).padStart(2, '0');
    const nombre = `appstock-respaldo-${ahora.getFullYear()}${pad(ahora.getMonth() + 1)}${pad(ahora.getDate())}-${pad(ahora.getHours())}${pad(ahora.getMinutes())}.json`;
    const blob = new Blob([JSON.stringify({ generado: ahora.toISOString(), usuario: getUsuario(), datos }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return nombre;
  }

  async function borrar() {
    if (getRol() !== 'admin') return;
    err.classList.add('hidden'); ok.classList.add('hidden');

    const nodos = [];
    if (chkStock.checked) nodos.push(...NODOS.stock);
    if (chkMov.checked) nodos.push(...NODOS.movimientos);
    if (!nodos.length) return;

    btn.disabled = true;
    btn.textContent = 'Borrando...';
    try {
      let respaldo = '';
      if (chkRespaldo.checked) respaldo = await descargarRespaldo(nodos); // si falla, no se borra nada

      const cambios = {};
      nodos.forEach(n => { cambios[n] = null; });
      let nuevoInicio = null;
      if (chkStock.checked) {
        nuevoInicio = Date.now();
        cambios['sincronizacion_config/inicio'] = nuevoInicio;
      }
      await dbStock.ref().update(cambios);

      // Esta pestaña también adopta el nuevo punto de partida.
      if (nuevoInicio !== null && typeof inicioSincronizacion !== 'undefined') inicioSincronizacion = nuevoInicio;

      const que = [chkStock.checked && 'stock', chkMov.checked && 'historial'].filter(Boolean).join(' y ');
      ok.textContent = `Se borró: ${que}.` + (respaldo ? ` Respaldo descargado: ${respaldo}` : '');
      ok.classList.remove('hidden');
      showToast('Datos borrados');
      inputConf.value = '';
      await actualizarCuentas();
    } catch (e) {
      console.error(e);
      err.textContent = 'No se pudo borrar: ' + (e.message || e);
      err.classList.remove('hidden');
    } finally {
      btn.textContent = 'Borrar datos seleccionados';
      validar();
    }
  }

  [chkStock, chkMov].forEach(c => c.addEventListener('change', validar));
  inputConf.addEventListener('input', validar);
  btn.addEventListener('click', borrar);

  // Las cuentas se cargan al entrar a la pestaña (no antes, para no leer de más).
  document.querySelector('.tab-btn[data-tab="mantenimiento"]')?.addEventListener('click', actualizarCuentas);
  validar();
})();
