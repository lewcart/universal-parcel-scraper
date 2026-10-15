FROM python:3.12.15-slim-trixie@sha256:a6e34c598f2467ed0e9a8d349809fcd8b5c603269512df273a0bb1784edc11b1 AS zto-ocr
RUN python3 -m venv /opt/zto-ocr \
    && /opt/zto-ocr/bin/pip install --no-cache-dir numpy==2.5.4 pillow==12.3.0 onnxruntime==1.31.0 \
       opencv-python-headless==5.0.0.93 pyyaml==6.0.3 shapely==2.2.0 pyclipper==1.4.0 six==1.17.0 tqdm==4.70.1 \
    && /opt/zto-ocr/bin/pip install --no-cache-dir --no-deps ddddocr==1.6.1 rapidocr-onnxruntime==1.4.4

FROM ghcr.io/germondai/trawl:1.8.0@sha256:44091fc0af5f9a0190d4cb23d944f69207684a28382a921800dda5b73b41ba2f
LABEL org.opencontainers.image.source="https://github.com/plhery/universal-parcel-scraper" \
      org.opencontainers.image.licenses="AGPL-3.0-only"
# TRAWL's request log includes the page path, where some carriers put the parcel number.
ENV LOG_LEVEL=warn
COPY --from=zto-ocr /usr/local /usr/local
COPY --from=zto-ocr /opt/zto-ocr /opt/zto-ocr
RUN /opt/zto-ocr/bin/python -c 'import ddddocr, rapidocr_onnxruntime, cv2'
COPY LICENSE /usr/share/licenses/trawl/LICENSE
COPY tracking-capture.mjs /app/packages/tiers/src/utils/tracking-capture.mjs
COPY challenge-wait.mjs /app/packages/tiers/src/utils/challenge-wait.mjs
COPY royal-mail-history.mjs /app/packages/tiers/src/utils/royal-mail-history.mjs
COPY fedex-session.mjs /app/packages/tiers/src/utils/fedex-session.mjs
COPY australia-post-browser.mjs /app/packages/tiers/src/utils/australia-post-browser.mjs
COPY wanbexpress-browser.mjs /app/packages/tiers/src/utils/wanbexpress-browser.mjs
COPY xpo-browser.mjs /app/packages/tiers/src/utils/xpo-browser.mjs
COPY magyar-posta-browser.mjs /app/packages/tiers/src/utils/magyar-posta-browser.mjs
COPY magyar-posta-app.mjs /app/packages/tiers/src/utils/magyar-posta-app.mjs
COPY asendia-browser.mjs /app/packages/tiers/src/utils/asendia-browser.mjs
COPY recaptcha-audio.mjs /app/packages/tiers/src/utils/recaptcha-audio.mjs
COPY dhl-poland-native.mjs /app/packages/tiers/src/utils/dhl-poland-native.mjs
COPY dhl-poland-browser.mjs /app/packages/tiers/src/utils/dhl-poland-browser.mjs
COPY dhl-express-browser.mjs /app/packages/tiers/src/utils/dhl-express-browser.mjs
COPY sf-express-session.mjs /app/packages/tiers/src/utils/sf-express-session.mjs
COPY sf-express-gap.mjs /app/packages/tiers/src/utils/sf-express-gap.mjs
COPY zto-browser.mjs /app/packages/tiers/src/utils/zto-browser.mjs
COPY zto-slider.mjs /app/packages/tiers/src/utils/zto-slider.mjs
COPY zto-ocr.mjs /app/packages/tiers/src/utils/zto-ocr.mjs
COPY zto-ocr.py /app/packages/tiers/src/utils/zto-ocr.py
COPY install.mjs /tmp/install-tracking-capture.mjs
RUN bun /tmp/install-tracking-capture.mjs && rm /tmp/install-tracking-capture.mjs
