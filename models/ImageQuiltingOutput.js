const mongoose = require("mongoose");

const ImageQuiltingOutputSchema = new mongoose.Schema({
    outputImagePath: { type: String, required: true },
    generatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("ImageQuiltingOutput", ImageQuiltingOutputSchema, "image quilting output");  
// Third argument specifies the exact collection name