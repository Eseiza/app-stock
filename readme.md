Desarrolla una aplicación web de gestión de stock utilizando HTML, CSS, JavaScript, Node.js, Express, Firebase, GitHub y Render.

La aplicación debe usar dos proyectos Firebase:

app-envase: contiene la base de productos existente (solo lectura).
app-stock: nueva base de datos para almacenar stock, movimientos y usuarios.

Funcionalidades:

Login con Firebase Authentication.
Roles: Administrador y Operador.
Obtener automáticamente los productos desde app-envase.
Permitir cargar stock inicial por producto.
Registrar entradas y salidas de stock.
Actualizar automáticamente el stock disponible.
Impedir salidas que dejen stock negativo.
Registrar en cada movimiento:
Producto
Cantidad
Tipo (Entrada/Salida)
Fecha y hora
Usuario
Stock anterior
Stock posterior
Dashboard con stock total, productos con bajo stock y últimos movimientos.
Historial completo con filtros por producto, fecha, usuario y tipo de movimiento.
Exportación a Excel y PDF.
Interfaz moderna, responsive y profesional.

Estructura de Firebase app-stock:

usuarios
stock
movimientos

La aplicación debe estar lista para producción, conectada a Firebase mediante variables de entorno, preparada para subir a GitHub y desplegar en Render.
