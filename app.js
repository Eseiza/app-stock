const productos = [
    {
        nombre: "Envase 1L",
        codigo: "ENV001",
        stock: 150
    },{
        nombre: "Envase 2L",
        codigo: "ENV002",
        stock: 80
    },{
        nombre: "Tapa Negra",
        codigo: "TAP001",
        stock: 450
    }
];
const tabla = document.getElementById("tablaStock");
productos.forEach(producto => {
    tabla.innerHTML += `
        <tr>
            <td>${producto.nombre}</td>
            <td>${producto.codigo}</td>
            <td>${producto.stock}</td>
        </tr>
    `;
});
