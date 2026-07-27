import logging
from django.conf import settings

logger = logging.getLogger(__name__)

# Global variables to hold the model and processor
_clip_model = None
_clip_processor = None
_is_clip_loaded = False

def load_clip_model():
    """
    Lazy load the CLIP model only when needed.
    Returns True if successful, False otherwise.
    """
    global _clip_model, _clip_processor, _is_clip_loaded
    if _is_clip_loaded:
        return True
        
    try:
        from transformers import CLIPProcessor, CLIPModel
        
        # We use openai/clip-vit-base-patch32 which outputs 512-dim vectors
        model_name = "openai/clip-vit-base-patch32"
        logger.info(f"Loading CLIP model {model_name}...")
        
        _clip_model = CLIPModel.from_pretrained(model_name)
        _clip_processor = CLIPProcessor.from_pretrained(model_name)
        _is_clip_loaded = True
        logger.info("CLIP model loaded successfully.")
        return True
    except ImportError:
        logger.error("CLIP libraries (transformers, torch, Pillow) are not installed. Cannot load CLIP model.")
        return False
    except Exception as e:
        logger.error(f"Error loading CLIP model: {e}")
        return False

def get_image_embedding(image_path_or_url=None, image_file=None):
    """
    Generates a 512-dimensional vector embedding for an image.
    Supports either a local file path, a URL, or an image file object (bytes).
    """
    if not load_clip_model():
        return None
        
    try:
        from PIL import Image
        import requests
        import io
        import torch
        
        img = None
        if image_file:
            # Handle Django InMemoryUploadedFile or raw bytes
            if hasattr(image_file, 'read'):
                image_file.seek(0)
                img = Image.open(image_file)
            else:
                img = Image.open(io.BytesIO(image_file))
        elif image_path_or_url:
            if image_path_or_url.startswith('http'):
                response = requests.get(image_path_or_url, stream=True, timeout=10)
                response.raise_for_status()
                img = Image.open(response.raw)
            else:
                img = Image.open(image_path_or_url)
                
        if not img:
            return None
            
        # Ensure image is RGB
        if img.mode != 'RGB':
            img = img.convert('RGB')
            
        # Process image and get embeddings
        inputs = _clip_processor(images=img, return_tensors="pt")
        with torch.no_grad():
            image_features = _clip_model.get_image_features(**inputs)
            
        # Normalize and convert to list
        image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)
        vector = image_features.squeeze().tolist()
        
        return vector
        
    except Exception as e:
        logger.error(f"Error generating image embedding: {e}")
        return None
