#!/usr/bin/env python3
"""Renders four candidate icon designs to dist/icon-designs/ for a look.

Same no-dependency approach as make-icons.py: shapes are sampled directly,
6x6 per pixel. Every design is an iOS-style squircle tile with a gradient and a
flat white glyph, so they can be compared on the idea rather than the polish.

  python3 tools/icon-designs.py            # all four at 128 and 16
  python3 tools/icon-designs.py 3          # just one

Whichever wins gets folded into make-icons.py.
"""
import math, os, struct, sys, zlib

SS = 6
WHITE = (255, 255, 255)
# Google's own four, sampled from the Material palette the page uses.
G_BLUE, G_RED, G_YELLOW, G_GREEN = (0x42, 0x85, 0xF4), (0xEA, 0x43, 0x35), (0xFB, 0xBC, 0x04), (0x34, 0xA8, 0x53)
G_GREY = (0x9A, 0xA0, 0xA6)


# ----------------------------------------------------------------- geometry ---
def squircle(px, py, pad=0.0, n=4.6):
    """Apple's rounded-square shape: a superellipse, not a rounded rect."""
    x = (px - 0.5) / (0.5 - pad)
    y = (py - 0.5) / (0.5 - pad)
    return abs(x) ** n + abs(y) ** n <= 1.0


def rrect(x, y, w, h, r, px, py):
    if px < x or px > x + w or py < y or py > y + h:
        return False
    r = min(r, w / 2, h / 2)
    cx = min(max(px, x + r), x + w - r)
    cy = min(max(py, y + r), y + h - r)
    dx, dy = px - cx, py - cy
    if dx == 0 or dy == 0:
        return True
    return dx * dx + dy * dy <= r * r


def circle(cx, cy, r, px, py):
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r


def ring(cx, cy, r, t, px, py):
    d = math.hypot(px - cx, py - cy)
    return r - t <= d <= r


def tri(a, b, c, px, py):
    def side(p, q):
        return (q[0] - p[0]) * (py - p[1]) - (q[1] - p[1]) * (px - p[0])
    d1, d2, d3 = side(a, b), side(b, c), side(c, a)
    return (d1 >= 0 and d2 >= 0 and d3 >= 0) or (d1 <= 0 and d2 <= 0 and d3 <= 0)


def star4(cx, cy, r, waist, px, py):
    """Four-pointed sparkle: two crossed spikes."""
    return tri((cx, cy - r), (cx - waist, cy), (cx + waist, cy), px, py) \
        or tri((cx, cy + r), (cx - waist, cy), (cx + waist, cy), px, py) \
        or tri((cx - r, cy), (cx, cy - waist), (cx, cy + waist), px, py) \
        or tri((cx + r, cy), (cx, cy - waist), (cx, cy + waist), px, py)


def lerp(c1, c2, t):
    t = max(0.0, min(1.0, t))
    return tuple(a + (b - a) * t for a, b in zip(c1, c2))


def photo(x, y, w, h, px, py, ink):
    """A white card with a sun and two peaks knocked out in `ink`."""
    if not rrect(x, y, w, h, 0.055, px, py):
        return None
    u, v = (px - x) / w, (py - y) / h
    if circle(0.26, 0.30, 0.115, u, v) \
            or (v <= 0.82 and tri((0.58, 0.30), (1.02, 0.82), (0.16, 0.82), u, v)) \
            or (v <= 0.82 and tri((0.28, 0.52), (0.60, 0.82), (-0.04, 0.82), u, v)):
        return ink + (255,)
    return WHITE + (255,)


# ------------------------------------------------------------------ designs ---
# Each returns (colour, alpha) for a point inside the tile, over the gradient.

def d1(px, py, g):
    """Stacked photos: the duplicate offset behind the one you keep."""
    if rrect(0.30, 0.18, 0.54, 0.40, 0.055, px, py) and not rrect(0.13, 0.30, 0.60, 0.46, 0.07, px, py):
        return WHITE + (105,)
    c = photo(0.16, 0.33, 0.54, 0.40, px, py, g)
    return c


