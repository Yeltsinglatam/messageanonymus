"use strict";
require("dotenv").config();

const express = require("express");
const path = require("path");
const helmet = require("helmet");
const cors = require("cors");
const mongoose = require("mongoose");

const apiRoutes = require("./routes/api.js");
const fccTestingRoutes = require("./routes/fcctesting.js");
const runner = require("./test-runner");

const app = express();

/* ---- Seguridad (Helmet v3, como pide FCC) ---- */
app.use(helmet.hidePoweredBy({ setTo: "PHP 7.4.3" }));
app.use(helmet.noSniff());
app.use(helmet.xssFilter());
app.use(helmet.noCache());
app.use(helmet.frameguard({ action: "sameorigin" }));
app.use(helmet.dnsPrefetchControl({ allow: false }));
app.use(helmet.referrerPolicy({ policy: "same-origin" }));
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      baseUri: ["'self'"],
    },
  })
);

/* ---- Imprescindible para que req.body NO llegue vacío ---- */
app.use(cors({ origin: "*" })); // FCC tests
app.use(express.json()); // JSON
app.use(express.urlencoded({ extended: true })); // x-www-form-urlencoded

/* ---- Estáticos y vistas que FCC asume ---- */
app.use("/public", express.static(process.cwd() + "/public"));
app.get("/", (req, res) => res.sendFile(process.cwd() + "/views/index.html"));
app.get("/b/:board/", (req, res) =>
  res.sendFile(process.cwd() + "/views/board.html")
);
app.get("/b/:board/:thread_id", (req, res) =>
  res.sendFile(process.cwd() + "/views/thread.html")
);

/* ---- Conexión a Mongo (UNA SOLA VEZ AQUÍ) ---- */
const uri = process.env.DB || process.env.MONGO_URI || process.env.DB2;
if (!uri) {
  console.error("❌ Falta la variable de entorno DB / MONGO_URI / DB2.");
  process.exit(1);
}
mongoose.set("strictQuery", false);
mongoose
  .connect(uri) // si tu URI ya incluye /nombreBD, no pases dbName extra
  .then(() => console.log("✅ Mongo connected"))
  .catch((e) => {
    console.error("❌ Mongo connection error", e);
    process.exit(1);
  });

/* ---- Rutas FCC y API ---- */
fccTestingRoutes(app);
apiRoutes(app);

/* ---- 404 ---- */
app.use((req, res) => res.status(404).type("text").send("Not Found"));

/* ---- Listen + test runner ---- */
const port = process.env.PORT || 3000;
app.listen(port, function () {
  console.log("Listening on port " + (process.env.PORT || 3000));
  if (process.env.NODE_ENV === "test") {
    console.log("Running Tests...");
    setTimeout(function () {
      try {
        runner.run();
      } catch (e) {
        console.log("Tests are not valid:", e);
      }
    }, 1500);
  }
});

module.exports = app; // for testing
