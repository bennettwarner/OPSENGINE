/**
 * Module dependencies.
 */
const fs = require("fs");
const express = require("express");
const compression = require("compression");
const session = require("express-session");
const bodyParser = require("body-parser");
const logger = require("morgan");
const chalk = require("chalk");
const errorHandler = require("errorhandler");
const lusca = require("lusca");
const dotenv = require("dotenv");
const MongoStore = require("connect-mongo")(session);
const flash = require("express-flash");
const path = require("path");
const mongoose = require("mongoose");
const passport = require("passport");
const sass = require("node-sass-middleware");
const ipfilter = require("express-ipfilter").IpFilter;

const multer = require("multer");
const upload = multer({ dest: path.join(__dirname, "uploads") });

var dir = "./tmp";

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

/**
 * Load environment variables from .env file, where API keys and passwords are configured.
 */
dotenv.config({ path: ".env" });

/**
 * Controllers (route handlers).
 */
const homeController = require("./controllers/home");
const userController = require("./controllers/user");
const apiController = require("./controllers/api");
const implantController = require("./controllers/implants");
const cloudController = require("./controllers/cloud");

/**
 * API keys and Passport configuration.
 */
const passportConfig = require("./config/passport");

/**
 * Create Express server.
 */
const app = express();

/**
 * Connect to MongoDB.
 */
mongoose.set("useFindAndModify", false);
mongoose.set("useCreateIndex", true);
mongoose.set("useNewUrlParser", true);
mongoose.set("useUnifiedTopology", true);
mongoose.connect(process.env.MONGODB_URI);
mongoose.connection.on("error", err => {
  console.error(err);
  console.log(
    "%s MongoDB connection error. Please make sure MongoDB is running.",
    chalk.red("✗")
  );
  process.exit();
});

/**
 * Express configuration.
 */
app.set("host", "0.0.0.0");
app.set("port", process.env.PORT || 8080);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");
app.locals.env = process.env;
if (process.env.ENABLE_WHITELIST == "true") {
  console.log("IP Whitelist: %s", chalk.green("✓"));
  var local_addrs = ["127.0.0.1", "::ffff:127.0.0.1", "::1"];
  var ip_whitelist = process.env.WHITELIST_IPADDRS.split(",").concat(
    local_addrs
  );
  console.log(ip_whitelist);
  app.use(ipfilter(ip_whitelist, { mode: "allow" }));
}
app.use(compression());
app.use(
  sass({
    src: path.join(__dirname, "public"),
    dest: path.join(__dirname, "public")
  })
);
app.use(logger("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    resave: true,
    saveUninitialized: true,
    secret: process.env.SESSION_SECRET,
    cookie: { maxAge: 1209600000 }, // two weeks in milliseconds
    store: new MongoStore({
      url: process.env.MONGODB_URI,
      autoReconnect: true
    })
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use((req, res, next) => {
  if (req.path === "/api/upload") {
    next();
  } else {
    lusca.csrf()(req, res, next);
  }
});
app.use(lusca.xframe("SAMEORIGIN"));
app.use(lusca.xssProtection(true));
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});
app.use((req, res, next) => {
  // After successful login, redirect back to the intended page
  if (
    !req.user &&
    req.path !== "/login" &&
    req.path !== "/signup" &&
    !req.path.match(/^\/auth/) &&
    !req.path.match(/\./)
  ) {
    req.session.returnTo = req.originalUrl;
  } else if (req.user && req.path == "/account") {
    req.session.returnTo = req.originalUrl;
  }
  next();
});
app.use(
  "/",
  express.static(path.join(__dirname, "public"), { maxAge: 31557600000 })
);
app.use(
  "/js/lib",
  express.static(path.join(__dirname, "node_modules/popper.js/dist/umd"), {
    maxAge: 31557600000
  })
);
app.use(
  "/js/lib",
  express.static(path.join(__dirname, "node_modules/bootstrap/dist/js"), {
    maxAge: 31557600000
  })
);
app.use(
  "/js/lib",
  express.static(path.join(__dirname, "node_modules/jquery/dist"), {
    maxAge: 31557600000
  })
);
app.use(
  "/",
  express.static(path.join(__dirname, "node_modules/gijgo"), {
    maxAge: 31557600000
  })
);

app.use(
  "/js/lib",
  express.static(path.join(__dirname, "node_modules/datatables/media/js"), {
    maxAge: 31557600000
  })
);
app.use(
  "/js/lib/xterm",
  express.static(path.join(__dirname, "node_modules/xterm/dist/"), {
    maxAge: 31557600000
  })
);
app.use(
  "/webfonts",
  express.static(
    path.join(__dirname, "node_modules/@fortawesome/fontawesome-free/webfonts"),
    { maxAge: 31557600000 }
  )
);
app.use(
  "/js/lib",
  express.static(path.join(__dirname, "node_modules/bootstrap4-toggle/js"), {
    maxAge: 31557600000
  })
);

