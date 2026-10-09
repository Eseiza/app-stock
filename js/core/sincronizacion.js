// ============================================================
// SINCRONIZACIÓN ROMERO-ENV (sobrantes) -> APP-STOCK
// romero-env se consulta únicamente con operaciones de lectura.
// ============================================================

const RUTA_HISTORIAL_ROMERO = 'historial';
const NODO_SOBRANTES = 'sobrantes'; // historial/{fecha}/sobrantes/{id}
const RUTA_SYNC = 'sincronizacion';

// Solo se sincronizan los sobrantes creados DESDE que se activó la sincronización.
// El momento de activación se guarda una única vez en appstock (RUTA_INICIO).
// Para volver a empezar "desde ahora", borrar ese nodo en Firebase.
const RUTA_INICIO = 'sincronizacion_config/inicio';
let inicioSincronizacion = 0;

function fechaKeyADate(fechaKey) {
  const [d, m, a] = String(fechaKey).split('-').map(Number);
  return new Date(a, (m || 1) - 1, d || 1).getTime();
}

// Los IDs que genera Firebase (push) llevan la hora de creación en los primeros 8 caracteres.
const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
function fechaDePushId(id) {
  const txt = String(id || '');
  if (txt.length < 20) return null;
  let n = 0;
  for (const ch of txt.slice(0, 8)) {
    const i = PUSH_CHARS.indexOf(ch);
    if (i < 0) return null;
    n = n * 64 + i;
  }
  return n;
}

async function obtenerInicioSincronizacion() {
  const ref = dbStock.ref(RUTA_INICIO);
  const res = await ref.transaction(actual => (Number.isFinite(Number(actual)) && Number(actual) > 0 ? undefined : Date.now()));
  const snap = await ref.once('value');
  return Number(snap.val()) || Date.now();
}

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
  const paquetes = Number(data[CAMPO_CANTIDAD]); // romero-env manda paquetes
  const catalogado = buscarProductoCatalogo(marca, linea, producto);

  if (!catalogado) {
    throw new Error(`Producto no catalogado: ${marca} / ${linea} / ${producto}`);
  }

  const porBandeja = paquetesPorBandeja(catalogado.marca, catalogado.linea, catalogado.producto);
  const cantidad = Math.floor(paquetes / porBandeja); // bandejas completas de esta tarea
  const paquetesRestantes = paquetes % porBandeja; // paquetes que no completan otra bandeja

  return {
    marca: catalogado.marca,
    linea: catalogado.linea,
    producto: catalogado.producto,
    cantidad,
    paquetes,
    paquetesRestantes,
    porBandeja,
    hora: data.hora || null
  };
}

/*
 * Respaldo de la app de envase: normalmente app-envase ya registra cada sobrante en
 * AppStock en el momento de cargarlo. Esto cubre los que no llegaron a escribirse
 * (por ejemplo, envase sin conexión). Usa la misma función idempotente, así que un
 * sobrante ya registrado no se vuelve a sumar.
 */
async function procesarTarea(fechaKey, idTarea, data) {
  if (!esTareaValida(data)) {
    console.warn('[AppStock] Registro ignorado (falta producto o total > 0):', fechaKey, idTarea, data);
    return;
  }

  try {
    const datos = obtenerDatosTarea(data);
    const r = await aplicarSobranteEnStock(dbStock, {
      id: idTarea,
      marca: datos.marca, linea: datos.linea, producto: datos.producto,
      paquetes: datos.paquetes, porBandeja: datos.porBandeja,
      fechaRomero: fechaKey, hora: datos.hora
    });
    if (r.aplicado) console.info('[AppStock] Sobrante registrado por el respaldo:', datos);
  } catch (error) {
    await dbStock.ref(`${RUTA_SYNC}/${idSeguro(idTarea)}`).update({
      estado: 'error',
      error: String(error.message || error),
      actualizado: Date.now(),
      fechaRomero: fechaKey,
      referenciaRomero: idTarea
    });
    console.error('[AppStock] Error sincronizando', idTarea, error);
  }
}

function observarFecha(fechaKey) {
  if (fechasObservadas.has(fechaKey)) return;
  fechasObservadas.add(fechaKey);

  // Días muy anteriores al inicio: nada para sincronizar. Se deja margen de 3 días porque la
  // jornada de envase (8:30 a 8:30, sábado hasta el lunes 8:30) puede guardar un registro bajo
  // una fecha anterior a la del momento en que se cargó. La hora exacta se controla por el ID.
  const limite = new Date(inicioSincronizacion); limite.setHours(0, 0, 0, 0); limite.setDate(limite.getDate() - 3);
  if (fechaKeyADate(fechaKey) < limite.getTime()) return;

  const tareasRef = dbEnvase.ref(`${RUTA_HISTORIAL_ROMERO}/${fechaKey}/${NODO_SOBRANTES}`);
  tareasRef.on('child_added', snap => {
    const id = snap.key;
    if (tareasObservadas.has(id)) return;
    const creado = fechaDePushId(snap.key);
    if (creado === null || creado < inicioSincronizacion) return; // registro anterior a la activación
    tareasObservadas.add(id);
    procesarTarea(fechaKey, snap.key, snap.val());
  });
}

function iniciarSincronizacionRomero() {
  if (sincronizacionActiva) return;
  sincronizacionActiva = true;

  obtenerInicioSincronizacion().then(inicio => {
    inicioSincronizacion = inicio;

    // Fechas nuevas que vayan apareciendo (también recorre las existentes, que se filtran por día).
    dbEnvase.ref(RUTA_HISTORIAL_ROMERO).on('child_added', snap => observarFecha(snap.key));

    console.info('[AppStock] Sincronización Romero activa. Fuente: romero-env/' + RUTA_HISTORIAL_ROMERO +
      '/{fecha}/' + NODO_SOBRANTES + ' · solo registros creados desde ' + new Date(inicio).toLocaleString('es-AR'));
  }).catch(error => {
    sincronizacionActiva = false;
    console.error('[AppStock] No se pudo iniciar la sincronización:', error);
  });
}
