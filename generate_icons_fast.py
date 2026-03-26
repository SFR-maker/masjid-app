"""
Fast icon generator — uses run-length encoding per row so it's nearly instant
even for 1284×2778. Produces valid PNG RGB files at exact required dimensions.
"""
import struct, zlib, os

def write_png_solid(path, width, height, rgb):
    """Write a solid-colour PNG — one row compressed, then referenced N times."""
    r, g, b = rgb
    row = b'\x00' + bytes([r, g, b]) * width   # filter=None + pixels
    compressed = zlib.compress(row * height, 9)
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        f.write(chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)))
        f.write(chunk(b'IDAT', compressed))
        f.write(chunk(b'IEND', b''))

def write_png_gradient(path, width, height, top_rgb, bottom_rgb):
    """Write a vertical gradient PNG efficiently."""
    rows = bytearray()
    for y in range(height):
        t = y / (height - 1)
        r = int(top_rgb[0] + (bottom_rgb[0] - top_rgb[0]) * t)
        g = int(top_rgb[1] + (bottom_rgb[1] - top_rgb[1]) * t)
        b = int(top_rgb[2] + (bottom_rgb[2] - top_rgb[2]) * t)
        rows += b'\x00' + bytes([r, g, b]) * width
    compressed = zlib.compress(bytes(rows), 6)
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        f.write(chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)))
        f.write(chunk(b'IDAT', compressed))
        f.write(chunk(b'IEND', b''))

out = "C:/Users/User/Desktop/masjid-app/apps/mobile/assets"

FOREST_DARK  = (10,  55, 28)
FOREST_MID   = (20,  83, 45)
FOREST_LIGHT = (29, 122, 62)

print("icon.png (1024×1024) ...")
write_png_gradient(f"{out}/icon.png", 1024, 1024, FOREST_DARK, FOREST_MID)

print("adaptive-icon.png (1024×1024) ...")
write_png_gradient(f"{out}/adaptive-icon.png", 1024, 1024, FOREST_DARK, FOREST_MID)

print("notification-icon.png (96×96) ...")
write_png_solid(f"{out}/notification-icon.png", 96, 96, FOREST_MID)

print("splash.png (1284×2778) ...")
write_png_gradient(f"{out}/splash.png", 1284, 2778, FOREST_DARK, FOREST_MID)

print("favicon.png (48×48) ...")
write_png_solid(f"{out}/favicon.png", 48, 48, FOREST_MID)

for name in ["icon.png", "adaptive-icon.png", "notification-icon.png", "splash.png", "favicon.png"]:
    sz = os.path.getsize(f"{out}/{name}")
    print(f"  {name}: {sz:,} bytes  ✓")

print("\nDone. Replace these with your real brand assets before submission.")
