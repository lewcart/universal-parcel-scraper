# Quiqup

Quiqup parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Quiqup's tracker asks for a seven-digit order reference. Detection does not claim it, because
many carriers print bare seven-digit numbers. Parcels handed to a partner carrier are tracked
under that carrier's number.

## Links

Quiqup's tracking links open an order by an unguessable key rather than its reference, so the
library reads no number from them.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
