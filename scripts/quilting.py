import cv2
import numpy as np
import sys
import os
import random

def random_patch(image, patch_size):
    """Select a random patch from the image with bounds checking"""
    h, w = image.shape[:2]
    x = random.randint(0, w - patch_size)
    y = random.randint(0, h - patch_size)
    return image[y:y+patch_size, x:x+patch_size].copy()

def quilt_texture_simple(image, output_size, patch_size, overlap):
    """Simpler quilting implementation with basic blending"""
    out_w, out_h = output_size
    quilt = np.zeros((out_h, out_w, 3), dtype=np.uint8)
    
    for i in range(0, out_h, patch_size - overlap):
        for j in range(0, out_w, patch_size - overlap):
            patch = random_patch(image, patch_size)
            
            # Calculate placement boundaries
            i_end = min(i + patch_size, out_h)
            j_end = min(j + patch_size, out_w)
            patch = patch[:i_end-i, :j_end-j]
            
            # Simple blending
            if i > 0:  # Blend top overlap
                alpha = np.linspace(0, 1, overlap).reshape(-1, 1, 1)
                patch[:overlap] = (alpha * patch[:overlap] + 
                                 (1-alpha) * quilt[i:i+overlap, j:j_end])
            
            if j > 0:  # Blend left overlap
                alpha = np.linspace(0, 1, overlap).reshape(1, -1, 1)
                patch[:, :overlap] = (alpha * patch[:, :overlap] + 
                                     (1-alpha) * quilt[i:i_end, j:j+overlap])
            
            quilt[i:i_end, j:j_end] = patch
    
    return quilt

if __name__ == "__main__":
    print("Starting quilting process...")  # Debug print
    
    if len(sys.argv) < 3:
        print("Usage: python quilting.py <input_path> <output_path> [width] [height] [patch_size] [overlap]")
        sys.exit(1)

    try:
        # Load image
        print(f"Loading image from {sys.argv[1]}")  # Debug print
        image = cv2.imread(sys.argv[1])
        if image is None:
            print(f"Error: Could not load image from {sys.argv[1]}")
            sys.exit(1)
        
        # Get parameters
        width = int(sys.argv[3]) if len(sys.argv) > 3 else 500
        height = int(sys.argv[4]) if len(sys.argv) > 4 else 500
        patch_size = int(sys.argv[5]) if len(sys.argv) > 5 else 50
        overlap = int(sys.argv[6]) if len(sys.argv) > 6 else 10
        
        print(f"Parameters: {width}x{height}, patch={patch_size}, overlap={overlap}")  # Debug print
        
        # Validate parameters
        if patch_size <= overlap or overlap < 0:
            print("Error: patch_size must be greater than overlap")
            sys.exit(1)
        
        # Process image
        print("Generating quilted texture...")  # Debug print
        result = quilt_texture_simple(image, (width, height), patch_size, overlap)
        
        # Save output
        print(f"Saving result to {sys.argv[2]}")  # Debug print
        cv2.imwrite(sys.argv[2], result)
        print("Done!")  # Debug print
        
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)