export const seasonLabelPattern = /^\d{2}\/\d{2}$/;

export function normalizeSeasonLabelInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function isValidSeasonLabel(value: string) {
  return seasonLabelPattern.test(value.trim());
}

export function splitBirthDate(value: string | null | undefined) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return {
      day: "",
      month: "",
      year: "",
    };
  }

  const [, year, month, day] = match;

  return {
    day,
    month,
    year,
  };
}

export function buildBirthDate({
  day,
  month,
  year,
}: {
  day: string;
  month: string;
  year: string;
}) {
  if (!day || !month || !year) {
    return "";
  }

  return `${year}-${month}-${day}`;
}
