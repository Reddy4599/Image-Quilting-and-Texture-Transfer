// ✅ server.js — with Texture Transfer + Quilting + ArtBot + User Page Support

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env'), debug: true });

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const crypto = require("crypto");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 5001;

// ✅ Environment checks
console.log('Environment Status:', {
  JWT_SECRET: process.env.JWT_SECRET ? '✅ Loaded' : '❌ Missing',
  MONGODB_URI: process.env.MONGODB_URI ? '✅ Loaded' : '❌ Missing',
  HUGGING_FACE_API_KEY: process.env.HUGGING_FACE_API_KEY ? '✅ Loaded' : '❌ Missing'
});

if (!process.env.JWT_SECRET || !process.env.MONGODB_URI) {
  console.error("❌ Critical Error: Missing required environment variables");
  process.exit(1);
}

// ✅ Connect MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true, useUnifiedTopology: true, serverSelectionTimeoutMS: 5000
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`❌ MongoDB Error: ${err.message}`);
    process.exit(1);
  }
};

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ✅ Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) return cb(new Error('Only images allowed'), false);
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ✅ Mongoose Models
const User = require('./models/user');
const QuiltingResult = require('./models/ImageQuiltingOutput');
const TextureTransferResult = require('./models/TextureTransferOutput');

// ✅ Auth Middleware
const authenticate = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ success: false, message: "No token provided" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ success: false, message: "User not found" });
    const now = Date.now() / 1000;
    if (decoded.exp - now < 300) {
      const newToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
      res.set('X-Renewed-Token', newToken);
    }
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: e.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token' });
  }
};

// ✅ Health Route
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', db: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected', port: PORT });
});

// ✅ ArtBot
app.use('/api/artbot', require('./routes/artbotRoutes'));

// ✅ Register/Login
app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, message: "All fields required" });
  if (await User.findOne({ username })) return res.status(400).json({ success: false, message: "Username taken" });
  const user = new User({ username, password: await bcrypt.hash(password, 10) });
  await user.save();
  res.status(201).json({ success: true, message: "Registered" });
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ success: false, message: "Invalid credentials" });
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
  res.json({ success: true, token });
});

// ✅ User Page Route
app.get('/api/user/profile', authenticate, async (req, res) => {
  try {
    const quiltingImages = await QuiltingResult.find({ userId: req.user._id }).sort({ createdAt: -1 });
    const textureImages = await TextureTransferResult.find({ userId: req.user._id }).sort({ createdAt: -1 });

    res.json({
      success: true,
      username: req.user.username,
      quiltingHistory: quiltingImages.map(img => ({
        url: img.outputImagePath.replace(path.join(__dirname, "public"), ''),
        date: img.createdAt
      })),
      textureTransferHistory: textureImages.map(img => ({
        url: img.outputImagePath.replace(path.join(__dirname, "outputs"), '/outputs'),
        date: img.createdAt
      }))
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Could not load profile" });
  }
});

// ✅ Quilting Preview
app.post("/api/quilting/preview", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
    const { outputWidth = 500, outputHeight = 500, patchSize = 50, overlap = 10 } = req.body;
    const sessionId = crypto.randomBytes(16).toString('hex');
    const outPath = path.join(__dirname, "temp_outputs", `preview_${sessionId}.jpg`);
    const cmd = `python3 "${path.join(__dirname, "scripts", "quilting.py")}" "${req.file.path}" "${outPath}" ${outputWidth} ${outputHeight} ${patchSize} ${overlap}`;

    exec(cmd, { timeout: 60000 }, async (err) => {
      fs.unlink(req.file.path, () => {});
      if (err || !fs.existsSync(outPath)) return res.status(500).json({ success: false, message: "Processing error" });
      res.json({ success: true, previewUrl: `/temp_outputs/preview_${sessionId}.jpg`, sessionId });
    });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Quilting Save
app.post("/api/quilting/save", authenticate, async (req, res) => {
  const { sessionId } = req.body;
  const previewFile = path.join(__dirname, "temp_outputs", `preview_${sessionId}.jpg`);
  const finalDir = path.join(__dirname, "public", "images");
  const finalName = `quilted_${req.user._id}_${Date.now()}.jpg`;
  const finalPath = path.join(finalDir, finalName);
  if (!fs.existsSync(previewFile)) return res.status(404).json({ success: false, message: "Preview not found" });
  if (!fs.existsSync(finalDir)) fs.mkdirSync(finalDir, { recursive: true });
  fs.renameSync(previewFile, finalPath);
  await new QuiltingResult({ userId: req.user._id, outputImagePath: finalPath }).save();
  res.json({ success: true, imageUrl: `/images/${finalName}` });
});

// ✅ Texture Transfer
app.post('/api/texture-transfer', upload.fields([{ name: 'texture', maxCount: 1 }, { name: 'target', maxCount: 1 }]), async (req, res) => {
  try {
    if (!req.files?.texture || !req.files?.target) return res.status(400).json({ success: false, message: "Images missing" });

    const outDir = path.join(__dirname, "outputs");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const outFile = `transfer_${Date.now()}.jpg`;
    const outPath = path.join(outDir, outFile);
    const { patchSize = 30, overlap = 10, iterations = 3 } = req.body;

    const cmd = `python3 "${path.join(__dirname, "scripts", "texture-transfer.py")}" "${req.files.texture[0].path}" "${req.files.target[0].path}" "${outPath}" ${patchSize} ${overlap} ${iterations}`;

    exec(cmd, { timeout: 300000 }, async (err) => {
      fs.unlink(req.files.texture[0].path, () => {});
      fs.unlink(req.files.target[0].path, () => {});
      if (err || !fs.existsSync(outPath)) return res.status(500).json({ success: false, message: "Failed" });

      // Optional: Save output reference
      if (req.user) {
        await new TextureTransferResult({ userId: req.user._id, outputImagePath: outPath }).save();
      }

      res.json({ success: true, imageUrl: `/outputs/${outFile}` });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Internal error", error: e.message });
  }
});

// ✅ Static files
app.use("/temp_outputs", express.static(path.join(__dirname, "temp_outputs")));
app.use("/images", express.static(path.join(__dirname, "public", "images")));
app.use("/outputs", express.static(path.join(__dirname, "outputs")));

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Endpoint not found" });
});

// ✅ Init server
(async () => {
  await connectDB();
  ["uploads", "temp_outputs", path.join("public", "images"), "outputs"].forEach(dir => {
    const fullPath = path.join(__dirname, dir);
    if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
  });
  app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
})();

