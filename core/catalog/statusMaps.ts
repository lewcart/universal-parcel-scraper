/**
 * The carriers' status maps, asked about one scan at a time.
 *
 * The parcel app keeps the wording no carrier map staged for review, keyed by
 * carrier, provider code and normalized wording. `statusMapAnswer` tells it
 * what the map of the scraper it runs says about such a key: the stage the map
 * gives it, a gap the map leaves on purpose, or nothing. A carrier declares its
 * `statusMap` next to its map in `status.ts`; carriers without one answer
 * `unknown`. The scans the app files under the carrier `unknown` come from the
 * universal providers, whose map is the reading they give a scan
 * (`providers/status.ts`).
 */
import { statusMap as seventeenFeia } from '../../carriers/17feia/status.js';
import { statusMap as fivePost } from '../../carriers/5post/status.js';
import { statusMap as ninetynineMinutos } from '../../carriers/99minutos/status.js';
import { statusMap as abfFreight } from '../../carriers/abf-freight/status.js';
import { statusMap as acsCourier } from '../../carriers/acs-courier/status.js';
import { statusMap as algeriePoste } from '../../carriers/algerie-poste/status.js';
import { statusMap as aliexpress } from '../../carriers/aliexpress/status.js';
import { statusMap as allegroOne } from '../../carriers/allegro-one/status.js';
import { statusMap as anPost } from '../../carriers/an-post/status.js';
import { statusMap as andreani } from '../../carriers/andreani/status.js';
import { statusMap as anjun } from '../../carriers/anjun/status.js';
import { statusMap as anteraja } from '../../carriers/anteraja/status.js';
import { statusMap as apcOvernight } from '../../carriers/apc-overnight/status.js';
import { statusMap as aramexAu } from '../../carriers/aramex-au/status.js';
import { statusMap as aramexNz } from '../../carriers/aramex-nz/status.js';
import { statusMap as arasKargo } from '../../carriers/aras-kargo/status.js';
import { statusMap as arrowXl } from '../../carriers/arrow-xl/status.js';
import { statusMap as austrianPost } from '../../carriers/austrian-post/status.js';
import { statusMap as averitt } from '../../carriers/averitt/status.js';
import { statusMap as aymakan } from '../../carriers/aymakan/status.js';
import { statusMap as bangladeshPost } from '../../carriers/bangladesh-post/status.js';
import { statusMap as baridAlMaghrib } from '../../carriers/barid-al-maghrib/status.js';
import { statusMap as belpost } from '../../carriers/belpost/status.js';
import { statusMap as blueExpress } from '../../carriers/blue-express/status.js';
import { statusMap as bosta } from '../../carriers/bosta/status.js';
import { statusMap as boxNow } from '../../carriers/box-now/status.js';
import { statusMap as bulgarianPosts } from '../../carriers/bulgarian-posts/status.js';
import { statusMap as byhd } from '../../carriers/byhd/status.js';
import { statusMap as cacesa } from '../../carriers/cacesa/status.js';
import { statusMap as cargus } from '../../carriers/cargus/status.js';
import { statusMap as cdek } from '../../carriers/cdek/status.js';
import { statusMap as cdl } from '../../carriers/cdl/status.js';
import { statusMap as celeritas } from '../../carriers/celeritas/status.js';
import { statusMap as centralTransport } from '../../carriers/central-transport/status.js';
import { statusMap as ceskaPosta } from '../../carriers/ceska-posta/status.js';
import { statusMap as cevaLogistics } from '../../carriers/ceva-logistics/status.js';
import { statusMap as chilexpress } from '../../carriers/chilexpress/status.js';
import { statusMap as chinaPost } from '../../carriers/china-post/status.js';
import { statusMap as chitChats } from '../../carriers/chit-chats/status.js';
import { statusMap as chronopost } from '../../carriers/chronopost/status.js';
import { statusMap as chunghwaPost } from '../../carriers/chunghwa-post/status.js';
import { statusMap as citymail } from '../../carriers/citymail/status.js';
import { statusMap as cjLogistics } from '../../carriers/cj-logistics/status.js';
import { statusMap as cjPacket } from '../../carriers/cj-packet/status.js';
import { statusMap as coordinadora } from '../../carriers/coordinadora/status.js';
import { statusMap as correoArgentino } from '../../carriers/correo-argentino/status.js';
import { statusMap as correosDeMexico } from '../../carriers/correos-de-mexico/status.js';
import { statusMap as correosExpress } from '../../carriers/correos-express/status.js';
import { statusMap as correosSpain } from '../../carriers/correos-spain/status.js';
import { statusMap as courierCenter } from '../../carriers/courier-center/status.js';
import { statusMap as couriersPlease } from '../../carriers/couriersplease/status.js';
import { statusMap as cseRussia } from '../../carriers/cse-russia/status.js';
import { statusMap as cttyex } from '../../carriers/cttyex/status.js';
import { statusMap as cyprusPost } from '../../carriers/cyprus-post/status.js';
import { statusMap as daiPost } from '../../carriers/dai-post/status.js';
import { statusMap as danskeFragtmaend } from '../../carriers/danske-fragtmaend/status.js';
import { statusMap as dayRoss } from '../../carriers/day-ross/status.js';
import { statusMap as dao } from '../../carriers/dao/status.js';
import { statusMap as dellin } from '../../carriers/dellin/status.js';
import { statusMap as delnext } from '../../carriers/delnext/status.js';
import { statusMap as deppon } from '../../carriers/deppon/status.js';
import { statusMap as dhlExpress } from '../../carriers/dhl-express/status.js';
import { statusMap as dhlFreight } from '../../carriers/dhl-freight/status.js';
import { statusMap as dhlink } from '../../carriers/dhlink/status.js';
import { statusMap as dpd } from '../../carriers/dpd/status.js';
import { statusMap as dpdAt } from '../../carriers/dpd-at/status.js';
import { statusMap as dpdBe } from '../../carriers/dpd-be/status.js';
import { statusMap as dpdDe } from '../../carriers/dpd-de/status.js';
import { statusMap as dpdFr } from '../../carriers/dpd-fr/status.js';
import { statusMap as dpdIe } from '../../carriers/dpd-ie/status.js';
import { statusMap as dpdNl } from '../../carriers/dpd-nl/status.js';
import { statusMap as dpdPl } from '../../carriers/dpd-pl/status.js';
import { statusMap as dpdPt } from '../../carriers/dpd-pt/status.js';
import { statusMap as dpdZa } from '../../carriers/dpd-za/status.js';
import { statusMap as drop2shop } from '../../carriers/drop2shop/status.js';
import { statusMap as dsv } from '../../carriers/dsv/status.js';
import { statusMap as dx } from '../../carriers/dx/status.js';
import { statusMap as dynalogic } from '../../carriers/dynalogic/status.js';
import { statusMap as earlyBird } from '../../carriers/early-bird/status.js';
import { statusMap as econt } from '../../carriers/econt/status.js';
import { statusMap as egyptPost } from '../../carriers/egypt-post/status.js';
import { statusMap as elta } from '../../carriers/elta/status.js';
import { statusMap as emile } from '../../carriers/emile/status.js';
import { statusMap as emsVietnam } from '../../carriers/ems-vietnam/status.js';
import { statusMap as energiaTk } from '../../carriers/energia-tk/status.js';
import { statusMap as enviaColombia } from '../../carriers/envia-colombia/status.js';
import { statusMap as envialia } from '../../carriers/envialia/status.js';
import { statusMap as epostGlobal } from '../../carriers/epost-global/status.js';
import { statusMap as estes } from '../../carriers/estes/status.js';
import { statusMap as expressOne } from '../../carriers/express-one/status.js';
import { statusMap as fanCourier } from '../../carriers/fan-courier/status.js';
import { statusMap as fedexPl } from '../../carriers/fedex-pl/status.js';
import { statusMap as fermopoint } from '../../carriers/fermopoint/status.js';
import { statusMap as fgDelivery } from '../../carriers/fg-delivery/status.js';
import { statusMap as flashExpress } from '../../carriers/flash-express/status.js';
import { statusMap as flashExpressPh } from '../../carriers/flash-express-ph/status.js';
import { statusMap as fourPx } from '../../carriers/four-px/status.js';
import { statusMap as foxpost } from '../../carriers/foxpost/status.js';
import { statusMap as fukuyama } from '../../carriers/fukuyama/status.js';
import { statusMap as gati } from '../../carriers/gati/status.js';
import { statusMap as gdex } from '../../carriers/gdex/status.js';
import { statusMap as gebruederWeiss } from '../../carriers/gebrueder-weiss/status.js';
import { statusMap as geis } from '../../carriers/geis/status.js';
import { statusMap as geodisPl } from '../../carriers/geodis-pl/status.js';
import { statusMap as geniki } from '../../carriers/geniki-taxydromiki/status.js';
import { statusMap as glsEs } from '../../carriers/gls-es/status.js';
import { statusMap as glsIt } from '../../carriers/gls-it/status.js';
import { statusMap as goExpress } from '../../carriers/go-express/status.js';
import { statusMap as gofo } from '../../carriers/gofo/status.js';
import { statusMap as gofoFr } from '../../carriers/gofo-fr/status.js';
import { statusMap as gofoIt } from '../../carriers/gofo-it/status.js';
import { statusMap as gzyl } from '../../carriers/gzyl/status.js';
import { statusMap as hanjin } from '../../carriers/hanjin/status.js';
import { statusMap as happyPost } from '../../carriers/happy-post/status.js';
import { statusMap as haypost } from '../../carriers/haypost/status.js';
import { statusMap as hctLogistics } from '../../carriers/hct-logistics/status.js';
import { statusMap as helthjem } from '../../carriers/helthjem/status.js';
import { statusMap as hepsijet } from '../../carriers/hepsijet/status.js';
import { statusMap as hermesAt } from '../../carriers/hermes-at/status.js';
import { statusMap as hispapost } from '../../carriers/hispapost/status.js';
import { statusMap as hrParcel } from '../../carriers/hr-parcel/status.js';
import { statusMap as hrvatskaPosta } from '../../carriers/hrvatska-posta/status.js';
import { statusMap as hywl } from '../../carriers/hywl/status.js';
import { statusMap as imile } from '../../carriers/imile/status.js';
import { statusMap as instabox } from '../../carriers/instabox/status.js';
import { statusMap as interrapidisimo } from '../../carriers/interrapidisimo/status.js';
import { statusMap as israelPost } from '../../carriers/israel-post/status.js';
import { statusMap as jAndT } from '../../carriers/j-and-t/status.js';
import { statusMap as jntCargo } from '../../carriers/j-and-t-cargo/status.js';
import { statusMap as jhgj } from '../../carriers/jhgj/status.js';
import { statusMap as jordanPost } from '../../carriers/jordan-post/status.js';
import { statusMap as jitsu } from '../../carriers/jitsu/status.js';
import { statusMap as jne } from '../../carriers/jne/status.js';
import { statusMap as jrt } from '../../carriers/jrt/status.js';
import { statusMap as jsExpress } from '../../carriers/js-express/status.js';
import { statusMap as kazpost } from '../../carriers/kazpost/status.js';
import { statusMap as kex } from '../../carriers/kex/status.js';
import { statusMap as kuehneNagel } from '../../carriers/kuehne-nagel/status.js';
import { statusMap as laPoste } from '../../carriers/la-poste/status.js';
import { statusMap as latvijasPasts } from '../../carriers/latvijas-pasts/status.js';
import { statusMap as leopardsCourier } from '../../carriers/leopards-courier/status.js';
import { statusMap as lietuvosPastas } from '../../carriers/lietuvos-pastas/status.js';
import { statusMap as linhan } from '../../carriers/linhan/status.js';
import { statusMap as lionParcel } from '../../carriers/lion-parcel/status.js';
import { statusMap as logen } from '../../carriers/logen/status.js';
import { statusMap as loggi } from '../../carriers/loggi/status.js';
import { statusMap as loomisExpress } from '../../carriers/loomis-express/status.js';
import { statusMap as lotteGlobal } from '../../carriers/lotte-global/status.js';
import { statusMap as magyarPosta } from '../../carriers/magyar-posta/status.js';
import { statusMap as mailamericas } from '../../carriers/mailamericas/status.js';
import { statusMap as mainfreight } from '../../carriers/mainfreight/status.js';
import { statusMap as maltapost } from '../../carriers/maltapost/status.js';
import { statusMap as matkahuolto } from '../../carriers/matkahuolto/status.js';
import { statusMap as mayiyinfu } from '../../carriers/mayiyinfu/status.js';
import { statusMap as meest } from '../../carriers/meest/status.js';
import { statusMap as metropolitanWarehouse } from '../../carriers/metropolitan-warehouse/status.js';
import { statusMap as mngKargo } from '../../carriers/mng-kargo/status.js';
import { statusMap as mtscn } from '../../carriers/mtscn/status.js';
import { statusMap as mylerz } from '../../carriers/mylerz/status.js';
import { statusMap as naqel } from '../../carriers/naqel/status.js';
import { statusMap as nationex } from '../../carriers/nationex/status.js';
import { statusMap as nipost } from '../../carriers/nipost/status.js';
import { statusMap as nipponExpress } from '../../carriers/nippon-express/status.js';
import { statusMap as oca } from '../../carriers/oca/status.js';
import { statusMap as oldDominion } from '../../carriers/old-dominion/status.js';
import { statusMap as olvaCourier } from '../../carriers/olva-courier/status.js';
import { statusMap as omgo } from '../../carriers/omgo/status.js';
import { statusMap as omniva } from '../../carriers/omniva/status.js';
import { statusMap as orlenPaczka } from '../../carriers/orlen-paczka/status.js';
import { statusMap as osmWorldwide } from '../../carriers/osm-worldwide/status.js';
import { statusMap as packlink } from '../../carriers/packlink/status.js';
import { statusMap as pakistanPost } from '../../carriers/pakistan-post/status.js';
import { statusMap as paquetexpress } from '../../carriers/paquetexpress/status.js';
import { statusMap as passport } from '../../carriers/passport/status.js';
import { statusMap as pathaoCourier } from '../../carriers/pathao-courier/status.js';
import { statusMap as pecom } from '../../carriers/pecom/status.js';
import { statusMap as phlpost } from '../../carriers/phlpost/status.js';
import { statusMap as posIndonesia } from '../../carriers/pos-indonesia/status.js';
import { statusMap as postLuxembourg } from '../../carriers/post-luxembourg/status.js';
import { statusMap as postaNorthMacedonia } from '../../carriers/posta-north-macedonia/status.js';
import { statusMap as postaRomana } from '../../carriers/posta-romana/status.js';
import { statusMap as postaSlovenije } from '../../carriers/posta-slovenije/status.js';
import { statusMap as postaSrbije } from '../../carriers/posta-srbije/status.js';
import { statusMap as postlogistics } from '../../carriers/postlogistics/status.js';
import { statusMap as posturinn } from '../../carriers/posturinn/status.js';
import { statusMap as ppl } from '../../carriers/ppl/status.js';
import { statusMap as ptt } from '../../carriers/ptt/status.js';
import { statusMap as raben } from '../../carriers/raben/status.js';
import { statusMap as redpack } from '../../carriers/redpack/status.js';
import { statusMap as redur } from '../../carriers/redur/status.js';
import { statusMap as redx } from '../../carriers/redx/status.js';
import { statusMap as relaytech } from '../../carriers/relaytech/status.js';
import { statusMap as rlCarriers } from '../../carriers/rl-carriers/status.js';
import { statusMap as rpxIndonesia } from '../../carriers/rpx-indonesia/status.js';
import { statusMap as saia } from '../../carriers/saia/status.js';
import { statusMap as sagawa } from '../../carriers/sagawa/status.js';
import { statusMap as sailpost } from '../../carriers/sailpost/status.js';
import { statusMap as sameday } from '../../carriers/sameday/status.js';
import { statusMap as saudiPost } from '../../carriers/saudi-post/status.js';
import { statusMap as seino } from '../../carriers/seino/status.js';
import { statusMap as sending } from '../../carriers/sending/status.js';
import { statusMap as serpost } from '../../carriers/serpost/status.js';
import { statusMap as servientrega } from '../../carriers/servientrega/status.js';
import { statusMap as sfc } from '../../carriers/sfc/status.js';
import { statusMap as shadowfax } from '../../carriers/shadowfax/status.js';
import { statusMap as skroutzLastMile } from '../../carriers/skroutz-last-mile/status.js';
import { statusMap as skynetWorldwide } from '../../carriers/skynet-worldwide/status.js';
import { statusMap as slovakParcelService } from '../../carriers/slovak-parcel-service/status.js';
import { statusMap as slovenskaPosta } from '../../carriers/slovenska-posta/status.js';
import { statusMap as smsaExpress } from '../../carriers/smsa-express/status.js';
import { statusMap as southAfricanPost } from '../../carriers/south-african-post-office/status.js';
import { statusMap as southeasternFreightLines } from '../../carriers/southeastern-freight-lines/status.js';
import { statusMap as speedaf } from '../../carriers/speedaf/status.js';
import { statusMap as speedex } from '../../carriers/speedex/status.js';
import { statusMap as speedx } from '../../carriers/speedx/status.js';
import { statusMap as speedy } from '../../carriers/speedy/status.js';
import { statusMap as spxBr } from '../../carriers/spx-br/status.js';
import { statusMap as spxId } from '../../carriers/spx-id/status.js';
import { statusMap as spxMy } from '../../carriers/spx-my/status.js';
import { statusMap as spxTh } from '../../carriers/spx-th/status.js';
import { statusMap as spxTw } from '../../carriers/spx-tw/status.js';
import { statusMap as spxVn } from '../../carriers/spx-vn/status.js';
import { statusMap as stallionExpress } from '../../carriers/stallion-express/status.js';
import { statusMap as starken } from '../../carriers/starken/status.js';
import { statusMap as sto } from '../../carriers/sto/status.js';
import { statusMap as swiftx } from '../../carriers/swiftx/status.js';
import { statusMap as swissPost } from '../../carriers/swiss-post/status.js';
import { statusMap as tCat } from '../../carriers/t-cat/status.js';
import { statusMap as tciExpress } from '../../carriers/tci-express/status.js';
import { statusMap as tcsPakistan } from '../../carriers/tcs-pakistan/status.js';
import { statusMap as teamGlobalExpress } from '../../carriers/team-global-express/status.js';
import { statusMap as tforceFreight } from '../../carriers/tforce-freight/status.js';
import { statusMap as thailandPost } from '../../carriers/thailand-post/status.js';
import { statusMap as thhy } from '../../carriers/thhy/status.js';
import { statusMap as tiki } from '../../carriers/tiki/status.js';
import { statusMap as tnt } from '../../carriers/tnt/status.js';
import { statusMap as tntIt } from '../../carriers/tnt-it/status.js';
import { statusMap as totalExpress } from '../../carriers/total-express/status.js';
import { statusMap as tsjy } from '../../carriers/tsjy/status.js';
import { statusMap as twsExpress } from '../../carriers/tws-express/status.js';
import { statusMap as ubiSmartParcel } from '../../carriers/ubi-smart-parcel/status.js';
import { statusMap as ups } from '../../carriers/ups/status.js';
import { statusMap as uzbekistanPost } from '../../carriers/uzbekistan-post/status.js';
import { statusMap as vaspExpresso } from '../../carriers/vasp-expresso/status.js';
import { statusMap as venipak } from '../../carriers/venipak/status.js';
import { statusMap as viettelPost } from '../../carriers/viettel-post/status.js';
import { statusMap as vintedGo } from '../../carriers/vinted-go/status.js';
import { statusMap as wanbexpress } from '../../carriers/wanbexpress/status.js';
import { statusMap as whistl } from '../../carriers/whistl/status.js';
import { statusMap as xdp } from '../../carriers/xdp/status.js';
import { statusMap as xpoLtl } from '../../carriers/xpo-ltl/status.js';
import { statusMap as zto } from '../../carriers/zto/status.js';
import { statusMap as yunexpress } from '../../carriers/yunexpress/status.js';
import { statusMap as yilongLogistics } from '../../carriers/yilong-logistics/status.js';
import { statusMap as yurticiKargo } from '../../carriers/yurtici-kargo/status.js';
import { statusMap as zeleris } from '../../carriers/zeleris/status.js';
import type { CarrierId, Stage } from '../../generated/catalog.js';
import { statusMap as universal } from '../../providers/status.js';
import { normalizeStatusWording, type CarrierStatusMap } from '../status/statusMap.js';
import { CARRIER_DEFINITIONS } from './definitions.js';

