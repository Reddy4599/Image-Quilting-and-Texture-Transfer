const fetch = require('node-fetch');

// Configuration
const API_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_RETRY_DELAY: 1000,
  MAX_RETRY_DELAY: 10000,
  RATE_LIMIT_WAIT: 60000
};

// Model Endpoints
const MODEL_ENDPOINTS = {
  TEXT: 'https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill',
  IMAGE: 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0'
};

// Helper functions
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function exponentialBackoff(attempt) {
  const jitter = Math.random() * 500;
  const delayTime = Math.min(
    API_CONFIG.INITIAL_RETRY_DELAY * Math.pow(2, attempt) + jitter,
    API_CONFIG.MAX_RETRY_DELAY
  );
  await delay(delayTime);
}

// Enhanced prompt engineering
function enhancePrompt(prompt, isImage = false) {
  if (isImage) {
    return `${prompt}, ultra-detailed, professional digital art, 4k render, cinematic lighting`;
  }
  return `${prompt}. Please provide a clear, helpful, and creative response.`;
}

// Main request handler
async function makeHuggingFaceRequest(prompt, isImageGeneration = false) {
  const apiKey = process.env.HUGGING_FACE_API_KEY;
  if (!apiKey) throw new Error('API key is required');

  const endpoint = isImageGeneration ? MODEL_ENDPOINTS.IMAGE : MODEL_ENDPOINTS.TEXT;
  const enhancedPrompt = enhancePrompt(prompt, isImageGeneration);

  const requestOptions = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Wait-For-Model': 'true'
    },
    body: JSON.stringify({
      inputs: enhancedPrompt,
      parameters: isImageGeneration ? {
        num_inference_steps: 30,
        guidance_scale: 7.5,
        negative_prompt: "blurry, low quality, distorted, bad anatomy, extra limbs",
        height: 512,
        width: 512
      } : {
        max_new_tokens: 200,
        temperature: 0.7,
        top_p: 0.9,
        repetition_penalty: 1.05
      }
    })
  };

  let lastError;
  let attempt = 0;

  while (attempt < API_CONFIG.MAX_RETRIES) {
    try {
      const response = await fetch(endpoint, requestOptions);

      if (response.status === 503) {
        const json = await response.json();
        if (json.estimated_time) {
          await delay(json.estimated_time * 1000);
          continue;
        }
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || API_CONFIG.RATE_LIMIT_WAIT;
        await delay(parseInt(retryAfter));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${errorText}`);
      }

      return {
        type: isImageGeneration ? 'image' : 'text',
        data: isImageGeneration ? await response.buffer() : await response.json()
      };

    } catch (error) {
      lastError = error;
      attempt++;
      if ([400, 401, 403, 404].includes(error.status)) break;
      if (attempt < API_CONFIG.MAX_RETRIES) {
        await exponentialBackoff(attempt);
      }
    }
  }

  throw lastError || new Error('API request failed after retries');
}

// Specialized Stable Diffusion function
async function generateImageWithStableDiffusion(prompt) {
  try {
    const { data: imageBuffer } = await makeHuggingFaceRequest(prompt, true);
    return imageBuffer;
  } catch (error) {
    console.error('Stable Diffusion Error:', error);
    throw new Error(`Image generation failed: ${error.message}`);
  }
}

// Text formatting
function formatBotResponse(text) {
  if (!text) return '';
  const responseText = Array.isArray(text) 
    ? text[0].generated_text || text[0].text || ''
    : text.generated_text || text.text || text;

  return responseText
    .trim()
    .replace(/\[INST\]|\[\/INST\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^- /gm, '• ')
    .replace(/```([^`]+)```/gs, '<pre><code>$1</code></pre>');
}

module.exports = {
  makeHuggingFaceRequest,
  generateImageWithStableDiffusion,
  formatBotResponse
};
