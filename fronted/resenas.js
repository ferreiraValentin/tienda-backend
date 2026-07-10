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

const listaPendientes = document.getElementById("listaPendientes");
const listaAprobadas = document.getElementById("listaAprobadas");

function renderizarEstrellas(cantidad) {
  let html = "";
  for (let i = 1; i <= 5; i++) {
    html += `<span class="estrella-fija ${i <= cantidad ? "llena" : ""}">★</span>`;
  }
  return html;
}

function formatearFecha(fechaISO) {
  const fecha = new Date(fechaISO);
  return fecha.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function optimizarImagen(url, ancho = 150) {
  if (!url || !url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${ancho}/`);
}

function crearTarjetaResena(resena) {
  const div = document.createElement("div");
  div.className = "resena-card";

  const tipoLabel =
    resena.tipo === "producto"
      ? `Producto: ${resena.productoNombre || "—"}`
      : "Reseña general de la tienda";

  const fotosHTML =
    resena.fotos && resena.fotos.length > 0
      ? `<div class="testimonio-fotos">${resena.fotos
          .map((foto) => `<img src="${optimizarImagen(foto, 150)}" onclick="window.open('${foto}', '_blank')">`)
          .join("")}</div>`
      : "";

  div.innerHTML = `
    <div class="resena-header">
      <div>
        <strong>${resena.nombreCliente}</strong>
        <span class="resena-fecha">${formatearFecha(resena.creadoEn)}</span>
      </div>
      <span class="resena-estrellas">${renderizarEstrellas(resena.calificacion)}</span>
    </div>
    <p class="resena-tipo">${tipoLabel}</p>
    <p class="resena-comentario">${resena.comentario}</p>
    ${fotosHTML}
    <div class="resena-acciones">
      ${!resena.aprobada ? `<button class="btn-aprobar">Aprobar</button>` : ""}
      <button class="btn-eliminar-resena">Eliminar</button>
    </div>
  `;

  const btnAprobar = div.querySelector(".btn-aprobar");
  if (btnAprobar) {
    btnAprobar.addEventListener("click", () => aprobarResena(resena._id));
  }

  div.querySelector(".btn-eliminar-resena").addEventListener("click", () => eliminarResena(resena._id));

  return div;
}

async function cargarResenas() {
  try {
    const res = await fetch(`${API}/resenas/admin`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      localStorage.removeItem("adminToken");
      window.location.href = "login.html";
      return;
    }

    const resenas = await res.json();

    const pendientes = resenas.filter((r) => !r.aprobada);
    const aprobadas = resenas.filter((r) => r.aprobada);

    listaPendientes.innerHTML = pendientes.length
      ? ""
      : "<p style='color:var(--text-muted)'>No hay reseñas pendientes.</p>";
    pendientes.forEach((r) => listaPendientes.appendChild(crearTarjetaResena(r)));

    listaAprobadas.innerHTML = aprobadas.length
      ? ""
      : "<p style='color:var(--text-muted)'>Todavía no aprobaste ninguna reseña.</p>";
    aprobadas.forEach((r) => listaAprobadas.appendChild(crearTarjetaResena(r)));
  } catch (error) {
    console.error(error);
    listaPendientes.innerHTML = "<p style='color:var(--red-soft)'>Error al cargar las reseñas.</p>";
  }
}

async function aprobarResena(id) {
  try {
    const res = await fetch(`${API}/resenas/${id}/aprobar`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      localStorage.removeItem("adminToken");
      window.location.href = "login.html";
      return;
    }

    const data = await res.json();
    alert(data.mensaje);
    cargarResenas();
  } catch (error) {
    console.error(error);
    alert("Error al aprobar la reseña");
  }
}

async function eliminarResena(id) {
  const confirmar = confirm("¿Eliminar esta reseña definitivamente?");
  if (!confirmar) return;

  try {
    const res = await fetch(`${API}/resenas/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      localStorage.removeItem("adminToken");
      window.location.href = "login.html";
      return;
    }

    const data = await res.json();
    alert(data.mensaje);
    cargarResenas();
  } catch (error) {
    console.error(error);
    alert("Error al eliminar la reseña");
  }
}

cargarResenas();