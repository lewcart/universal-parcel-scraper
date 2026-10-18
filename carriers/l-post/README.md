# L-POST

L-POST parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

L-POST (Л-Пост) is the delivery service of the Labirint bookselling holding, with its own
pickup points and couriers for online shops and marketplaces. Its tracking page says a track
number is the letters ABC followed by eight digits, typed in full. Archived lookups on that
page and the examples in its API manual have this layout, and the `l-post-1` rule claims it.
The page also accepts the shop's own order number, which has no fixed layout and is not
claimed.

## Links

The tracking page reads the number from its `id` parameter and writes it back there after a
search, so `l-post.ru/tracking?id=` opens one parcel. Older lookups used
`l-post.ru/tracking/order?id=`. The library reads the number from both.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
