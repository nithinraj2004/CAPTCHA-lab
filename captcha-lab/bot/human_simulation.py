import asyncio
import math
import random
from typing import Tuple
from playwright.async_api import Page

def calculateBezierPoint(p0: Tuple[float, float], p1: Tuple[float, float], p2: Tuple[float, float], p3: Tuple[float, float], t: float) -> Tuple[float, float]:
    u = 1.0 - t
    tt = t * t
    uu = u * u
    uuu = uu * u
    ttt = tt * t

    x = uuu * p0[0] + 3 * uu * t * p1[0] + 3 * u * tt * p2[0] + ttt * p3[0]
    y = uuu * p0[1] + 3 * uu * t * p1[1] + 3 * u * tt * p2[1] + ttt * p3[1]
    return (x, y)

calculate_bezier_point = calculateBezierPoint

async def simulateFastBot(page: Page, inputSelector: str, submitSelector: str, answer: str):
    await page.wait_for_selector(inputSelector, timeout=8000)
    await page.locator(inputSelector).focus()
    await page.keyboard.type(answer, delay=5)
    await page.wait_for_selector(submitSelector, timeout=8000)
    await page.locator(submitSelector).click()

simulate_fast_bot = simulateFastBot

async def simulateSyntheticMouse(page: Page, inputSelector: str, submitSelector: str, answer: str):
    startX, startY = 50.0, 50.0
    await page.mouse.move(startX, startY)

    inputBox = await page.locator(inputSelector).bounding_box()
    if not inputBox:
        await page.fill(inputSelector, answer)
        await page.click(submitSelector)
        return

    targetX = inputBox["x"] + inputBox["width"] / 2
    targetY = inputBox["y"] + inputBox["height"] / 2

    steps = 25
    for i in range(1, steps + 1):
        ratio = i / steps
        cx = startX + (targetX - startX) * ratio
        cy = startY + (targetY - startY) * ratio
        await page.mouse.move(cx, cy)
        await asyncio.sleep(0.015)

    await page.mouse.down()
    await asyncio.sleep(0.02)
    await page.mouse.up()

    for char in answer:
        await page.keyboard.press(char)
        await asyncio.sleep(0.05)

    submitBox = await page.locator(submitSelector).bounding_box()
    if submitBox:
        subX = submitBox["x"] + submitBox["width"] / 2
        subY = submitBox["y"] + submitBox["height"] / 2
        for i in range(1, 15):
            ratio = i / 15
            cx = targetX + (subX - targetX) * ratio
            cy = targetY + (subY - targetY) * ratio
            await page.mouse.move(cx, cy)
            await asyncio.sleep(0.015)

        await page.mouse.down()
        await asyncio.sleep(0.02)
        await page.mouse.up()

simulate_synthetic_mouse = simulateSyntheticMouse

async def simulateRegularTiming(page: Page, inputSelector: str, submitSelector: str, answer: str):
    await page.mouse.move(100, 100)
    await asyncio.sleep(0.1)

    inputBox = await page.locator(inputSelector).bounding_box()
    if inputBox:
        targetX = inputBox["x"] + inputBox["width"] / 2
        targetY = inputBox["y"] + inputBox["height"] / 2

        for i in range(1, 21):
            cx = 100 + (targetX - 100) * (i / 20)
            cy = 100 + (targetY - 100) * (i / 20)
            await page.mouse.move(cx, cy)
            await asyncio.sleep(0.025)

        await page.mouse.click(targetX, targetY)
        await asyncio.sleep(0.12)

    for char in answer:
        await page.keyboard.press(char)
        await asyncio.sleep(0.120)

    await asyncio.sleep(0.15)
    submitBox = await page.locator(submitSelector).bounding_box()
    if submitBox:
        await page.mouse.click(submitBox["x"] + submitBox["width"] / 2, submitBox["y"] + submitBox["height"] / 2)

simulate_regular_timing = simulateRegularTiming

