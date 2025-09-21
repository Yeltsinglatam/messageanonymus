"use strict";

const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");

require("dotenv").config();

const app = express();

// ───────────────── Seguridad FCC (Helmet v3, middlewares explícitos)
app.use(helmet.hidePoweredBy());
app.use(helmet.frameguard({ action: "sameorigin" })); // iFrame solo mismo origen
app.use(helmet.dnsPrefetchControl()); // deshabilitar DNS prefetch
app.use(helmet.referrerPolicy({ policy: "same-origin" })); // referrer solo same-origin
app.use(helmet.noSniff());

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// estáticos y vistas (boilerplate FCC)
app.use("/public", express.static(path.join(process.cwd(), "public")));
app.get("/", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "views", "index.html"));
});
app.get("/b/:board/", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "views", "board.html"));
});
app.get("/b/:board/:threadid", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "views", "thread.html"));
});

// ───────────────── Rutas de testing FCC (exponen /_api/get-tests)
try {
  require("./routes/fcctesting.js")(app);
} catch (_) {
  /* ignorar si no existe */
}

// ───────────────── Conexión Mongo
const DB = process.env.DB || process.env.MONGO_URI || process.env.DB2;
if (!DB) {
  console.error("❌ Falta variable de entorno DB/MONGO_URI/DB2");
  process.exit(1);
}
mongoose.set("strictQuery", true);
mongoose
  .connect(DB)
  .then(() => console.log("✅ Mongo conectado"))
  .catch((err) => {
    console.error("❌ Error Mongo:", err?.message || err);
    process.exit(1);
  });

// ───────────────── API (intenta ./api.js y, si no existe, ./routes/api.js)
let wired = false;
try {
  require("./api.js")(app); // si api.js está en la raíz
  wired = true;
} catch (_) {
  try {
    require("./routes/api.js")(app); // si api.js está en /routes
    wired = true;
  } catch (e) {
    console.error("❌ No se encontró ./api.js ni ./routes/api.js:", e.message);
    // No hacemos process.exit(1) para no tumbar el puerto mientras depuras
  }
}
if (!wired) {
  console.warn("⚠️  API no montada: verifica la ruta de tu api.js");
}

// ───────────────── Ejecutar test runner (para ítem 13) cuando NODE_ENV==='test'
let runner;
try {
  runner = require("./test-runner");
} catch (_) {
  /* opcional */
}

if (
  process.env.NODE_ENV === "test" &&
  runner &&
  typeof runner.run === "function"
) {
  console.log("Running FCC Tests...");
  setTimeout(() => {
    try {
      runner.run();
    } catch (e) {
      console.log("Tests are not valid:");
      console.error(e);
    }
  }, 1500); // pequeño delay tras levantar el server
}

// ───────────────── Arranque (siempre escuchar el puerto; Render necesita esto)
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";
console.log(
  "About to listen on PORT=",
  PORT,
  "NODE_ENV=",
  process.env.NODE_ENV
);
app.listen(PORT, HOST, () => {
  console.log("🚀 Server en puerto", PORT);
});

module.exports = app;
