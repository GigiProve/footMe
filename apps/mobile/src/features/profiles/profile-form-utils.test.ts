import { describe, expect, it } from "vitest";

import {
  PROFILE_BIO_MAX_LENGTH,
  calculateAge,
  composeBirthDate,
  createBirthDayOptions,
  formatBirthDateValue,
  formatBirthDate,
  formatBirthDateInputValue,
  formatLocationSummary,
  formatProfileDisplayName,
  getSocialDisplayValue,
  getBirthDateParts,
  getRegionFromCity,
  isEmailValid,
  isPhoneNumberValid,
  isRegionConsistentWithCity,
  isSeasonLabelValid,
  normalizeContactEmail,
  normalizeBirthDateInput,
  normalizeFacebookInput,
  normalizeInstagramInput,
  normalizePhoneInput,
  normalizeProfileBioInput,
  normalizeSeasonLabelInput,
  parseBirthDate,
  parseBirthDateInput,
  searchItalianCities,
  validateProfileBio,
  validateBirthDateInput,
} from "./profile-form-utils";

describe("profile-form-utils", () => {
  it("normalizes season labels to the xx/xx pattern", () => {
    expect(normalizeSeasonLabelInput("2425")).toBe("2024/2025");
    expect(normalizeSeasonLabelInput("2024/25")).toBe("2024/2025");
    expect(normalizeSeasonLabelInput(" 24 / 25 ")).toBe("2024/2025");
    expect(normalizeSeasonLabelInput("2024/2025")).toBe("2024/2025");
  });

  it("validates season labels with the xx/xx pattern", () => {
    expect(isSeasonLabelValid("24/25")).toBe(true);
    expect(isSeasonLabelValid("2024/2025")).toBe(true);
    expect(isSeasonLabelValid("2024/25")).toBe(true);
    expect(isSeasonLabelValid("24-25")).toBe(false);
  });

  it("builds and formats birth dates from picker parts", () => {
    expect(composeBirthDate({ day: "11", month: "03", year: "2001" })).toBe(
      "2001-03-11",
    );
    expect(getBirthDateParts("2001-03-11")).toEqual({
      day: "11",
      month: "03",
      year: "2001",
    });
    expect(formatBirthDate("2001-03-11")).toBe("11/03/2001");
    expect(parseBirthDate("2001-03-11")).toEqual(new Date(2001, 2, 11));
    expect(formatBirthDateValue(new Date(2001, 2, 11))).toBe("2001-03-11");
    expect(formatBirthDateInputValue("2001-03-11")).toBe("11/03/2001");
  });

  it("adjusts available days based on month and leap years", () => {
    expect(createBirthDayOptions("2000", "02")).toHaveLength(29);
    expect(createBirthDayOptions("2001", "02")).toHaveLength(28);
    expect(createBirthDayOptions("2001", "04")).toHaveLength(30);
  });

  it("normalizes and validates manual birth date input", () => {
    const currentDate = new Date(2026, 2, 13);

    expect(normalizeBirthDateInput("15082000")).toBe("15/08/2000");
    expect(parseBirthDateInput("15/08/2000", currentDate)?.isoValue).toBe("2000-08-15");
    expect(validateBirthDateInput("15/08/2000", currentDate)).toEqual({
      isValid: true,
      isoValue: "2000-08-15",
      message: null,
    });
    expect(validateBirthDateInput("31/02/2000", currentDate).isValid).toBe(false);
    expect(validateBirthDateInput("14/03/2026", currentDate).isValid).toBe(false);
  });

  it("calculates age and formats personal header summaries", () => {
    const currentDate = new Date(2026, 2, 13);

    expect(calculateAge("2000-03-13", currentDate)).toBe(26);
    expect(calculateAge("15/08/2000", currentDate)).toBe(25);
    expect(formatProfileDisplayName("Mario Rossi", 26)).toBe("Mario Rossi, 26");
    expect(formatLocationSummary("Milano", "Lombardia")).toBe("Milano, Lombardia");
  });

  it("searches italian cities and resolves their regions", () => {
    const suggestions = searchItalianCities("Mil", 5);

    expect(suggestions.some((entry) => entry.name === "Milano")).toBe(true);
    expect(getRegionFromCity("Milano")).toBe("Lombardia");
    expect(getRegionFromCity("Roma")).toBe("Lazio");
    expect(isRegionConsistentWithCity("Milano", "Lombardia")).toBe(true);
    expect(isRegionConsistentWithCity("Milano", "Lazio")).toBe(false);
  });

  it("normalizes and validates public contact fields", () => {
    expect(normalizeInstagramInput("@mario.rossi")).toBe(
      "https://instagram.com/mario.rossi",
    );
    expect(normalizeInstagramInput("https://instagram.com/mario.rossi/")).toBe(
      "https://instagram.com/mario.rossi",
    );
    expect(normalizeFacebookInput("mario.rossi")).toBe(
      "https://facebook.com/mario.rossi",
    );
    expect(normalizeContactEmail(" Mario@Example.com ")).toBe("mario@example.com");
    expect(isEmailValid("mario@example.com")).toBe(true);
    expect(isEmailValid("mario@example")).toBe(false);
    expect(normalizePhoneInput("+39 333 123 4567")).toBe("+393331234567");
    expect(normalizePhoneInput("0039 3331234567")).toBe("+393331234567");
    expect(isPhoneNumberValid("+393331234567")).toBe(true);
    expect(isPhoneNumberValid("+1234567")).toBe(true);
    expect(isPhoneNumberValid("3331234567")).toBe(false);
    expect(getSocialDisplayValue("instagram", "https://instagram.com/mario.rossi")).toBe(
      "@mario.rossi",
    );
    expect(getSocialDisplayValue("facebook", "https://facebook.com/mario.rossi")).toBe(
      "mario.rossi",
    );
  });

  it("validates profile bios, including legacy empty values and spammy patterns", () => {
    expect(validateProfileBio("")).toEqual({
      isValid: true,
      message: null,
      normalizedValue: "",
    });
    expect(validateProfileBio("      ").isValid).toBe(false);
    expect(
      validateProfileBio(
        "Centrocampista classe 2001 con visione di gioco e disponibilità a trasferirmi in Lombardia.",
      ),
    ).toEqual({
      isValid: true,
      message: null,
      normalizedValue:
        "Centrocampista classe 2001 con visione di gioco e disponibilità a trasferirmi in Lombardia.",
    });
    expect(validateProfileBio("Troppo corta").message).toBe(
      "La bio deve contenere almeno 20 caratteri.",
    );
    expect(validateProfileBio("spam spam spam spam spam").message).toBe(
      "Inserisci una descrizione valida del tuo profilo.",
    );
    expect(validateProfileBio("aaaaaa bio di prova che non va bene").message).toBe(
      "Inserisci una descrizione valida del tuo profilo.",
    );
  });

  it("caps profile bio input at four hundred characters", () => {
    const oversizedValue = "a".repeat(PROFILE_BIO_MAX_LENGTH + 25);

    expect(normalizeProfileBioInput(oversizedValue)).toHaveLength(PROFILE_BIO_MAX_LENGTH);
    expect(validateProfileBio(oversizedValue).normalizedValue).toHaveLength(
      PROFILE_BIO_MAX_LENGTH,
    );
  });
});
