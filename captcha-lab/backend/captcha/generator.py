import base64
import hashlib
import io
import json
import math
import random
import secrets
from typing import Any, Dict, List, Optional, Tuple
from PIL import Image, ImageDraw, ImageFilter, ImageFont

UPPER_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ"
LOWER_CHARS = "abcdefghjkmnpqrstuvwxyz"
DIGIT_CHARS = "23456789"
CHAR_SET = UPPER_CHARS + LOWER_CHARS + DIGIT_CHARS

def generateSalt() -> str:
    return secrets.token_hex(16)

generate_salt = generateSalt

def hashAnswer(salt: str, answer: str) -> str:
    clean = answer.strip().upper()
    return hashlib.sha256(f"{salt}:{clean}".encode("utf-8")).hexdigest()

hash_answer = hashAnswer

def createTextChallenge(length: int = 5) -> Tuple[str, str, str, str]:
    # Include lowercase letters, uppercase letters, and digits for visual complexity
    sample = [
        secrets.choice(LOWER_CHARS),
        secrets.choice(UPPER_CHARS),
        secrets.choice(DIGIT_CHARS)
    ]
    sample += [secrets.choice(CHAR_SET) for _ in range(max(0, length - len(sample)))]
    random.shuffle(sample)
    text = "".join(sample[:length])
    salt = generateSalt()
    ansHash = hashAnswer(salt, text)
    width, height = 260, 90

    color1 = (random.randint(235, 250), random.randint(235, 250), random.randint(245, 255))
    color2 = (random.randint(215, 235), random.randint(220, 240), random.randint(235, 255))

    img = Image.new("RGBA", (width, height), color1)
    draw = ImageDraw.Draw(img)

    for y in range(height):
        ratio = y / height
        r = int(color1[0] * (1 - ratio) + color2[0] * ratio)
        g = int(color1[1] * (1 - ratio) + color2[1] * ratio)
        b = int(color1[2] * (1 - ratio) + color2[2] * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b, 255))

    for _ in range(250):
        nx = random.randint(0, width - 1)
        ny = random.randint(0, height - 1)
        draw.point((nx, ny), fill=(random.randint(120, 200), random.randint(120, 200), random.randint(140, 220), random.randint(90, 180)))

    for _ in range(4):
        lineColor = (random.randint(80, 160), random.randint(80, 160), random.randint(120, 200), random.randint(110, 170))
        pts = []
        cx = 0
        freq = random.uniform(0.015, 0.035)
        phase = random.uniform(0, math.pi * 2)
        baseY = random.randint(20, height - 20)
        amp = random.randint(10, 22)
        while cx < width:
            cy = baseY + int(math.sin(cx * freq + phase) * amp)
            pts.append((cx, cy))
            cx += 4
        if len(pts) > 1:
            draw.line(pts, fill=lineColor, width=random.randint(1, 2))

    charSpacing = (width - 40) // length
    font = None
    for fc in ["arial.ttf", "segoeui.ttf", "tahoma.ttf", "calibri.ttf", "consola.ttf"]:
        try:
            font = ImageFont.truetype(fc, 42)
            break
        except Exception:
            continue
    if font is None:
        font = ImageFont.load_default()

    for i, char in enumerate(text):
        charImg = Image.new("RGBA", (70, 70), (0, 0, 0, 0))
        charDraw = ImageDraw.Draw(charImg)
        charDraw.text((15, 10), char, font=font, fill=(random.randint(20, 70), random.randint(20, 80), random.randint(70, 150), 255))

        rotAngle = random.uniform(-22, 22)
        rotated = charImg.rotate(rotAngle, resample=Image.Resampling.BILINEAR, expand=False)
        px = 20 + i * charSpacing + random.randint(-4, 4)
        py = 10 + random.randint(-5, 8)
        img.paste(rotated, (px, py), rotated)

    draw = ImageDraw.Draw(img)
    x1, y1 = random.randint(5, 40), random.randint(15, height - 15)
    x2, y2 = random.randint(width - 40, width - 5), random.randint(15, height - 15)
    draw.line([(x1, y1), (x2, y2)], fill=(random.randint(60, 120), random.randint(60, 120), random.randint(120, 180), 160), width=2)

    img = img.filter(ImageFilter.SMOOTH_MORE)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    dataUrl = f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"
    return ansHash, salt, dataUrl, text

