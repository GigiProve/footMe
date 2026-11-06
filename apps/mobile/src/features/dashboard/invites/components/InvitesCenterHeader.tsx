/**
 * Il componente vive ora in `dashboard/components/SocietyContextHeader`,
 * dove DAS-REV-20 lo riusa senza dipendere dal modulo Inviti.
 *
 * Il nome locale resta: i chiamanti di DAS-REV-19 non cambiano, e
 * rinominarli avrebbe allargato il diff senza cambiare nulla a schermo.
 */
export { SocietyContextHeader as InvitesCenterHeader } from "../../components/SocietyContextHeader";
