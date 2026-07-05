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
const metricasDiv = document.getElementById("metricas");
const ventaManualForm = document.getElementById("ventaManualForm");
const productoManualSelect = document.getElementById("productoManual");

function formatearPrecio(numero) {
  return new Intl.NumberFormat("es-AR").format(numero);
}

// ==========================
// Venta manual
// ==========================
async function cargarProductosParaVentaManual() {
  try {
    const res = await fetch(`${API}/productos`);
    const productos = await res.json();

    productoManualSelect.innerHTML = '<option value="">Seleccionar producto...</option>';

    productos.forEach((producto) => {
      const option = document.createElement("option");
      option.value = producto._id;
      option.textContent = `${producto.nombre} — $${formatearPrecio(producto.precio)} (stock: ${producto.stock})`;
      option.disabled = producto.stock <= 0;
      productoManualSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error al cargar productos para venta manual:", error);
  }
}

ventaManualForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const productoId = productoManualSelect.value;
  const cantidad = document.getElementById("cantidadManual").value;
  const nota = document.getElementById("notaManual").value;

  if (!productoId) {
    alert("Elegí un producto");
    return;
  }

  try {
    const res = await fetch(`${API}/pedidos/manual`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ productoId, cantidad, nota }),
    });

    if (res.status === 401) {
      localStorage.removeItem("adminToken");
      window.location.href = "login.html";
      return;
    }

    const data = await res.json();

    if (!res.ok) {
      alert(data.mensaje || "Error al registrar la venta");
      return;
    }

    alert(data.mensaje);
    ventaManualForm.reset();
    cargarProductosParaVentaManual();
    cargarMetricas();
    cargarPedidos();
  } catch (error) {
    console.error(error);
    alert("Error de conexión al registrar la venta");
  }
});

async function cargarMetricas() {
  try {
    const res = await fetch(`${API}/pedidos/metricas`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      localStorage.removeItem("adminToken");
      window.location.href = "login.html";
      return;
    }

    const data = await res.json();

    const cantidadPendientes = data.porEstado.find(e => e.estado === "pendiente")?.cantidad || 0;
    const cantidadConfirmados = data.porEstado.find(e => e.estado === "confirmado")?.cantidad || 0;
    const cantidadCancelados = data.porEstado.find(e => e.estado === "cancelado")?.cantidad || 0;

    const topProductosHTML = data.topProductos.length
      ? data.topProductos
          .map(
            (p, i) =>
              `<li><span>#${i + 1} ${p.nombre}</span><span>${p.unidades} unid. — $${formatearPrecio(p.ingresos)}</span></li>`
          )
          .join("")
      : "<li>Todavía no hay ventas confirmadas.</li>";

    metricasDiv.innerHTML = `
      <div class="metricas-grid">
        <div class="metrica-card">
          <span class="metrica-label">Total vendido</span>
          <span class="metrica-valor">$${formatearPrecio(data.totalVendido)}</span>
        </div>
        <div class="metrica-card">
          <span class="metrica-label">Vendido este mes</span>
          <span class="metrica-valor">$${formatearPrecio(data.totalVendidoMes)}</span>
        </div>
        <div class="metrica-card">
          <span class="metrica-label">Pedidos confirmados</span>
          <span class="metrica-valor">${cantidadConfirmados}</span>
        </div>
        <div class="metrica-card">
          <span class="metrica-label">Pedidos pendientes</span>
          <span class="metrica-valor metrica-pendiente">${cantidadPendientes}</span>
        </div>
        <div class="metrica-card">
          <span class="metrica-label">Pedidos cancelados</span>
          <span class="metrica-valor metrica-cancelado">${cantidadCancelados}</span>
        </div>
      </div>

      <div class="top-productos">
        <h3>🏆 Productos más vendidos</h3>
        <ul>${topProductosHTML}</ul>
      </div>
    `;
  } catch (error) {
    console.error(error);
    metricasDiv.innerHTML = "<p style='color:var(--red-soft)'>Error al cargar las métricas.</p>";
  }
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
          <button class="btn-eliminar-pedido">Eliminar</button>
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

      const btnEliminar = div.querySelector(".btn-eliminar-pedido");
      btnEliminar.addEventListener("click", () => eliminarPedido(pedido._id));

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
    cargarMetricas();
    cargarPedidos();
  } catch (error) {
    console.error(error);
    alert("Error al actualizar el pedido");
  }
}

async function eliminarPedido(id) {
  const confirmar = confirm("¿Eliminar este pedido definitivamente? Esta acción no se puede deshacer.");

  if (!confirmar) return;

  try {
    const res = await fetch(`${API}/pedidos/${id}`, {
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
    cargarMetricas();
    cargarPedidos();
  } catch (error) {
    console.error(error);
    alert("Error al eliminar el pedido");
  }
}

cargarProductosParaVentaManual();
cargarMetricas();
cargarPedidos();