/** By adapter: a carrier served by another's adapter, as Delivengo by La Poste's, reads that map. */
export const STATUS_MAPS: Readonly<Record<string, CarrierStatusMap>> = {
  '17feia': seventeenFeia, '5post': fivePost, '99minutos': ninetynineMinutos, 'abf-freight': abfFreight, 'acs-courier': acsCourier,
  'algerie-poste': algeriePoste, aliexpress,
  'allegro-one': allegroOne, 'an-post': anPost, andreani, anjun, anteraja, 'apc-overnight': apcOvernight, 'aramex-au': aramexAu,
  'aramex-nz': aramexNz, 'aras-kargo': arasKargo, 'arrow-xl': arrowXl, 'austrian-post': austrianPost, averitt, aymakan, 'bangladesh-post': bangladeshPost,
  'barid-al-maghrib': baridAlMaghrib, belpost, 'blue-express': blueExpress, bosta, 'box-now': boxNow, 'bulgarian-posts': bulgarianPosts,
  byhd, cacesa, cargus, cdek, cdl, celeritas,
  'central-transport': centralTransport, 'ceska-posta': ceskaPosta, 'ceva-logistics': cevaLogistics, chilexpress, 'china-post': chinaPost,
  'chit-chats': chitChats, chronopost, 'chunghwa-post': chunghwaPost, citymail, 'cj-logistics': cjLogistics, 'cj-packet': cjPacket, coordinadora,
  'correo-argentino': correoArgentino, 'correos-de-mexico': correosDeMexico, 'correos-express': correosExpress, 'correos-spain': correosSpain,
  'courier-center': courierCenter, couriersplease: couriersPlease, 'cse-russia': cseRussia, cttyex, 'cyprus-post': cyprusPost, 'dai-post': daiPost,
  'danske-fragtmaend': danskeFragtmaend, dao, 'day-ross': dayRoss, dellin, delnext, deppon, 'dhl-express': dhlExpress, 'dhl-freight': dhlFreight, dhlink, dpd, 'dpd-at': dpdAt, 'dpd-be': dpdBe,
  'dpd-de': dpdDe, 'dpd-fr': dpdFr, 'dpd-ie': dpdIe, 'dpd-nl': dpdNl, 'dpd-pl': dpdPl, 'dpd-pt': dpdPt, 'dpd-za': dpdZa, drop2shop, dsv, dx, dynalogic, 'early-bird': earlyBird,
  econt, 'egypt-post': egyptPost, elta, emile, 'ems-vietnam': emsVietnam, 'energia-tk': energiaTk, 'envia-colombia': enviaColombia, envialia,
  'epost-global': epostGlobal, estes,
  'express-one': expressOne, 'fan-courier': fanCourier, 'fedex-pl': fedexPl, fermopoint, 'fg-delivery': fgDelivery, 'flash-express': flashExpress,
  'flash-express-ph': flashExpressPh,
  'four-px': fourPx, foxpost, fukuyama, gati, gdex,
  'gebrueder-weiss': gebruederWeiss, geis, 'geniki-taxydromiki': geniki, 'geodis-pl': geodisPl, 'gls-es': glsEs, 'gls-it': glsIt,
  'go-express': goExpress, gofo, 'gofo-fr': gofoFr, 'gofo-it': gofoIt, gzyl, hanjin, 'happy-post': happyPost, haypost, 'hct-logistics': hctLogistics,
  helthjem, hepsijet, 'hermes-at': hermesAt, hispapost, 'hr-parcel': hrParcel,
  'hrvatska-posta': hrvatskaPosta, hywl, imile, instabox, interrapidisimo, 'israel-post': israelPost, 'j-and-t': jAndT, 'j-and-t-cargo': jntCargo,
  jhgj, jitsu, jne, 'jordan-post': jordanPost, jrt, 'js-express': jsExpress, kazpost, kex, 'kuehne-nagel': kuehneNagel, 'la-poste': laPoste, 'latvijas-pasts': latvijasPasts,
  'leopards-courier': leopardsCourier, 'lietuvos-pastas': lietuvosPastas, linhan, 'lion-parcel': lionParcel, logen, loggi, 'loomis-express': loomisExpress,
  'lotte-global': lotteGlobal, 'magyar-posta': magyarPosta, mailamericas, mainfreight, maltapost, matkahuolto, mayiyinfu, meest,
  'metropolitan-warehouse': metropolitanWarehouse, 'mng-kargo': mngKargo, mtscn, mylerz, naqel, nationex, nipost, 'nippon-express': nipponExpress, oca,
  'old-dominion': oldDominion, 'olva-courier': olvaCourier, omgo, omniva, 'orlen-paczka': orlenPaczka, 'osm-worldwide': osmWorldwide, packlink,
  'pakistan-post': pakistanPost, paquetexpress, passport, 'pathao-courier': pathaoCourier, pecom, phlpost, 'pos-indonesia': posIndonesia,
  'post-luxembourg': postLuxembourg, 'posta-north-macedonia': postaNorthMacedonia, 'posta-romana': postaRomana,
  'posta-slovenije': postaSlovenije, 'posta-srbije': postaSrbije, postlogistics, posturinn, ppl,
  ptt, raben, redpack, redur, redx, relaytech, 'rl-carriers': rlCarriers, 'rpx-indonesia': rpxIndonesia, sagawa, saia, sailpost, sameday, 'saudi-post': saudiPost, seino,
  sending, serpost, servientrega, sfc, shadowfax, 'skroutz-last-mile': skroutzLastMile, 'skynet-worldwide': skynetWorldwide, 'slovak-parcel-service': slovakParcelService,
  'slovenska-posta': slovenskaPosta, 'smsa-express': smsaExpress, 'south-african-post-office': southAfricanPost,
  'southeastern-freight-lines': southeasternFreightLines, speedaf, speedex, speedx, speedy, 'spx-br': spxBr, 'spx-id': spxId, 'spx-my': spxMy,
  'spx-th': spxTh, 'spx-tw': spxTw, 'spx-vn': spxVn, 'stallion-express': stallionExpress, starken, sto, swiftx, 'swiss-post': swissPost,
  't-cat': tCat, 'tci-express': tciExpress, 'tcs-pakistan': tcsPakistan, 'team-global-express': teamGlobalExpress, 'tforce-freight': tforceFreight,
  'thailand-post': thailandPost, thhy, tiki, tnt, 'tnt-it': tntIt, 'total-express': totalExpress, tsjy, 'tws-express': twsExpress, 'ubi-smart-parcel': ubiSmartParcel, ups,
  'uzbekistan-post': uzbekistanPost, 'vasp-expresso': vaspExpresso, venipak, 'viettel-post': viettelPost, 'vinted-go': vintedGo, wanbexpress, whistl, xdp, 'xpo-ltl': xpoLtl,
  'yilong-logistics': yilongLogistics, yunexpress, zto,
  'yurtici-kargo': yurticiKargo, zeleris,
};

