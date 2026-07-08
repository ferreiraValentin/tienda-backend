const API = "https://tienda-api-5ulq.onrender.com";

// ==========================
// Protección de acceso: si no hay token, redirige al login
// ==========================
const token = localStorage.getItem("adminToken");

if (!token) {
  window.location.href = "login.html";
}

document.getElementById("botonLogout").addEventListener("click", () => {
  localStorage.removeItem("adminToken");
  window.location.href = "login.html";
});

const productoForm = document.getElementById("productoForm");
const listaProductos = document.getElementById("listaProductos");
const formTitulo = document.getElementById("formTitulo");
const botonSubmit = document.getElementById("botonSubmit");
const botonCancelar = document.getElementById("botonCancelar");
const productoIdInput = document.getElementById("productoId");
const imagenInput = document.getElementById("imagenInput");
const imagenActualDiv = document.getElementById("imagenActual");
const previewImagen = document.getElementById("previewImagen");
const adicionalesActualesDiv = document.getElementById("adicionalesActuales");

let modoEdicion = false;

// ==========================
// Optimización de imágenes con Cloudinary (thumbnails livianos)
// ==========================
function optimizarImagen(url, ancho = 200) {
  if (!url || !url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${ancho}/`);
}

function formatearPrecio(numero) {
  return new Intl.NumberFormat("es-AR").format(numero);
}

// ==========================
// Crear o actualizar producto
// ==========================
productoForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const formData = new FormData(productoForm);
  const id = productoIdInput.value;

  try {
    let res;

    if (modoEdicion && id) {
      // Actualizar producto existente
      res = await fetch(`${API}/productos/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
    } else {
      // Crear producto nuevo
      if (!imagenInput.files[0]) {
        alert("Tenés que seleccionar una imagen");
        return;
      }
      res = await fetch(`${API}/productos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
    }

    if (res.status === 401) {
      alert("Tu sesión expiró, iniciá sesión de nuevo");
      localStorage.removeItem("adminToken");
      window.location.href = "login.html";
      return;
    }

    const data = await res.json();

    if (!res.ok) {
      alert(data.mensaje || "Ocurrió un error");
      return;
    }

    alert(data.mensaje);
    cancelarEdicion();
    cargarProductos();
  } catch (error) {
    console.error(error);
    alert("Error de conexión con el servidor");
  }
});

// ==========================
// Cargar datos de un producto en el formulario para editar
// ==========================
function editarProducto(producto) {
  modoEdicion = true;

  productoIdInput.value = producto._id;
  document.getElementById("nombre").value = producto.nombre;
  document.getElementById("precio").value = producto.precio;
  document.getElementById("stock").value = producto.stock;
  document.getElementById("categoria").value = producto.categoria;
  document.getElementById("destacado").checked = producto.destacado;
  document.getElementById("descripcion").value = producto.descripcion || "";

  // Ya no es obligatorio subir una imagen nueva al editar
  imagenInput.removeAttribute("required");
  imagenActualDiv.style.display = "block";
  previewImagen.src = optimizarImagen(producto.imagen, 200);

  if (producto.imagenesAdicionales && producto.imagenesAdicionales.length > 0) {
    const miniaturas = producto.imagenesAdicionales
      .map((url) => `<img src="${optimizarImagen(url, 100)}" width="60">`)
      .join(" ");
    adicionalesActualesDiv.innerHTML = `
      <p>Imágenes adicionales actuales:</p>
      <div class="miniaturas-adicionales">${miniaturas}</div>
      <p class="nota-imagen">Si subís nuevas, reemplazan a todas estas.</p>
    `;
    adicionalesActualesDiv.style.display = "block";
  } else {
    adicionalesActualesDiv.innerHTML = "";
    adicionalesActualesDiv.style.display = "none";
  }

  formTitulo.textContent = "Editar producto";
  botonSubmit.textContent = "Actualizar producto";
  botonCancelar.style.display = "inline-block";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ==========================
// Cancelar edición y volver al modo "Crear"
// ==========================
function cancelarEdicion() {
  modoEdicion = false;
  productoForm.reset();
  productoIdInput.value = "";
  imagenInput.setAttribute("required", "true");
  imagenActualDiv.style.display = "none";
  adicionalesActualesDiv.innerHTML = "";
  adicionalesActualesDiv.style.display = "none";
  formTitulo.textContent = "Crear producto";
  botonSubmit.textContent = "Crear producto";
  botonCancelar.style.display = "none";
}

botonCancelar.addEventListener("click", cancelarEdicion);

// ==========================
// Cargar y listar productos
// ==========================
async function cargarProductos() {
  const res = await fetch(`${API}/productos`);
  const productos = await res.json();

  listaProductos.innerHTML = "";

  productos.forEach((producto) => {
    const div = document.createElement("div");
    div.className = "producto-admin";

    div.innerHTML = `
      <img src="${optimizarImagen(producto.imagen, 200)}" width="90" loading="lazy">
      <div class="producto-admin-info">
        <h3>${producto.nombre}</h3>
        <p>$${formatearPrecio(producto.precio)} — Stock: ${producto.stock}</p>
        <p class="producto-admin-cat">${producto.categoria} ${producto.destacado ? "⭐" : ""}</p>
        ${
          producto.imagenesAdicionales && producto.imagenesAdicionales.length > 0
            ? `<p class="producto-admin-galeria">🖼️ +${producto.imagenesAdicionales.length} imágenes</p>`
            : ""
        }
      </div>
      <div class="producto-admin-acciones">
        <button class="btn-editar">Editar</button>
        <button class="btn-eliminar">Eliminar</button>
      </div>
    `;

    div.querySelector(".btn-editar").addEventListener("click", () => editarProducto(producto));
    div.querySelector(".btn-eliminar").addEventListener("click", () => eliminarProducto(producto._id));

    listaProductos.appendChild(div);
  });
}

// ==========================
// Eliminar producto
// ==========================
async function eliminarProducto(id) {
  const confirmar = confirm("¿Seguro que querés eliminar este producto?");

  if (!confirmar) return;

  const res = await fetch(`${API}/productos/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    alert("Tu sesión expiró, iniciá sesión de nuevo");
    localStorage.removeItem("adminToken");
    window.location.href = "login.html";
    return;
  }

  const data = await res.json();

  alert(data.mensaje);
  cargarProductos();
}

cargarProductos();