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

// Opcional: rutas de testing del boilerplate (si existen)
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

// ───────────────── API
require("./api.js")(app);

// ───────────────── Arranque
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => console.log("🚀 Server en puerto", PORT));
}

module.exports = app;
