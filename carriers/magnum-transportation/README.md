# Magnum Transportation

Magnum Transportation shipments use enabled universal providers. There is no dedicated adapter.

Magnum Transportation (Magnum LTL) is a less-than-truckload and truckload freight carrier based in
Fargo, North Dakota. Its site is magnumlog.com.

## Numbers

Magnum Transportation publishes no PRO number format, and no public page shows one of its numbers,
so there is no rule.

## Why there is no adapter

Its tracking form posts `trace_type` (`2PTRACE` for a Magnum pro bill, or a C/L pro, bill, bill of
lading or booking number type) and `search_value` to
`portal.magnumlog.com/trace/external_bill_viewer.msw`, with no page or address per number. That
portal's gateway answers with a 502 error, the form's own request included, so no reply is known,
and no public number is known to see a found one.

## Links

No tracking link is known.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
