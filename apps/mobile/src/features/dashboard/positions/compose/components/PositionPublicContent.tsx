import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../../../theme/tokens";
import { AppText, Avatar } from "../../../../../ui";
import {
  ageSummary,
  availabilitySummary,
  contextSummary,
  experienceSummary,
  listNames,
  playerExperienceSummary,
  situationSummary,
} from "../compose-presentation";
import type { PositionCatalogs, PositionDraft } from "../compose-types";

type Props = {
  catalogs: PositionCatalogs;
  draft: PositionDraft;
};

type Section = { label: string; value: string };

/**
 * Il contenuto pubblico di una Position (DAS-REV-16 §23, mockup screen 12).
 *
 * «L'anteprima usa quanto più possibile lo stesso renderer del dettaglio
 * pubblico Position con una modalità privata di preview.» Questo componente
 * **è** quel renderer: non conosce candidature, permessi, readiness,
 * lifecycle né azioni, e per questo può essere montato sia in anteprima sia
 * nel dettaglio pubblico senza una modalità da ricordarsi di attivare. Chi
 * lo usa decide le CTA; lui rende soltanto ciò che l'annuncio dice.
 *
 * «Soltanto sezioni compilate»: §20 vieta «Non specificato» per ogni campo
 * assente, e infatti un optional vuoto qui non produce nessuna riga.
 */
export function PositionPublicContent({ catalogs, draft }: Props) {
  const sections = buildSections(draft, catalogs);
  const place = [draft.clubCity, draft.clubRegion]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  return (
    <View style={styles.block}>
      <AppText color="neutral" variant="screenTitle">
        {draft.title ?? "Posizione senza titolo"}
      </AppText>

      <View style={styles.club}>
        <Avatar
          name={draft.clubName}
          size="sm"
          square
          tone="ink"
          uri={draft.clubLogoUrl ?? undefined}
        />

        <AppText color="neutral" variant="titleSm">
          {draft.clubName}
        </AppText>

        {/* Il check compare solo per una verifica reale (§4). */}
        {draft.clubIsVerified ? (
          <Ionicons
            accessibilityLabel="Società verificata"
            color={colors.accent}
            name="checkmark-circle"
            size={15}
          />
        ) : null}
      </View>

      {/* §17: con SOCIETY si legge «Intera società» e **nessuna** categoria
          di squadra. Lo screen 12 non ne mostra apposta. */}
      <AppText color="neutralMuted" variant="bodySm">
        {contextSummary(draft)}
      </AppText>

      {place ? (
        <AppText color="neutralMuted" variant="bodySm">
          {place}
        </AppText>
      ) : null}

      {sections.map((section) => (
        <View key={section.label} style={styles.section}>
          <AppText color="neutral" variant="metaStrong">
            {section.label}
          </AppText>

          <AppText color="neutral" variant="bodyLg">
            {section.value}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/**
 * L'ordine segue quello dei dettagli nello step 2, così l'anteprima non
 * riordina ciò che l'utente ha appena compilato.
 *
 * `push` condizionale e non un `map` con filtro: una sezione nasce solo
 * quando ha un valore, ed è questo che impedisce la lista di campi vuoti
 * che §20 vieta.
 */
function buildSections(
  draft: PositionDraft,
  catalogs: PositionCatalogs,
): Section[] {
  const out: Section[] = [];
  const push = (label: string, value: string | null | undefined) => {
    if (value) {
      out.push({ label, value });
    }
  };

  if (draft.secondaryTeams.length > 0) {
    push(
      "Squadre coinvolte nell'incarico",
      listNames(draft.secondaryTeams.map((team) => team.name)),
    );
  }

  if (draft.profileType === "player") {
    push("Fascia d'età", ageSummary(draft));
  }

  if (draft.profileType === "director") {
    push("Aree di responsabilità", draft.details.responsibilities);
  }

  if (draft.profileType === "coach") {
    const qualification = catalogs.qualifications.find(
      (entry) => entry.id === draft.details.coachQualificationId,
    );

    push("Patentino richiesto", qualification?.label);
  }

  if (draft.profileType === "staff") {
    push("Qualifica richiesta", draft.details.staffQualification);
  }

  push(
    "Esperienza richiesta",
    draft.profileType === "player"
      ? playerExperienceSummary(draft.details.playerExperience, catalogs.categories)
      : experienceSummary(draft.details.experience, catalogs.experiences),
  );

  if (draft.profileType === "player") {
    push("Situazione del calciatore", situationSummary(draft.details.playerSituation));
  }

  push(
    "Disponibilità richiesta",
    availabilitySummary(draft.details.availability, catalogs.seasons),
  );

  push("Descrizione della posizione", draft.description);
  push("Requisiti aggiuntivi", draft.details.requirements);

  return out;
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[8],
  },
  club: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    marginTop: spacing[4],
  },
  section: {
    gap: spacing[4],
    marginTop: spacing[12],
  },
});
