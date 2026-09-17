#!/usr/bin/env python3
"""Draws the extension icons into icons/*.png.

No dependencies on purpose: a rasteriser is not installed on every machine that
might rebuild these, and the shapes are simple enough to sample directly. Every
pixel is supersampled 4x4 for the edges.

The mark is a pair of offset rounded tiles - the duplicate - with the front one
carrying a four-colour mosaic in Google's palette. Deliberately not the Google
Photos pinwheel: the extension must not look like Google's own.
"""
import struct, zlib, os

BLUE, RED, YELLOW, GREEN = (0x42, 0x85, 0xF4), (0xEA, 0x43, 0x35), (0xFB, 0xBC, 0x05), (0x34, 0xA8, 0x53)
GHOST = (0x9A, 0xA0, 0xA6)
SS = 4


def rrect(x, y, w, h, r, px, py):
    """Inside-test for a rounded rectangle in unit (0..1) space."""
    if px < x or px > x + w or py < y or py > y + h:
        return False
    cx = min(max(px, x + r), x + w - r)
    cy = min(max(py, y + r), y + h - r)
    dx, dy = px - cx, py - cy
    if dx == 0 or dy == 0:
        return True
    return dx * dx + dy * dy <= r * r


def tri(ax, ay, bx, by, cx, cy, px, py):
    def side(x1, y1, x2, y2):
        return (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1)
    d1, d2, d3 = side(ax, ay, bx, by), side(bx, by, cx, cy), side(cx, cy, ax, ay)
    return (d1 >= 0 and d2 >= 0 and d3 >= 0) or (d1 <= 0 and d2 <= 0 and d3 <= 0)


def draw(px, py, small):
    """Returns the colour at a point in unit space, or None for transparent."""
    fx, fy, fw = 0.06, 0.20, 0.74
    bx, by, bw = 0.20, 0.06, 0.74
    r = 0.16 * fw

    # The offset duplicate behind, drawn as an outline so it reads as a second
    # copy of the same photo rather than a second colour.
    if not rrect(fx - 0.035, fy - 0.035, fw + 0.07, fw + 0.07, r * 1.1, px, py):
        if rrect(bx, by, bw, bw, r, px, py):
            if small:
                return GHOST + (200,)
            t = 0.075
            if not rrect(bx + t, by + t, bw - 2 * t, bw - 2 * t, max(r - t, 0.01), px, py):
                return GHOST + (225,)
        return None

    if not rrect(fx, fy, fw, fw, r, px, py):
        return None

    # Glyph in the front tile's own 0..1 space: a sun and two peaks, the plain
    # reading of "photo" at 16px.
    u, v = (px - fx) / fw, (py - fy) / fw
    ink = (
        (u - 0.30) ** 2 + (v - 0.30) ** 2 <= 0.105 ** 2
        or (v <= 0.78 and tri(0.60, 0.34, 0.97, 0.78, 0.23, 0.78, u, v))
        or (v <= 0.78 and tri(0.33, 0.50, 0.60, 0.78, 0.06, 0.78, u, v))
    )
    if ink:
        return (255, 255, 255, 255)
    # Blue into green across the diagonal: the palette of the page it works on,
    # without its pinwheel.
    t = max(0.0, min(1.0, (u + v) / 2))
    return tuple(int(a + (b - a) * t + 0.5) for a, b in zip(BLUE, GREEN)) + (255,)


def render(size):
    small = size <= 32
    rows = []
    for j in range(size):
        row = bytearray()
        for i in range(size):
            acc = [0.0, 0.0, 0.0, 0.0]
            for sy in range(SS):
                for sx in range(SS):
                    px = (i + (sx + 0.5) / SS) / size
                    py = (j + (sy + 0.5) / SS) / size
                    c = draw(px, py, small)
                    if not c:
                        continue
                    a = c[3] / 255
                    acc[0] += c[0] * a
                    acc[1] += c[1] * a
                    acc[2] += c[2] * a
                    acc[3] += a
            n = SS * SS
            a = acc[3] / n
            if a <= 0:
                row += bytes(4)
                continue
            row += bytes((int(acc[0] / acc[3] + 0.5), int(acc[1] / acc[3] + 0.5), int(acc[2] / acc[3] + 0.5), int(a * 255 + 0.5)))
        rows.append(bytes(row))
    return rows


def png(path, size, rows):
    raw = b''.join(b'\x00' + r for r in rows)
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
    out = b'\x89PNG\r\n\x1a\n'
    out += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    out += chunk(b'IDAT', zlib.compress(raw, 9))
    out += chunk(b'IEND', b'')
    open(path, 'wb').write(out)


if __name__ == '__main__':
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(here, 'icons')
    os.makedirs(out, exist_ok=True)
    for s in (16, 32, 48, 128):
        p = os.path.join(out, f'icon{s}.png')
        png(p, s, render(s))
        print(p)
