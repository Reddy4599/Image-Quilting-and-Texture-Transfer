document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const quiltingForm = document.getElementById('quiltingForm');
    const previewSection = document.getElementById('previewSection');
    const previewImage = document.getElementById('previewImage');
    const startBtn = document.getElementById('startQuilting');
    const saveBtn = document.getElementById('saveBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const newQuiltBtn = document.getElementById('newQuiltBtn');
    const backBtn = document.getElementById('backBtn');
    
    let currentSessionId = null;
    let currentImageUrl = null;

    // Back button functionality
    backBtn.addEventListener('click', function() {
        window.location.href = '/dashboard.html';
    });

    // Form submission for preview generation
    quiltingForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        // Show loading state
        startBtn.disabled = true;
        startBtn.innerHTML = '<span class="spinner"></span> Processing...';
        
        try {
            const formData = new FormData(quiltingForm);
            
            // Log form data for debugging
            console.log("Form data:", {
                image: formData.get('image').name,
                outputWidth: formData.get('outputWidth'),
                outputHeight: formData.get('outputHeight'),
                patchSize: formData.get('patchSize'),
                overlap: formData.get('overlap')
            });

            const response = await fetch('/api/quilting/preview', {
                method: 'POST',
                body: formData
            });

            // Check response status first
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Server error: ${response.status}`);
            }

            // Then parse JSON
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || "Preview generation failed");
            }

            // Show preview
            previewImage.src = data.previewUrl + '?t=' + Date.now(); // Cache bust
            previewSection.style.display = 'block';
            currentSessionId = data.sessionId;
            currentImageUrl = data.previewUrl;
            
            // Scroll to preview
            previewSection.scrollIntoView({ behavior: 'smooth' });
            
        } catch (error) {
            console.error('Quilting error:', error);
            alert(`Error: ${error.message}\nCheck console for details.`);
        } finally {
            // Reset button state
            startBtn.disabled = false;
            startBtn.textContent = "Generate Preview";
        }
    });

    // Save to account button
    saveBtn.addEventListener('click', async function() {
        if (!currentSessionId) {
            alert("No preview to save. Generate a preview first.");
            return;
        }
        
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner"></span> Saving...';
        
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error("You need to be logged in to save images");
            }

            const response = await fetch('/api/quilting/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ sessionId: currentSessionId })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Save failed: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                alert('Image saved successfully to your account!');
                // Update to permanent image URL
                currentImageUrl = data.outputImage;
                previewImage.src = currentImageUrl;
            } else {
                throw new Error(data.message || "Save failed");
            }
        } catch (error) {
            console.error('Save error:', error);
            alert(`Save failed: ${error.message}`);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save to Account";
        }
    });

    // Download button
    downloadBtn.addEventListener('click', function() {
        if (!currentImageUrl) {
            alert("No image to download. Generate a preview first.");
            return;
        }
        
        const link = document.createElement('a');
        link.href = currentImageUrl;
        link.download = `quilted-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // New quilt button
    newQuiltBtn.addEventListener('click', function() {
        previewSection.style.display = 'none';
        quiltingForm.reset();
        currentSessionId = null;
        currentImageUrl = null;
    });
});