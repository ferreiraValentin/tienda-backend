require("dotenv").config();

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const mongoose = require("mongoose");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

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
const productoSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  precio: { type: Number, required: true },
  stock: { type: Number, required: true },
  categoria: { type: String, required: true },
  destacado: { type: Boolean, default: false },
  imagen: { type: String, required: true },
  creadoEn: { type: Date, default: Date.now },
});

const Producto = mongoose.model("Producto", productoSchema);

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
app.post("/productos", upload.single("imagen"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ mensaje: "No se subió ninguna imagen" });
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
app.put("/productos/:id", upload.single("imagen"), async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);

    if (!producto) {
      return res.status(404).json({ mensaje: "Producto no encontrado" });
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
app.delete("/productos/:id", async (req, res) => {
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

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});