const express = require('express');
const router = express.Router();
const { makeHuggingFaceRequest, formatBotResponse } = require('../utils/artbot');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');

// Enhanced rate limiting using express-rate-limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    const waitTime = Math.ceil(15 * 60);
    return res.status(429).json({
      success: false,
      error: `Too many requests. Please wait ${waitTime} seconds before trying again.`,
      retryAfter: waitTime
    });
  }
});

// Input validation middleware
const validateInputs = [
  body('message').trim().notEmpty().withMessage('Message is required')
    .isLength({ max: 500 }).withMessage('Message must be less than 500 characters')
    .customSanitizer(value => sanitizeHtml(value)),
  body('modelEndpoint').trim().notEmpty().withMessage('Model endpoint is required')
    .isIn([
      'stable-diffusion-v1-5',
      'stable-diffusion-2-1',
      'text-to-image',
      // Add other supported endpoints here
    ]).withMessage('Invalid model endpoint')
];

// Model endpoint configuration
const MODEL_CONFIG = {
  'stable-diffusion-v1-5': {
    isImage: true,
    maxPromptLength: 500
  },
  'stable-diffusion-2-1': {
    isImage: true,
    maxPromptLength: 500
  },
  'text-to-image': {
    isImage: true,
    maxPromptLength: 500
  }
  // Add other model configurations
};

router.post('/chat', apiLimiter, validateInputs, async (req, res) => {
  try {
    // Validate inputs using express-validator
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
        message: 'Validation failed'
      });
    }

    const { message, modelEndpoint } = req.body;
    const HF_API_KEY = process.env.HUGGING_FACE_API_KEY;

    if (!HF_API_KEY) {
      console.error('Hugging Face API key not configured');
      return res.status(500).json({
        success: false,
        error: "Server configuration error",
        code: 'SERVER_CONFIG_ERROR'
      });
    }

    // Check model configuration
    const modelConfig = MODEL_CONFIG[modelEndpoint];
    if (!modelConfig) {
      return res.status(400).json({
        success: false,
        error: "Unsupported model endpoint",
        code: 'UNSUPPORTED_MODEL'
      });
    }

    // Process request
    const { type, data, metadata } = await makeHuggingFaceRequest(
      modelEndpoint,
      message,
      HF_API_KEY,
      modelConfig.isImage
    );

    // Format response
    if (type === 'image') {
      return res.json({
        success: true,
        type: 'image',
        imageUrl: `data:image/jpeg;base64,${data.toString('base64')}`,
        response: "Image generated successfully",
        metadata: metadata || null
      });
    } else {
      const responseText = Array.isArray(data) 
        ? data[0].generated_text 
        : data.generated_text;
      
      return res.json({
        success: true,
        type: 'text',
        response: formatBotResponse(responseText),
        metadata: metadata || null
      });
    }

  } catch (error) {
    console.error('ArtBot Error:', error);
    
    // Enhanced error handling
    let statusCode = 500;
    let errorMessage = "An error occurred";
    let errorCode = 'INTERNAL_SERVER_ERROR';
    
    if (error.response) {
      // Handle Hugging Face API errors
      statusCode = error.response.status;
      errorMessage = error.response.data?.error || error.response.statusText;
      errorCode = 'HF_API_ERROR';
      
      if (statusCode === 429) {
        errorMessage = "Too many requests to the AI service. Please try again later.";
        errorCode = 'HF_RATE_LIMIT';
      }
    } else if (error.message.includes('unauthorized')) {
      statusCode = 401;
      errorMessage = "API authentication failed";
      errorCode = 'AUTH_FAILED';
    } else if (error.message.includes('Failed to fetch')) {
      statusCode = 503;
      errorMessage = "AI service currently unavailable";
      errorCode = 'SERVICE_UNAVAILABLE';
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      code: errorCode,
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

module.exports = router;