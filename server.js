const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const API_URL = "https://tienda-api-5ulq.onrender.com";

const carpetaImagenes = path.join(__dirname, "backend", "imagenes");
const archivoProductos = path.join(__dirname, "productos.json");

if (!fs.existsSync(carpetaImagenes)) {
  fs.mkdirSync(carpetaImagenes, { recursive: true });
}

app.use("/imagenes", express.static(carpetaImagenes));

const storage = multer.diskStorage({
  destination: carpetaImagenes,
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

function leerProductos() {
  if (!fs.existsSync(archivoProductos)) {
    fs.writeFileSync(archivoProductos, "[]");
  }

  return JSON.parse(fs.readFileSync(archivoProductos, "utf-8"));
}

function guardarProductos(productos) {
  fs.writeFileSync(archivoProductos, JSON.stringify(productos, null, 2));
}

app.get("/", (req, res) => {
  res.send("Servidor funcionando ✅");
});

app.get("/productos", (req, res) => {
  res.json(leerProductos());
});

app.post("/productos", upload.single("imagen"), (req, res) => {
  const productos = leerProductos();

  const nuevoProducto = {
  id: Date.now(),
  nombre: req.body.nombre,
  precio: Number(req.body.precio),
  categoria: req.body.categoria,
  imagen: `${API_URL}/imagenes/${req.file.filename}`,
};


  productos.push(nuevoProducto);
  guardarProductos(productos);

  res.json({
    mensaje: "Producto creado correctamente ✅",
    producto: nuevoProducto,
  });
});

app.delete("/productos/:id", (req, res) => {
  let productos = leerProductos();

  const id = Number(req.params.id);
  const producto = productos.find(p => p.id === id);

  if (!producto) {
    return res.status(404).json({ mensaje: "Producto no encontrado" });
  }

  const nombreImagen = producto.imagen.split("/").pop();
  const rutaImagen = path.join(carpetaImagenes, nombreImagen);

  if (fs.existsSync(rutaImagen)) {
    fs.unlinkSync(rutaImagen);
  }

  productos = productos.filter(p => p.id !== id);
  guardarProductos(productos);

  res.json({ mensaje: "Producto eliminado correctamente ✅" });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
