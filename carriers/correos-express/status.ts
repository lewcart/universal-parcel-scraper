import type { ClassifiedStatus } from '../../core/status/index.js';
import type { CarrierStatusMap } from '../../core/status/statusMap.js';

/** The fixed opening of a failed round's note, which the form shows without a label. */
export const FAILED_ROUND = 'Su envío no ha podido ser entregado';

const labels: Record<string, ClassifiedStatus> = {
  INFORMADO: { status: 'pending', stage: 'registered' },
  ADMITIDO: { status: 'in_transit', stage: 'accepted' },
  'ADMITIDO EN OFICINA DE CORREOS': { status: 'in_transit', stage: 'accepted' },
  'EN RUTA A LOCALIDAD DE DESTINO': { status: 'in_transit', stage: 'in_transit' },
  'EN DESTINO': { status: 'in_transit', stage: 'in_transit' },
  'EN REPARTO': { status: 'out_for_delivery', stage: 'out_for_delivery' },
  // The fixed opening the parser keeps from an unlabelled failed round.
  'SU ENVIO NO HA PODIDO SER ENTREGADO': { status: 'exception', stage: 'failed_attempt' },
  // At the chosen pickup point, but the carrier says the collection
  // instructions are still to come; the next scan makes it available.
  'ENTREGADO EN PUNTO DE CONVENIENCIA': { status: 'in_transit', stage: 'in_transit' },
  'DISPONIBLE EN PUNTO DE CONVENIENCIA': { status: 'in_transit', stage: 'ready_for_pickup' },
  ENTREGADO: { status: 'delivered', stage: 'delivered' },
  DEVUELTO: { status: 'exception', stage: 'returned' },
  'EN ALMACEN': { status: 'exception', stage: 'exception' },
  // Customer service is handling an incident on the shipment.
  'EN GESTION': { status: 'exception', stage: 'exception' },
  // The pickup point's holding period ended and the parcel goes back.
  'EL PERIODO DE RECOGIDA DEL ENVIO EN EL PUNTO DE CONVENIENCIA SELECCIONADO HA FINALIZADO Y SE PROCEDERA A SU DEVOLUCION A ORIGEN':
    { status: 'exception', stage: 'returned' },
  ESTACIONADO: { status: 'exception', stage: 'exception' },
  // The accompanying carrier wording describes a rescheduled delivery after
  // an unsuccessful attempt, with the new delivery still in the future.
  'NUEVO REPARTO': { status: 'in_transit', stage: 'in_transit' },
  // The sender asked for delivery to another address; the parcel moves on.
  'CAMBIO DE DESTINO': { status: 'in_transit', stage: 'in_transit' },
};

/**
 * The situations of a Correos Express scan in the Correos group's localizador,
 * by the first three characters of its code, and the label the tracking form
 * shows for the same scan. The rest of the code names the reason.
 */
const SITUATIONS: Record<string, string> = {
  X01: 'INFORMADO',
  X02: 'EN RUTA A LOCALIDAD DE DESTINO',
  X04: 'EN RUTA A LOCALIDAD DE DESTINO',
  X06: 'EN DESTINO',
  X08: 'EN REPARTO',
  // Estacionado in the localizador; the form shows only the failed round's note.
  X09: FAILED_ROUND,
  X10: 'EN ALMACÉN',
  X11: 'NUEVO REPARTO',
  X12: 'ENTREGADO',
  X13: 'EN GESTIÓN',
  X14: 'CAMBIO DE DESTINO',
  X17: 'DEVUELTO',
  X38: 'ENTREGADO EN PUNTO DE CONVENIENCIA',
  X39: 'DISPONIBLE EN PUNTO DE CONVENIENCIA',
};

const key = (label: string) => label.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().replace(/\s+/g, ' ').trim();

export function classifyCorreosExpressStatus(label: string): ClassifiedStatus | undefined {
  const name = key(label);
  return Object.hasOwn(labels, name) ? labels[name] : undefined;
}

/** A Correos Express situation code: X, two digits for the situation, four for the reason, then V or R. */
export function isCorreosExpressCode(code: string): boolean {
  return /^X\d{6}[VR]$/.test(code);
}

/** The label the form shows for a localizador code's situation, when the situation is known. */
export function correosExpressCodeLabel(code: string): string | undefined {
  const situation = code.slice(0, 3);
  return isCorreosExpressCode(code) && Object.hasOwn(SITUATIONS, situation) ? SITUATIONS[situation] : undefined;
}

/** The situation a form label stands for, in a form comparable across labels; ESTACIONADO is the failed round's. */
export function correosExpressSituationKey(label: string): string {
  const name = key(label);
  return name === 'ESTACIONADO' ? key(FAILED_ROUND) : name;
}

/** The label a scan's description opens with: the description is the label, then any fixed explanation. */
export function correosExpressDescriptionLabel(description: string): string {
  const text = description.replace(/\s+/g, ' ').trim();
  if (/^su env[ií]o no ha podido ser entregado\b/iu.test(text)) return FAILED_ROUND;
  return text.split('.')[0]!.trim();
}

export function classifyCorreosExpressDescription(description: string): ClassifiedStatus | undefined {
  if (description.trim().toLowerCase() === 'delivered') return labels.ENTREGADO;
  return classifyCorreosExpressStatus(correosExpressDescriptionLabel(description));
}

export const statusMap: CarrierStatusMap = {
  codeKey: (code) => (isCorreosExpressCode(code) ? code.slice(0, 3) : code),
  stage: (code, wording) => {
    const label = code ? correosExpressCodeLabel(code) : undefined;
    return (label ? classifyCorreosExpressStatus(label) : classifyCorreosExpressDescription(wording))?.stage;
  },
  gaps: [
    { wording: 'tracking update', note: 'A form scan whose label the map does not know, shown under a neutral wording so its note cannot carry personal details.' },
  ],
};
