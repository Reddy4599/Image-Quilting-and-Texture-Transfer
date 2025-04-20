document.getElementById("logoutBtn").addEventListener("click", function() {
    localStorage.removeItem("token");
    window.location.href = "/index.html";
});

document.getElementById("tryQuiltingBtn").addEventListener("click", function() {
    window.location.href = "/quilting.html";
});

document.getElementById("tryTextureTransferBtn").addEventListener("click", function() {
    window.location.href = "/texture-transfer.html";
});

// Chatbot Toggle
document.getElementById('artbotButton').addEventListener('click', function() {
    const popup = document.getElementById('artbotPopup');
    popup.style.display = popup.style.display === 'flex' ? 'none' : 'flex';
});

document.getElementById('closeChatbot').addEventListener('click', function() {
    document.getElementById('artbotPopup').style.display = 'none';
});

// Send Message Functionality
document.getElementById('sendMessage').addEventListener('click', sendMessage);
document.getElementById('userMessage').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') sendMessage();
});

// Configuration
const ARTBOT_CONFIG = {
    systemPrompt: `You're ArtBot, a creative AI assistant powered by Hugging Face, specializing in:
- Image generation and manipulation
- Art style analysis and recommendations
- Design feedback and suggestions
- Color theory and composition advice
- Visual creativity enhancement

Provide creative, practical advice and generate images when requested.`,
    fallbackResponse: "I apologize, but I'm having trouble processing that request. You can try:\n- Asking for image generation\n- Getting design feedback\n- Requesting art style analysis\n- Discussing color theory",
    modelEndpoint: "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0"
};

// Helper function to detect if a message is requesting image generation
function isImagePrompt(message) {
    const imageGenerationKeywords = [
        'draw', 'generate image', 'create image', 'make image', 'design image',
        'create a picture', 'draw me', 'generate artwork', 'create art',
        'create an illustration', 'generate a photo', 'make a drawing'
    ];
    
    const lowerMessage = message.toLowerCase();
    return imageGenerationKeywords.some(keyword => lowerMessage.includes(keyword));
}

// Main AI response generator
async function generateBotResponse(userMessage) {
    try {
        // Show loading state in UI
        const loadingMessage = isImagePrompt(userMessage) ? 
            "🎨 Generating your artwork (this may take a few seconds)..." :
            "🤔 Thinking...";
        
        // Select the appropriate model endpoint based on the message type
        const modelEndpoint = isImagePrompt(userMessage)
            ? "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0"
            : "https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill";
        
        const response = await fetch('/api/artbot/chat', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                message: userMessage,
                modelEndpoint: modelEndpoint
            })
        });

        // First try to get the response as JSON
        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            console.error('JSON parsing error:', jsonError);
            const textResponse = await response.text();
            throw new Error(`Invalid server response format. Please try again.`);
        }

        if (!response.ok) {
            console.error('Response not OK:', data);
            if (response.status === 429) {
                throw new Error("🚫 Rate limit reached. Please wait a minute before trying again.");
            }
            if (response.status === 503) {
                throw new Error("🔧 Hugging Face service is temporarily unavailable. Please try again later.");
            }
            
            const errorMessage = data?.error || 'Unknown server error';
            if (errorMessage.includes("authentication")) {
                throw new Error("🔑 Service is temporarily unavailable. Our team has been notified.");
            }

            // Log the full error for debugging
            console.error('Hugging Face API Error:', errorMessage);
            throw new Error("😕 I'm having trouble processing your request. Please try again in a moment.");
        }

        if (!data.success) {
            console.error('Request not successful:', data);
            if (data.error?.includes("API key not configured")) {
                throw new Error("⚠️ Service configuration issue. Please try again later.");
            }
            if (data.error?.includes("authentication")) {
                throw new Error("🔑 Service is temporarily unavailable. Our team has been notified.");
            }
            throw new Error("🤔 I couldn't process that request. Please try rephrasing or try again later.");
        }

        // Handle both text responses and image generation
        if (data.imageUrl) {
            return `🎨 Here's your generated artwork:\n<img src="${data.imageUrl}" alt="Generated Art" class="generated-image">\n\n${data.response || ''}`;
        }

        return data.response || ARTBOT_CONFIG.fallbackResponse;

    } catch (error) {
        console.error('Hugging Face Chat Error:', error);
        // Return a user-friendly error message
        return `❌ ${error.message || "Something unexpected happened. Please try again later."}`;
    }
}

// Format AI responses with enhanced styling
function formatDesignResponse(text) {
    return text
        .replace(/### (.*?)\n/g, '<strong>$1</strong>\n')
        .replace(/- (.*?)\n/g, '• $1\n')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/<img.*?>/g, (match) => `<div class="generated-art-container">${match}</div>`);
}

// Enhanced sendMessage with typing indicator
async function sendMessage() {
    const input = document.getElementById('userMessage');
    const message = input.value.trim();
    if (!message) return;

    addMessage(message, 'user');
    input.value = '';
    
    // Show typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.id = 'typingIndicator';
    typingIndicator.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    document.getElementById('chatbotMessages').appendChild(typingIndicator);
    
    try {
        const response = await generateBotResponse(message);
        document.getElementById('chatbotMessages').removeChild(typingIndicator);
        addMessage(response, 'bot');
    } catch (error) {
        document.getElementById('chatbotMessages').removeChild(typingIndicator);
        addMessage("⚠️ Design resources unavailable. Try again later.", 'bot');
    }
}

function addMessage(text, sender) {
    const messagesDiv = document.getElementById('chatbotMessages');
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${sender}-message`);
    
    // Format the response if it's from the bot
    if (sender === 'bot') {
        text = formatDesignResponse(text);
    }
    
    messageDiv.innerHTML = text;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    // Handle any generated images
    const images = messageDiv.getElementsByTagName('img');
    for (const img of images) {
        img.addEventListener('load', () => {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        });
    }
}

// API test function
async function testHuggingFace() {
    const testPrompt = "Hi, are you available?";
    try {
        const response = await fetch('/api/artbot/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: testPrompt,
                modelEndpoint: "https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill"
            })
        });

        const data = await response.json();
        
        if (!data.success) {
            if (data.error && data.error.includes("authentication")) {
                console.error("Hugging Face API Authentication Error: Please check your API key configuration");
                addMessage("⚠️ I'm currently experiencing some technical difficulties. The service will be back soon!", 'bot');
            } else {
                throw new Error(data.error || 'Unknown error occurred');
            }
            return;
        }

        console.log("Hugging Face API Test Response:", data);
        
    } catch (error) {
        console.error("API Test Failed:", error);
        addMessage("👋 Hello! I'm having trouble connecting to my services right now. Please try again in a few minutes.", 'bot');
    }
}

// Test the API connection during development
testHuggingFace();