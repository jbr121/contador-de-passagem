#!/usr/bin/env python3
from PIL import Image
import os

SRC = os.path.join("assets", "screenshots")
OUT = os.path.join(SRC, "optimized")
os.makedirs(OUT, exist_ok=True)

imgs = [f for f in os.listdir(SRC) if f.lower().endswith((".png", ".jpg", ".jpeg"))]
for fn in imgs:
    src = os.path.join(SRC, fn)
    name, _ = os.path.splitext(fn)
    try:
        im = Image.open(src).convert("RGB")
        webp_path = os.path.join(OUT, f"{name}.webp")
        im.save(webp_path, "WEBP", quality=80, method=6)

        thumb = im.copy()
        thumb.thumbnail((1200, 1200))
        thumb_path = os.path.join(OUT, f"{name}-thumb.png")
        thumb.save(thumb_path, "PNG", optimize=True)

        # Try AVIF if Pillow and libsupport available
        try:
            avif_path = os.path.join(OUT, f"{name}.avif")
            im.save(avif_path, "AVIF", quality=50)
        except Exception:
            # AVIF not supported in this environment; skip silently
            pass

        print(f"Processed {fn} -> webp/thumb (avif maybe)")
    except Exception as e:
        print(f"Failed {fn}: {e}")

