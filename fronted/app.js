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

// ==========================
// Formateo de precios ($15.000 en vez de $15000)
// ==========================
function formatearPrecio(numero) {
  return new Intl.NumberFormat("es-AR").format(numero);
}

// ==========================
// Optimización de imágenes con Cloudinary
// ==========================
// Inserta transformaciones en la URL de Cloudinary para servir la imagen
// en el formato más liviano posible (f_auto), con compresión inteligente
// (q_auto) y limitando el ancho máximo (w_...), sin tener que subir de
// nuevo ninguna imagen.
function optimizarImagen(url, ancho = 400) {
  if (!url || !url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${ancho}/`);
}

function renderizarProductos(productos) {
  contenedor.innerHTML = "";

  productos.forEach(prod => {
    const div = document.createElement("div");
    div.classList.add("producto");

    const stock = prod.stock ?? 0;
    const imagenOptimizada = optimizarImagen(prod.imagen, 400);

    div.innerHTML = `
      <div class="imagen-producto">

  ${prod.destacado
    ? '<span class="destacado-tag">⭐ DESTACADO</span>'
    : ''
  }

  ${prod.categoria === "Ofertas"
    ? '<span class="oferta-tag">🔥 OFERTA</span>'
    : ''
  }

  <img src="${imagenOptimizada}" alt="${prod.nombre}" loading="lazy">
</div>

      <span class="categoria-tag">
        ${prod.categoria || "Sin categoría"}
      </span>

      <h3>${prod.nombre}</h3>

      <p class="stock">
        ${stock > 0 ? `📦 Stock: ${stock}` : "❌ Sin stock"}
      </p>

      <p>$${formatearPrecio(prod.precio)}</p>

      ${
        stock > 0
          ? `<button onclick="agregarCarrito('${prod._id}')">Agregar</button>`
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

function filtrarCategoria(categoria, boton) {
  categoriaActual = categoria;

  document.querySelectorAll(".categorias button").forEach(btn => {
    btn.classList.remove("activa");
  });

  if (boton) {
    boton.classList.add("activa");
  }

  aplicarFiltros();
}

function agregarCarrito(id) {
  const producto = productosGlobal.find(p => p._id === id);

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
      id: producto._id,
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
      ${prod.nombre} - $${formatearPrecio(prod.precio)}
      x ${prod.cantidad} = $${formatearPrecio(subtotal)}
      <button onclick="sumarCantidad(${index})">+</button>
      <button onclick="restarCantidad(${index})">-</button>
      <button onclick="eliminarProducto(${index})">❌</button>
    `;

    carritoHTML.appendChild(li);
    total += subtotal;
  });

  totalHTML.textContent = formatearPrecio(total);
}

function sumarCantidad(index) {
  const item = carrito[index];
  const producto = productosGlobal.find(p => p._id === item.id);

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

  const nombre = document.getElementById("nombreCliente").value;
  const ciudad = document.getElementById("ciudadCliente").value;
  const provincia = document.getElementById("provinciaCliente").value;
  const cp = document.getElementById("cpCliente").value;

  if (!nombre || !ciudad || !provincia || !cp) {
    alert("Completá los datos de envío");
    return;
  }

  const total = carrito.reduce(
    (acc, p) => acc + p.precio * p.cantidad,
    0
  );

  // Guardamos el pedido en el historial (no bloquea la compra si falla)
  fetch(`${API_URL}/pedidos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cliente: { nombre, ciudad, provincia, codigoPostal: cp },
      items: carrito.map(p => ({
        productoId: p.id,
        nombre: p.nombre,
        precio: p.precio,
        cantidad: p.cantidad,
      })),
      total,
    }),
  }).catch(error => {
    console.error("No se pudo registrar el pedido en el historial:", error);
  });

  let mensaje = "Hola, quiero comprar:\n\n";

  carrito.forEach(prod => {
    mensaje += `- ${prod.nombre} x${prod.cantidad} = $${formatearPrecio(prod.precio * prod.cantidad)}\n`;
  });

  mensaje += `

DATOS DE ENVÍO

Nombre: ${nombre}
Ciudad: ${ciudad}
Provincia: ${provincia}
Código Postal: ${cp}

Total: $${formatearPrecio(total)}
`;

  const numero = "5491156461555";
  const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;

  window.open(url, "_blank");
}