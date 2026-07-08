require("dotenv").config();

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const mongoose = require("mongoose");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");

const app = express();

// Necesario porque Render (y la mayoría de los hosting en la nube) ponen
// la app detrás de un proxy. Sin esto, express-rate-limit no puede
// identificar correctamente la IP de cada request.
app.set("trust proxy", 1);

// ==========================
// CORS restringido: solo estos orígenes pueden llamar a la API
// ==========================
const origenesPermitidos = [
  "https://tiendapremium.vercel.app",
  "http://127.0.0.1:5500", // Live Server, para pruebas locales
  "http://localhost:5500",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Sin "origin" (ej: Postman, apps móviles, curl) lo dejamos pasar
      if (!origin || origenesPermitidos.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("No permitido por CORS"));
    },
  })
);
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ==========================
// Conexión a MongoDB
// ==========================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch((err) => console.error("❌ Error al conectar a MongoDB:", err));

// ==========================
// Modelo de Producto
// ==========================
const CATEGORIAS_VALIDAS = [
  "Audio",
  "Cargadores",
  "Cables",
  "Accesorios",
  "Ofertas",
  "Hogar",
];

const productoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100,
  },
  precio: {
    type: Number,
    required: true,
    min: [0.01, "El precio tiene que ser mayor a 0"],
  },
  stock: {
    type: Number,
    required: true,
    min: [0, "El stock no puede ser negativo"],
  },
  categoria: {
    type: String,
    required: true,
    enum: {
      values: CATEGORIAS_VALIDAS,
      message: "Categoría inválida",
    },
  },
  destacado: { type: Boolean, default: false },
  imagen: { type: String, required: true },
  imagenesAdicionales: { type: [String], default: [] },
  descripcion: { type: String, default: "", maxlength: 1000 },
  creadoEn: { type: Date, default: Date.now },
});

const Producto = mongoose.model("Producto", productoSchema);

// ==========================
// Modelo de Pedido
// ==========================
const pedidoSchema = new mongoose.Schema({
  cliente: {
    nombre: { type: String, required: true },
    ciudad: { type: String, default: "-" },
    provincia: { type: String, default: "-" },
    codigoPostal: { type: String, default: "-" },
  },
  items: [
    {
      productoId: { type: String },
      nombre: { type: String, required: true },
      precio: { type: Number, required: true },
      cantidad: { type: Number, required: true },
    },
  ],
  total: { type: Number, required: true },
  estado: {
    type: String,
    enum: ["pendiente", "confirmado", "cancelado"],
    default: "pendiente",
  },
  creadoEn: { type: Date, default: Date.now },
});

const Pedido = mongoose.model("Pedido", pedidoSchema);

// Descuenta del stock las cantidades de cada item (usado al confirmar un pedido)
async function descontarStock(items) {
  for (const item of items) {
    if (!item.productoId) continue;
    const producto = await Producto.findById(item.productoId);
    if (producto) {
      producto.stock = Math.max(0, producto.stock - item.cantidad);
      await producto.save();
    }
  }
}

// Devuelve al stock las cantidades de cada item (usado al revertir/borrar un pedido confirmado)
async function restaurarStock(items) {
  for (const item of items) {
    if (!item.productoId) continue;
    const producto = await Producto.findById(item.productoId);
    if (producto) {
      producto.stock = producto.stock + item.cantidad;
      await producto.save();
    }
  }
}

// Valida los datos del body antes de crear/editar un producto.
// Devuelve un array de errores (vacío si todo está bien).
function validarDatosProducto(body) {
  const errores = [];

  const nombre = (body.nombre || "").trim();
  if (nombre.length < 2 || nombre.length > 100) {
    errores.push("El nombre debe tener entre 2 y 100 caracteres");
  }

  const precio = Number(body.precio);
  if (Number.isNaN(precio) || precio <= 0) {
    errores.push("El precio debe ser un número mayor a 0");
  }

  const stock = Number(body.stock);
  if (Number.isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
    errores.push("El stock debe ser un número entero, no negativo");
  }

  if (!CATEGORIAS_VALIDAS.includes(body.categoria)) {
    errores.push("La categoría seleccionada no es válida");
  }

  return errores;
}

