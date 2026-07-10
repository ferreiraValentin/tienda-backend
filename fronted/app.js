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
      <div class="imagen-producto" onclick="abrirModalProducto('${prod._id}')">

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

      <h3 class="producto-nombre-clickeable" onclick="abrirModalProducto('${prod._id}')">${prod.nombre}</h3>

      <p class="stock">
        ${stock > 0 ? `📦 Stock: ${stock}` : "❌ Sin stock"}
      </p>

      ${
        stock > 0 && stock <= 3
          ? `<p class="pocas-unidades">⚡ ¡Últimas ${stock} unidades!</p>`
          : ""
      }

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

// ==========================
// Modal de detalle de producto (galería + descripción)
// ==========================
const modalOverlay = document.getElementById("modalProducto");
const modalImagenPrincipal = document.getElementById("modalImagenPrincipal");
const modalDots = document.getElementById("modalDots");
const modalCategoria = document.getElementById("modalCategoria");
const modalNombre = document.getElementById("modalNombre");
const modalDescripcion = document.getElementById("modalDescripcion");
const modalStock = document.getElementById("modalStock");
const modalPrecio = document.getElementById("modalPrecio");
const modalBotonAgregar = document.getElementById("modalBotonAgregar");

let productoModalActual = null;
let imagenModalIndex = 0;

function obtenerGaleria(producto) {
  const galeria = [producto.imagen, ...(producto.imagenesAdicionales || [])];
  return galeria.filter(Boolean);
}

function abrirModalProducto(id) {
  const producto = productosGlobal.find(p => p._id === id);
  if (!producto) return;

  productoModalActual = producto;
  imagenModalIndex = 0;
  renderizarModal();

  // Reseteamos el formulario de reseña de producto cada vez que se abre un producto distinto
  const formResenaProducto = document.getElementById("formResenaProducto");
  formResenaProducto.reset();
  formResenaProducto.classList.add("oculto");
  document.getElementById("estrellasResenaProducto").dataset.valor = 0;
  document.querySelectorAll("#estrellasResenaProducto span").forEach((e) => e.classList.remove("seleccionada"));

  cargarResenasProducto(id);

  modalOverlay.classList.remove("oculto");
}

function cerrarModalProducto() {
  modalOverlay.classList.add("oculto");
  productoModalActual = null;
}

function cambiarImagenModal(delta) {
  if (!productoModalActual) return;

  const galeria = obtenerGaleria(productoModalActual);
  imagenModalIndex = (imagenModalIndex + delta + galeria.length) % galeria.length;
  renderizarModal();
}

function renderizarModal() {
  if (!productoModalActual) return;

  const producto = productoModalActual;
  const galeria = obtenerGaleria(producto);
  const stock = producto.stock ?? 0;

  modalImagenPrincipal.src = optimizarImagen(galeria[imagenModalIndex], 700);
  modalImagenPrincipal.alt = producto.nombre;

  // Puntitos de navegación (solo si hay más de una imagen)
  if (galeria.length > 1) {
    modalDots.innerHTML = galeria
      .map((_, i) => `<span class="modal-dot ${i === imagenModalIndex ? "activo" : ""}" onclick="irAImagenModal(${i})"></span>`)
      .join("");
    modalDots.style.display = "flex";
  } else {
    modalDots.innerHTML = "";
    modalDots.style.display = "none";
  }

  document.querySelectorAll(".galeria-flecha").forEach(btn => {
    btn.style.display = galeria.length > 1 ? "flex" : "none";
  });

  modalCategoria.textContent = producto.categoria || "Sin categoría";
  modalNombre.textContent = producto.nombre;
  modalDescripcion.textContent = producto.descripcion && producto.descripcion.trim()
    ? producto.descripcion
    : "Este producto todavía no tiene descripción cargada.";
  modalStock.innerHTML = stock > 0 ? `📦 Stock: ${stock}` : "❌ Sin stock";
  modalPrecio.textContent = `$${formatearPrecio(producto.precio)}`;

  if (stock > 0) {
    modalBotonAgregar.textContent = "Agregar al carrito";
    modalBotonAgregar.disabled = false;
    modalBotonAgregar.onclick = () => {
      agregarCarrito(producto._id);
      modalBotonAgregar.textContent = "¡Agregado! ✓";
      setTimeout(() => {
        if (modalBotonAgregar) modalBotonAgregar.textContent = "Agregar al carrito";
      }, 1200);
    };
  } else {
    modalBotonAgregar.textContent = "Agotado";
    modalBotonAgregar.disabled = true;
    modalBotonAgregar.onclick = null;
  }
}

