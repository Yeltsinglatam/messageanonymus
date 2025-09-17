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

/* --- Seguridad Helmet v3 (lo que pide FCC) --- */
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

/* --- Parsers y CORS (FCC tests) --- */
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* --- Static & vistas opcionales --- */
app.use("/public", express.static(process.cwd() + "/public"));
app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/views/index.html");
});


const uri = process.env.DB || process.env.MONGO_URI || process.env.DB2; // 
if (!uri) {
  console.error("❌ Falta la variable de entorno DB / MONGO_URI / DB2.");
  process.exit(1);
}
mongoose.set("strictQuery", false);
mongoose
  .connect(uri) 
  .then(() => console.log("✅ Mongo connected"))
  .catch((e) => {
    console.error("❌ Mongo connection error", e);
    process.exit(1);
  });

/* --- Rutas FCC + API --- */
fccTestingRoutes(app);
apiRoutes(app);

/* --- 404 --- */
app.use((req, res) => res.status(404).type("text").send("Not Found"));

/* --- Listen + test runner --- */
const port = process.env.PORT || 3000;
app.listen(port, function () {
  console.log("Listening on port " + port);
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
