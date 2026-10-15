# Viettel Post CAPTCHA model

`captcha.onnx` is the unmodified `common_old.onnx` from
[sml2h3/ddddocr](https://github.com/sml2h3/ddddocr/tree/c40f56f95412e10bcb9bd0bd24411e92f896d238).
The upstream MIT license is retained in [LICENSE](LICENSE).

The worker accepts the legacy tracker's text images, resizes them to the model's
grayscale input and decodes its CTC output. `characters.json` retains the blank,
Latin-letter and digit labels at their original indices from `CHARSET_OLD`.
An output outside that alphabet is unreadable, rather than forced to a Latin character.
This model does not solve reCAPTCHA or locate ordered Chinese-character clicks.