def d2(px, py, g):
    """Two overlapping circles: the same photo, found twice."""
    a = circle(0.38, 0.5, 0.235, px, py)
    b = circle(0.62, 0.5, 0.235, px, py)
    if a and b:
        return WHITE + (255,)
    if ring(0.38, 0.5, 0.235, 0.062, px, py) or ring(0.62, 0.5, 0.235, 0.062, px, py):
        return WHITE + (235,)
    return None


def d3(px, py, g):
    """A stack being thinned: three cards, the top one badged."""
    for i, alpha in ((2, 95), (1, 160)):
        off = 0.085 * i
        if rrect(0.19 + off, 0.21 - off * 0.10, 0.50, 0.34, 0.05, px, py):
            inner = rrect(0.19 + off - 0.055, 0.21 - off * 0.10 + 0.075, 0.56, 0.40, 0.06, px, py)
            if not inner:
                return WHITE + (alpha,)
    c = photo(0.17, 0.33, 0.50, 0.36, px, py, g)
    if c:
        return c
    # Badge: a minus, the one thing the extension does to a duplicate.
    if circle(0.71, 0.73, 0.155, px, py):
        if abs(py - 0.73) <= 0.024 and abs(px - 0.71) <= 0.072:
            return g + (255,)
        return WHITE + (255,)
    return None


def d4(px, py, g):
    """One photo, cleaned up: the card with a sparkle on its corner."""
    if circle(0.755, 0.255, 0.105, px, py) and not star4(0.755, 0.255, 0.20, 0.045, px, py):
        return None  # a gap, so the sparkle reads as sitting above the card
    if star4(0.755, 0.255, 0.20, 0.045, px, py):
        return WHITE + (255,)
    return photo(0.17, 0.32, 0.56, 0.42, px, py, g)


def rot(px, py, deg):
    """Point in a frame rotated about the tile centre, for diagonal shapes."""
    a = math.radians(deg)
    x, y = px - 0.5, py - 0.5
    return x * math.cos(a) + y * math.sin(a), -x * math.sin(a) + y * math.cos(a)


def capsule(x0, x1, half, u, v):
    return rrect(x0, -half, x1 - x0, half * 2, half, u, v)


def glyph(x, y, w, h, px, py, ink, fill=None):
    """A card with a sun and two peaks, drawn in `ink` on `fill`."""
    if not rrect(x, y, w, h, 0.055, px, py):
        return None
    u, v = (px - x) / w, (py - y) / h
    if circle(0.26, 0.30, 0.115, u, v) \
            or (v <= 0.82 and tri((0.58, 0.30), (1.02, 0.82), (0.16, 0.82), u, v)) \
            or (v <= 0.82 and tri((0.28, 0.52), (0.60, 0.82), (-0.04, 0.82), u, v)):
        return ink + (255,)
    return (fill + (255,)) if fill else None


def d5(px, py, g):
    """A stack of photos in Google's four: the copies peek out behind."""
    for i, col in ((3, G_RED), (2, G_YELLOW), (1, G_GREEN)):
        off = 0.062 * i
        if rrect(0.17 + off, 0.24 - off * 0.34, 0.52, 0.36, 0.05, px, py) \
                and not rrect(0.17 + off - 0.062, 0.24 - off * 0.34 + 0.021, 0.52, 0.36, 0.05, px, py):
            return col + (255,)
    if rrect(0.17, 0.24, 0.52, 0.36, 0.05, px, py):
        return glyph(0.17, 0.24, 0.52, 0.36, px, py, WHITE, G_BLUE)
    return None


def d6(px, py, g):
    """A frame built from the four colours, around the photo it keeps."""
    x, y, w, t = 0.20, 0.20, 0.60, 0.085
    if rrect(x, y, w, w, 0.10, px, py) and not rrect(x + t, y + t, w - 2 * t, w - 2 * t, 0.06, px, py):
        # One side per colour, split on the diagonals so the corners meet clean.
        ox, oy = px - (x + w / 2), py - (y + w / 2)
        if abs(ox) <= abs(oy):
            return (G_BLUE if oy < 0 else G_YELLOW) + (255,)
        return (G_GREEN if ox < 0 else G_RED) + (255,)
    c = glyph(x + t, y + t, w - 2 * t, w - 2 * t, px, py, G_GREY)
    return c


