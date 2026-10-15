# J&T Express China

J&T Express China parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

The tracker accepts thirteen digits, or `JT` or `UT` followed by thirteen digits. Archived
lookups on J&T China's tracker carry `JT` numbers. J&T's Philippine network prints the same
`JT` and thirteen digits, so `j-and-t-cn-1` only suggests J&T China alongside J&T Express.
Bare thirteen-digit numbers are shared by many carriers and have no rule.

## Links

The home page form sends up to ten numbers to `jtexpress.com.cn/service.html` in `indexIpt`,
so `www.jtexpress.com.cn/service.html?indexIpt={number}` opens one parcel.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