/** The carrier the app files the universal providers' scans under. */
const UNIVERSAL_CARRIER = 'unknown';

/** One scan as the app observed it. */
export interface ObservedStatus {
  /**
   * The catalog carrier that served the scan, the prefix of the app's provider
   * event id: `unknown` for a scan a universal provider relayed.
   */
  readonly carrier: string;
  readonly providerCode?: string | null;
  /** The scan's wording, as the carrier sent it or already normalized. */
  readonly description: string;
}

/**
 * What the carrier's map says about a scan: it gives the scan a stage, it
 * leaves it without one on purpose, or it does not know it.
 */
export type StatusMapAnswer =
  | { readonly kind: 'mapped'; readonly stage: Stage }
  | { readonly kind: 'intentional_gap'; readonly note: string }
  | { readonly kind: 'unknown' };

const UNKNOWN: StatusMapAnswer = { kind: 'unknown' };

function carrierStatusMap(carrier: string): CarrierStatusMap | undefined {
  if (carrier === UNIVERSAL_CARRIER) return universal;
  const adapter = Object.hasOwn(CARRIER_DEFINITIONS, carrier)
    ? CARRIER_DEFINITIONS[carrier as CarrierId].tracking.adapter
    : null;
  return adapter && Object.hasOwn(STATUS_MAPS, adapter) ? STATUS_MAPS[adapter] : undefined;
}

/**
 * What the carrier's map says about one observed scan, keyed as the app keys
 * its observations: carrier, provider code and `normalizeStatusWording`
 * wording. A gap without a code covers only wording that came without one; a
 * gap without wording covers every wording of its code. A scan a universal
 * provider relayed is `mapped` with the stage the providers' reading gives it,
 * as the sync does, and `unknown` when neither its code nor a rule stages it.
 */
export function statusMapAnswer(observed: ObservedStatus): StatusMapAnswer {
  const map = carrierStatusMap(observed.carrier);
  const wording = normalizeStatusWording(observed.description);
  if (!map || !wording) return UNKNOWN;
  const code = observed.providerCode || null;
  const stage = map.stage(code, wording);
  if (stage) return { kind: 'mapped', stage };
  const key = code === null ? null : map.codeKey?.(code) ?? code;
  const gap = map.gaps.find((candidate) => (candidate.code ?? null) === key
    && (candidate.wording === undefined || candidate.wording === wording));
  return gap ? { kind: 'intentional_gap', note: gap.note } : UNKNOWN;
}
