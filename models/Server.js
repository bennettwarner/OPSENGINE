const mongoose = require("mongoose");

const serverSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true },
    ip: { type: String, unique: true },
    name: String,
    consultant: String,
    client: String,
    creds: String,
    project: {
      start: Date,
      end: Date
    },
    notes: String
  },
  { timestamps: true }
);

const Server = mongoose.model("Server", serverSchema);

module.exports = Server;
