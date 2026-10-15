# Pakistan Post

Pakistan Post items use enabled universal providers. There is no dedicated adapter.

## Numbers

International items carry UPU S10 numbers ending in `PK`, which generic postal detection
handles. Domestic registered letters and parcels quoted by customers are `RGL` or `PAR`
followed by eight digits; a low-confidence rule suggests Pakistan Post for them.

## Links

Pakistan Post's tracker on ep.gov.pk takes the number in a form behind a CAPTCHA, so no address
opens one item. Its former live tracker took the number in `ArticleIDz` on
`/emtts/EPTrack_Live.aspx`, and the library reads the number from that address.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
