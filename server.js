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
app.use(helmet.frameguard({ action: "sameorigin" })); // ✔ iFrame solo mismo origen (2)
app.use(helmet.dnsPrefetchControl()); // ✔ Deshabilitar DNS prefetch (3)
app.use(helmet.referrerPolicy({ policy: "same-origin" })); // ✔ Referrer solo same-origin (4)
app.use(helmet.noSniff());

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// estáticos y vistas (si usas el boilerplate de FCC)
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

// Rutas de testing FCC (si existen)
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
try {
  require("./api.js")(app); // si api.js está en la raíz
} catch (_) {
  try {
    require("./routes/api.js")(app); // si api.js está en /routes
  } catch (e) {
    console.error("❌ No se encontró ./api.js ni ./routes/api.js:", e.message);
    process.exit(1);
  }
}

let runner;
try {
  runner = require("./test-runner");
} catch (_) {
  /* opcional */
}

if (process.env.NODE_ENV === "test" && runner) {
  console.log("Running FCC Tests...");
  setTimeout(() => {
    try {
      runner.run();
    } catch (e) {
      console.log("Tests are not valid:");
      console.error(e);
    }
  }, 1500);
}

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log("🚀 Server en puerto", PORT);
});

module.exports = app;
