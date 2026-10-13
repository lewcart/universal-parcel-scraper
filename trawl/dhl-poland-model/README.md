# DHL Poland image verification

The DHL-specific browser helper uses the CPU classifier from
[cateyelow/recaptcha_ia_solver](https://github.com/cateyelow/recaptcha_ia_solver/tree/b8049e7243f6f1e6f7d4c6e9e4eb4befc0eaab21).
The build downloads its ONNX weights and checks their SHA-256 before installation.
The model is YOLOv8s-cls with fourteen classes, RGB float inputs in `[0, 1]`,
and a `1 × 3 × 128 × 128` tensor. Weights stay out of Git and the npm package.

Only supported three-by-three image grids are classified. Tile answers are
bound to their current image URLs, dynamic replacements must finish loading,
and the page must confirm verification. Other grids may be refreshed once;
unsupported or unsuccessful challenges leave the API summary available.
Workers are bounded by the browser deadline and limited to two per process.

The weights declare AGPL-3.0 and use
[Ultralytics](https://github.com/ultralytics/ultralytics/tree/dc824b40bf01ecfd2f535be41691a704bc496674).
They belong only to this AGPL browser-service image. The upstream project's
MIT notice is retained in [UPSTREAM-LICENSE](UPSTREAM-LICENSE). Release artifacts
include its model/training source and the matching Ultralytics source.
