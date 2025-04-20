require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const crypto = require("crypto");
const fetch = require('node-fetch');

const app = express();
app.use(express.json());
app.use(cors());

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// MongoDB Connection
mongoose.connect("mongodb://127.0.0.1:28017/loginDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB connected successfully!"))
.catch((err) => console.error("❌ MongoDB connection failed:", err));

// Schemas and Models
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

const QuiltingResultSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    inputImagePath: { type: String, required: true },
    outputImagePath: { type: String, required: true },
    parameters: {
        outputWidth: Number,
        outputHeight: Number,
        patchSize: Number,
        overlap: Number
    },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", UserSchema);
const QuiltingResult = mongoose.model("QuiltingResult", QuiltingResultSchema);

// Temporary storage for preview sessions
const tempSessions = new Map();

// Multer Setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, "uploads");
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Authentication Middleware
const authenticate = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: "No token provided" });

    try {
        const decoded = jwt.verify(token, "your_secret_key");
        req.user = await User.findById(decoded.id);
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: "Invalid token" });
    }
};

// Hugging Face ArtBot Configuration
const ARTBOT_CONFIG = {
    model: "mistralai/Mistral-7B-Instruct-v0.1",
    systemPrompt: `[INST] You are ArtBot, a professional design assistant. Provide concise, practical advice about:
- Color theory and palette generation
- Typography and font pairing
- Layout/composition techniques
- Current design trends
- Logo/UI/UX best practices

Format responses clearly with bullet points or numbered steps when appropriate. [/INST]`,
    fallbackResponse: "I'm currently unavailable. Try asking about:\n- Color palette ideas\n- Font combinations\n- Layout improvements"
};

// Rate limiting for Hugging Face API
const apiCallsStore = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_CALLS_PER_WINDOW = 10;

function checkRateLimit(ip) {
    const now = Date.now();
    const userCalls = apiCallsStore.get(ip) || [];
    const recentCalls = userCalls.filter(time => now - time < RATE_LIMIT_WINDOW);
    
    if (recentCalls.length >= MAX_CALLS_PER_WINDOW) {
        return false;
    }
    
    recentCalls.push(now);
    apiCallsStore.set(ip, recentCalls);
    return true;
}

// ArtBot Endpoint with Hugging Face
app.post('/api/artbot/chat', async (req, res) => {
    try {
        // Rate limiting check
        if (!checkRateLimit(req.ip)) {
            return res.status(429).json({
                success: false,
                error: "Too many requests. Please wait a minute before trying again."
            });
        }

        const { message, modelEndpoint } = req.body;
        if (!message) {
            return res.status(400).json({ success: false, error: "Message is required" });
        }

        if (!modelEndpoint) {
            return res.status(400).json({ success: false, error: "Model endpoint is required" });
        }

        // Ensure you have HUGGING_FACE_API_KEY in your .env file
        const HF_API_KEY = process.env.HUGGING_FACE_API_KEY;
        if (!HF_API_KEY || HF_API_KEY === 'your_huggingface_api_key_here') {
            return res.status(500).json({ 
                success: false, 
                error: "Hugging Face API key not configured properly. Please check your API key in the .env file." 
            });
        }

        console.log('Making request to Hugging Face API with endpoint:', modelEndpoint);
        
        const isImageGeneration = modelEndpoint.includes('stable-diffusion');
        
        // Test the API key first
        const testResponse = await fetch('https://api-inference.huggingface.co/models/gpt2', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HF_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inputs: "test" })
        });

        if (!testResponse.ok) {
            const errorText = await testResponse.text();
            console.error('Hugging Face API key validation failed:', errorText);
            return res.status(401).json({
                success: false,
                error: "Invalid or unauthorized Hugging Face API key. Please check your API key permissions."
            });
        }

        // Proceed with the actual model request
        const response = await fetch(modelEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HF_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: message,
                parameters: isImageGeneration 
                    ? {
                        num_inference_steps: 30,
                        guidance_scale: 7.5,
                        negative_prompt: "blurry, low quality, distorted"
                    }
                    : {
                        max_new_tokens: 250,
                        temperature: 0.7,
                        top_p: 0.9,
                        do_sample: true,
                        truncation: true,
                        max_length: 128
                    }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Hugging Face API error response:', errorText);
            let errorMessage = 'Failed to process request with Hugging Face API';
            
            if (response.status === 403) {
                errorMessage = 'Access denied. Please ensure your API key has the necessary permissions for this model.';
            } else if (response.status === 404) {
                errorMessage = 'Model not found. Please check the model endpoint URL.';
            }
            
            return res.status(response.status).json({ 
                success: false, 
                error: errorMessage,
                details: errorText
            });
        }

        // Handle image generation response
        if (isImageGeneration) {
            const buffer = await response.buffer();
            const imageBase64 = buffer.toString('base64');
            return res.json({ 
                success: true, 
                imageUrl: `data:image/jpeg;base64,${imageBase64}`,
                response: "Image generated successfully!" 
            });
        }

        // Handle text response
        const data = await response.json();
        return res.json({ 
            success: true, 
            response: Array.isArray(data) ? data[0].generated_text : data.generated_text 
        });

    } catch (error) {
        console.error('ArtBot Error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || "Failed to process request",
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Existing Routes (unchanged)
app.post("/api/auth/register", async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: "All fields are required!" });
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "Username already exists!" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();

        res.json({ success: true, message: "User registered successfully!" });
    } catch (error) {
        console.error("❌ Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.post("/api/auth/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ success: false, message: "User not found!" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ success: false, message: "Invalid credentials!" });

        const token = jwt.sign({ id: user._id }, "your_secret_key", { expiresIn: "1h" });
        res.json({ success: true, token });
    } catch (error) {
        console.error("❌ Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.post("/api/quilting/preview", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded!" });
        }

        const tempOutputDir = path.join(__dirname, "temp_outputs");
        if (!fs.existsSync(tempOutputDir)) fs.mkdirSync(tempOutputDir);

        const sessionId = crypto.randomBytes(16).toString('hex');
        const outputFilename = `preview_${sessionId}.jpg`;
        const outputPath = path.join(tempOutputDir, outputFilename);

        const outputWidth = req.body.outputWidth || 500;
        const outputHeight = req.body.outputHeight || 500;
        const patchSize = req.body.patchSize || 50;
        const overlap = req.body.overlap || 10;

        const scriptPath = path.join(__dirname, "scripts", "quilting.py");
        if (!fs.existsSync(scriptPath)) {
            return res.status(500).json({ 
                success: false, 
                message: "Server configuration error" 
            });
        }

        const cmd = `python3 "${scriptPath}" "${req.file.path}" "${outputPath}" ${outputWidth} ${outputHeight} ${patchSize} ${overlap}`;
        
        exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
            if (error) {
                console.error("❌ Quilting failed:", error.message);
                return res.status(500).json({ 
                    success: false, 
                    message: "Image processing failed",
                    error: stderr || error.message 
                });
            }

            if (!fs.existsSync(outputPath)) {
                return res.status(500).json({ 
                    success: false, 
                    message: "Output file not generated" 
                });
            }

            tempSessions.set(sessionId, {
                inputPath: req.file.path,
                outputPath,
                parameters: { outputWidth, outputHeight, patchSize, overlap }
            });

            res.json({
                success: true,
                previewUrl: `/temp_outputs/${outputFilename}`,
                sessionId
            });
        });
    } catch (error) {
        console.error("❌ Preview error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Internal server error"
        });
    }
});

