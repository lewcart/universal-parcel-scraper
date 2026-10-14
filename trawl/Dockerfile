FROM ghcr.io/germondai/trawl:1.8.0@sha256:44091fc0af5f9a0190d4cb23d944f69207684a28382a921800dda5b73b41ba2f
LABEL org.opencontainers.image.source="https://github.com/plhery/universal-parcel-scraper" \
      org.opencontainers.image.licenses="AGPL-3.0-only"
# TRAWL's request log includes the page path, where some carriers put the parcel number.
ENV LOG_LEVEL=warn
COPY LICENSE /usr/share/licenses/trawl/LICENSE
COPY tracking-capture.mjs /app/packages/tiers/src/utils/tracking-capture.mjs
COPY challenge-wait.mjs /app/packages/tiers/src/utils/challenge-wait.mjs
COPY royal-mail-history.mjs /app/packages/tiers/src/utils/royal-mail-history.mjs
COPY fedex-session.mjs /app/packages/tiers/src/utils/fedex-session.mjs
COPY australia-post-browser.mjs /app/packages/tiers/src/utils/australia-post-browser.mjs
COPY wanbexpress-browser.mjs /app/packages/tiers/src/utils/wanbexpress-browser.mjs
COPY xpo-browser.mjs /app/packages/tiers/src/utils/xpo-browser.mjs
COPY magyar-posta-browser.mjs /app/packages/tiers/src/utils/magyar-posta-browser.mjs
COPY asendia-browser.mjs /app/packages/tiers/src/utils/asendia-browser.mjs
COPY dhl-poland-native.mjs /app/packages/tiers/src/utils/dhl-poland-native.mjs
COPY dhl-poland-browser.mjs /app/packages/tiers/src/utils/dhl-poland-browser.mjs
COPY dhl-express-browser.mjs /app/packages/tiers/src/utils/dhl-express-browser.mjs
COPY sf-express-session.mjs /app/packages/tiers/src/utils/sf-express-session.mjs
COPY sf-express-gap.mjs /app/packages/tiers/src/utils/sf-express-gap.mjs
COPY install.mjs /tmp/install-tracking-capture.mjs
RUN bun /tmp/install-tracking-capture.mjs && rm /tmp/install-tracking-capture.mjs