// ==========================
// Configuración de Cloudinary
// ==========================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "tienda-productos", // carpeta donde se guardan las imágenes en Cloudinary
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

const upload = multer({ storage });

// Config para recibir la imagen principal + hasta 4 imágenes adicionales
const uploadProducto = upload.fields([
  { name: "imagen", maxCount: 1 },
  { name: "imagenesAdicionales", maxCount: 4 },
]);

// ==========================
// Límites de intentos (protección contra fuerza bruta / spam)
// ==========================

// Login: máximo 5 intentos cada 15 minutos por IP
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { mensaje: "Demasiados intentos de inicio de sesión. Probá de nuevo en unos minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Pedidos: máximo 20 pedidos cada 15 minutos por IP (evita spam sin molestar clientes reales)
const limitePedidos = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { mensaje: "Demasiadas solicitudes. Probá de nuevo en unos minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ==========================
// Autenticación
// ==========================

// Middleware que protege rutas: exige un token válido
function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ mensaje: "No autorizado, falta el token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ mensaje: "Token inválido o expirado" });
  }
}

// Login: valida usuario y contraseña, devuelve un token
app.post("/login", limiteLogin, async (req, res) => {
  try {
    const { usuario, password } = req.body;

    if (usuario !== process.env.ADMIN_USER) {
      return res.status(401).json({ mensaje: "Usuario o contraseña incorrectos" });
    }

    const passwordCorrecta = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);

    if (!passwordCorrecta) {
      return res.status(401).json({ mensaje: "Usuario o contraseña incorrectos" });
    }

    const token = jwt.sign({ usuario }, process.env.JWT_SECRET, { expiresIn: "8h" });

    res.json({ mensaje: "Login correcto ✅", token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al iniciar sesión" });
  }
});

// ==========================
// Rutas
// ==========================
app.get("/", (req, res) => {
  res.send("Servidor funcionando ✅");
});

// Obtener todos los productos
app.get("/productos", async (req, res) => {
  try {
    const productos = await Producto.find().sort({ creadoEn: -1 });
    res.json(productos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al obtener productos" });
  }
});

// Crear un producto nuevo
app.post("/productos", verificarToken, uploadProducto, async (req, res) => {
  try {
    const archivoPrincipal = req.files?.imagen?.[0];
    const archivosAdicionales = req.files?.imagenesAdicionales || [];

    if (!archivoPrincipal) {
      return res.status(400).json({ mensaje: "No se subió ninguna imagen principal" });
    }

    const errores = validarDatosProducto(req.body);
    if (errores.length > 0) {
      // Si ya se subieron imágenes a Cloudinary pero los datos son inválidos,
      // las borramos para no dejar imágenes huérfanas.
      await cloudinary.uploader.destroy(archivoPrincipal.filename);
      for (const archivo of archivosAdicionales) {
        await cloudinary.uploader.destroy(archivo.filename);
      }
      return res.status(400).json({ mensaje: errores.join(". ") });
    }

    const nuevoProducto = new Producto({
      nombre: req.body.nombre,
      precio: Number(req.body.precio),
      stock: Number(req.body.stock),
      categoria: req.body.categoria,
      destacado: req.body.destacado === "on",
      imagen: archivoPrincipal.path, // Cloudinary devuelve la URL directa acá
      imagenesAdicionales: archivosAdicionales.map((archivo) => archivo.path),
      descripcion: (req.body.descripcion || "").trim(),
    });

    await nuevoProducto.save();

    res.json({
      mensaje: "Producto creado correctamente ✅",
      producto: nuevoProducto,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al crear el producto" });
  }
});

// Actualizar (editar) un producto existente
app.put("/productos/:id", verificarToken, uploadProducto, async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);

    if (!producto) {
      return res.status(404).json({ mensaje: "Producto no encontrado" });
    }

    const archivoPrincipal = req.files?.imagen?.[0];
    const archivosAdicionales = req.files?.imagenesAdicionales || [];

    const errores = validarDatosProducto(req.body);
    if (errores.length > 0) {
      if (archivoPrincipal) {
        await cloudinary.uploader.destroy(archivoPrincipal.filename);
      }
      for (const archivo of archivosAdicionales) {
        await cloudinary.uploader.destroy(archivo.filename);
      }
      return res.status(400).json({ mensaje: errores.join(". ") });
    }

    producto.nombre = req.body.nombre;
    producto.precio = Number(req.body.precio);
    producto.stock = Number(req.body.stock);
    producto.categoria = req.body.categoria;
    producto.destacado = req.body.destacado === "on";
    producto.descripcion = (req.body.descripcion || "").trim();

    // Si se subió una imagen principal nueva, reemplazamos la anterior en Cloudinary
    if (archivoPrincipal) {
      const partesViejas = producto.imagen.split("/");
      const nombreArchivoViejo = partesViejas[partesViejas.length - 1].split(".")[0];
      await cloudinary.uploader.destroy(`tienda-productos/${nombreArchivoViejo}`);

      producto.imagen = archivoPrincipal.path;
    }

    // Si se subieron imágenes adicionales nuevas, reemplazamos TODO el set anterior
    if (archivosAdicionales.length > 0) {
      for (const url of producto.imagenesAdicionales) {
        const partes = url.split("/");
        const nombreArchivo = partes[partes.length - 1].split(".")[0];
        await cloudinary.uploader.destroy(`tienda-productos/${nombreArchivo}`);
      }
      producto.imagenesAdicionales = archivosAdicionales.map((archivo) => archivo.path);
    }

    await producto.save();

    res.json({
      mensaje: "Producto actualizado correctamente ✅",
      producto,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al actualizar el producto" });
  }
});

// Eliminar un producto
app.delete("/productos/:id", verificarToken, async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);

    if (!producto) {
      return res.status(404).json({ mensaje: "Producto no encontrado" });
    }

    // Extraer el public_id de Cloudinary a partir de la URL para poder borrar la imagen
    const partes = producto.imagen.split("/");
    const nombreArchivo = partes[partes.length - 1].split(".")[0];
    const publicId = `tienda-productos/${nombreArchivo}`;

    await cloudinary.uploader.destroy(publicId);

    for (const url of producto.imagenesAdicionales) {
      const partesAd = url.split("/");
      const nombreArchivoAd = partesAd[partesAd.length - 1].split(".")[0];
      await cloudinary.uploader.destroy(`tienda-productos/${nombreArchivoAd}`);
    }

    await Producto.findByIdAndDelete(req.params.id);

    res.json({ mensaje: "Producto eliminado correctamente ✅" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al eliminar el producto" });
  }
});

// ==========================
// Pedidos
// ==========================

// Crear un pedido nuevo (lo dispara el cliente al comprar por WhatsApp)
app.post("/pedidos", limitePedidos, async (req, res) => {
  try {
    const { cliente, items, total } = req.body;

    if (!cliente || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ mensaje: "Datos de pedido incompletos" });
    }

    const nuevoPedido = new Pedido({ cliente, items, total });
    await nuevoPedido.save();

    res.json({ mensaje: "Pedido registrado ✅", pedido: nuevoPedido });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al registrar el pedido" });
  }
});