async def simulateRandomizedTiming(page: Page, inputSelector: str, submitSelector: str, answer: str):
    await asyncio.sleep(random.uniform(0.3, 0.7))

    startX = random.uniform(80, 200)
    startY = random.uniform(80, 200)
    await page.mouse.move(startX, startY)

    inputBox = await page.locator(inputSelector).bounding_box()
    if inputBox:
        destX = inputBox["x"] + random.uniform(inputBox["width"] * 0.2, inputBox["width"] * 0.8)
        destY = inputBox["y"] + random.uniform(inputBox["height"] * 0.3, inputBox["height"] * 0.7)

        ctrl1X = startX + (destX - startX) * random.uniform(0.1, 0.4) + random.uniform(-40, 40)
        ctrl1Y = startY + (destY - startY) * random.uniform(0.1, 0.4) + random.uniform(-40, 40)
        ctrl2X = startX + (destX - startX) * random.uniform(0.6, 0.9) + random.uniform(-30, 30)
        ctrl2Y = startY + (destY - startY) * random.uniform(0.6, 0.9) + random.uniform(-30, 30)

        numPoints = random.randint(28, 45)
        for i in range(numPoints):
            t = i / (numPoints - 1)
            bx, by = calculateBezierPoint((startX, startY), (ctrl1X, ctrl1Y), (ctrl2X, ctrl2Y), (destX, destY), t)
            await page.mouse.move(bx, by)
            await asyncio.sleep(random.uniform(0.008, 0.024))

        await page.mouse.down()
        await asyncio.sleep(random.uniform(0.06, 0.12))
        await page.mouse.up()
        await asyncio.sleep(random.uniform(0.1, 0.25))

    for char in answer:
        await page.keyboard.press(char)
        interval = max(0.06, random.gauss(0.14, 0.04))
        await asyncio.sleep(interval)

    await asyncio.sleep(random.uniform(0.15, 0.35))

    submitBox = await page.locator(submitSelector).bounding_box()
    if submitBox:
        subX = submitBox["x"] + random.uniform(submitBox["width"] * 0.25, submitBox["width"] * 0.75)
        subY = submitBox["y"] + random.uniform(submitBox["height"] * 0.25, submitBox["height"] * 0.75)
        await page.mouse.move(subX, subY)
        await asyncio.sleep(random.uniform(0.04, 0.09))
        await page.mouse.click(subX, subY)

simulate_randomized_timing = simulateRandomizedTiming

async def simulateSliderBot(page: Page, profile: str, targetOffsetX: float):
    handleEl = await page.wait_for_selector("#slider-handle", timeout=8000)
    box = await handleEl.bounding_box()
    if not box:
        return
    hx = box["x"] + box["width"] / 2
    hy = box["y"] + box["height"] / 2

    await page.mouse.move(hx, hy)
    await page.mouse.down()

    if profile == "fast":
        await page.mouse.move(hx + targetOffsetX, hy)
    elif profile == "regular":
        steps = 20
        for i in range(1, steps + 1):
            await page.mouse.move(hx + targetOffsetX * (i / steps), hy)
            await asyncio.sleep(0.02)
    elif profile == "randomized":
        steps = random.randint(25, 40)
        for i in range(1, steps + 1):
            ratio = i / steps
            jitterY = hy + random.uniform(-2, 2)
            await page.mouse.move(hx + targetOffsetX * ratio, jitterY)
            await asyncio.sleep(random.uniform(0.01, 0.025))
    else:
        for i in range(1, 15):
            await page.mouse.move(hx + targetOffsetX * (i / 15), hy)
            await asyncio.sleep(0.015)

    await asyncio.sleep(0.05)
    await page.mouse.up()
    await asyncio.sleep(0.1)

    slider = page.locator("#slider-input")
    if await slider.count() > 0:
        await slider.evaluate(f"""el => {{
            const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
            if (proto && proto.set) {{
                proto.set.call(el, {targetOffsetX});
            }} else {{
                el.value = {targetOffsetX};
            }}
            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
            el.dispatchEvent(new Event('change', {{ bubbles: true }}));
        }}""")

    await asyncio.sleep(0.1)
    submitBtn = page.locator("#captcha-submit-btn")
    if await submitBtn.is_visible():
        await submitBtn.click()

simulate_slider_bot = simulateSliderBot
