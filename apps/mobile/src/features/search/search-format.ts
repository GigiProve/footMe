const ITALIAN_MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

/** "Scadenza 15 luglio" from a date-only ISO string (parsed without timezone drift). */
export function formatDeadlineLabel(deadline: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(deadline);

  if (!match) {
    return "";
  }

  const day = Number(match[3]);
  const month = ITALIAN_MONTHS[Number(match[2]) - 1];

  if (!month || day < 1 || day > 31) {
    return "";
  }

  return `Scadenza ${day} ${month}`;
}

/** Small label helper for the club-kind chip family, shared across rows. */
export function formatClubKindLabel(isAffiliate: boolean): string {
  return isAffiliate ? "Affiliata" : "Società";
}
