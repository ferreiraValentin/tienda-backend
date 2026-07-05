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

const listaPedidos = document.getElementById("listaPedidos");

function formatearPrecio(numero) {
  return new Intl.NumberFormat("es-AR").format(numero);
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

async function cargarPedidos() {
  try {
    const res = await fetch(`${API}/pedidos`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      localStorage.removeItem("adminToken");
      window.location.href = "login.html";
      return;
    }

    const pedidos = await res.json();

    if (pedidos.length === 0) {
      listaPedidos.innerHTML = "<p style='color:var(--text-muted)'>Todavía no hay pedidos registrados.</p>";
      return;
    }

    listaPedidos.innerHTML = "";

    pedidos.forEach((pedido) => {
      const div = document.createElement("div");
      div.className = "pedido-card";

      const itemsHTML = pedido.items
        .map(
          (item) =>
            `<li>${item.nombre} x${item.cantidad} — $${formatearPrecio(item.precio * item.cantidad)}</li>`
        )
        .join("");

      div.innerHTML = `
        <div class="pedido-header">
          <div>
            <strong>${pedido.cliente.nombre}</strong>
            <span class="pedido-fecha">${formatearFecha(pedido.creadoEn)}</span>
          </div>
          <span class="estado-badge estado-${pedido.estado}">${pedido.estado}</span>
        </div>

        <p class="pedido-envio">
          📍 ${pedido.cliente.ciudad}, ${pedido.cliente.provincia} (CP ${pedido.cliente.codigoPostal})
        </p>

        <ul class="pedido-items">${itemsHTML}</ul>

        <p class="pedido-total">Total: $${formatearPrecio(pedido.total)}</p>

        <div class="pedido-acciones">
          ${
            pedido.estado !== "confirmado"
              ? `<button class="btn-confirmar">Marcar como confirmado</button>`
              : ""
          }
          ${
            pedido.estado !== "cancelado"
              ? `<button class="btn-cancelar-pedido">Cancelar pedido</button>`
              : ""
          }
        </div>
      `;

      const btnConfirmar = div.querySelector(".btn-confirmar");
      if (btnConfirmar) {
        btnConfirmar.addEventListener("click", () => cambiarEstado(pedido._id, "confirmado"));
      }

      const btnCancelar = div.querySelector(".btn-cancelar-pedido");
      if (btnCancelar) {
        btnCancelar.addEventListener("click", () => cambiarEstado(pedido._id, "cancelado"));
      }

      listaPedidos.appendChild(div);
    });
  } catch (error) {
    console.error(error);
    listaPedidos.innerHTML = "<p style='color:var(--red-soft)'>Error al cargar los pedidos.</p>";
  }
}

async function cambiarEstado(id, estado) {
  const confirmar = confirm(
    estado === "confirmado"
      ? "¿Confirmar este pedido?"
      : "¿Cancelar este pedido?"
  );

  if (!confirmar) return;

  try {
    const res = await fetch(`${API}/pedidos/${id}/estado`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ estado }),
    });

    if (res.status === 401) {
      localStorage.removeItem("adminToken");
      window.location.href = "login.html";
      return;
    }

    const data = await res.json();
    alert(data.mensaje);
    cargarPedidos();
  } catch (error) {
    console.error(error);
    alert("Error al actualizar el pedido");
  }
}

cargarPedidos();