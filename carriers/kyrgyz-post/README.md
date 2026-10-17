# Kyrgyz Post

Kyrgyz Post parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Kyrgyz Post handles UPU S10 numbers; items it sends end in `KG`. Its tracking page shows only
items arriving in Kyrgyzstan and gives an inbound Singapore Post item as its example, and a
review of Kyrgyz Post quotes an inbound China Post parcel. Generic postal detection handles S10
numbers, so Kyrgyz Post has no rule of its own.

## Links

The tracking page at post.kg looks a number up through a form post behind reCAPTCHA, so no
address opens one parcel. The former tracker on kyrgyzpost.kg read the number from the
`searchword` parameter of `/ru/zip-search.html`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
