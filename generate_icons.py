"""
Generate mosque-themed app icons for Masjid app.
Uses only Python stdlib (struct + zlib) — no Pillow required.
Produces proper PNG files at the exact sizes EAS/Play Store require.
"""
import struct, zlib, os

# ── Colour palette ─────────────────────────────────────────────────────────
BG       = (20,  83,  45)   # forest-800  #14532d
DOME     = (255, 255, 255)  # white
GOLD     = (201, 150, 58)   # gold

# ── Pure-stdlib PNG writer ──────────────────────────────────────────────────
def _chunk(tag: bytes, data: bytes) -> bytes:
    c = struct.pack('>I', len(data)) + tag + data
    return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

def write_png(path: str, width: int, height: int, pixels):
    """pixels: list of (R,G,B) tuples, row-major."""
    raw = b''
    for y in range(height):
        raw += b'\x00'  # filter byte = None
        for x in range(width):
            r, g, b = pixels[y * width + x]
            raw += bytes([r, g, b])
    compressed = zlib.compress(raw, 9)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        f.write(_chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)))
        f.write(_chunk(b'IDAT', compressed))
        f.write(_chunk(b'IEND', b''))

# ── Drawing helpers ─────────────────────────────────────────────────────────
def lerp(a, b, t):
    return a + (b - a) * t

def blend(base, top, alpha):
    return tuple(int(lerp(base[i], top[i], alpha)) for i in range(3))

def in_circle(cx, cy, r, x, y):
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r

def in_rect(rx, ry, rw, rh, x, y):
    return rx <= x < rx + rw and ry <= y < ry + rh

def in_arch(cx, cy, r, x, y):
    """True if point is inside a semicircle (top half of circle)."""
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r and y <= cy

