const mongoose = require("mongoose");

const ImageQuiltingInputSchema = new mongoose.Schema({
    inputImagePath: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("ImageQuiltingInput", ImageQuiltingInputSchema, "image quilting input"); 
// Third argument specifies the exact collection name

