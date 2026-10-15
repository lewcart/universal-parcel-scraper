# TK KIT

TK KIT parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

A consignment is tracked by its forwarding receipt: six Cyrillic letters, then ten digits. The
tracker also accepts the ten digits alone. The library accepts only Latin letters and digits,
so the full receipt is not recognised, and ten digits are shared by many carriers, so no rule
claims them.

## Links

`tk-kit.ru/tracking?track_code={number}` opens one consignment: the tracker page writes the
number into that parameter as it is typed and looks it up on load. The site's earlier direct
tracking links, `tk-kit.ru/?tracking={number}` and the same on tk-kit.com, are read too.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
