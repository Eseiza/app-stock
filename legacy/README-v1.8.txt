AppStock v1.8 - endurecimiento del núcleo

Cambios:
- Ajuste de stock ahora usa transaction() para evitar sobrescrituras por concurrencia.
- Ajustes sin diferencia no generan movimientos innecesarios.
- Se conserva delta, stockAnterior y stockFinal.
- Escape de valores renderizados desde Firebase para reducir riesgo de HTML inyectado.
- romero-env continúa siendo únicamente lectura.
- La autenticación sigue siendo provisional mediante sessionStorage; Firebase Authentication + Rules debe configurarse antes de producción.

v1.8.2 - correcciones y nuevo estilo
- admin: los botones "Aplicar" (ajuste) y "Guardar" (ubicación) no funcionaban: el onclick inline rompía el atributo HTML
  y window.ajustarStock pisaba la función del núcleo. Ahora usan data-attributes + delegación de eventos y ajustarStockUI().
- admin: la tabla ya no se redibuja mientras se escribe en una fila (se actualiza al salir del campo).
- stock-core: registrarMovimiento ahora guarda delta (antes se descartaba).
- admin: filtro de historial con opción "Producción"; resumen de marcas escapado.
- ventas.html: se cierra el div .content.
- showToast(msg, esError) distingue éxito de error.
- Estilo: tema oscuro con rojo Romero, degradés radiales y radios unificados (style.css reescrito, mismas clases).
- Archivos huérfanos sin uso: app.js (demo vieja) y carga.html/carga.js (reemplazados por operador.*).
