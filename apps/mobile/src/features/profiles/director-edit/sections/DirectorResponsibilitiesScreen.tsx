/**
 * Responsabilità e focus del Dirigente (REV-PROF-11, schermata 4).
 *
 * Due dati distinti che il prodotto tiene volutamente separati (REV-ONB-07
 * §I, §L): le **aree di responsabilità** dicono di cosa ci si occupa, il
 * **focus** dove si concentra l'attività. Si salvano insieme perché il mockup
 * li mette nella stessa schermata, non perché siano lo stesso dato.
 *
 * Due vincoli espliciti della task:
 *
 *  - le responsabilità usano righe compatte, non le card a due colonne del
 *    vecchio profilo: le etichette lunghe vanno a capo invece di troncarsi, e
 *    la selezione si legge da bordo, fondo e segno di spunta — mai dal solo
 *    colore;
 *  - le responsabilità descrivono competenze generali e **non** vengono
 *    copiate dentro le esperienze di carriera. Salvare qui non tocca nessuna
 *    stagione.
 *
 * Tassonomia e messaggi di errore sono quelli dell'onboarding: un'area
 * salvata prima della review e non più in elenco resta selezionabile, così
 * salvare non cancella in silenzio una dichiarazione dell'utente.
 */
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { SelectionRow } from "../../../onboarding/ui";
import {
  DIRECTOR_FOCUS_CARD_OPTIONS,
  DIRECTOR_RESPONSIBILITY_CHIP_OPTIONS,
  getDirectorResponsibilityIcon,
} from "../../../onboarding/director/director-taxonomy";
import { trackProfileEvent } from "../../profile-analytics";
import { ProfileEditScaffold } from "../../edit/ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../../edit/ProfileEditStates";
import { useUnsavedChangesGuard } from "../../edit/use-unsaved-changes-guard";
import {
  useCompleteProfileQuery,
  useDirectorSectionSave,
} from "../director-profile-edit-service";
import { useDirectorEditorGuard } from "../use-director-editor-guard";

type ResponsibilitiesForm = {
  mainFocus: string;
  responsibilities: string[];
};

const GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";

/**
 * Elenco canonico più le aree già dichiarate che non vi compaiono più.
 * L'ordine della tassonomia non cambia: le aggiunte vanno in coda.
 */
function buildResponsibilityOptions(declared: readonly string[]) {
  const options = DIRECTOR_RESPONSIBILITY_CHIP_OPTIONS.map((option) => ({
    label: option.label,
    value: option.value,
  }));

  for (const entry of declared) {
    const value = entry?.trim();

    if (value && !options.some((option) => option.value === value)) {
      options.push({ label: value, value });
    }
  }

  return options;
}

