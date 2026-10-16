# JS Express

JS Express parcels use enabled universal providers. There is no dedicated adapter.

JS Express (急速国际), run by 急创速供应链管理（苏州）有限公司, ships
parcels abroad from China for online shops, through dedicated lines, express and postal
services, and a local carrier delivers them. Its tracking page posts the waybill number to
`index.php?page=19` and shows the scans in the page; an unknown number reads
"未获取到任何数据".

## Numbers

JS Express waybills are `JSE`, two capital letters, ten digits and `YQ`, the layout 17FEIA,
WanbExpress, SFC and CJ Packet use with prefixes of their own. The `JSE` prefix is JS
Express's own, so `js-express-1` claims the layout. The samples and their sources are in
[`numbers.json`](numbers.json).

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
