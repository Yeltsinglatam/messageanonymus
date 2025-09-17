"use strict";
require("dotenv").config();

var express = require("express");
var bodyParser = require("body-parser");
var expect = require("chai").expect;
var cors = require("cors");

var apiRoutes = require("./routes/api.js");
var fccTestingRoutes = require("./routes/fcctesting.js");
var runner = require("./test-runner");

var app = express();

const helmet = require('helmet');


app.use(helmet.hidePoweredBy({ setTo: 'PHP 7.4.3' }));         // X-Powered-By: PHP 7.4.3
app.use(helmet.noSniff());                                      // X-Content-Type-Options: nosniff
app.use(helmet.xssFilter());                                    // X-XSS-Protection
app.use(helmet.noCache());                                      // Cache-Control/Pragma no-cache
app.use(helmet.frameguard({ action: 'sameorigin' }));           // X-Frame-Options: SAMEORIGIN
app.use(helmet.dnsPrefetchControl({ allow: false }));           // X-DNS-Prefetch-Control: off
app.use(helmet.referrerPolicy({ policy: 'same-origin' }));      // Referrer-Policy: same-origin
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc:  ["'self'"],
    styleSrc:   ["'self'", "'unsafe-inline'"],
    imgSrc:     ["'self'", "data:"],
    connectSrc: ["'self'"],
    objectSrc:  ["'none'"],
    frameAncestors: ["'self'"],
    baseUri: ["'self'"]
  }
}));


//Index page (static HTML)
app.route("/").get(function (req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

//For FCC testing purposes
fccTestingRoutes(app);

//Routing for API
apiRoutes(app);

//Sample Front-end

//404 Not Found Middleware
app.use(function (req, res, next) {
  res.status(404).type("text").send("Not Found");
});

//Start our server and tests!
app.listen(process.env.PORT || 3000, function () {
  console.log("Listening on port " + process.env.PORT);
  if (process.env.NODE_ENV === "test") {
    console.log("Running Tests...");
    setTimeout(function () {
      try {
        runner.run();
      } catch (e) {
        var error = e;
        console.log("Tests are not valid:");
        console.log(error);
      }
    }, 1500);
  }
});

module.exports = app; //for testing
