// ============================================================
// SINCRONIZACIÓN ROMERO-ENV -> APP-STOCK
// romero-env se consulta únicamente con operaciones de lectura.
// ============================================================

const RUTA_HISTORIAL_ROMERO = 'historial';
const RUTA_SYNC = 'sincronizacion';

let sincronizacionActiva = false;
const fechasObservadas = new Set();
const tareasObservadas = new Set();

function idSeguro(id) {
  return String(id).replace(/[.#$\[\]/]/g, '_');
}

function esTareaValida(data) {
  if (!data || typeof data !== 'object') return false;
  const cantidad = Number(data[CAMPO_CANTIDAD]);
  return Boolean(data[CAMPO_PRODUCTO]) && Number.isFinite(cantidad) && cantidad > 0;
}

function obtenerDatosTarea(data) {
  const marca = data[CAMPO_MARCA] || '';
  const linea = data[CAMPO_LINEA] || '';
  const producto = data[CAMPO_PRODUCTO] || '';
  const cantidad = Number(data[CAMPO_CANTIDAD]);
  const catalogado = buscarProductoCatalogo(marca, linea, producto);

  if (!catalogado) {
    throw new Error(`Producto no catalogado: ${marca} / ${linea} / ${producto}`);
  }

  return {
    marca: catalogado.marca,
    linea: catalogado.linea,
    producto: catalogado.producto,
    cantidad,
    hora: data.hora || null
  };
}

/*
 * Idempotencia fuerte por producto:
 * la producción de cada tarea queda registrada dentro del mismo nodo
 * de stock que se actualiza mediante transaction(). Si el navegador
 * se corta después de actualizar, al reintentar la misma tarea la
 * transaction detecta que ya existe producciones[syncId] y NO vuelve
 * a sumar la cantidad.
 */
async function procesarTarea(fechaKey, idTarea, data) {
  if (!esTareaValida(data)) return;

  const syncId = `${fechaKey}__${idTarea}`;
  const syncKey = idSeguro(syncId);

  try {
    const datos = obtenerDatosTarea(data);
    const key = claveProducto(datos.marca, datos.linea, datos.producto);
    const stockRef = dbStock.ref(`stock/${key}`);
    const syncRef = dbStock.ref(`${RUTA_SYNC}/${syncKey}`);
    const movimientoRef = dbStock.ref(`movimientos/${syncKey}`);
    const ahora = Date.now();

    const resultado = await stockRef.transaction(actual => {
      const actualData = actual && typeof actual === 'object' ? actual : {};
      const producciones = actualData.producciones && typeof actualData.producciones === 'object'
        ? actualData.producciones
        : {};

      if (producciones[syncKey]) return;

      return {
        marca: datos.marca,
        linea: datos.linea,
        producto: datos.producto,
        cantidad: Number(actualData.cantidad || 0) + datos.cantidad,
        ultimaActualizacion: ahora,
        producciones: {
          ...producciones,
          [syncKey]: {
            cantidad: datos.cantidad,
            fechaRomero: fechaKey,
            referenciaRomero: idTarea,
            horaRomero: datos.hora,
            procesadoEn: ahora
          }
        }
      };
    });

    if (!resultado.committed) {
      // Ya estaba procesada por otra ejecución: aseguramos los metadatos y salimos.
      const snap = await stockRef.once('value');
      const existente = snap.val()?.producciones?.[syncKey];
      if (!existente) throw new Error('No se pudo actualizar el stock.');
    }

    const stockFinal = Number((await stockRef.once('value')).val()?.cantidad || 0);

    // El movimiento usa un ID determinístico, por lo que se crea una sola vez.
    const movimientoSnap = await movimientoRef.once('value');
    if (!movimientoSnap.exists()) {
      await movimientoRef.set({
        tipo: 'produccion',
        marca: datos.marca,
        linea: datos.linea,
        producto: datos.producto,
        cantidad: datos.cantidad,
        fecha: ahora,
        fechaRomero: fechaKey,
        horaRomero: datos.hora,
        origen: 'romero-env',
        referenciaRomero: idTarea,
        stockFinal
      });
    }

    await syncRef.set({
      estado: 'procesado',
      fechaRomero: fechaKey,
      referenciaRomero: idTarea,
      producto: datos.producto,
      cantidad: datos.cantidad,
      procesadoEn: Date.now()
    });

    console.info('[AppStock] Producción sincronizada:', datos);
  } catch (error) {
    await dbStock.ref(`${RUTA_SYNC}/${idSeguro(syncId)}`).update({
      estado: 'error',
      error: String(error.message || error),
      actualizado: Date.now(),
      fechaRomero: fechaKey,
      referenciaRomero: idTarea
    });
    console.error('[AppStock] Error sincronizando', syncId, error);
  }
}

function observarFecha(fechaKey) {
  if (fechasObservadas.has(fechaKey)) return;
  fechasObservadas.add(fechaKey);

  const tareasRef = dbEnvase.ref(`${RUTA_HISTORIAL_ROMERO}/${fechaKey}/tareas`);
  tareasRef.on('child_added', snap => {
    const id = `${fechaKey}__${snap.key}`;
    if (tareasObservadas.has(id)) return;
    tareasObservadas.add(id);
    procesarTarea(fechaKey, snap.key, snap.val());
  });
}

function iniciarSincronizacionRomero() {
  if (sincronizacionActiva) return;
  sincronizacionActiva = true;

  dbEnvase.ref(RUTA_HISTORIAL_ROMERO).on('child_added', snap => {
    observarFecha(snap.key);
  });

  // También revisa las fechas que ya existían antes de abrir AppStock.
  dbEnvase.ref(RUTA_HISTORIAL_ROMERO).once('value').then(snap => {
    const historial = snap.val() || {};
    Object.keys(historial).forEach(observarFecha);
  }).catch(error => console.error('[AppStock] No se pudo leer historial Romero:', error));

  console.info('[AppStock] Sincronización Romero activa. Fuente: romero-env/' + RUTA_HISTORIAL_ROMERO);
}
