# GSI Express

GSI Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

GSI Express flies parcels from its warehouses in Oregon and New Jersey to Korea, clears them
through Korean customs and hands them to Korea Post for delivery. It also ships from the United
States to Japan with Sagawa and to Singapore.

Its tracker takes the seven-digit GSI receipt number, which it calls the invoice number, and
the thirteen-digit Korea Post registered number of the domestic leg. Archived lookups show both
layouts on one page. Seven digits cannot name a carrier, and the Korea Post numbers stay with
Korea Post's rule, so no rule here claims them.

## Links

The tracker's query page opens
`www.gsiexpress.com/track_pop.php?textfield={number}&track_type=invoice_no` for receipt
numbers, and archived lookups use `track_pop.php?textfield={number}`. The lookup on the home
page opens `www.gsiexpress.com/track_pop.php?track_type=ship_num&query_num={number}` for Korea
Post numbers.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
