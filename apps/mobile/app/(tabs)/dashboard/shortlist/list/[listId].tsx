/**
 * Dettaglio di una lista personalizzata dentro la tab Dashboard.
 *
 * DAS-REV-24 §25: «tap CUSTOM → dettaglio canonico già esistente». La
 * schermata è quella di RET-07, montata anche qui perché §31 chiede che la
 * bottom navigation resti visibile: `/shortlist/[listId]`, fuori dalle tab,
 * la perdeva. La route vecchia resta valida per i link già emessi (§26).
 */
import { ShortlistListDetailScreen } from "../../../../../src/features/shortlist/components/ShortlistListDetailScreen";

export default ShortlistListDetailScreen;
