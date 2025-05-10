const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  password: {
    type: String,
    required: true
  },

  email: {
    type: String,
    trim: true,
    default: ""
  },

  profileImage: {
    type: String,
    default: ""  // Store URL or path to image
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("user", UserSchema);