/**
 * Primary app routes.
 */
app.get("/", homeController.index);
app.get("/login", userController.getLogin);
app.post("/login", userController.postLogin);
app.get("/logout", userController.logout);
app.get("/forgot", userController.getForgot);
app.post("/forgot", userController.postForgot);
app.get("/reset/:token", userController.getReset);
app.post("/reset/:token", userController.postReset);
app.get("/signup", userController.getSignup);
app.post("/signup", userController.postSignup);
app.get("/users", passportConfig.isAuthenticated, userController.getUsers);
app.get(
  "/users/enable/:id",
  passportConfig.isAuthenticated,
  userController.enableUser
);
app.get(
  "/users/disable/:id",
  passportConfig.isAuthenticated,
  userController.disableUser
);
app.get(
  "/users/delete/:id",
  passportConfig.isAuthenticated,
  userController.deleteUser
);
app.get(
  "/users/edit/:id",
  passportConfig.isAuthenticated,
  userController.getEditUser
);
app.post(
  "/users/edit/:id",
  passportConfig.isAuthenticated,
  userController.postEditUser
);
app.get("/retro", passportConfig.isAuthenticated, userController.retro);
app.get(
  "/implants",
  passportConfig.isAuthenticated,
  implantController.getImplants
);
app.get(
  "/implants/:user",
  passportConfig.isAuthenticated,
  implantController.userImplants
);
app.get(
  "/implant/add/",
  passportConfig.isAuthenticated,
  implantController.addImplant
);
app.get(
  "/implant/:id",
  passportConfig.isAuthenticated,
  implantController.getImplant
);
app.post(
  "/implant/:id",
  passportConfig.isAuthenticated,
  implantController.postImplant
);
app.get("/shell/:id", passportConfig.isAuthenticated, cloudController.getShell);

app.get("/files/:id", passportConfig.isAuthenticated, cloudController.getFiles);

app.get("/getFile/:id", passportConfig.isAuthenticated, cloudController.dlFile);

app.get("/account", passportConfig.isAuthenticated, userController.getAccount);
app.post(
  "/account/profile",
  passportConfig.isAuthenticated,
  userController.postUpdateProfile
);
app.post(
  "/account/password",
  passportConfig.isAuthenticated,
  userController.postUpdatePassword
);
app.post(
  "/account/delete",
  passportConfig.isAuthenticated,
  userController.postDeleteAccount
);

app.get(
  "/infrastructure",
  passportConfig.isAuthenticated,
  cloudController.getInfrastructure
);

app.get(
  "/userInfrastructure",
  passportConfig.isAuthenticated,
  cloudController.getUserInfrastructure
);

app.get(
  "/deployInfrastructure",
  passportConfig.isAuthenticated,
  cloudController.getdeployInfrastructure
);

app.get("/rdpgen/:id", passportConfig.isAuthenticated, cloudController.rdpgen);

app.post(
  "/deployInfrastructure",
  passportConfig.isAuthenticated,
  cloudController.postdeployInfrastructure
);

app.get(
  "/deleteServer/:id",
  passportConfig.isAuthenticated,
  cloudController.deleteServer
);

app.post(
  "/serverMetadata/:id",
  passportConfig.isAuthenticated,
  cloudController.postMetadata
);

app.get(
  "/infrastructure/:id",
  passportConfig.isAuthenticated,
  cloudController.getServer
);

app.get(
  "/account/enroll",
  passportConfig.isAuthenticated,
  userController.getEnrollMFA
);

app.post(
  "/account/enroll",
  passportConfig.isAuthenticated,
  userController.postEnrollMFA
);

app.get(
  "/account/disableEnrollment",
  passportConfig.isAuthenticated,
  userController.getDisableEnrollment
);

app.get("/2fa", userController.getMFA);

app.post("/2fa", userController.postMFA);

/**
 * API examples routes.
 */
app.get("/api", apiController.getApi);
app.get("/api/upload", apiController.getFileUpload);
app.post("/api/upload", upload.single("myFile"), apiController.postFileUpload);

/**
 * Error Handler.
 */
if (process.env.NODE_ENV === "development") {
  // only use in development
  app.use(errorHandler());
} else {
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send("Server Error");
  });
}

// express error handling
app.use(function(req, res, next) {
  res.status(404).send("404");
});

/**
 * Start Express server.
 */
app.listen(app.get("port"), () => {
  console.log(
    "%s %s is running at %s:%d in %s mode",
    chalk.green("✓"),
    process.env.PLATFORM,
    process.env.BASE_URL,
    app.get("port"),
    app.get("env")
  );
  console.log("  Press CTRL-C to stop\n");
});

module.exports = app;