// Registrar una venta manual (ej: vendida en persona o por otro canal)
// Se crea directamente como "confirmado" y descuenta stock al instante.
app.post("/pedidos/manual", verificarToken, async (req, res) => {
  try {
    const { productoId, cantidad, nota } = req.body;

    const cantidadNum = Number(cantidad);
    if (!productoId || !Number.isInteger(cantidadNum) || cantidadNum <= 0) {
      return res.status(400).json({ mensaje: "Datos inválidos" });
    }

    const producto = await Producto.findById(productoId);
    if (!producto) {
      return res.status(404).json({ mensaje: "Producto no encontrado" });
    }

    if (producto.stock < cantidadNum) {
      return res.status(400).json({ mensaje: `Stock insuficiente (disponible: ${producto.stock})` });
    }

    const nuevoPedido = new Pedido({
      cliente: {
        nombre: nota && nota.trim() ? nota.trim() : "Venta manual",
      },
      items: [
        {
          productoId: producto._id.toString(),
          nombre: producto.nombre,
          precio: producto.precio,
          cantidad: cantidadNum,
        },
      ],
      total: producto.precio * cantidadNum,
      estado: "confirmado",
    });

    await nuevoPedido.save();
    await descontarStock(nuevoPedido.items);

    res.json({ mensaje: "Venta manual registrada ✅", pedido: nuevoPedido });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al registrar la venta manual" });
  }
});

