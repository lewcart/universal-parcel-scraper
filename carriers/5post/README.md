# 5Post

5Post parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

5Post's tracker asks for the order number the shop gave, so its numbers follow each sender.
Archived lookups on the tracker and a public complaint show fourteen digits starting `9999`,
`9988` or `9911`, some of them opened from AliExpress order pages, `P` and eleven digits from
Avito, and `BX`, fourteen digits and `FRW`. Lookups also show other shops' order numbers. No
rule claims any of them: the digit runs share their shape with other carriers, and the other
families belong to senders whose parcels may travel with other carriers.

## Links

The site's scripts open one order at `fivepost.ru/tracking?id={number}`. The page itself
redirects to the home page, whose search field takes the number.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
