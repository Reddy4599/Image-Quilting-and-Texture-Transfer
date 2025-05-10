// models/TextureTransferOutput.js

const mongoose = require('mongoose');

const TextureTransferOutputSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  outputImagePath: {
    type: String,
    required: true
  },
  parameters: {
    patchSize: Number,
    overlap: Number,
    iterations: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('TextureTransferOutput', TextureTransferOutputSchema);