// Listar todos los pedidos (solo admin)
app.get("/pedidos", verificarToken, async (req, res) => {
  try {
    const pedidos = await Pedido.find().sort({ creadoEn: -1 });
    res.json(pedidos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al obtener los pedidos" });
  }
});

// Métricas de ventas para el dashboard del admin
app.get("/pedidos/metricas", verificarToken, async (req, res) => {
  try {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const [totalGeneral] = await Pedido.aggregate([
      { $match: { estado: "confirmado" } },
      { $group: { _id: null, total: { $sum: "$total" }, cantidad: { $sum: 1 } } },
    ]);

    const [totalMes] = await Pedido.aggregate([
      { $match: { estado: "confirmado", creadoEn: { $gte: inicioMes } } },
      { $group: { _id: null, total: { $sum: "$total" }, cantidad: { $sum: 1 } } },
    ]);

    const porEstado = await Pedido.aggregate([
      { $group: { _id: "$estado", cantidad: { $sum: 1 } } },
    ]);

    const topProductos = await Pedido.aggregate([
      { $match: { estado: "confirmado" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.nombre",
          unidades: { $sum: "$items.cantidad" },
          ingresos: { $sum: { $multiply: ["$items.precio", "$items.cantidad"] } },
        },
      },
      { $sort: { unidades: -1 } },
      { $limit: 5 },
    ]);

    res.json({
      totalVendido: totalGeneral?.total || 0,
      pedidosConfirmados: totalGeneral?.cantidad || 0,
      totalVendidoMes: totalMes?.total || 0,
      pedidosConfirmadosMes: totalMes?.cantidad || 0,
      porEstado: porEstado.map((e) => ({ estado: e._id, cantidad: e.cantidad })),
      topProductos: topProductos.map((p) => ({
        nombre: p._id,
        unidades: p.unidades,
        ingresos: p.ingresos,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al calcular métricas" });
  }
});

// Cambiar el estado de un pedido (confirmar o cancelar)
app.put("/pedidos/:id/estado", verificarToken, async (req, res) => {
  try {
    const { estado } = req.body;

    if (!["pendiente", "confirmado", "cancelado"].includes(estado)) {
      return res.status(400).json({ mensaje: "Estado inválido" });
    }

    const pedido = await Pedido.findById(req.params.id);

    if (!pedido) {
      return res.status(404).json({ mensaje: "Pedido no encontrado" });
    }

    const estadoAnterior = pedido.estado;
    pedido.estado = estado;

    // Si el pedido pasa a "confirmado" por primera vez, descontamos stock
    if (estadoAnterior !== "confirmado" && estado === "confirmado") {
      await descontarStock(pedido.items);
    }

    // Si un pedido confirmado se revierte (a pendiente o cancelado), devolvemos el stock
    if (estadoAnterior === "confirmado" && estado !== "confirmado") {
      await restaurarStock(pedido.items);
    }

    await pedido.save();

    res.json({ mensaje: "Estado actualizado ✅", pedido });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al actualizar el pedido" });
  }
});

// Eliminar un pedido (borra el registro; si estaba confirmado, devuelve el stock)
app.delete("/pedidos/:id", verificarToken, async (req, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id);

    if (!pedido) {
      return res.status(404).json({ mensaje: "Pedido no encontrado" });
    }

    // Si el pedido estaba confirmado, restauramos el stock antes de borrarlo
    if (pedido.estado === "confirmado") {
      await restaurarStock(pedido.items);
    }

    await Pedido.findByIdAndDelete(req.params.id);

    res.json({ mensaje: "Pedido eliminado correctamente ✅" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al eliminar el pedido" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});