function irAImagenModal(index) {
  imagenModalIndex = index;
  renderizarModal();
}

// Cerrar el modal con la tecla Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") cerrarModalProducto();
});

// ==========================
// Reseñas — helpers compartidos
// ==========================

function renderizarEstrellas(promedio) {
  const llenas = Math.round(promedio);
  let html = "";
  for (let i = 1; i <= 5; i++) {
    html += `<span class="estrella-fija ${i <= llenas ? "llena" : ""}">★</span>`;
  }
  return html;
}

function renderizarResumen(contenedor, resenas) {
  if (resenas.length === 0) {
    contenedor.innerHTML = "";
    return;
  }
  const promedio = resenas.reduce((acc, r) => acc + r.calificacion, 0) / resenas.length;
  contenedor.innerHTML = `
    <div class="estrellas-resumen">${renderizarEstrellas(promedio)}</div>
    <span class="promedio-numero">${promedio.toFixed(1)} / 5</span>
    <span class="cantidad-resenas">(${resenas.length} reseña${resenas.length === 1 ? "" : "s"})</span>
  `;
}

function renderizarListaTestimonios(contenedor, resenas, vacio) {
  if (resenas.length === 0) {
    contenedor.innerHTML = `<p class="sin-resenas">${vacio}</p>`;
    return;
  }

  contenedor.innerHTML = resenas
    .map(
      (r) => `
      <div class="testimonio">
        <div class="testimonio-header">
          <strong>${r.nombreCliente}</strong>
          <span class="testimonio-estrellas">${renderizarEstrellas(r.calificacion)}</span>
        </div>
        <p>${r.comentario}</p>
        ${
          r.fotos && r.fotos.length > 0
            ? `<div class="testimonio-fotos">${r.fotos
                .map(
                  (foto) =>
                    `<img src="${optimizarImagen(foto, 200)}" onclick="abrirFotoCompleta('${foto}')" loading="lazy">`
                )
                .join("")}</div>`
            : ""
        }
      </div>
    `
    )
    .join("");
}

function abrirFotoCompleta(url) {
  window.open(url, "_blank");
}

function configurarSelectorEstrellas(contenedorId) {
  const contenedor = document.getElementById(contenedorId);
  const estrellas = contenedor.querySelectorAll("span");

  estrellas.forEach((estrella) => {
    estrella.addEventListener("click", () => {
      const valor = Number(estrella.dataset.valor);
      contenedor.dataset.valor = valor;
      estrellas.forEach((e) => {
        e.classList.toggle("seleccionada", Number(e.dataset.valor) <= valor);
      });
    });
  });
}

configurarSelectorEstrellas("estrellasResenaTienda");
configurarSelectorEstrellas("estrellasResenaProducto");

// ==========================
// Reseñas de la tienda (generales)
// ==========================

const botonMostrarFormResena = document.getElementById("botonMostrarFormResena");
const formResenaTienda = document.getElementById("formResenaTienda");

botonMostrarFormResena.addEventListener("click", () => {
  formResenaTienda.classList.toggle("oculto");
});

