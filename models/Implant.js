const mongoose = require("mongoose");

const implantSchema = new mongoose.Schema(
  {
    name: { type: String, unique: true },
    status: {
      state: String,
      shipDate: Date,
      returnDate: Date,
      online: Boolean,
      publicIP: String
    },
    model: String,
    client: String,
    location: String,
    pointOfContact: {
      name: String,
      number: String,
      email: String
    },
    consultant: String,
    networkConfig: {
      internalIP: String,
      subnet: String,
      gateway: String,
      dns1: String,
      dns2: String
    },
    notes: String
  },
  { timestamps: true }
);

const Implant = mongoose.model("Implant", implantSchema);

module.exports = Implant;
