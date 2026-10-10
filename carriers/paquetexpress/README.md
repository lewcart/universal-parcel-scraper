# Paquetexpress

Paquetexpress parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Paquetexpress's tracker takes a tracking code, a guía number or the shipper's reference.
Lookups archived from it between 2023 and 2025 show eleven-digit tracking codes, every one
starting `011`, some opened from Paquetexpress's own SMS links. Paquetexpress publishes no
layout or check digit, and eleven digits are shared with GLS, PostLogistics and several other
carriers, so no rule claims them and the user picks Paquetexpress.

## Links

The search form opens `www.paquetexpress.com.mx/rastreo/{number}` (`/en/rastreo/{number}` in
English), which shows one parcel; the library reads the number from such a link and builds it.
Several numbers searched at once are joined with hyphens in one address, and the library leaves
those alone.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
