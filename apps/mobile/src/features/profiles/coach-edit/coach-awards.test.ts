/**
 * Palmarès Allenatore (REV-PROF-05): le regole che è facile sbagliare.
 *
 * Il titolo nasce dai campi e non da una stringa digitata; il duplicato è
 * *esatto* e non "stessa stagione"; l'ordinamento non fa sparire un
 * riconoscimento senza stagione.
 */
import { describe, expect, it } from "vitest";

import type { CoachAchievementRecord } from "../profile-service";
import {
  buildCoachAwardKey,
  buildCoachAwardTitle,
  getCoachAwardIcon,
  getCoachAwardTypeMeta,
  isDuplicateCoachAward,
  sortCoachAwards,
} from "./coach-awards";

function award(
  overrides: Partial<CoachAchievementRecord> & Pick<CoachAchievementRecord, "id">,
): CoachAchievementRecord {
  return {
    achievement_type: "campionato",
    club_id: null,
    club_name: "Torino FC",
    coach_profile_id: "coach-1",
    competition_name: "Eccellenza",
    created_at: "2026-01-01T00:00:00.000Z",
    description: null,
    label: "",
    season_label: "2023/2024",
    sort_order: 0,
    ...overrides,
  };
}

describe("Titolo del riconoscimento", () => {
  it("compone tipo, competizione e stagione in forma breve", () => {
    expect(
      buildCoachAwardTitle({
        achievement_type: "campionato",
        competition_name: "Eccellenza",
        season_label: "2023/2024",
      }),
    ).toBe("Vincitore campionato Eccellenza 2023/24");
  });

  it("cambia apertura col tipo senza cambiare struttura", () => {
    expect(
      buildCoachAwardTitle({
        achievement_type: "coppa",
        competition_name: "Coppa Piemonte",
        season_label: "2022/2023",
      }),
    ).toBe("Vittoria Coppa Piemonte 2022/23");

    expect(
      buildCoachAwardTitle({
        achievement_type: "premio_personale",
        competition_name: "Allenatore dell'anno",
        season_label: "2024/2025",
      }),
    ).toBe("Premio Allenatore dell'anno 2024/25");
  });

  it("non lascia spazi orfani quando un pezzo manca", () => {
    expect(
      buildCoachAwardTitle({
        achievement_type: "promozione",
        competition_name: null,
        season_label: null,
      }),
    ).toBe("Promozione");
  });
});

describe("Etichette e icone", () => {
  it("chiama 'Premio' il campo competizione di un premio personale", () => {
    expect(getCoachAwardTypeMeta("premio_personale").competitionLabel).toBe(
      "Premio",
    );
    expect(getCoachAwardTypeMeta("campionato").competitionLabel).toBe(
      "Competizione",
    );
  });

  it("dà un'icona anche ai tipi legacy non più offerti dall'editor", () => {
    expect(getCoachAwardIcon("playoff")).toBe("star-outline");
    expect(getCoachAwardIcon("qualcosa-di-ignoto")).toBe("ribbon-outline");
  });
});

describe("Duplicati", () => {
  it("considera uguali due voci che differiscono solo per spazi e maiuscole", () => {
    expect(
      buildCoachAwardKey({
        achievement_type: "coppa",
        club_name: " Torino FC ",
        competition_name: "COPPA ITALIA",
        season_label: "2023/2024",
      }),
    ).toBe(
      buildCoachAwardKey({
        achievement_type: "coppa",
        club_name: "torino fc",
        competition_name: "Coppa Italia",
        season_label: "2023/2024",
      }),
    );
  });

  it("blocca il duplicato esatto", () => {
    expect(
      isDuplicateCoachAward(
        {
          achievement_type: "campionato",
          club_name: "Torino FC",
          competition_name: "Eccellenza",
          season_label: "2023/2024",
        },
        [award({ id: "a" })],
      ),
    ).toBe(true);
  });

  it("non blocca due riconoscimenti diversi nella stessa stagione", () => {
    expect(
      isDuplicateCoachAward(
        {
          achievement_type: "coppa",
          club_name: "Torino FC",
          competition_name: "Coppa Piemonte",
          season_label: "2023/2024",
        },
        [award({ id: "a" })],
      ),
    ).toBe(false);
  });

  it("non considera duplicato di se stesso il riconoscimento in modifica", () => {
    expect(
      isDuplicateCoachAward(
        {
          achievement_type: "campionato",
          club_name: "Torino FC",
          competition_name: "Eccellenza",
          id: "a",
          season_label: "2023/2024",
        },
        [award({ id: "a" })],
      ),
    ).toBe(false);
  });
});

describe("Ordinamento", () => {
  it("mette la stagione più recente in cima e i senza stagione in fondo", () => {
    const sorted = sortCoachAwards([
      award({ id: "vecchio", season_label: "2019/2020" }),
      award({ id: "legacy", season_label: null }),
      award({ id: "recente", season_label: "2024/2025" }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual([
      "recente",
      "vecchio",
      "legacy",
    ]);
  });

  it("a parità di stagione preferisce il riconoscimento creato più tardi", () => {
    const sorted = sortCoachAwards([
      award({
        created_at: "2026-01-01T00:00:00.000Z",
        id: "primo",
        competition_name: "Eccellenza",
      }),
      award({
        created_at: "2026-06-01T00:00:00.000Z",
        id: "secondo",
        competition_name: "Promozione",
      }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["secondo", "primo"]);
  });
});