# ── Icon renderer ───────────────────────────────────────────────────────────
def make_icon(size: int) -> list:
    """Render a mosque silhouette icon at `size`×`size`."""
    s = size
    pixels = []

    # geometry — scale everything relative to size
    def sc(v): return int(v * s / 1024)

    # Background gradient (dark green → slightly lighter)
    bg_top    = (15,  68, 35)
    bg_bottom = (20,  83, 45)

    # Dome params
    dome_cx = sc(512)
    dome_cy = sc(440)
    dome_r  = sc(195)

    # Minaret params (two symmetrical)
    mL_x, mL_w = sc(230), sc(70)   # left minaret x, width
    mR_x, mR_w = sc(724), sc(70)   # right minaret x, width
    m_base_y    = sc(630)           # minaret base y
    m_top_y     = sc(220)           # minaret top y
    m_h         = m_base_y - m_top_y

    # Minaret cap (small dome on top)
    mcap_r  = sc(42)

    # Mosque body (rectangle under dome)
    body_x  = sc(310)
    body_y  = sc(440)
    body_w  = sc(404)
    body_h  = sc(190)

    # Door
    door_cx = sc(512)
    door_y  = sc(560)
    door_w  = sc(80)
    door_h  = sc(70)
    door_r  = sc(40)  # arch radius

    # Star — crescent above dome
    star_cx = sc(512)
    star_cy = sc(220)
    star_r  = sc(28)
    cres_offset = sc(18)  # offset for crescent cutout

    for y in range(s):
        for x in range(s):
            t = y / s  # 0 = top, 1 = bottom

            # Background gradient
            r = int(lerp(bg_top[0], bg_bottom[0], t))
            g = int(lerp(bg_top[1], bg_bottom[1], t))
            b = int(lerp(bg_top[2], bg_bottom[2], t))
            col = (r, g, b)

            # Rounded corners (radius = 18% of size for squircle look)
            corner_r = sc(184)
            cx_corners = [corner_r, s - corner_r - 1, corner_r, s - corner_r - 1]
            cy_corners = [corner_r, corner_r, s - corner_r - 1, s - corner_r - 1]
            corners = [(corner_r, corner_r), (s - corner_r - 1, corner_r),
                       (corner_r, s - corner_r - 1), (s - corner_r - 1, s - corner_r - 1)]
            in_corner_zone = False
            for (ccx, ccy) in corners:
                if abs(x - ccx) > corner_r and abs(y - ccy) > corner_r:
                    pass
                # simple corner test: if in the corner bounding box but outside radius → transparent (BG)
            # simpler: mask to rounded rect
            in_rr = True
            if x < corner_r and y < corner_r and not in_circle(corner_r, corner_r, corner_r, x, y):
                in_rr = False
            if x > s - corner_r - 1 and y < corner_r and not in_circle(s - corner_r - 1, corner_r, corner_r, x, y):
                in_rr = False
            if x < corner_r and y > s - corner_r - 1 and not in_circle(corner_r, s - corner_r - 1, corner_r, x, y):
                in_rr = False
            if x > s - corner_r - 1 and y > s - corner_r - 1 and not in_circle(s - corner_r - 1, s - corner_r - 1, corner_r, x, y):
                in_rr = False

            if not in_rr:
                pixels.append(BG)  # solid bg colour in corners (no transparency in PNG-RGB)
                continue

            # Left minaret
            if in_rect(mL_x, m_top_y, mL_w, m_h, x, y):
                col = blend(col, DOME, 0.92)

            # Right minaret
            if in_rect(mR_x, m_top_y, mR_w, m_h, x, y):
                col = blend(col, DOME, 0.92)

            # Minaret caps (tiny dome)
            mL_cap_cx = mL_x + mL_w // 2
            mR_cap_cx = mR_x + mR_w // 2
            if in_arch(mL_cap_cx, m_top_y + mcap_r, mcap_r, x, y):
                col = blend(col, DOME, 0.92)
            if in_arch(mR_cap_cx, m_top_y + mcap_r, mcap_r, x, y):
                col = blend(col, DOME, 0.92)

            # Minaret finials (gold spike on top)
            fin_h = sc(50)
            fin_w = sc(14)
            mL_fin_x = mL_cap_cx - fin_w // 2
            mR_fin_x = mR_cap_cx - fin_w // 2
            fin_top = m_top_y - fin_h
            if in_rect(mL_fin_x, fin_top, fin_w, fin_h, x, y):
                col = blend(col, GOLD, 0.95)
            if in_rect(mR_fin_x, fin_top, fin_w, fin_h, x, y):
                col = blend(col, GOLD, 0.95)

            # Main dome
            if in_arch(dome_cx, dome_cy, dome_r, x, y):
                col = blend(col, DOME, 0.95)

            # Mosque body (rectangle)
            if in_rect(body_x, body_y, body_w, body_h, x, y):
                col = blend(col, DOME, 0.88)

            # Door arch cutout (dark, so it shows as window)
            door_bottom = door_y + door_h
            in_door = False
            # rectangular part of door
            if in_rect(door_cx - door_w // 2, door_y, door_w, door_h - door_r, x, y):
                in_door = True
            # arch top
            if in_arch(door_cx, door_y + door_r, door_r, x, y):
                in_door = True
            if in_door:
                col = blend(col, bg_bottom, 0.85)

            # Star (gold circle) above dome
            if in_circle(star_cx, star_cy, star_r, x, y):
                # crescent: subtract offset circle
                if not in_circle(star_cx + cres_offset, star_cy - sc(5), star_r - sc(8), x, y):
                    col = blend(col, GOLD, 0.97)

            # Subtle gold shimmer line at top of dome
            if in_arch(dome_cx, dome_cy, dome_r, x, y) and in_arch(dome_cx, dome_cy, dome_r - sc(12), x, y) is False:
                col = blend(col, GOLD, 0.25)

            pixels.append(col)

    return pixels

# ── Notification icon (white on transparent bg) ─────────────────────────────
def make_notif_icon(size: int) -> list:
    """96×96 white mosque silhouette on dark green for notification."""
    s = size
    # Just render a simplified version
    pixels = []
    bg = (20, 83, 45)
    for y in range(s):
        for x in range(s):
            col = bg
            cx, cy, r = s // 2, s // 2 + 4, s // 3
            # dome
            if in_arch(cx, cy, r, x, y):
                col = (255, 255, 255)
            # body
            bx, bw, bh = cx - r, r * 2, r
            if in_rect(bx, cy, bw, bh, x, y):
                col = (255, 255, 255)
            pixels.append(col)
    return pixels

# ── Splash screen ────────────────────────────────────────────────────────────
def make_splash(width: int, height: int) -> list:
    """1284×2778 splash — centred icon on dark green gradient."""
    pixels = []
    bg_top    = (10, 55, 28)
    bg_bottom = (20, 83, 45)

    # render a 400×400 icon tile for the centre
    icon_size = min(width, height) // 3
    icon_pixels = make_icon(icon_size)

    cx = width // 2
    cy = height // 2
    ix0 = cx - icon_size // 2
    iy0 = cy - icon_size // 2

    for y in range(height):
        for x in range(width):
            t = y / height
            r = int(lerp(bg_top[0], bg_bottom[0], t))
            g = int(lerp(bg_top[1], bg_bottom[1], t))
            b = int(lerp(bg_top[2], bg_bottom[2], t))
            col = (r, g, b)

            # paste icon in centre
            ix = x - ix0
            iy = y - iy0
            if 0 <= ix < icon_size and 0 <= iy < icon_size:
                ip = icon_pixels[iy * icon_size + ix]
                # only paste if icon pixel differs from its own background
                if ip != BG and ip != bg_bottom and ip != bg_top:
                    col = ip

            pixels.append(col)
    return pixels

# ── Generate all assets ──────────────────────────────────────────────────────
out = "C:/Users/User/Desktop/masjid-app/apps/mobile/assets"

print("Generating icon.png (1024×1024)...")
write_png(f"{out}/icon.png", 1024, 1024, make_icon(1024))
print("  done.")

print("Generating adaptive-icon.png (1024×1024)...")
write_png(f"{out}/adaptive-icon.png", 1024, 1024, make_icon(1024))
print("  done.")

print("Generating notification-icon.png (96×96)...")
write_png(f"{out}/notification-icon.png", 96, 96, make_notif_icon(96))
print("  done.")

print("Generating splash.png (1284×2778)...")
write_png(f"{out}/splash.png", 1284, 2778, make_splash(1284, 2778))
print("  done.")

# Verify file sizes
import os
for name in ["icon.png", "adaptive-icon.png", "notification-icon.png", "splash.png"]:
    path = f"{out}/{name}"
    size = os.path.getsize(path)
    print(f"  {name}: {size:,} bytes")

print("\nAll icons generated successfully.")
