const API_URL = "https://tienda-api-5ulq.onrender.com";

const contenedor = document.getElementById("productos");
const carritoHTML = document.getElementById("carrito");
const totalHTML = document.getElementById("total");
const buscador = document.getElementById("buscador");

let productosGlobal = [];
let carrito = JSON.parse(localStorage.getItem("carrito")) || [];
let categoriaActual = "Todos";

cargarProductos();
mostrarCarrito();

function renderizarProductos(productos) {
  contenedor.innerHTML = "";

  productos.forEach(prod => {
    const div = document.createElement("div");
    div.classList.add("producto");

    const stock = prod.stock ?? 0;

    div.innerHTML = `
      <div class="imagen-producto">
        ${prod.categoria === "Ofertas" ? '<span class="oferta-tag">🔥 OFERTA</span>' : ''}
        <img src="${prod.imagen}" alt="${prod.nombre}">
      </div>

      <span class="categoria-tag">
        ${prod.categoria || "Sin categoría"}
      </span>

      <h3>${prod.nombre}</h3>

      <p class="stock">
        ${stock > 0 ? `📦 Stock: ${stock}` : "❌ Sin stock"}
      </p>

      <p>$${prod.precio}</p>

      ${
        stock > 0
          ? `<button onclick="agregarCarrito(${prod.id})">Agregar</button>`
          : `<button disabled>Agotado</button>`
      }
    `;

    contenedor.appendChild(div);
  });
}

function aplicarFiltros() {
  const texto = buscador ? buscador.value.toLowerCase() : "";

  let productosFiltrados = productosGlobal.filter(prod =>
    prod.nombre.toLowerCase().includes(texto)
  );

  if (categoriaActual !== "Todos") {
    productosFiltrados = productosFiltrados.filter(prod =>
      prod.categoria === categoriaActual
    );
  }

  renderizarProductos(productosFiltrados);
}

function cargarProductos() {
  fetch(`${API_URL}/productos`)
    .then(res => res.json())
    .then(productos => {
      productosGlobal = productos;
      aplicarFiltros();
    })
    .catch(error => {
      console.error("Error cargando productos:", error);
    });
}

if (buscador) {
  buscador.addEventListener("input", aplicarFiltros);
}

function filtrarCategoria(categoria) {
  categoriaActual = categoria;
  aplicarFiltros();
}

function agregarCarrito(id) {
  const producto = productosGlobal.find(p => p.id === id);

  if (!producto) return;

  if ((producto.stock ?? 0) <= 0) {
    alert("Este producto está sin stock");
    return;
  }

  const productoEnCarrito = carrito.find(p => p.id === id);

  if (productoEnCarrito) {
    if (productoEnCarrito.cantidad >= producto.stock) {
      alert("No hay más stock disponible");
      return;
    }

    productoEnCarrito.cantidad++;
  } else {
    carrito.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      cantidad: 1
    });
  }

  guardarCarrito();
  mostrarCarrito();
}

function guardarCarrito() {
  localStorage.setItem("carrito", JSON.stringify(carrito));
}

function mostrarCarrito() {
  carritoHTML.innerHTML = "";

  let total = 0;

  carrito.forEach((prod, index) => {
    const subtotal = prod.precio * prod.cantidad;

    const li = document.createElement("li");

    li.innerHTML = `
      ${prod.nombre} - $${prod.precio}
      x ${prod.cantidad} = $${subtotal}
      <button onclick="sumarCantidad(${index})">+</button>
      <button onclick="restarCantidad(${index})">-</button>
      <button onclick="eliminarProducto(${index})">❌</button>
    `;

    carritoHTML.appendChild(li);
    total += subtotal;
  });

  totalHTML.textContent = total;
}

function sumarCantidad(index) {
  const item = carrito[index];
  const producto = productosGlobal.find(p => p.id === item.id);

  if (producto && item.cantidad >= producto.stock) {
    alert("No hay más stock disponible");
    return;
  }

  carrito[index].cantidad++;
  guardarCarrito();
  mostrarCarrito();
}

function restarCantidad(index) {
  carrito[index].cantidad--;

  if (carrito[index].cantidad <= 0) {
    carrito.splice(index, 1);
  }

  guardarCarrito();
  mostrarCarrito();
}

function eliminarProducto(index) {
  carrito.splice(index, 1);
  guardarCarrito();
  mostrarCarrito();
}

function vaciarCarrito() {
  carrito = [];
  guardarCarrito();
  mostrarCarrito();
}

function comprarWhatsApp() {
  if (carrito.length === 0) {
    alert("El carrito está vacío");
    return;
  }

  let mensaje = "Hola, quiero comprar:\n\n";

  carrito.forEach(prod => {
    mensaje += `- ${prod.nombre} x${prod.cantidad} = $${prod.precio * prod.cantidad}\n`;
  });

  const total = carrito.reduce((acc, p) => acc + p.precio * p.cantidad, 0);

  mensaje += `\nTotal: $${total}`;

  const numero = "5491156461555";
  const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;

  window.open(url, "_blank");
}