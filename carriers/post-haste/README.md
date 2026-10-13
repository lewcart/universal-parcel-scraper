# Post Haste

Post Haste parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Post Haste, a Freightways courier, tracks several kinds of label. A courier ticket or Express
Pack carries a product code of up to four letters and an eight-digit ticket number, which its
tracker takes as two fields; the corpus writes them with a space between. Charge labels carry
an eight-digit label number. Customer printed labels pair the sender's account number with a
consignment number, so they are not kept. The track and trace page gives the samples, and
archived lookups on the tracker give the tickets. New Zealand Couriers, another Freightways
brand, prints tickets in the same layout, and eight digits are shared by many carriers, so no
rule claims either.

## Links

The site's search box sends a number to `posthaste.co.nz/track?query={number}`, whose script
asks Freightways for its history. The older servlet at `/phl/servlet/ITNG_TAndTServlet` needs
the product code and ticket number as separate parameters, so it is not read.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
