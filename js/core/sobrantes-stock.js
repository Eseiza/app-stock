// ============================================================
// Registro de sobrantes (producción de romero-env) en AppStock.
// IMPORTANTE: este archivo es IDÉNTICO en app-envase y en AppStock.
// Si se cambia en uno, copiarlo al otro.
//
// aplicarSobranteEnStock(db, {...}) deja el stock de UN producto igual a
// "lo que corresponde según este sobrante", de forma idempotente:
//   - paquetes = número  -> alta (si no estaba) o edición (suma la diferencia)
//   - paquetes = null    -> anulación (resta lo que ese sobrante había sumado)
// Cada sobrante se identifica por su ID (independiente de la fecha), y lo que
// aportó queda en stock/{clave}/producciones/{id}, por eso llamarla dos veces
// con los mismos datos no suma dos veces.
// ============================================================
function idSeguroSync(id) {
  return String(id).replace(/[.#$\[\]\/]/g, '_');
}

async function aplicarSobranteEnStock(db, { id, marca, linea, producto, paquetes, porBandeja, fechaRomero = null, hora = null, reactivar = false }) {
  const anular = paquetes === null;
  const nuevoPaq = anular ? 0 : Number(paquetes);
  const ppb = Number(porBandeja);
  if (!id || !marca || !producto) throw new Error('Faltan datos del sobrante.');
  if (!(ppb > 0)) throw new Error('Paquetes por bandeja inválido.');
  if (!anular && !(Number.isFinite(nuevoPaq) && nuevoPaq >= 0)) throw new Error('Total de paquetes inválido.');

  const syncKey = idSeguroSync(id);
  const clave = [marca, linea, producto].join('|');
  const ref = db.ref(`stock/${clave}`);
  const ahora = Date.now();

  let calculado = false, previo = null, antes = null, despues = null, descuadre = false;

  const res = await ref.transaction(actual => {
    // Primera pasada local sin datos del servidor: para anular no hay nada que decidir todavía.
    if (actual === null && anular) return actual;

    const data = actual && typeof actual === 'object' ? actual : {};
    const prods = data.producciones && typeof data.producciones === 'object' ? data.producciones : {};
    const prev = prods[syncKey] || null;
    const prevActivo = !!prev && !prev.anulado;
    const prevPaq = prevActivo ? Number(prev.paquetes || 0) : 0;

    if (anular && !prevActivo) return;                           // no había nada para anular
    if (!anular && prevActivo && prevPaq === nuevoPaq) return;   // ya estaba registrado igual
    if (!anular && prev && prev.anulado && !reactivar) return;   // un sobrante anulado no se revive solo

    calculado = true;
    previo = prev;
    antes = { cantidad: Number(data.cantidad || 0), paquetesSueltos: Number(data.paquetesSueltos || 0) };
    let total = antes.cantidad * ppb + antes.paquetesSueltos + (nuevoPaq - prevPaq);
    descuadre = total < 0;           // se restó más de lo que queda (ya salió mercadería): se deja en 0
    if (total < 0) total = 0;
    despues = { cantidad: Math.floor(total / ppb), paquetesSueltos: total % ppb };

    return {
      ...data,
      marca, linea, producto,
      cantidad: despues.cantidad,
      paquetesSueltos: despues.paquetesSueltos,
      ultimaActualizacion: ahora,
      producciones: {
        ...prods,
        [syncKey]: {
          ...(prev || {}),
          paquetes: nuevoPaq,
          paquetesPorBandeja: ppb,
          cantidad: Math.floor(nuevoPaq / ppb),
          anulado: anular,
          referenciaRomero: id,
          ...(fechaRomero ? { fechaRomero } : {}),
          ...(hora ? { horaRomero: hora } : {}),
          procesadoEn: prev?.procesadoEn || ahora,
          actualizadoEn: ahora
        }
      }
    };
  });

  if (!res.committed || !calculado) return { aplicado: false };

  const prevPaqAplicado = previo && !previo.anulado ? Number(previo.paquetes || 0) : 0;
  const deltaPaquetes = nuevoPaq - prevPaqAplicado;
  const bandejasDelta = despues.cantidad - antes.cantidad;
  const base = {
    marca, linea, producto,
    fecha: ahora,
    origen: 'romero-env',
    referenciaRomero: id,
    paquetesPorBandeja: ppb,
    stockAnterior: antes.cantidad,
    stockFinal: despues.cantidad,
    ...(fechaRomero ? { fechaRomero } : {}),
    ...(hora ? { horaRomero: hora } : {})
  };

  if (!previo) {
    // Alta: movimiento con ID fijo, se crea una sola vez.
    const movRef = db.ref(`movimientos/${syncKey}`);
    const snap = await movRef.once('value');
    if (!snap.exists()) {
      await movRef.set({ ...base, tipo: 'produccion', cantidad: Math.floor(nuevoPaq / ppb), paquetes: nuevoPaq });
    }
  } else {
    // Edición o eliminación del sobrante: queda como ajuste con signo.
    await db.ref('movimientos').push({
      ...base,
      tipo: 'ajuste',
      cantidad: Math.abs(bandejasDelta) || Math.abs(deltaPaquetes),
      delta: bandejasDelta,
      deltaPaquetes,
      paquetes: nuevoPaq,
      usuario: 'romero-env',
      motivo: anular ? 'sobrante eliminado' : 'sobrante editado',
      ...(descuadre ? { descuadre: true } : {})
    });
  }

  try {
    await db.ref(`sincronizacion/${syncKey}`).set({
      estado: anular ? 'anulado' : 'procesado',
      clave, paquetes: nuevoPaq, referenciaRomero: id,
      ...(fechaRomero ? { fechaRomero } : {}),
      actualizado: ahora
    });
  } catch (e) { console.warn('[sobrantes-stock] No se pudo escribir el estado de sincronización', e); }

  return { aplicado: true, stock: despues, descuadre };
}
