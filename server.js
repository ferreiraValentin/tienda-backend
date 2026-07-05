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

const app = express();

app.use(cors());
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
  creadoEn: { type: Date, default: Date.now },
});

const Producto = mongoose.model("Producto", productoSchema);

// ==========================
// Modelo de Pedido
// ==========================
const pedidoSchema = new mongoose.Schema({
  cliente: {
    nombre: { type: String, required: true },
    ciudad: { type: String, required: true },
    provincia: { type: String, required: true },
    codigoPostal: { type: String, required: true },
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
app.post("/login", async (req, res) => {
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
app.post("/productos", verificarToken, upload.single("imagen"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ mensaje: "No se subió ninguna imagen" });
    }

    const errores = validarDatosProducto(req.body);
    if (errores.length > 0) {
      // Si ya se subió la imagen a Cloudinary pero los datos son inválidos,
      // la borramos para no dejar imágenes huérfanas.
      await cloudinary.uploader.destroy(req.file.filename);
      return res.status(400).json({ mensaje: errores.join(". ") });
    }

    const nuevoProducto = new Producto({
      nombre: req.body.nombre,
      precio: Number(req.body.precio),
      stock: Number(req.body.stock),
      categoria: req.body.categoria,
      destacado: req.body.destacado === "on",
      imagen: req.file.path, // Cloudinary devuelve la URL directa acá
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
app.put("/productos/:id", verificarToken, upload.single("imagen"), async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);

    if (!producto) {
      return res.status(404).json({ mensaje: "Producto no encontrado" });
    }

    const errores = validarDatosProducto(req.body);
    if (errores.length > 0) {
      if (req.file) {
        await cloudinary.uploader.destroy(req.file.filename);
      }
      return res.status(400).json({ mensaje: errores.join(". ") });
    }

    producto.nombre = req.body.nombre;
    producto.precio = Number(req.body.precio);
    producto.stock = Number(req.body.stock);
    producto.categoria = req.body.categoria;
    producto.destacado = req.body.destacado === "on";

    // Si se subió una imagen nueva, reemplazamos la anterior en Cloudinary
    if (req.file) {
      const partesViejas = producto.imagen.split("/");
      const nombreArchivoViejo = partesViejas[partesViejas.length - 1].split(".")[0];
      const publicIdViejo = `tienda-productos/${nombreArchivoViejo}`;

      await cloudinary.uploader.destroy(publicIdViejo);

      producto.imagen = req.file.path;
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
app.post("/pedidos", async (req, res) => {
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

    pedido.estado = estado;
    await pedido.save();

    res.json({ mensaje: "Estado actualizado ✅", pedido });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al actualizar el pedido" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});