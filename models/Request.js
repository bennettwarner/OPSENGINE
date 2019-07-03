const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  name: { type: String, unique: true },
  status: {
      state: String,
      shipDate: Date,
      returnDate: Date,
  },
  device: String,
  client: String,
  location: String,
  pointOfContact: {
    name: String,
    number: String,
    email: String,
  },
  requester: String,
  networkConfig: {
    internalIP: String,
    subnet: String,
    gateway: String,
    dns1: String,
    dns2: String,
  },
  notes: String,
}, { timestamps: true });

const Request = mongoose.model('Device', requestSchema);

module.exports = Request;