app.post("/api/quilting/save", authenticate, async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!tempSessions.has(sessionId)) {
            return res.status(404).json({ success: false, message: "Session expired or invalid" });
        }

        const session = tempSessions.get(sessionId);
        const outputDir = path.join(__dirname, "public", "images");
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

        const finalFilename = `quilted_${Date.now()}.jpg`;
        const finalOutputPath = path.join(outputDir, finalFilename);
        
        fs.renameSync(session.outputPath, finalOutputPath);

        const quiltingResult = new QuiltingResult({
            userId: req.user._id,
            inputImagePath: session.inputPath,
            outputImagePath: finalOutputPath,
            parameters: session.parameters
        });

        await quiltingResult.save();
        tempSessions.delete(sessionId);

        res.json({
            success: true,
            message: "Quilting result saved successfully!",
            outputImage: `/images/${finalFilename}`
        });
    } catch (error) {
        console.error("❌ Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.get("/api/quilting/history", authenticate, async (req, res) => {
    try {
        const results = await QuiltingResult.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .select('parameters createdAt outputImagePath');

        res.json({ success: true, results });
    } catch (error) {
        console.error("❌ Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Texture Transfer Endpoint
app.post('/api/texture-transfer', upload.fields([
    { name: 'texture', maxCount: 1 },
    { name: 'target', maxCount: 1 }
]), async (req, res) => {
    try {
        const texturePath = req.files.texture[0].path;
        const targetPath = req.files.target[0].path;
        const outputDir = path.join(__dirname, 'temp_outputs');
        
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputPath = path.join(outputDir, `transfer_${Date.now()}.jpg`);
        const patchSize = parseInt(req.body.patchSize) || 30;
        const overlap = parseInt(req.body.overlap) || 10;
        const iterations = parseInt(req.body.iterations) || 3;

        const scriptPath = path.join(__dirname, 'scripts', 'texture-transfer.py');
        const cmd = `python3 "${scriptPath}" "${texturePath}" "${targetPath}" "${outputPath}" ${patchSize} ${overlap} ${iterations}`;
        
        const { stdout, stderr } = await new Promise((resolve, reject) => {
            exec(cmd, { timeout: 60000 }, (error, stdout, stderr) => {
                if (error) reject(new Error(`Python script failed: ${stderr || error.message}`));
                resolve({ stdout, stderr });
            });
        });

        if (!fs.existsSync(outputPath)) {
            throw new Error(`Output file not created at ${outputPath}`);
        }

        res.sendFile(outputPath, {}, (err) => {
            [texturePath, targetPath, outputPath].forEach(file => {
                try { if (fs.existsSync(file)) fs.unlinkSync(file); } 
                catch (e) { console.error('Cleanup error:', e); }
            });
        });

    } catch (error) {
        console.error('Texture transfer failed:', error);
        if (req.files) {
            Object.values(req.files).forEach(files => {
                files.forEach(file => {
                    try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); }
                    catch (e) { console.error('Cleanup error:', e); }
                });
            });
        }

        res.status(500).json({ 
            success: false,
            error: 'Texture transfer failed',
            details: error.message
        });
    }
});

// Static file serving
app.use("/temp_outputs", express.static(path.join(__dirname, "temp_outputs")));
app.use("/images", express.static(path.join(__dirname, "public", "images")));

// Cleanup temp files on startup
function cleanupTempFiles() {
    const tempDir = path.join(__dirname, "temp_outputs");
    if (fs.existsSync(tempDir)) {
        fs.readdirSync(tempDir).forEach(file => {
            try {
                fs.unlinkSync(path.join(tempDir, file));
            } catch (err) {
                console.error("Error cleaning up file:", file, err);
            }
        });
    }
}

// Start server
const PORT = 5001;
app.listen(PORT, () => {
    cleanupTempFiles();
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});