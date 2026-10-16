"""Read the ordered characters in China Post's public verification prompt."""
import base64
import io
import json
import re
import sys

import onnxruntime

_session = onnxruntime.InferenceSession


def limited_session(*args, **kwargs):
    options = kwargs.get("sess_options") or onnxruntime.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    kwargs["sess_options"] = options
    return _session(*args, **kwargs)


onnxruntime.InferenceSession = limited_session

import ddddocr
from PIL import Image

try:
    raw = sys.stdin.buffer.read(100_001)
    if len(raw) > 100_000:
        raise ValueError("Prompt too large")
    encoded = json.loads(raw)
    image = base64.b64decode(encoded, validate=True)
    size = Image.open(io.BytesIO(image)).size
    if not (0 < size[0] <= 400 and 0 < size[1] <= 150):
        raise ValueError("Invalid prompt dimensions")
    text = ddddocr.DdddOcr(show_ad=False, beta=True).classification(image)
    print(json.dumps(text if re.fullmatch(r"[\u3400-\u9fff]{2,4}", text) else None))
except Exception:
    print("null")
