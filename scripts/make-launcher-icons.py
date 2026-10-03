"""Regenerates the legacy launcher PNGs so devices below API 26 show the MOTracker
mark rather than the retired blue icon.

The adaptive icon covers API 26+ from vectors, but minSdk here is 24, so these
still ship and have to match. Drawn rather than downscaled from one bitmap so
each density gets correctly antialiased strokes.
"""
from PIL import Image, ImageDraw
import os

RES = os.path.join("android", "app", "src", "main", "res")

# Densities Android expects for launcher icons.
DENSITIES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
SS = 8  # supersample factor, downsampled at the end for clean edges

BG_START = (0x6d, 0x28, 0xd9)
BG_MID = (0x7c, 0x3a, 0xed)
BG_END = (0xa7, 0x8b, 0xfa)
WHITE = (255, 255, 255)

# Mark geometry in the same units as the vector drawable's 108-unit canvas.
STROKE = 7
CAP = "round"


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(size, start, mid, end):
    """Diagonal gradient, matching the shape drawable's 315 degree angle."""
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            px[x, y] = lerp(start, mid, t / 0.5) if t < 0.5 else lerp(mid, end, (t - 0.5) / 0.5)
    return img


def rounded_mask(size, radius_ratio=0.22):
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1],
                                           radius=int(size * radius_ratio), fill=255)
    return mask


def circle_mask(size):
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=255)
    return mask


def draw_mark(img, scale):
    """The trend line / M glyph.

    Coordinates are in the same 108-unit space as the vector drawable, so the
    legacy bitmap shows the mark at exactly the size and position the adaptive
    icon does. `scale` is pixels per unit.
    """
    d = ImageDraw.Draw(img)

    def pt(x, y):
        return (x * scale, y * scale)

    w = max(1, round(STROKE * scale))
    alpha = 255

    def stroke(points, width=w, fill=WHITE + (alpha,)):
        d.line([pt(*p) for p in points], fill=fill, width=width, joint="curve")
        # Round the caps and joins by hand; Pillow's line joints are square.
        r = width / 2
        for x, y in points:
            cx, cy = pt(x, y)
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)

    # M / rising baseline, lifted so the glyph's optical centre sits on the
    # canvas centre rather than below it.
    lift = 7
    stroke([(30, 74 - lift), (30, 52 - lift), (42, 64 - lift), (54, 44 - lift)])
    stroke([(54, 44 - lift), (66, 56 - lift), (78, 56 - lift), (78, 68 - lift)])
    # Coin slot, dimmer so it reads as secondary.
    stroke([(42, 78 - lift), (66, 78 - lift)], width=max(1, round(5 * scale)),
           fill=WHITE + (140,))


def render(size, circular):
    big = size * SS
    img = gradient(big, BG_START, BG_MID, BG_END).convert("RGBA")
    # big is the full 108-unit canvas, so scale is simply pixels per unit. The
    # glyph spans units 30..78, which is inside the 21..87 safe zone a launcher
    # mask is guaranteed to keep.
    draw_mark(img, big / 108)
    img = img.resize((size, size), Image.LANCZOS)
    mask = circle_mask(size) if circular else rounded_mask(size)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def main():
    for name, density in DENSITIES.items():
        folder = os.path.join(RES, f"mipmap-{name}")
        os.makedirs(folder, exist_ok=True)
        render(density, False).save(os.path.join(folder, "ic_launcher.png"))
        render(density, True).save(os.path.join(folder, "ic_launcher_round.png"))
        # The foreground PNGs are no longer referenced by the adaptive icon, but
        # some launchers still read them, so keep them matching the vector.
        print(f"  mipmap-{name}: {density}x{density}")


if __name__ == "__main__":
    main()
