# Chunghwa Post

Reads Chunghwa Post's international postal tracking through its public image-CAPTCHA flow.

## Retrieval

The [official tracker](https://postserv.post.gov.tw/pstmail/main_mail.html) opens a session
through `SessionServlet` and creates a four-digit JPEG through `jcaptcha` with a fresh UUID.
The adapter uses the shared local [OCR model](../../core/transport/text-captcha-model/README.md)
and posts the same UUID, answer and one whole item to `EsoafDispatcher`, using the public
client's `EB500200` query envelope. One fresh challenge is allowed after an unreadable or
explicitly refused answer. Cookies and verification material stay within that lookup.

The server must confirm verification and repeat the requested item. The parser keeps scan
wording, event codes and processing locations. Overseas and domestic facility clocks retain
their local time without invented offsets. Recipient, dispatch-bag and expanded remark fields
are omitted. Only the server's explicit absence message for the requested item is not found.

## Numbers

Detection names Chunghwa Post for the EMS, parcel, registered and tracked-letter S10 items it
issues: C, E, L or R first, TW last and a passing check digit. Its U-prefixed letter-post items
stay with international mail, since its tracker does not read them.

## Limitations

The direct path supports international EMS, parcel, registered and tracked-letter S10 items.
It refuses other postal services, numeric domestic references and proprietary mainland
formats as invalid input before any request; enabled universal providers follow them.
The tracker retains six months of history, and destination posts can withhold scans.
No cheap HTTP recognition is declared. Changed image geometry remains a challenge.

## Testing

Set `CHUNGHWA_POST_TRACKING_NUMBER` outside Git and run
`npm run test:carriers:live -- carriers/chunghwa-post`. `CHUNGHWA_POST_UNKNOWN_NUMBER` checks an unknown item.
