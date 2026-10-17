# Nepal Post

Nepal Post items use enabled universal providers. There is no dedicated adapter.

## Numbers

International items carry UPU S10 numbers ending in `NP`, which generic postal detection
handles. No domestic layout is claimed.

## Links

The General Post Office in Kathmandu links two trackers. For international tracking it links the
UPU's Global Track & Trace, which the [UPU provider](../../providers/upu/README.md) reads. For
domestic tracking it links Nepal Post's internal tracking system, which opens one item at
`pits.gpo.gov.np/Inquiry/InquiryIndexClient?ItemId={number}`, also served from the address
`202.166.194.38`. The library reads the number from both.

## Why there is no adapter

The internal tracking system renders an item's scans on its server for a plain `GET` of that
address, without an account, token or captcha. The page repeats the number above the scan table
and says "No Events Found" for a number it holds nothing for. It does not answer connections
from outside Nepal: from Europe, the Americas, Africa, Oceania, the Middle East and the rest of
Asia, including India, Bangladesh and Pakistan, the connection times out, while a Nepali network
gets the page. Nepal Post has no tracking app, and its international tracker is the UPU's, which
the UPU provider already reads, so Nepal Post stays on universal providers.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