generate_text_challenge = createTextChallenge

def createSliderChallenge() -> Tuple[str, str, Dict[str, Any], int]:
    width, height = 320, 160
    pieceSize = 46

    targetX = random.randint(70, width - pieceSize - 30)
    targetY = random.randint(25, height - pieceSize - 20)

    salt = generateSalt()
    ansHash = hashAnswer(salt, str(targetX))

    bg = Image.new("RGBA", (width, height), (30, 41, 59, 255))
    draw = ImageDraw.Draw(bg)

    for y in range(height):
        r = int(24 + 30 * (y / height))
        g = int(40 + 60 * (y / height))
        b = int(70 + 90 * (y / height))
        draw.line([(0, y), (width, y)], fill=(r, g, b, 255))

    colors = [(45, 85, 125, 230), (59, 130, 246, 180), (16, 185, 129, 160), (139, 92, 246, 140)]
    for idx, col in enumerate(colors):
        yBase = 50 + idx * 25
        poly = [(0, height)]
        step = 40
        for x in range(0, width + step, step):
            polyY = yBase + int(math.sin(x * 0.03 + idx) * 25) + int(math.cos(x * 0.015) * 15)
            poly.append((x, polyY))
        poly.append((width, height))
        draw.polygon(poly, fill=col)

    for _ in range(40):
        draw.point((random.randint(0, width - 1), random.randint(0, 70)), fill=(255, 255, 255, random.randint(150, 255)))

    box = (targetX, targetY, targetX + pieceSize, targetY + pieceSize)
    piece = bg.crop(box)

    pieceDraw = ImageDraw.Draw(piece)
    pieceDraw.rectangle([0, 0, pieceSize - 1, pieceSize - 1], outline=(255, 255, 255, 200), width=2)
    pieceDraw.ellipse([pieceSize // 2 - 6, 2, pieceSize // 2 + 6, 14], fill=(255, 255, 255, 120))

    hole = Image.new("RGBA", (pieceSize, pieceSize), (15, 23, 42, 220))
    holeDraw = ImageDraw.Draw(hole)
    holeDraw.rectangle([0, 0, pieceSize - 1, pieceSize - 1], outline=(200, 220, 255, 240), width=2)
    holeDraw.ellipse([pieceSize // 2 - 6, 2, pieceSize // 2 + 6, 14], fill=(15, 23, 42, 220), outline=(200, 220, 255, 240), width=1)
    bg.paste(hole, (targetX, targetY), hole)

    bgBuf = io.BytesIO()
    bg.save(bgBuf, format="PNG")
    bgDataUrl = f"data:image/png;base64,{base64.b64encode(bgBuf.getvalue()).decode('utf-8')}"

    pieceBuf = io.BytesIO()
    piece.save(pieceBuf, format="PNG")
    pieceDataUrl = f"data:image/png;base64,{base64.b64encode(pieceBuf.getvalue()).decode('utf-8')}"

    payload = {
        "bg_image": bgDataUrl,
        "piece_image": pieceDataUrl,
        "target_y": targetY,
        "piece_width": pieceSize,
        "piece_height": pieceSize,
        "canvas_width": width,
        "canvas_height": height
    }

    return ansHash, salt, payload, targetX

generate_slider_challenge = createSliderChallenge

def drawTile(category: str, width: int = 110, height: int = 110) -> Image.Image:
    img = Image.new("RGBA", (width, height), (240, 240, 240, 255))
    draw = ImageDraw.Draw(img)

    if category == "Traffic Lights":
        for y in range(height):
            c = int(190 + 35 * (y / height))
            draw.line([(0, y), (width, y)], fill=(c - 20, c - 10, c, 255))
        draw.rectangle([50, 40, 60, height], fill=(60, 64, 67, 255))
        draw.rectangle([38, 12, 72, 88], fill=(30, 34, 40, 255), outline=(15, 18, 22, 255), width=2)
        draw.ellipse([44, 18, 66, 38], fill=(220, 38, 38, 255), outline=(100, 10, 10, 255))
        draw.ellipse([44, 40, 66, 60], fill=(234, 179, 8, 255), outline=(100, 80, 5, 255))
        draw.ellipse([44, 62, 66, 82], fill=(34, 197, 94, 255), outline=(10, 80, 30, 255))
    elif category == "Bicycles":
        for y in range(height):
            draw.line([(0, y), (width, y)], fill=(215 + int(y * 0.2), 220 + int(y * 0.15), 225, 255))
        draw.rectangle([0, 88, width, height], fill=(90, 95, 105, 255))
        draw.ellipse([14, 60, 46, 92], outline=(30, 35, 45, 255), width=4)
        draw.ellipse([64, 60, 96, 92], outline=(30, 35, 45, 255), width=4)
        draw.line([(30, 76), (30, 62)], fill=(120, 120, 130, 255), width=1)
        draw.line([(30, 76), (18, 76)], fill=(120, 120, 130, 255), width=1)
        draw.line([(80, 76), (80, 62)], fill=(120, 120, 130, 255), width=1)
        draw.line([(80, 76), (68, 76)], fill=(120, 120, 130, 255), width=1)
        frameCol = (31, 94, 255, 255)
        draw.line([(30, 76), (54, 76)], fill=frameCol, width=3)
        draw.line([(54, 76), (46, 50)], fill=frameCol, width=3)
        draw.line([(30, 76), (46, 50)], fill=frameCol, width=3)
        draw.line([(46, 50), (74, 50)], fill=frameCol, width=3)
        draw.line([(54, 76), (74, 50)], fill=frameCol, width=3)
        draw.line([(74, 50), (80, 76)], fill=frameCol, width=3)
        draw.line([(42, 48), (50, 48)], fill=(20, 20, 20, 255), width=4)
        draw.line([(72, 42), (76, 42)], fill=(20, 20, 20, 255), width=4)
    elif category == "Fire Hydrants":
        for y in range(height):
            draw.line([(0, y), (width, y)], fill=(210, 215, 220, 255))
        draw.rectangle([0, 85, width, height], fill=(130, 135, 145, 255))
        hydrantRed = (220, 38, 38, 255)
        draw.rectangle([42, 40, 68, 92], fill=hydrantRed, outline=(140, 20, 20, 255), width=2)
        draw.ellipse([40, 26, 70, 48], fill=hydrantRed, outline=(140, 20, 20, 255), width=2)
        draw.rectangle([50, 20, 60, 28], fill=(160, 25, 25, 255))
        draw.rectangle([30, 52, 42, 64], fill=hydrantRed, outline=(140, 20, 20, 255), width=2)
        draw.rectangle([68, 52, 80, 64], fill=hydrantRed, outline=(140, 20, 20, 255), width=2)
        draw.rectangle([36, 88, 74, 98], fill=hydrantRed, outline=(140, 20, 20, 255), width=2)
    elif category == "Buses":
        for y in range(height):
            if y < 75:
                draw.line([(0, y), (width, y)], fill=(195, 215, 235, 255))
            else:
                draw.line([(0, y), (width, y)], fill=(85, 90, 100, 255))
        draw.rounded_rectangle([15, 30, 95, 80], radius=5, fill=(234, 179, 8, 255), outline=(160, 110, 5, 255), width=2)
        winCol = (186, 230, 253, 255)
        draw.rectangle([22, 38, 38, 52], fill=winCol, outline=(30, 30, 30, 255), width=1)
        draw.rectangle([42, 38, 56, 52], fill=winCol, outline=(30, 30, 30, 255), width=1)
        draw.rectangle([60, 38, 74, 52], fill=winCol, outline=(30, 30, 30, 255), width=1)
        draw.rectangle([78, 38, 88, 52], fill=winCol, outline=(30, 30, 30, 255), width=1)
        draw.ellipse([25, 74, 43, 92], fill=(20, 20, 20, 255))
        draw.ellipse([67, 74, 85, 92], fill=(20, 20, 20, 255))
        draw.ellipse([31, 80, 37, 86], fill=(180, 180, 180, 255))
        draw.ellipse([73, 80, 79, 86], fill=(180, 180, 180, 255))
    elif category == "Crosswalks":
        draw.rectangle([0, 0, width, height], fill=(50, 55, 65, 255))
        draw.polygon([(20, 100), (32, 100), (45, 10), (38, 10)], fill=(245, 245, 250, 255))
        draw.polygon([(46, 100), (58, 100), (62, 10), (55, 10)], fill=(245, 245, 250, 255))
        draw.polygon([(72, 100), (84, 100), (79, 10), (72, 10)], fill=(245, 245, 250, 255))
    elif category == "Trees":
        for y in range(height):
            if y < 70:
                draw.line([(0, y), (width, y)], fill=(180, 210, 235, 255))
            else:
                draw.line([(0, y), (width, y)], fill=(74, 130, 55, 255))
        draw.rectangle([48, 50, 62, 85], fill=(110, 65, 30, 255))
        draw.ellipse([30, 18, 80, 68], fill=(34, 140, 60, 255))
        draw.ellipse([40, 12, 70, 48], fill=(40, 160, 70, 255))
    elif category == "Houses":
        for y in range(height):
            if y < 75:
                draw.line([(0, y), (width, y)], fill=(200, 220, 240, 255))
            else:
                draw.line([(0, y), (width, y)], fill=(100, 140, 80, 255))
        draw.rectangle([30, 45, 80, 82], fill=(225, 215, 200, 255), outline=(100, 80, 60, 255), width=2)
        draw.polygon([(25, 45), (55, 20), (85, 45)], fill=(185, 45, 35, 255), outline=(120, 30, 25, 255))
        draw.rectangle([48, 62, 62, 82], fill=(85, 45, 25, 255))
    else:
        for y in range(height):
            draw.line([(0, y), (width, y)], fill=(140 + int(y * 0.7), 185 + int(y * 0.4), 235, 255))
        draw.ellipse([20, 35, 65, 75], fill=(255, 255, 255, 220))
        draw.ellipse([45, 25, 90, 70], fill=(255, 255, 255, 240))
        draw.ellipse([60, 40, 95, 75], fill=(255, 255, 255, 220))

    for _ in range(80):
        nx = random.randint(0, width - 1)
        ny = random.randint(0, height - 1)
        draw.point((nx, ny), fill=(random.randint(100, 200), random.randint(100, 200), random.randint(100, 200), 40))

    return img

_draw_tile = drawTile

def createImageSelectChallenge() -> Tuple[str, str, Dict[str, Any], str]:
    targetCategories = ["Traffic Lights", "Bicycles", "Fire Hydrants", "Buses", "Crosswalks"]
    distractorCategories = ["Trees", "Houses", "Clouds"]

    targetName = random.choice(targetCategories)
    otherTargets = [c for c in targetCategories if c != targetName]
    distractorPool = distractorCategories + otherTargets

    numTargets = random.randint(2, 4)
    targetIndices = sorted(random.sample(range(9), numTargets))
    solutionStr = ",".join(str(i) for i in targetIndices)

    salt = generateSalt()
    ansHash = hashAnswer(salt, solutionStr)

    tiles = []
    for idx in range(9):
        tileImg = drawTile(targetName) if idx in targetIndices else drawTile(random.choice(distractorPool))
        buf = io.BytesIO()
        tileImg.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        tiles.append(f"data:image/png;base64,{b64}")

    payload = {
        "target_category": targetName,
        "prompt": f"Select all squares with {targetName}",
        "tiles": tiles,
        "grid_size": 3,
        "total_tiles": 9
    }
    return ansHash, salt, payload, solutionStr

generate_image_select_challenge = createImageSelectChallenge

def createClickOrderChallenge() -> Tuple[str, str, Dict[str, Any], str]:
    symbols = ["A", "B", "C", "D", "E", "F", "H", "K", "M", "N", "P", "R", "T", "W", "X", "Y", "3", "4", "7", "8", "9"]
    chosen = random.sample(symbols, 5)
    targetSymbols = chosen[:3]
    distractors = chosen[3:]

    width, height = 340, 180
    img = Image.new("RGBA", (width, height), (245, 246, 248, 255))
    draw = ImageDraw.Draw(img)

    for x in range(0, width, 20):
        draw.line([(x, 0), (x, height)], fill=(225, 228, 235, 160), width=1)
    for y in range(0, height, 20):
        draw.line([(0, y), (width, y)], fill=(225, 228, 235, 160), width=1)

    for _ in range(3):
        pts = []
        phase = random.uniform(0, 6.28)
        baseY = random.randint(30, height - 30)
        for cx in range(0, width, 6):
            cy = baseY + int(math.sin(cx * 0.03 + phase) * 14)
            pts.append((cx, cy))
        if len(pts) > 1:
            draw.line(pts, fill=(195, 205, 220, 180), width=1)

    placedItems = []
    allSymbols = [(s, True) for s in targetSymbols] + [(s, False) for s in distractors]
    random.shuffle(allSymbols)

    for sym, isTarget in allSymbols:
        placed = False
        for _ in range(60):
            x = random.randint(45, width - 45)
            y = random.randint(40, height - 40)
            if not any(math.hypot(x - px, y - py) < 55 for px, py, _, _ in placedItems):
                placedItems.append((x, y, sym, isTarget))
                placed = True
                break
        if not placed:
            placedItems.append((40 + len(placedItems) * 55, 90, sym, isTarget))

    font = None
    for fc in ["arial.ttf", "segoeui.ttf", "tahoma.ttf", "calibri.ttf"]:
        try:
            font = ImageFont.truetype(fc, 30)
            break
        except Exception:
            continue
    if font is None:
        font = ImageFont.load_default()

    palette = [
        (26, 86, 219, 255),
        (185, 28, 28, 255),
        (21, 128, 61, 255),
        (109, 40, 217, 255),
        (180, 83, 9, 255)
    ]

    for idx, (x, y, sym, _) in enumerate(placedItems):
        col = palette[idx % len(palette)]
        charCanvas = Image.new("RGBA", (50, 50), (0, 0, 0, 0))
        charDraw = ImageDraw.Draw(charCanvas)
        charDraw.text((12, 6), sym, font=font, fill=col)

        rotTile = charCanvas.rotate(random.uniform(-20, 20), resample=Image.Resampling.BILINEAR, expand=False)
        draw.ellipse([x - 22, y - 22, x + 22, y + 22], outline=(200, 210, 225, 200), width=1)
        img.paste(rotTile, (x - 25, y - 25), rotTile)

    targetSolution = []
    for ts in targetSymbols:
        for x, y, sym, isTarget in placedItems:
            if isTarget and sym == ts:
                targetSolution.append({"symbol": ts, "x": x, "y": y})
                break

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    dataUrl = f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"

    rawSalt = generateSalt()
    salt = f"{rawSalt}|{json.dumps([{'x': t['x'], 'y': t['y']} for t in targetSolution])}"
    ansHash = hashAnswer(rawSalt, "->".join(targetSymbols))

    payload = {
        "image_data": dataUrl,
        "target_sequence": targetSymbols,
        "prompt": f"Click the symbols in order: {' → '.join(targetSymbols)}",
        "canvas_width": width,
        "canvas_height": height,
        "target_count": len(targetSymbols)
    }
    return ansHash, salt, payload, json.dumps(targetSolution)

generate_click_order_challenge = createClickOrderChallenge

def createRotateChallenge() -> Tuple[str, str, Dict[str, Any], int]:
    size = 200
    img = Image.new("RGBA", (size, size), (245, 246, 248, 255))
    draw = ImageDraw.Draw(img)

    draw.ellipse([10, 10, size - 10, size - 10], fill=(255, 255, 255, 255), outline=(217, 217, 212, 255), width=2)
    draw.ellipse([25, 25, size - 25, size - 25], fill=(30, 41, 59, 255))

    center = size // 2
    for deg in range(0, 360, 30):
        rad = math.radians(deg)
        x1 = center + int(math.sin(rad) * 65)
        y1 = center - int(math.cos(rad) * 65)
        x2 = center + int(math.sin(rad) * 72)
        y2 = center - int(math.cos(rad) * 72)
        draw.line([(x1, y1), (x2, y2)], fill=(100, 116, 139, 255), width=1)

    draw.polygon([
        (center, center - 62),
        (center - 18, center - 6),
        (center, center - 16),
        (center + 18, center - 6)
    ], fill=(239, 68, 68, 255), outline=(185, 28, 28, 255))

    draw.polygon([
        (center, center + 55),
        (center - 16, center + 4),
        (center, center + 14),
        (center + 16, center + 4)
    ], fill=(31, 94, 255, 255), outline=(29, 78, 216, 255))

    draw.ellipse([center - 9, center - 9, center + 9, center + 9], fill=(255, 255, 255, 255), outline=(15, 23, 42, 255), width=2)
    draw.ellipse([center - 4, center - 4, center + 4, center + 4], fill=(31, 94, 255, 255))

    theta = random.randint(50, 310)
    targetAngle = (360 - theta) % 360

    rotated = img.rotate(-theta, resample=Image.Resampling.BILINEAR)
    buf = io.BytesIO()
    rotated.save(buf, format="PNG")
    dataUrl = f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"

    rawSalt = generateSalt()
    salt = f"{rawSalt}|{targetAngle}"
    ansHash = hashAnswer(rawSalt, str(targetAngle))

    payload = {
        "image_data": dataUrl,
        "prompt": "Rotate the image until the arrow points straight up (North)",
        "canvas_size": size,
        "initial_angle": 0
    }
    return ansHash, salt, payload, targetAngle

generate_rotate_challenge = createRotateChallenge

def createMathChallenge() -> Tuple[str, str, Dict[str, Any], int]:
    op = random.choice(["+", "-", "×"])
    if op == "+":
        a = random.randint(12, 58)
        b = random.randint(8, 38)
        result = a + b
    elif op == "-":
        a = random.randint(25, 75)
        b = random.randint(7, a - 5)
        result = a - b
    else:
        a = random.randint(3, 9)
        b = random.randint(4, 9)
        result = a * b

    equationText = f"{a} {op} {b} = ?"
    salt = generateSalt()
    ansHash = hashAnswer(salt, str(result))

    width, height = 260, 90
    img = Image.new("RGBA", (width, height), (248, 248, 246, 255))
    draw = ImageDraw.Draw(img)

    for x in range(0, width, 18):
        draw.line([(x, 0), (x, height)], fill=(230, 230, 226, 255), width=1)
    for y in range(0, height, 18):
        draw.line([(0, y), (width, y)], fill=(230, 230, 226, 255), width=1)

    for _ in range(120):
        nx = random.randint(0, width - 1)
        ny = random.randint(0, height - 1)
        draw.point((nx, ny), fill=(random.randint(140, 190), random.randint(140, 190), random.randint(150, 200), 180))

    for _ in range(2):
        pts = []
        phase = random.uniform(0, 6.28)
        baseY = random.randint(25, height - 25)
        for cx in range(0, width, 5):
            cy = baseY + int(math.sin(cx * 0.04 + phase) * 12)
            pts.append((cx, cy))
        if len(pts) > 1:
            draw.line(pts, fill=(160, 170, 190, 160), width=1)

    font = None
    for fc in ["arial.ttf", "segoeui.ttf", "consola.ttf", "calibri.ttf"]:
        try:
            font = ImageFont.truetype(fc, 36)
            break
        except Exception:
            continue
    if font is None:
        font = ImageFont.load_default()

    charSpacing = (width - 40) // len(equationText)
    for i, char in enumerate(equationText):
        charCanvas = Image.new("RGBA", (50, 50), (0, 0, 0, 0))
        charDraw = ImageDraw.Draw(charCanvas)
        charDraw.text((10, 5), char, font=font, fill=(random.randint(20, 50), random.randint(20, 60), random.randint(80, 140), 255))
        rotC = charCanvas.rotate(random.uniform(-14, 14), resample=Image.Resampling.BILINEAR)
        px = 16 + i * charSpacing + random.randint(-2, 2)
        py = 18 + random.randint(-4, 4)
        img.paste(rotC, (px, py), rotC)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    dataUrl = f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"

    payload = {
        "image_data": dataUrl,
        "prompt": "Calculate the arithmetic result",
        "canvas_width": width,
        "canvas_height": height
    }
    return ansHash, salt, payload, result

generate_math_challenge = createMathChallenge

def createCaptcha(challengeType: str = "text", length: int = 5) -> Tuple[str, str, Dict[str, Any], Any]:
    if challengeType == "slider":
        return createSliderChallenge()
    elif challengeType == "image_select":
        return createImageSelectChallenge()
    elif challengeType == "click_order":
        return createClickOrderChallenge()
    elif challengeType == "rotate":
        return createRotateChallenge()
    elif challengeType == "math":
        return createMathChallenge()
    else:
        ansHash, salt, dataUrl, solution = createTextChallenge(length=length)
        return ansHash, salt, {"image_data": dataUrl}, solution
