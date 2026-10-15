# SiCepat Ekspres

SiCepat Ekspres parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

SiCepat resi numbers are twelve digits starting `00`. SiCepat's own replies to complaints on
Media Konsumen give them. Twelve digits are also FedEx's and other carriers' layout, and the
`00` start does not set SiCepat apart, so no rule claims them.

## Links

SiCepat's tracker reads the number from its form and asks for a reCAPTCHA token, and sometimes
the recipient's phone number, before it shows a parcel. No address opens one parcel.

The current public client posts to `api.sicepatconsumer.com/v2/contentsvc/public/validate-awb-id`
with `awb_number` and a fresh `x-recaptcha` token for action `checkAwb`. Ordinary waybills then
use `check-awb` under the same prefix with `awb_id` and `awb_number`, after fresh verification.
The other branch requires the recipient phone's last five digits. The Android app's current
guest route also sends a reCAPTCHA token; its older content-service routes do not establish
another usable guest path. A failed token and an explicit missing-waybill reply are separate.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
