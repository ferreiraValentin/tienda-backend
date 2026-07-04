const API = "https://tienda-api-5ulq.onrender.com";

const productoForm = document.getElementById("productoForm");
const listaProductos = document.getElementById("listaProductos");

productoForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const formData = new FormData(productoForm);

  const res = await fetch(`${API}/productos`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();

  alert(data.mensaje);
  productoForm.reset();
  cargarProductos();
});

async function cargarProductos() {
  const res = await fetch(`${API}/productos`);
  const productos = await res.json();

  listaProductos.innerHTML = "";

  productos.forEach((producto) => {
    listaProductos.innerHTML += `
      <div style="border:1px solid #ddd; padding:15px; margin:15px 0; border-radius:10px;">
        <h3>${producto.nombre}</h3>
        <p>$${producto.precio}</p>
        <img src="${producto.imagen}" width="120">
        <br><br>
        <button onclick="eliminarProducto('${producto._id}')">
          Eliminar
        </button>
      </div>
    `;
  });
}

async function eliminarProducto(id) {
  const confirmar = confirm("¿Seguro que querés eliminar este producto?");

  if (!confirmar) return;

  const res = await fetch(`${API}/productos/${id}`, {
    method: "DELETE",
  });

  const data = await res.json();

  alert(data.mensaje);
  cargarProductos();
}

cargarProductos();