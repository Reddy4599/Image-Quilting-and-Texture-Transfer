document.addEventListener('DOMContentLoaded', function () {
    const getElement = (id) => document.getElementById(id) || null;

    const elements = {
        textureInput: getElement('textureImage'),
        targetInput: getElement('targetImage'),
        texturePreview: getElement('texturePreview'),
        targetPreview: getElement('targetPreview'),
        resultContainer: getElement('resultContainer'),
        resultImage: getElement('resultImage'),
        transferBtn: getElement('transferBtn'),
        downloadBtn: getElement('downloadBtn'),
        patchSizeSlider: getElement('patchSize'),
        overlapSlider: getElement('overlap'),
        iterationsSlider: getElement('iterations'),
        errorDisplay: getElement('errorDisplay'),
        loadingIndicator: getElement('loadingIndicator'),
        backBtn: getElement('backBtn')
    };

    let resultData = null;
    let textureObjectUrl = null;
    let targetObjectUrl = null;

    function init() {
        const requiredElements = ['textureImage', 'targetImage', 'transferBtn'];
        const missing = requiredElements.filter(id => !document.getElementById(id));
        if (missing.length) {
            console.error('Missing required elements:', missing);
            showError('Page configuration error', 'Some required components are missing');
            return;
        }
        updateSliderValues();
        setupEventListeners();
        disableButtons();
    }

    function setupEventListeners() {
        elements.textureInput?.addEventListener('change', handleImageUpload);
        elements.targetInput?.addEventListener('change', handleImageUpload);
        elements.patchSizeSlider?.addEventListener('input', updateSliderValues);
        elements.overlapSlider?.addEventListener('input', updateSliderValues);
        elements.iterationsSlider?.addEventListener('input', updateSliderValues);
        elements.transferBtn?.addEventListener('click', processTextureTransfer);
        elements.downloadBtn?.addEventListener('click', downloadResult);
        elements.backBtn?.addEventListener('click', () => {
            window.location.href = '/dashboard.html';
        });
    }

    function updateSliderValues() {
        const patchSizeValue = getElement('patchSizeValue');
        const overlapValue = getElement('overlapValue');
        const iterationsValue = getElement('iterationsValue');

        if (patchSizeValue && elements.patchSizeSlider)
            patchSizeValue.textContent = elements.patchSizeSlider.value;
        if (overlapValue && elements.overlapSlider)
            overlapValue.textContent = elements.overlapSlider.value;
        if (iterationsValue && elements.iterationsSlider)
            iterationsValue.textContent = elements.iterationsSlider.value;

        if (elements.patchSizeSlider && elements.overlapSlider) {
            elements.overlapSlider.max = Math.min(
                parseInt(elements.patchSizeSlider.value) - 1,
                50
            );
        }
    }

    function handleImageUpload(e) {
        const file = e.target.files[0];
        const isTexture = e.target.id === 'textureImage';
        const preview = isTexture ? elements.texturePreview : elements.targetPreview;

        if (file && preview) {
            if (isTexture && textureObjectUrl) URL.revokeObjectURL(textureObjectUrl);
            if (!isTexture && targetObjectUrl) URL.revokeObjectURL(targetObjectUrl);

            const url = URL.createObjectURL(file);
            isTexture ? (textureObjectUrl = url) : (targetObjectUrl = url);
            preview.innerHTML = `<img src="${url}" alt="Preview">`;
        }

        checkReadyState();
    }

    function checkReadyState() {
        if (elements.transferBtn && elements.textureInput && elements.targetInput) {
            elements.transferBtn.disabled = !(
                elements.textureInput.files.length > 0 &&
                elements.targetInput.files.length > 0
            );
        }
    }

    function disableButtons() {
        if (elements.transferBtn) elements.transferBtn.disabled = true;
        if (elements.downloadBtn) elements.downloadBtn.disabled = true;
    }

    function showLoading(show) {
        if (elements.loadingIndicator)
            elements.loadingIndicator.style.display = show ? 'flex' : 'none';
        if (elements.transferBtn)
            elements.transferBtn.disabled = show;
    }

    function showError(message, details = '') {
        if (elements.errorDisplay) {
            elements.errorDisplay.innerHTML = `
                <div class="error-message">
                    <strong>${message}</strong>
                    ${details ? `<p class="error-detail">${details}</p>` : ''}
                </div>`;
            elements.errorDisplay.style.display = 'block';
            setTimeout(() => {
                elements.errorDisplay.style.display = 'none';
            }, 8000);
        }
    }

    function displayResult(imageUrl) {
        resultData = { imageUrl };
        if (elements.resultImage) {
            elements.resultImage.src = imageUrl;
            elements.resultImage.style.display = 'block';
            elements.resultImage.onload = () => {
                if (elements.resultContainer) {
                    elements.resultContainer.style.display = 'block';
                }
                if (elements.downloadBtn) {
                    elements.downloadBtn.disabled = false;
                }
            };
            elements.resultImage.onerror = () => {
                showError("Failed to load result image");
            };
        }
    }

    async function processTextureTransfer() {
        if (!elements.textureInput?.files.length || !elements.targetInput?.files.length) {
            showError("Please select both texture and target images");
            return;
        }

        try {
            showLoading(true);
            if (elements.resultContainer) elements.resultContainer.style.display = 'none';

            const formData = new FormData();
            formData.append('texture', elements.textureInput.files[0]);
            formData.append('target', elements.targetInput.files[0]);
            formData.append('patchSize', elements.patchSizeSlider?.value || 30);
            formData.append('overlap', elements.overlapSlider?.value || 10);
            formData.append('iterations', elements.iterationsSlider?.value || 3);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 300000);

            const response = await fetch('/api/texture-transfer', {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const contentType = response.headers.get('content-type');
            if (contentType?.startsWith('image/')) {
                const blob = await response.blob();
                displayResult(URL.createObjectURL(blob));
                return;
            }

            if (!contentType?.includes('application/json')) {
                throw new Error(`Unexpected response type: ${contentType}`);
            }

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || "Texture transfer failed");
            }

            if (data.imageUrl) {
                const base = window.location.origin;
                const absoluteUrl = data.imageUrl.startsWith('/') ? base + data.imageUrl : data.imageUrl;
                console.log("🖼️ Final image preview URL:", absoluteUrl);
                displayResult(absoluteUrl + '?t=' + Date.now());
            } else if (data.imageData) {
                displayResult(`data:image/jpeg;base64,${data.imageData}`);
            } else {
                throw new Error("Server didn't return any image data");
            }

        } catch (error) {
            console.error('Texture transfer error:', error);
            let msg = error.name === 'AbortError'
                ? "Texture transfer timed out (5 minutes)"
                : error.message;
            showError("Texture transfer failed", msg);

            if (elements.resultContainer) {
                elements.resultContainer.innerHTML = `
                    <div class="error-state">
                        <p>❌ Texture transfer failed</p>
                        <p class="error-detail">${msg}</p>
                        <button class="retry-btn">Try Again</button>
                    </div>`;
                const retryBtn = elements.resultContainer.querySelector('.retry-btn');
                retryBtn?.addEventListener('click', processTextureTransfer);
            }
        } finally {
            showLoading(false);
        }
    }

    function downloadResult() {
        if (!resultData?.imageUrl) return;
        const link = document.createElement('a');
        link.href = resultData.imageUrl;
        link.download = `texture-transfer-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    window.addEventListener('beforeunload', () => {
        if (textureObjectUrl) URL.revokeObjectURL(textureObjectUrl);
        if (targetObjectUrl) URL.revokeObjectURL(targetObjectUrl);
        if (resultData?.imageUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(resultData.imageUrl);
        }
    });

    init();
});