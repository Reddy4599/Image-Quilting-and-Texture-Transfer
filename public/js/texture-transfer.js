document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const backBtn = document.getElementById('backBtn');
    const textureInput = document.getElementById('textureImage');
    const targetInput = document.getElementById('targetImage');
    const texturePreview = document.getElementById('texturePreview');
    const targetPreview = document.getElementById('targetPreview');
    const resultPreview = document.getElementById('resultPreview');
    const transferBtn = document.getElementById('transferBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const patchSizeSlider = document.getElementById('patchSize');
    const overlapSlider = document.getElementById('overlap');
    const iterationsSlider = document.getElementById('iterations');
    const patchSizeValue = document.getElementById('patchSizeValue');
    const overlapValue = document.getElementById('overlapValue');
    const iterationsValue = document.getElementById('iterationsValue');
    const errorDisplay = document.getElementById('errorDisplay');

    // Verify critical elements exist
    if (!patchSizeSlider || !overlapSlider || !iterationsSlider) {
        console.error('Slider controls not found! Check your HTML elements');
        return;
    }

    // State
    let textureFile = null;
    let targetFile = null;
    let resultImage = null;

    // Initialize slider values
    updateSliderValues();

    // Event Listeners
    backBtn?.addEventListener('click', () => {
        window.location.href = '/dashboard.html';
    });

    textureInput?.addEventListener('change', function(e) {
        if (e.target.files.length) {
            textureFile = e.target.files[0];
            const url = URL.createObjectURL(textureFile);
            if (texturePreview) {
                texturePreview.innerHTML = `<img src="${url}" alt="Texture Preview">`;
            }
            checkReadyState();
        }
    });

    targetInput?.addEventListener('change', function(e) {
        if (e.target.files.length) {
            targetFile = e.target.files[0];
            const url = URL.createObjectURL(targetFile);
            if (targetPreview) {
                targetPreview.innerHTML = `<img src="${url}" alt="Target Preview">`;
            }
            checkReadyState();
        }
    });

    patchSizeSlider.addEventListener('input', updateSliderValues);
    overlapSlider.addEventListener('input', updateSliderValues);
    iterationsSlider.addEventListener('input', updateSliderValues);

    transferBtn?.addEventListener('click', processTextureTransfer);
    downloadBtn?.addEventListener('click', downloadResult);

    // Functions
    function updateSliderValues() {
        if (patchSizeValue) patchSizeValue.textContent = patchSizeSlider.value;
        if (overlapValue) overlapValue.textContent = overlapSlider.value;
        if (iterationsValue) iterationsValue.textContent = iterationsSlider.value;
        
        // Ensure overlap doesn't exceed patch size
        if (overlapSlider && patchSizeSlider) {
            overlapSlider.max = Math.min(parseInt(patchSizeSlider.value) - 1, 50);
        }
    }

    function checkReadyState() {
        if (transferBtn) {
            transferBtn.disabled = !(textureFile && targetFile);
        }
    }

    function showError(message) {
        if (errorDisplay) {
            errorDisplay.textContent = message;
            errorDisplay.style.display = 'block';
            setTimeout(() => {
                errorDisplay.style.display = 'none';
            }, 5000);
        } else {
            console.error('Error:', message);
            alert(message); // Fallback error display
        }
    }

    async function processTextureTransfer() {
        if (!textureFile || !targetFile || !transferBtn || !resultPreview) return;
        
        try {
            // Get current parameter values
            const params = {
                patchSize: parseInt(patchSizeSlider.value),
                overlap: parseInt(overlapSlider.value),
                iterations: parseInt(iterationsSlider.value)
            };

            console.log("Sending parameters:", params);

            transferBtn.disabled = true;
            transferBtn.textContent = 'Processing...';
            resultPreview.innerHTML = '<div class="processing-message">Transferring texture... This may take a moment</div>';
            if (downloadBtn) downloadBtn.disabled = true;
            
            const formData = new FormData();
            formData.append('texture', textureFile);
            formData.append('target', targetFile);
            formData.append('patchSize', params.patchSize);
            formData.append('overlap', params.overlap);
            formData.append('iterations', params.iterations);

            const response = await fetch('/api/texture-transfer', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.details || errorData.error || `Server responded with ${response.status}`);
            }

            const blob = await response.blob();
            resultImage = URL.createObjectURL(blob);
            resultPreview.innerHTML = `<img src="${resultImage}" alt="Texture Transfer Result">`;
            if (downloadBtn) downloadBtn.disabled = false;
            
        } catch (error) {
            console.error('Texture transfer failed:', error);
            showError(`Error: ${error.message}`);
            if (resultPreview) {
                resultPreview.innerHTML = '<div class="error-message">Texture transfer failed. Please try again.</div>';
            }
        } finally {
            if (transferBtn) {
                transferBtn.disabled = false;
                transferBtn.textContent = 'Transfer Texture';
            }
        }
    }

    function downloadResult() {
        if (!resultImage) return;
        
        const link = document.createElement('a');
        link.href = resultImage;
        link.download = `texture-transfer-result-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Initialize
    if (transferBtn) transferBtn.disabled = true;
    if (downloadBtn) downloadBtn.disabled = true;
});

async function processTextureTransfer() {
    if (!textureFile || !targetFile || !transferBtn || !resultPreview) return;
    
    try {
        transferBtn.disabled = true;
        transferBtn.textContent = 'Processing...';
        resultPreview.innerHTML = '<div class="processing-message">Transferring texture... This may take a moment</div>';
        if (downloadBtn) downloadBtn.disabled = true;
        
        const params = {
            patchSize: parseInt(patchSizeSlider.value),
            overlap: parseInt(overlapSlider.value),
            iterations: parseInt(iterationsSlider.value)
        };

        console.log("Sending parameters:", params);

        const formData = new FormData();
        formData.append('texture', textureFile);
        formData.append('target', targetFile);
        formData.append('patchSize', params.patchSize);
        formData.append('overlap', params.overlap);
        formData.append('iterations', params.iterations);

        const response = await fetch('/api/texture-transfer', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            // Try to get detailed error from Python
            const errorData = await response.json().catch(() => ({}));
            const pythonError = errorData.pythonError || errorData.message || 'Unknown error';
            throw new Error(`Server error: ${pythonError}`);
        }

        const blob = await response.blob();
        resultImage = URL.createObjectURL(blob);
        resultPreview.innerHTML = `<img src="${resultImage}" alt="Texture Transfer Result">`;
        
    } catch (error) {
        console.error('Full error:', error);
        showError(`Texture transfer failed: ${error.message}`);
        resultPreview.innerHTML = `
            <div class="error-message">
                <p>Texture transfer failed</p>
                <p class="error-detail">${error.message}</p>
            </div>
        `;
    } finally {
        if (transferBtn) {
            transferBtn.disabled = false;
            transferBtn.textContent = 'Transfer Texture';
        }
    }
}