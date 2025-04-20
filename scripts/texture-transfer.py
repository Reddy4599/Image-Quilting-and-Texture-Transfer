#!/usr/bin/env python3
import sys
import os
from PIL import Image
import numpy as np
import traceback
from tqdm import tqdm  # For progress bars

def validate_inputs(texture_path, target_path, output_path, patch_size, overlap, iterations):
    """Validate all input parameters"""
    if not os.path.exists(texture_path):
        raise FileNotFoundError(f"Texture file not found: {texture_path}")
    if not os.path.exists(target_path):
        raise FileNotFoundError(f"Target file not found: {target_path}")
    if patch_size < 10:
        raise ValueError("Patch size must be at least 10 pixels")
    if overlap >= patch_size:
        raise ValueError("Overlap must be smaller than patch size")
    if iterations < 1:
        raise ValueError("At least 1 iteration required")
    
    # Ensure output directory exists
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

def calculate_ssd(patch1, patch2):
    """Calculate sum of squared differences between patches"""
    return np.sum((patch1 - patch2)**2)

def texture_transfer(texture_path, target_path, output_path, patch_size=30, overlap=10, iterations=3, alpha=0.7):
    """
    Improved texture transfer with balanced blending
    Args:
        alpha: Blending factor (0.0-1.0), higher = more texture dominance
    """
    # Load and prepare images
    texture_img = Image.open(texture_path).convert('RGB')
    target_img = Image.open(target_path).convert('RGB')
    
    # Resize texture to match target dimensions
    target_width, target_height = target_img.size
    texture_img = texture_img.resize((target_width, target_height))
    
    # Convert to numpy arrays
    texture = np.array(texture_img, dtype=np.float32)
    target = np.array(target_img, dtype=np.float32)
    result = np.zeros_like(target)
    
    # Main processing loop
    for _ in range(iterations):
        for y in tqdm(range(0, target_height - patch_size + 1, patch_size - overlap), 
                     desc="Processing rows"):
            for x in range(0, target_width - patch_size + 1, patch_size - overlap):
                # Extract target patch
                target_patch = target[y:y+patch_size, x:x+patch_size]
                
                # Find best matching texture patch
                best_match = None
                min_diff = float('inf')
                
                # Search random patches for efficiency
                for _ in range(100):
                    ty = np.random.randint(0, texture.shape[0] - patch_size)
                    tx = np.random.randint(0, texture.shape[1] - patch_size)
                    texture_patch = texture[ty:ty+patch_size, tx:tx+patch_size]
                    
                    # Calculate difference
                    diff = np.mean((target_patch - texture_patch) ** 2)
                    
                    if diff < min_diff:
                        min_diff = diff
                        best_match = texture_patch
                
                # Blend the best match with target
                if best_match is not None:
                    blended_patch = alpha * best_match + (1-alpha) * target_patch
                    result[y:y+patch_size, x:x+patch_size] = blended_patch
    
    # Convert and save result
    result_img = Image.fromarray(np.uint8(np.clip(result, 0, 255)))
    result_img.save(output_path)
    print(f"Saved balanced result to {output_path}")
def main():
    try:
        if len(sys.argv) != 7:
            raise ValueError("Usage: python3 texture_transfer.py texture target output patch overlap iterations")
            
        texture_path = sys.argv[1]
        target_path = sys.argv[2]
        output_path = sys.argv[3]
        patch_size = int(sys.argv[4])
        overlap = int(sys.argv[5])
        iterations = int(sys.argv[6])
        
        # Validate inputs
        validate_inputs(texture_path, target_path, output_path, patch_size, overlap, iterations)
        
        # Perform texture transfer
        texture_transfer(texture_path, target_path, output_path, patch_size, overlap, iterations)
        
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 7:
        print("Usage: python texture-transfer.py texture target output patch_size overlap iterations [alpha=0.7]")
        sys.exit(1)
        
    texture_path = sys.argv[1]
    target_path = sys.argv[2]
    output_path = sys.argv[3]
    patch_size = int(sys.argv[4])
    overlap = int(sys.argv[5])
    iterations = int(sys.argv[6])
    alpha = float(sys.argv[7]) if len(sys.argv) > 7 else 0.7  # Default blending factor
    
    texture_transfer(texture_path, target_path, output_path, patch_size, overlap, iterations, alpha)