export function DirectorResponsibilitiesScreen() {
  const { userId } = useDirectorEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useDirectorSectionSave(userId);
  const data = profileQuery.data;

  const initialForm = useMemo<ResponsibilitiesForm | null>(() => {
    if (!data) {
      return null;
    }

    return {
      mainFocus: data.directorProfile?.main_focus?.trim() ?? "",
      responsibilities: (data.directorProfile?.responsibilities ?? [])
        .map((entry) => entry.trim())
        .filter(Boolean),
    };
  }, [data]);

  const [draft, setDraft] = useState<ResponsibilitiesForm | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const form = draft ?? initialForm;

  const responsibilityOptions = useMemo(
    () => buildResponsibilityOptions(initialForm?.responsibilities ?? []),
    [initialForm],
  );

  const isDirty = Boolean(
    form && initialForm && JSON.stringify(form) !== JSON.stringify(initialForm),
  );

  const handleBack = useUnsavedChangesGuard({
    isDirty,
    isSaving: save.isPending,
    onLeave: () => {
      if (isDirty) {
        trackProfileEvent("profile_edit_unsaved_exit", {
          profileType: "director",
          section: "responsibilities",
        });
      }

      router.back();
    },
  });

  const patch = useCallback(
    (changes: Partial<ResponsibilitiesForm>) => {
      setErrorMessage(null);
      setDraft((current) => {
        const base = current ?? initialForm;

        return base ? { ...base, ...changes } : base;
      });
    },
    [initialForm],
  );

  const toggleResponsibility = useCallback(
    (value: string) => {
      if (!form) {
        return;
      }

      patch({
        responsibilities: form.responsibilities.includes(value)
          ? form.responsibilities.filter((entry) => entry !== value)
          : [...form.responsibilities, value],
      });
    },
    [form, patch],
  );

  function handleSave() {
    if (!data || !form) {
      return;
    }

    if (form.responsibilities.length === 0) {
      setErrorMessage("Seleziona almeno un'area di responsabilità.");
      return;
    }

    if (!form.mainFocus) {
      setErrorMessage("Seleziona il tuo focus principale.");
      return;
    }

    setErrorMessage(null);

    save.mutate(
      {
        data,
        patch: {
          directorProfile: {
            main_focus: form.mainFocus,
            /*
              L'ordine canonico della tassonomia, non quello dei tap: due
              profili con le stesse aree le mostrano nello stesso ordine.
            */
            responsibilities: responsibilityOptions
              .map((option) => option.value)
              .filter((value) => form.responsibilities.includes(value)),
          },
        },
      },
      {
        onError: (error) => {
          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "director",
            section: "responsibilities",
            success: false,
          });
          setErrorMessage(
            error instanceof Error && error.message
              ? error.message
              : GENERIC_SAVE_ERROR,
          );
        },
        onSuccess: () => {
          trackProfileEvent("profile_edit_section_saved", {
            profileType: "director",
            section: "responsibilities",
            success: true,
          });
          setDraft(null);
          router.back();
        },
      },
    );
  }

  return (
    <ProfileEditScaffold
      errorMessage={errorMessage}
      onBack={handleBack}
      onSave={form ? handleSave : undefined}
      saving={save.isPending}
      testID="director-profile-edit-responsibilities"
      title="Responsabilità e focus"
    >
      {profileQuery.isPending ? (
        <ProfileEditFieldsSkeleton rows={8} testID="director-edit-skeleton" />
      ) : null}

      {profileQuery.isError ? (
        <ProfileEditErrorState
          onRetry={() => void profileQuery.refetch()}
          testID="director-edit-error"
        />
      ) : null}

      {form ? (
        <>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText variant="titleSm">Aree di responsabilità</AppText>
              <AppText color="secondary" variant="bodySm">
                Seleziona le aree in cui operi.
              </AppText>
            </View>

            <View style={styles.rows}>
              {responsibilityOptions.map((option) => (
                <SelectionRow
                  control="checkbox"
                  key={option.value}
                  label={option.label}
                  leading={
                    <Ionicons
                      color={colors.textSecondary}
                      name={getDirectorResponsibilityIcon(option.value)}
                      size={20}
                    />
                  }
                  onPress={() => toggleResponsibility(option.value)}
                  selected={form.responsibilities.includes(option.value)}
                  testID={`director-responsibility-${option.value}`}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <AppText variant="titleSm">Focus principale</AppText>

            <View style={styles.rows}>
              {DIRECTOR_FOCUS_CARD_OPTIONS.map((option) => (
                <SelectionRow
                  // Scelta singola: il controllo radio lo dice anche a chi
                  // naviga con uno screen reader.
                  control="radio"
                  key={option.value}
                  label={option.label}
                  onPress={() => patch({ mainFocus: option.value })}
                  selected={form.mainFocus === option.value}
                  testID={`director-focus-${option.value}`}
                />
              ))}
            </View>
          </View>
        </>
      ) : null}
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  rows: {
    gap: spacing[8],
  },
  section: {
    gap: spacing[12],
  },
  sectionHeader: {
    gap: spacing[4],
  },
});
