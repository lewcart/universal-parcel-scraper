"""Locate a translucent puzzle cutout; never submit or retain a challenge."""
import base64
import json
import os
import sys

os.environ.setdefault("OPENCV_IO_MAX_IMAGE_PIXELS", "1048576")
import cv2
import numpy as np

cv2.setNumThreads(1)


def decode(value):
    if not isinstance(value, str) or len(value) > 1_500_000:
        return None
    if not value.startswith(("data:image/png;base64,", "data:image/jpeg;base64,")):
        return None
    try:
        raw = base64.b64decode(value.split(",", 1)[1], validate=True)
        image = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_UNCHANGED)
    except Exception:
        return None
    if image is None or len(image.shape) != 3 or image.shape[2] not in (3, 4):
        return None
    if min(image.shape[:2]) < 32 or max(image.shape[:2]) > 1024:
        return None
    return image


def locate(challenge):
    if not isinstance(challenge, dict) or challenge.get("type") not in ("SLIDER", "CONCAT"):
        return None
    background = decode(challenge.get("backgroundImage"))
    if background is None or [background.shape[1], background.shape[0]] != [
            challenge.get("backgroundImageWidth"), challenge.get("backgroundImageHeight")]:
        return None
    if challenge["type"] == "CONCAT":
        top = challenge.get("concatTopHeight")
        if not isinstance(top, int) or top < 8 or top > background.shape[0] - 8:
            return None
        # The page moves its upper strip cyclically to the right. The two
        # sides of a correct seam retain the photograph's colour continuity.
        above = background[top - 3:top, :, :3].astype(np.float32).mean(axis=0)
        below = background[top:top + 3, :, :3].astype(np.float32).mean(axis=0)
        costs = sorted((float(np.abs(np.roll(above, x, axis=0) - below).mean()), x)
                       for x in range(background.shape[1]))
        best = costs[0]
        other = next((item for item in costs if min(abs(item[1] - best[1]),
                     background.shape[1] - abs(item[1] - best[1])) > background.shape[1] / 20), None)
        if best[0] >= 25 or other is None or other[0] <= best[0] * 1.3 + 1:
            return None
        return {"x": best[1]}
    template = decode(challenge.get("templateImage"))
    if template is None or template.shape[2] != 4:
        return None
    height, width = background.shape[:2]
    if (template.shape[0] != height or template.shape[1] >= width
            or [width, height, template.shape[1], template.shape[0]] != [
                challenge.get("backgroundImageWidth"), challenge.get("backgroundImageHeight"),
                challenge.get("templateImageWidth"), challenge.get("templateImageHeight")]):
        return None
    opaque = (template[:, :, 3] > 220).astype(np.uint8)
    outline = opaque - cv2.erode(opaque, np.ones((3, 3), np.uint8))
    ys, xs = np.where(outline)
    if len(xs) < 100 or len(xs) > 2000 or ys.min() < 4 or ys.max() >= height - 4:
        return None
    gray = cv2.cvtColor(background, cv2.COLOR_BGRA2GRAY if background.shape[2] == 4 else cv2.COLOR_BGR2GRAY)
    matches = []
    low_peak = None
    for lower, upper, minimum_margin in ((120, 240, .3), (80, 160, .3), (40, 80, .5)):
        edges = cv2.Canny(gray, lower, upper)
        distance = cv2.distanceTransform((edges == 0).astype(np.uint8), cv2.DIST_L2, 3)
        candidates = []
        for dy in range(-3, 4):
            for x in range(12, width - template.shape[1]):
                cost = float(np.minimum(distance[ys + dy, xs + x], 5).mean())
                candidates.append((cost, x))
        if not candidates:
            return None
        candidates.sort()
        best = candidates[0]
        competitor = next((item for item in candidates if abs(item[1] - best[1]) > template.shape[1] / 3), None)
        # Distractors can share a fill. Require a distinct contour, and reject
        # edge scales that confidently disagree about its position.
        if best[0] < 1.3 and competitor is not None and competitor[0] - best[0] > minimum_margin:
            matches.append(best[1])
        if lower == 40:
            low_peak = best
    if matches:
        return {"x": int(round(sum(matches) / len(matches)))} if max(matches) - min(matches) <= 3 else None
    # A faded cutout can lose its strong outline while retaining photograph
    # texture. Accept that only when independent texture and edge peaks agree.
    interior = cv2.erode(opaque, np.ones((7, 7), np.uint8))
    if interior.sum() < 100:
        return None
    scores = cv2.matchTemplate(gray, cv2.cvtColor(template, cv2.COLOR_BGRA2GRAY),
                               cv2.TM_CCOEFF_NORMED, mask=interior)
    scores = np.nan_to_num(scores, nan=-1, posinf=-1, neginf=-1)
    scores[:, :12] = -1
    _, score, _, location = cv2.minMaxLoc(scores)
    x = location[0]
    radius = max(1, int(template.shape[1] / 3))
    scores[:, max(0, x - radius):x + radius + 1] = -1
    other = float(scores.max())
    return {"x": x} if (score >= .5 and score - other > .12 and low_peak is not None
                         and low_peak[0] < 1 and abs(low_peak[1] - x) <= 2) else None



if __name__ == "__main__":
    try:
        raw = sys.stdin.buffer.read(3_100_001)
        answer = locate(json.loads(raw)) if len(raw) <= 3_100_000 else None
    except Exception:
        answer = None
    print(json.dumps(answer))
