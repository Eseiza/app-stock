# Stock Romero (AppStock)

Aplicación web de stock para Romero Panificados. HTML + JS puro, Firebase Realtime Database. No requiere compilar: se abre con cualquier servidor estático.

## Estructura

```
index.html            Login por rol
pages/                admin · operador · visor · ventas
js/core/              config (Firebase), marcas (catálogo), stock-core, sobrantes-stock, sincronizacion
js/pages/             lógica de cada página (+ mantenimiento.js, solo admin)
js/ui/                ui.js (interacciones) · editor-stock.js (modal de ajuste)
css/                  tokens · base · components
docs/CHANGELOG.md     historial de versiones
```

## Roles

| Rol | Qué puede hacer |
|---|---|
| admin | Todo: stock, movimientos, ajustes, historial, mantenimiento |
| operario | Salidas, ajustes de stock, historial |
| visor | Stock y movimientos |
| ventas | Solo stock disponible |

## Bases de datos

- **appstock** (lectura/escritura): `stock`, `movimientos`, `sincronizacion`, `sincronizacion_config`.
- **romero-env** (solo lectura): `historial/{fecha}/sobrantes/{id}`.

## Borrar datos

Admin → pestaña **Mantenimiento**. Elegí qué borrar, dejá marcado el respaldo, escribí BORRAR y confirmá.
Solo toca appstock. Al borrar el stock, la sincronización vuelve a empezar desde ese momento.

`js/core/sobrantes-stock.js` debe ser idéntico al de app-envase.

## Pendiente antes de producción

- El login es provisional (usuarios y contraseñas en `js/pages/login.js`, sesión en sessionStorage). Pasar a Firebase Authentication + Reglas de la base; hoy cualquiera con la URL podría escribir o borrar datos.
- Agregar `".indexOn": "fecha"` en `movimientos` en las reglas de appstock (la consulta del historial ordena por `fecha`).
