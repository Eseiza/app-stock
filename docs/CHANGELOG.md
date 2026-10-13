#v.12


# Historial de cambios

## v1.9 - orden del proyecto y herramienta de mantenimiento
- Nueva pestaña **Mantenimiento** (solo Admin): borra el stock y/o el historial de AppStock. Pide escribir BORRAR, puede descargar un respaldo .json antes y reinicia el punto de partida de la sincronización para que no se vuelvan a cargar sobrantes viejos de envase. Nunca escribe en romero-env. Código en js/pages/mantenimiento.js.
- ventas.html no cargaba sobrantes-stock.js pero ejecutaba la sincronización: los sobrantes quedaban marcados con error ("aplicarSobranteEnStock is not defined"). Corregido.
- visor.html cargaba sincronizacion.js sin usarlo: quitado.
- admin: la tabla de Usuarios tenía 2 encabezados y 3 columnas; se agregó "Permisos".
- Código sin uso eliminado: ajustarStock, obtenerStockProducto, escucharStockProducto (stock-core), obtenerRefStock y COLECCION_PRODUCTOS (config), idSeguro duplicado (sincronizacion), renderStockPendiente (admin), variable sin uso (operador).
- Eliminados archivos huérfanos: legacy/ (app.js, carga.html, carga.js; carga.html apuntaba a archivos que ya no existían) y desktop.ini.
- Este historial pasó de legacy/README-v1.8.txt a docs/CHANGELOG.md.

## v1.8 - endurecimiento del núcleo

Cambios:
- Ajuste de stock ahora usa transaction() para evitar sobrescrituras por concurrencia.
- Ajustes sin diferencia no generan movimientos innecesarios.
- Se conserva delta, stockAnterior y stockFinal.
- Escape de valores renderizados desde Firebase para reducir riesgo de HTML inyectado.
- romero-env continúa siendo únicamente lectura.
- La autenticación sigue siendo provisional mediante sessionStorage; Firebase Authentication + Rules debe configurarse antes de producción.

v1.8.2 - correcciones y nuevo estilo
- admin: los botones "Aplicar" (ajuste) y "Guardar" no funcionaban: el onclick inline rompía el atributo HTML
  y window.ajustarStock pisaba la función del núcleo. Ahora usan data-attributes + delegación de eventos y ajustarStockUI().
- admin: la tabla ya no se redibuja mientras se escribe en una fila (se actualiza al salir del campo).
- stock-core: registrarMovimiento ahora guarda delta (antes se descartaba).
- admin: filtro de historial con opción "Producción"; resumen de marcas escapado.
- ventas.html: se cierra el div .content.
- showToast(msg, esError) distingue éxito de error.
- Estilo: tema oscuro con rojo Romero, degradés radiales y radios unificados (style.css reescrito, mismas clases).
- Archivos huérfanos sin uso: app.js (demo vieja) y carga.html/carga.js (reemplazados por operador.*).

v1.8.3 - edición de stock desde "Stock actual" (admin)
- Nuevo botón "Editar" por producto: abre un modal para sumar o restar filas, bandejas y paquetes (1 fila = 14 bandejas; 1 bandeja = paquetes según producto).
- Vista previa del stock resultante y bloqueo si el ajuste dejaría stock negativo.
- stock-core: ajustarStockDetallado() (transaction sobre paquetes totales), simularAjusteDetallado(), formatearDetalleAjuste().
- El historial muestra el detalle del ajuste (ej. "+1 fila, +2 bandejas").

v1.8.4 - el operario también puede editar stock
- El editor (modal de filas / bandejas / paquetes) pasó a js/ui/editor-stock.js y lo usan admin y operario.
- Los ajustes del operario quedan en el historial con origen "operario".
- Usuarios (admin.js): el rol OPERARIO ahora figura como "Salidas, movimientos y edición de stock".

v1.8.5 - la sincronización lee "sobrantes"
- Fuente: romero-env/historial/{fecha}/sobrantes/{id} (antes leía .../tareas, que no es donde envase guarda lo cargado).
- Campos usados: marca, linea, producto, total (paquetes). 'total' ya viene en paquetes: se convierte a bandejas con paqPorBandeja del catálogo y el resto queda como paquetes sueltos.
- Los registros inválidos ahora dejan un aviso en la consola en lugar de ignorarse en silencio.

v1.8.6 - sincronización solo en tiempo real
- Ya no se procesa el historial existente: solo los sobrantes creados desde que se activó la sincronización.
- La primera vez que se abre admin/operario se guarda el momento de inicio en appstock: sincronizacion_config/inicio. Se compara con la hora de creación embebida en el ID de cada registro (push ID).
- Lo que entre mientras la app está cerrada se toma al abrirla (siempre que sea posterior al inicio).
- Para reiniciar el punto de partida: borrar el nodo sincronizacion_config/inicio.

v1.8.7 - el stock se registra en el momento de cargar en envase
- app-envase ahora escribe en AppStock al crear / editar / eliminar un sobrante (archivos nuevos en envase: stock-sync.js y sobrantes-stock.js).
- js/core/sobrantes-stock.js (nuevo, IDÉNTICO al de app-envase): aplica el sobrante al stock de forma idempotente. Alta suma, edición aplica la diferencia, eliminación resta.
- sincronizacion.js pasa a ser RESPALDO: toma los sobrantes nuevos que envase no haya podido escribir (p. ej. sin conexión). Si ya estaban registrados no los vuelve a sumar.
- El sobrante se identifica por su ID (ya no por fecha + ID), así corregir-sobrantes (cambio de día) no duplica.
- Las ediciones/eliminaciones desde envase quedan en el historial como "Ajuste" con origen romero-env (ej. "−1000 paq. (sobrante eliminado)").
- Si se elimina un sobrante cuyo stock ya salió, el stock queda en 0 y el movimiento se marca con descuadre:true.

v1.8.8 - jornada de envase (8:30 a 8:30, sábado hasta lunes 8:30)
- El respaldo de sincronización deja 3 días de margen al filtrar fechas (la jornada puede guardar bajo una fecha anterior). El control fino sigue siendo la hora del ID del registro.
