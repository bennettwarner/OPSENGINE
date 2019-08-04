const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    type: String,
    state: Boolean,
    user: String,
    server: String
  },
  { timestamps: true }
);

const Task = mongoose.model("Task", taskSchema);

module.exports = Task;
