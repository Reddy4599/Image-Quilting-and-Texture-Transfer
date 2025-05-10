// DOM Elements
const logoutBtn = document.getElementById("logoutBtn");
const tryQuiltingBtn = document.getElementById("tryQuiltingBtn");
const tryTextureTransferBtn = document.getElementById("tryTextureTransferBtn");
const artbotButton = document.getElementById("artbotButton");
const closeChatbot = document.getElementById("closeChatbot");
const sendMessageBtn = document.getElementById("sendMessage");
const userMessageInput = document.getElementById("userMessage");
const chatbotMessages = document.getElementById("chatbotMessages");

// Event Listeners
logoutBtn?.addEventListener("click", handleLogout);
tryQuiltingBtn?.addEventListener("click", () => navigateTo("quilting.html"));
tryTextureTransferBtn?.addEventListener("click", () => navigateTo("texture-transfer.html"));
artbotButton?.addEventListener("click", toggleChatbot);
closeChatbot?.addEventListener("click", () => document.getElementById("artbotPopup").classList.add('hidden'));
sendMessageBtn?.addEventListener("click", sendMessage);
userMessageInput?.addEventListener("keypress", (e) => e.key === 'Enter' && sendMessage());

// Configuration
const ARTBOT_CONFIG = {
    systemPrompt: `You're ArtBot, a creative AI assistant specializing in:
- Image generation and manipulation
- Art style analysis
- Design feedback
- Color theory advice
- Visual creativity enhancement`,

    fallbackResponse: "I'm having some technical difficulties. You can try:\n- Asking for image generation\n- Getting design feedback\n- Requesting art style analysis",

    endpoints: {
        text: "/api/artbot/chat",
        image: "/api/artbot/image"
    },

    imageKeywords: [
        'draw', 'generate image', 'create image', 'make image', 'design image',
        'picture', 'artwork', 'illustration', 'photo', 'drawing', 'painting'
    ]
};

// Helper Functions
function handleLogout() {
    localStorage.removeItem("token");
    navigateTo("index.html");
}

function navigateTo(url) {
    window.location.href = url;
}

function toggleChatbot() {
    const popup = document.getElementById('artbotPopup');
    popup.classList.toggle('hidden');
    if (!popup.classList.contains('hidden')) {
        userMessageInput.focus();
    }
}

function isImagePrompt(message) {
    const lowerMessage = message.toLowerCase();
    return ARTBOT_CONFIG.imageKeywords.some(keyword => lowerMessage.includes(keyword));
}

// Chatbot Functions
async function generateBotResponse(userMessage) {
    try {
        const isImage = isImagePrompt(userMessage);
        const loadingMessage = isImage ? 
            "🎨 Generating your artwork..." : 
            "🤔 Processing your request...";

        showTypingIndicator(loadingMessage);

        const response = await fetch('/api/artbot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: userMessage,
                modelEndpoint: isImage ? ARTBOT_CONFIG.endpoints.image : ARTBOT_CONFIG.endpoints.text
            })
        });

        const text = await response.text(); // 👈 show raw error
        console.log('🔍 Raw Response Text:', text);

        const data = await parseResponse(response);

        if (!response.ok) {
            throw new Error(data?.error || 'Request failed');
        }

        if (!data.success) {
            throw new Error(data?.error || 'Request unsuccessful');
        }

        return formatResponse(data);

    } catch (error) {
        console.error('ArtBot Error:', error);
        return handleError(error);
    } finally {
        removeTypingIndicator();
    }
}

async function parseResponse(response) {
    try {
        return await response.json();
    } catch (error) {
        const text = await response.text();
        throw new Error(text || 'Invalid response format');
    }
}

function formatResponse(data) {
    if (data.imageUrl) {
        return {
            type: 'image',
            content: `🎨 Here's your generated artwork:<br><img src="${data.imageUrl}" alt="Generated Art" class="generated-image">`,
            metadata: data.metadata
        };
    }
    return {
        type: 'text',
        content: data.response || ARTBOT_CONFIG.fallbackResponse,
        metadata: data.metadata
    };
}

function handleError(error) {
    const message = error.message.toLowerCase();
    if (message.includes('rate limit')) return "🚦 Too many requests. Please wait a minute before trying again.";
    if (message.includes('unavailable')) return "🔧 Service is temporarily unavailable. Please try again later.";
    if (message.includes('authentication')) return "🔑 Authentication issue. Our team has been notified.";
    return "😕 I'm having trouble processing your request. Please try again.";
}

async function sendMessage() {
    const message = userMessageInput.value.trim();
    if (!message) return;

    disableInputs();
    addMessage(message, 'user');
    userMessageInput.value = '';

    try {
        const response = await generateBotResponse(message);
        addMessage(response.content, 'bot', response.type);
    } catch (error) {
        addMessage(handleError(error), 'bot');
    } finally {
        enableInputs();
    }
}

// UI Functions
function showTypingIndicator(message) {
    const indicator = document.createElement('div');
    indicator.id = 'typingIndicator';
    indicator.className = 'message bot-message';
    indicator.innerHTML = `
        <div class="typing-content">
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
            <div class="typing-text">${message}</div>
        </div>
    `;
    chatbotMessages.appendChild(indicator);
    scrollToBottom();
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.remove();
    }
}

function addMessage(content, sender, type = 'text') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message ${type}-message`;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    messageDiv.innerHTML = `
        <div class="message-content">${type === 'image' ? content : formatTextResponse(content)}</div>
        <div class="message-timestamp">${timestamp}</div>
    `;

    chatbotMessages.appendChild(messageDiv);
    scrollToBottom();
    setTimeout(() => messageDiv.style.opacity = '1', 100);
}

function formatTextResponse(text) {
    return text
        .replace(/### (.*?)\n/g, '<h3>$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>')
        .replace(/(http[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
}

function scrollToBottom() {
    chatbotMessages.scrollTo({ top: chatbotMessages.scrollHeight, behavior: 'smooth' });
}

function disableInputs() {
    userMessageInput.disabled = true;
    sendMessageBtn.disabled = true;
}

function enableInputs() {
    userMessageInput.disabled = false;
    sendMessageBtn.disabled = false;
    userMessageInput.focus();
}

// Initialize Chatbot
window.addEventListener('DOMContentLoaded', () => {
    if (chatbotMessages) {
        addMessage(
            "👋 Hello! I'm ArtBot, your creative assistant. I can help with:\n" +
            "• Image generation\n• Design feedback\n• Art style analysis\n" +
            "• Color theory\n• Composition advice\n\n" +
            "What would you like to create today?",
            'bot'
        );
    }
});
