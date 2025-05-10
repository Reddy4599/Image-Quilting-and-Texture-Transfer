document.addEventListener('DOMContentLoaded', function () {
    // === Configuration ===
    const BASE_URL = 'http://localhost:5001';  // CHANGE THIS if backend runs elsewhere

    // === DOM Elements ===
    const elements = {
        form: document.getElementById('quiltingForm'),
        previewSection: document.getElementById('previewSection'),
        previewImage: document.getElementById('previewImage'),
        startBtn: document.getElementById('startQuilting'),
        saveBtn: document.getElementById('saveBtn'),
        downloadBtn: document.getElementById('downloadBtn'),
        newQuiltBtn: document.getElementById('newQuiltBtn'),
        backBtn: document.getElementById('backBtn'),
        errorDisplay: document.getElementById('errorDisplay')
    };

    let currentSessionId = null;
    let currentImageUrl = null;
    let currentParameters = null;

    // === Utility Functions ===
    const utils = {
        showError: (message, isSuccess = false) => {
            if (elements.errorDisplay) {
                elements.errorDisplay.textContent = message;
                elements.errorDisplay.style.color = isSuccess ? 'green' : 'red';
                elements.errorDisplay.style.display = 'block';
                setTimeout(() => {
                    elements.errorDisplay.style.display = 'none';
                    elements.errorDisplay.style.color = 'red'; // reset
                }, 5000);
            } else {
                alert(message);
            }
        },

        validateImageUrl: (url) => {
            if (!url || typeof url !== 'string') {
                return { valid: false, error: 'No image URL provided' };
            }

            if (url.startsWith('/')) {
                return {
                    valid: true,
                    url: new URL(url, BASE_URL).toString(),
                    isRelative: true
                };
            }

            try {
                new URL(url);
                return { valid: true, url, isRelative: false };
            } catch {
                return { valid: false, error: 'Invalid image URL format' };
            }
        },

        resetPreview: () => {
            elements.previewSection.style.display = 'none';
            elements.previewImage.src = '';
            currentSessionId = null;
            currentImageUrl = null;
            currentParameters = null;
        },

        loadImage: (url) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = url;
                setTimeout(() => {
                    if (!img.complete) reject(new Error('Image loading timed out'));
                }, 30000);
            });
        },

        checkAuth: () => {
            const token = localStorage.getItem('token');
            if (!token) {
                utils.showError('Session expired. Please log in again.');
                setTimeout(() => {
                    window.location.href = '/index.html?session_expired=true';
                }, 1500);
                return false;
            }
            return true;
        },

        handleAuthResponse: async (response) => {
            const renewedToken = response.headers.get('X-Renewed-Token');
            if (renewedToken) {
                localStorage.setItem('token', renewedToken);
            }

            if (response.status === 401) {
                localStorage.removeItem('token');
                utils.showError('Session expired. Please log in again.');
                setTimeout(() => {
                    window.location.href = '/index.html?session_expired=true';
                }, 1500);
                return false;
            }
            return true;
        }
    };

    // === Event Handlers ===
    const handlers = {
        handleBack: () => {
            window.location.href = '/dashboard.html';
        },

        handleFormSubmit: async (event) => {
            event.preventDefault();

            elements.startBtn.disabled = true;
            elements.startBtn.innerHTML = '<span class="spinner"></span> Processing...';
            utils.resetPreview();

            try {
                const formData = new FormData(elements.form);
                const imageFile = formData.get('image');

                if (!imageFile || imageFile.size === 0) {
                    throw new Error('Please select an image file');
                }

                const response = await fetch('http://localhost:5001/api/quilting/preview', {
                    method: 'POST',
                    body: formData
                });


                const data = await response.json();

                if (!response.ok || !data?.success) {
                    const errorMsg = data?.message || `Server error (${response.status})`;
                    throw new Error(errorMsg);
                }

                const validation = utils.validateImageUrl(data.previewUrl);
                if (!validation.valid) {
                    throw new Error(validation.error || 'Invalid image data received');
                }

                if (!data.sessionId) {
                    throw new Error('Missing session ID in server response');
                }

                currentSessionId = data.sessionId;
                currentParameters = data.parameters || {};
                currentImageUrl = validation.url;

                try {
                    await utils.loadImage(currentImageUrl);
                    elements.previewImage.src = currentImageUrl;
                    elements.previewSection.style.display = 'block';
                    elements.previewSection.scrollIntoView({ behavior: 'smooth' });

                    utils.showError('Preview generated successfully!', true);
                } catch (imgError) {
                    throw new Error('Failed to display the generated image');
                }

            } catch (error) {
                let userMessage = error.message;
                if (userMessage.includes('invalid image data') || userMessage.includes('Invalid image URL')) {
                    userMessage = "The server returned an invalid image. Please try again.";
                } else if (userMessage.includes('Failed to display')) {
                    userMessage = "Couldn't display the generated image. Please try again.";
                }

                utils.showError(userMessage);
                utils.resetPreview();
            } finally {
                elements.startBtn.disabled = false;
                elements.startBtn.textContent = "Generate Preview";
            }
        },

        handleSave: async () => {
            if (!currentImageUrl) {
                utils.showError("Please generate a preview first");
                return;
            }

            if (!utils.checkAuth()) return;

            elements.saveBtn.disabled = true;
            elements.saveBtn.textContent = "Saving...";

            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${BASE_URL}/api/quilting/save`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        sessionId: currentSessionId,
                        parameters: currentParameters
                    })
                });

                if (!await utils.handleAuthResponse(response)) return;

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || `Save failed (${response.status})`);
                }

                const data = await response.json();

                if (!data?.success) {
                    throw new Error(data?.message || "Save operation failed");
                }

                if (data.imageUrl) {
                    const validation = utils.validateImageUrl(data.imageUrl);
                    if (validation.valid) {
                        currentImageUrl = validation.url;
                        elements.previewImage.src = currentImageUrl;
                    }
                }

                utils.showError('Image saved successfully!', true);

            } catch (error) {
                utils.showError(error.message);
            } finally {
                elements.saveBtn.disabled = false;
                elements.saveBtn.textContent = "Save to Account";
            }
        },

        handleDownload: () => {
            if (!currentImageUrl) {
                utils.showError("No image to download");
                return;
            }

            try {
                const link = document.createElement('a');
                link.href = currentImageUrl;
                link.download = `quilted-art-${new Date().toISOString().slice(0, 10)}.jpg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (error) {
                utils.showError('Download failed. Please try again.');
            }
        },

        handleNewQuilt: () => {
            utils.resetPreview();
            elements.form.reset();
        }
    };

    // === Attach Event Listeners ===
    elements.backBtn?.addEventListener('click', handlers.handleBack);
    elements.form?.addEventListener('submit', handlers.handleFormSubmit);
    elements.saveBtn?.addEventListener('click', handlers.handleSave);
    elements.downloadBtn?.addEventListener('click', handlers.handleDownload);
    elements.newQuiltBtn?.addEventListener('click', handlers.handleNewQuilt);

    // === Init Check ===
    if (!elements.form || !elements.previewSection || !elements.previewImage) {
        console.error('Critical elements missing');
        utils.showError('Page loading failed. Please refresh.');
    } else {
        utils.showError('Ready to create your quilted masterpiece! Upload an image to begin.', true);
    }
});
