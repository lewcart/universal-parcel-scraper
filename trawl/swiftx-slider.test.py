"""Synthetic image checks; run with the optional TRAWL Python runtime."""
import base64
import importlib.util
import os
from pathlib import Path
import unittest

import cv2
import numpy as np

module = Path(os.environ.get('SWIFTX_SLIDER_MODULE', Path(__file__).with_name('swiftx-slider.py')))
spec = importlib.util.spec_from_file_location('swiftx_slider', module)
slider = importlib.util.module_from_spec(spec)
spec.loader.exec_module(slider)


def png(image):
    return 'data:image/png;base64,' + base64.b64encode(cv2.imencode('.png', image)[1]).decode()


def puzzle(positions=(150,)):
    height, width, tile_width = 180, 320, 64
    mask = np.zeros((height, tile_width), np.uint8)
    cv2.rectangle(mask, (12, 60), (52, 108), 255, -1)
    cv2.circle(mask, (12, 75), 8, 0, -1)
    cv2.circle(mask, (52, 90), 8, 255, -1)
    cv2.circle(mask, (34, 108), 8, 0, -1)
    tile = np.full((height, tile_width, 4), 120, np.uint8)
    tile[:, :, 3] = mask
    background = np.full((height, width, 3), 80, np.uint8)
    edge = mask - cv2.erode(mask, np.ones((3, 3), np.uint8))
    for x in positions:
        region = background[:, x:x + tile_width]
        region[mask > 0] = 20
        region[edge > 0] = 250
    return dict(type='SLIDER', backgroundImage=png(background), templateImage=png(tile),
                backgroundImageWidth=width, backgroundImageHeight=height,
                templateImageWidth=tile_width, templateImageHeight=height)


class SliderTests(unittest.TestCase):
    def test_joined_image(self):
        width, height, top = 320, 180, 90
        x = np.arange(width)
        colour = np.stack((120 + 70 * np.sin(x / 13), 120 + 60 * np.cos(x / 9),
                           120 + 65 * np.sin(x / 17)), axis=1)
        background = np.clip(np.tile(colour, (height, 1, 1)), 0, 255).astype(np.uint8)
        background[:top] = np.roll(background[:top], -73, axis=1)
        data = dict(type='CONCAT', backgroundImage=png(background),
                    backgroundImageWidth=width, backgroundImageHeight=height, concatTopHeight=top)
        self.assertEqual(slider.locate(data), {'x': 73})
        data['backgroundImage'] = png(np.full((height, width, 3), 80, np.uint8))
        self.assertIsNone(slider.locate(data))

    def test_unique_contour(self):
        self.assertAlmostEqual(slider.locate(puzzle())['x'], 150, delta=1)
        data = puzzle()
        background = slider.decode(data['backgroundImage'])
        background[np.all(background == 250, axis=2)] = 115
        data['backgroundImage'] = png(background)
        self.assertAlmostEqual(slider.locate(data)['x'], 150, delta=1)

    def test_ambiguous_contours(self):
        self.assertIsNone(slider.locate(puzzle((40, 180))))

    def test_dimension_mismatch(self):
        data = puzzle()
        data['backgroundImageWidth'] += 1
        self.assertIsNone(slider.locate(data))

    def test_invalid_or_unsupported(self):
        for data in (None, {}, dict(puzzle(), type='ROTATE'), dict(puzzle(), backgroundImage='invalid')):
            self.assertIsNone(slider.locate(data))

    def test_no_puzzle_outline(self):
        data = puzzle()
        data['templateImage'] = png(np.full((180, 64, 4), 255, np.uint8))
        self.assertIsNone(slider.locate(data))


if __name__ == '__main__':
    unittest.main()
