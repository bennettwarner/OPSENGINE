const axios = require("axios");

/**
 * GET /api
 * List of API examples.
 */
exports.getApi = (req, res) => {
  res.render("api/index", {
    title: "API Examples"
  });
};

exports.getFileUpload = (req, res) => {
  res.render("api/upload", {
    title: "File Upload"
  });
};

exports.postFileUpload = (req, res) => {
  req.flash("success", { msg: "File was uploaded successfully." });
  res.redirect("/api/upload");
};