def d7(px, py, g):
    """Two copies overlapping, and the badge for what happens to one."""
    a = circle(0.40, 0.44, 0.225, px, py)
    b = circle(0.63, 0.44, 0.225, px, py)
    if a and b:
        return G_YELLOW + (255,)
    if a:
        return G_BLUE + (255,)
    if b:
        return G_GREEN + (255,)
    if circle(0.70, 0.78, 0.145, px, py):
        if abs(py - 0.78) <= 0.026 and abs(px - 0.70) <= 0.068:
            return WHITE + (255,)
        return G_RED + (255,)
    return None


def d8(px, py, g):
    """Four petals to the corners: Google's palette, not Google's pinwheel."""
    for deg, col in ((45, G_BLUE), (135, G_RED), (225, G_YELLOW), (315, G_GREEN)):
        u, v = rot(px, py, deg)
        if capsule(0.055, 0.405, 0.098, u, v):
            return col + (255,)
    if circle(0.5, 0.5, 0.062, px, py):
        return G_GREY + (255,)
    return None


LIGHT = ((0xFF, 0xFF, 0xFF), (0xF1, 0xF3, 0xF4))

DESIGNS = {
    1: ('stacked-photos', d1, ((0x5B, 0x5C, 0xE2), (0x9B, 0x5D, 0xE5))),
    2: ('overlap', d2, ((0x0A, 0x84, 0xFF), (0x32, 0xD7, 0x4B))),
    3: ('thinned-stack', d3, ((0x00, 0xB3, 0xA6), (0x0A, 0x84, 0xFF))),
    4: ('sparkle', d4, ((0xFF, 0x2D, 0x78), (0xFF, 0x9F, 0x0A))),
    # Google's palette on a white tile, the way Google's own app icons sit.
    5: ('colour-stack', d5, LIGHT),
    6: ('colour-frame', d6, LIGHT),
    7: ('overlap-colour', d7, LIGHT),
    8: ('petals', d8, LIGHT),
}


def sample(px, py, fn, ramp):
    if not squircle(px, py, 0.008):
        return None
    top, bottom = ramp
    bg = lerp(top, bottom, (px * 0.35 + py * 0.9) / 1.25)
    # A soft light from the top-left, the way an iOS tile is lit.
    d = math.hypot(px - 0.28, py - 0.18)
    bg = lerp(bg, (255, 255, 255), max(0.0, 0.16 - d * 0.16))
    ink = tuple(int(round(max(0, min(255, c * 0.62)))) for c in lerp(top, bottom, 0.5))
    fg = fn(px, py, ink)
    if not fg:
        return tuple(int(round(c)) for c in bg) + (255,)
    a = fg[3] / 255
    return tuple(int(round(bg[i] + (fg[i] - bg[i]) * a)) for i in range(3)) + (255,)


# -------------------------------------------------------------------- output ---
def render(size, fn, ramp):
    rows = []
    for j in range(size):
        row = bytearray()
        for i in range(size):
            acc = [0.0, 0.0, 0.0, 0.0]
            for sy in range(SS):
                for sx in range(SS):
                    c = sample((i + (sx + 0.5) / SS) / size, (j + (sy + 0.5) / SS) / size, fn, ramp)
                    if not c:
                        continue
                    acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; acc[3] += 1
            if acc[3] == 0:
                row += bytes(4)
                continue
            row += bytes((int(acc[0] / acc[3] + 0.5), int(acc[1] / acc[3] + 0.5),
                          int(acc[2] / acc[3] + 0.5), int(acc[3] / (SS * SS) * 255 + 0.5)))
        rows.append(bytes(row))
    return rows


def png(path, size, rows):
    raw = b''.join(b'\x00' + r for r in rows)

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    out = b'\x89PNG\r\n\x1a\n'
    out += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    out += chunk(b'IDAT', zlib.compress(raw, 9))
    out += chunk(b'IEND', b'')
    open(path, 'wb').write(out)


if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(root, 'dist', 'icon-designs')
    os.makedirs(out, exist_ok=True)
    want = [int(a) for a in sys.argv[1:]] or sorted(DESIGNS)
    for n in want:
        name, fn, ramp = DESIGNS[n]
        for size in (128, 16):
            p = os.path.join(out, f'{n}-{name}-{size}.png')
            png(p, size, render(size, fn, ramp))
            print(p)