async function cargarTestimoniosTienda() {
  try {
    const res = await fetch(`${API_URL}/resenas?tipo=tienda`);
    const resenas = await res.json();

    renderizarResumen(document.getElementById("resumenCalificacion"), resenas);
    renderizarListaTestimonios(
      document.getElementById("listaTestimonios"),
      resenas,
      "Todavía no hay reseñas. ¡Sé el primero en dejar la tuya!"
    );
  } catch (error) {
    console.error("Error al cargar testimonios:", error);
  }
}

formResenaTienda.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nombreCliente = document.getElementById("nombreResenaTienda").value;
  const comentario = document.getElementById("comentarioResenaTienda").value;
  const calificacion = document.getElementById("estrellasResenaTienda").dataset.valor;
  const fotos = document.getElementById("fotosResenaTienda").files;

  if (Number(calificacion) < 1) {
    alert("Elegí una calificación en estrellas");
    return;
  }

  if (fotos.length > 3) {
    alert("Podés subir como máximo 3 fotos");
    return;
  }

  const formData = new FormData();
  formData.append("tipo", "tienda");
  formData.append("nombreCliente", nombreCliente);
  formData.append("calificacion", calificacion);
  formData.append("comentario", comentario);
  for (const foto of fotos) {
    formData.append("fotos", foto);
  }

  try {
    const res = await fetch(`${API_URL}/resenas`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    alert(data.mensaje);

    if (res.ok) {
      formResenaTienda.reset();
      document.getElementById("estrellasResenaTienda").dataset.valor = 0;
      document.querySelectorAll("#estrellasResenaTienda span").forEach((e) => e.classList.remove("seleccionada"));
      formResenaTienda.classList.add("oculto");
    }
  } catch (error) {
    console.error(error);
    alert("Error de conexión al enviar la reseña");
  }
});

cargarTestimoniosTienda();

// ==========================
// Reseñas por producto (dentro del modal)
// ==========================

const botonMostrarFormResenaProducto = document.getElementById("botonMostrarFormResenaProducto");
const formResenaProducto = document.getElementById("formResenaProducto");

botonMostrarFormResenaProducto.addEventListener("click", () => {
  formResenaProducto.classList.toggle("oculto");
});

async function cargarResenasProducto(productoId) {
  try {
    const res = await fetch(`${API_URL}/resenas?tipo=producto&productoId=${productoId}`);
    const resenas = await res.json();

    renderizarResumen(document.getElementById("resumenCalificacionProducto"), resenas);
    renderizarListaTestimonios(
      document.getElementById("listaResenasProducto"),
      resenas,
      "Todavía no hay reseñas para este producto."
    );
  } catch (error) {
    console.error("Error al cargar reseñas del producto:", error);
  }
}

formResenaProducto.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!productoModalActual) return;

  const nombreCliente = document.getElementById("nombreResenaProducto").value;
  const comentario = document.getElementById("comentarioResenaProducto").value;
  const calificacion = document.getElementById("estrellasResenaProducto").dataset.valor;
  const fotos = document.getElementById("fotosResenaProducto").files;

  if (Number(calificacion) < 1) {
    alert("Elegí una calificación en estrellas");
    return;
  }

  if (fotos.length > 3) {
    alert("Podés subir como máximo 3 fotos");
    return;
  }

  const formData = new FormData();
  formData.append("tipo", "producto");
  formData.append("productoId", productoModalActual._id);
  formData.append("productoNombre", productoModalActual.nombre);
  formData.append("nombreCliente", nombreCliente);
  formData.append("calificacion", calificacion);
  formData.append("comentario", comentario);
  for (const foto of fotos) {
    formData.append("fotos", foto);
  }

  try {
    const res = await fetch(`${API_URL}/resenas`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    alert(data.mensaje);

    if (res.ok) {
      formResenaProducto.reset();
      document.getElementById("estrellasResenaProducto").dataset.valor = 0;
      document.querySelectorAll("#estrellasResenaProducto span").forEach((e) => e.classList.remove("seleccionada"));
      formResenaProducto.classList.add("oculto");
    }
  } catch (error) {
    console.error(error);
    alert("Error de conexión al enviar la reseña");
  }
});