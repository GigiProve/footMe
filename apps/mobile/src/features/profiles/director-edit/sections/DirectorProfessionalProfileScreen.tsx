/**
 * Profilo professionale del Dirigente (REV-PROF-11, schermata 3).
 *
 * Due decisioni, una sola scrittura: quali ruoli si sono ricoperti e quale fra
 * questi mostrare sotto il proprio nome. Partono insieme nello stesso payload
 * perché uno stato in cui il ruolo principale non appartiene ai ruoli
 * dichiarati non deve nemmeno poter raggiungere il backend.
 *
 * Tre cose che questa schermata **non** fa, e che la task vieta
 * esplicitamente:
 *
 *  - non tocca la carriera. Cambiare il ruolo principale non riscrive il ruolo
 *    di nessuna stagione, non elimina record e non sovrascrive la situazione
 *    attuale: il ruolo del profilo è la specializzazione professionale, il
 *    ruolo dell'incarico è un dato della carriera e i due non si sincronizzano;
 *  - non duplica la situazione attuale. Società, ruolo e categoria correnti
 *    restano calcolati dalla carriera di REV-PROF-10;
 *  - non riscrive la tassonomia. L'elenco è `DIRECTOR_CLUB_ROLE_OPTIONS`,
 *    quello dell'onboarding.
 *
 * Deselezionando il ruolo principale la bozza **conserva** il vecchio valore:
 * il selector smette di mostrarlo perché non è più fra i ruoli scelti, ma
 * ricontrassegnando quel ruolo lo si ritrova. Il salvataggio resta bloccato
 * finché una scelta coerente non esiste, invece di sceglierla al posto
 * dell'utente.
 */
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import {
  InfoMessage,
  OnboardingSelectField,
  OnboardingTextField,
  RoleCard,
} from "../../../onboarding/ui";
import { DIRECTOR_OTHER_ROLE_VALUE } from "../../../onboarding/director/director-taxonomy";
import { trackProfileEvent } from "../../profile-analytics";
import { ProfileEditScaffold } from "../../edit/ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../../edit/ProfileEditStates";
import { useUnsavedChangesGuard } from "../../edit/use-unsaved-changes-guard";
import { getDirectorProfileRoleOptions } from "../director-role-options";
import {
  useCompleteProfileQuery,
  useDirectorSectionSave,
} from "../director-profile-edit-service";
import { useDirectorEditorGuard } from "../use-director-editor-guard";

type ProfessionalForm = {
  otherRoleLabel: string;
  primaryRole: string;
  roles: string[];
};

const GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";

export function DirectorProfessionalProfileScreen() {
  const { userId } = useDirectorEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useDirectorSectionSave(userId);
  const data = profileQuery.data;

  const initialForm = useMemo<ProfessionalForm | null>(() => {
    if (!data) {
      return null;
    }

    return {
      otherRoleLabel: data.directorProfile?.other_role_label?.trim() ?? "",
      primaryRole: data.directorProfile?.primary_role?.trim() ?? "",
      roles: (data.directorProfile?.director_roles ?? [])
        .map((role) => role.trim())
        .filter(Boolean),
    };
  }, [data]);

  const [draft, setDraft] = useState<ProfessionalForm | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPrimaryError, setShowPrimaryError] = useState(false);
  const form = draft ?? initialForm;

  /*
    I ruoli già dichiarati entrano nell'elenco anche se non sono più in
    tassonomia: salvare non deve cancellare in silenzio una dichiarazione
    dell'utente.
  */
  const roleOptions = useMemo(
    () =>
      getDirectorProfileRoleOptions([
        ...(initialForm?.roles ?? []),
        initialForm?.primaryRole ?? "",
      ]),
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
          section: "professional",
        });
      }

      router.back();
    },
  });

  const patch = useCallback(
    (changes: Partial<ProfessionalForm>) => {
      setErrorMessage(null);
      setShowPrimaryError(false);
      setDraft((current) => {
        const base = current ?? initialForm;

        return base ? { ...base, ...changes } : base;
      });
    },
    [initialForm],
  );

  const toggleRole = useCallback(
    (role: string) => {
      if (!form) {
        return;
      }

      const next = form.roles.includes(role)
        ? form.roles.filter((entry) => entry !== role)
        : [...form.roles, role];

      // Il ruolo principale non viene toccato: se è uscito dalla selezione
      // resta nella bozza e il selector smette di proporlo.
      patch({ roles: next });
    },
    [form, patch],
  );

  const hasOtherRole = Boolean(form?.roles.includes(DIRECTOR_OTHER_ROLE_VALUE));

  /**
   * Il selector mostra solo i ruoli ancora selezionati. "Altro" non è un
   * ruolo: al suo posto compare l'etichetta libera dichiarata dall'utente
   * (REV-ONB-07 §H), così il Master Profile non mostra mai "Altro" sotto il
   * nome.
   */
  const primaryRoleOptions = useMemo(
    () =>
      (form?.roles ?? []).map((role) => ({
        label:
          role === DIRECTOR_OTHER_ROLE_VALUE && form?.otherRoleLabel.trim()
            ? form.otherRoleLabel.trim()
            : (roleOptions.find((option) => option.value === role)?.label ??
              role),
        value: role,
      })),
    [form, roleOptions],
  );

  const isPrimaryRoleSelectable = Boolean(
    form && form.primaryRole && form.roles.includes(form.primaryRole),
  );

  function handleSave() {
    if (!data || !form) {
      return;
    }

    if (form.roles.length === 0) {
      setErrorMessage("Seleziona almeno un ruolo.");
      return;
    }

    if (hasOtherRole && !form.otherRoleLabel.trim()) {
      setErrorMessage("Specifica il ruolo selezionato come «Altro».");
      return;
    }

    if (!form.primaryRole) {
      setShowPrimaryError(true);
      setErrorMessage("Seleziona il ruolo principale.");
      return;
    }

    if (!form.roles.includes(form.primaryRole)) {
      setShowPrimaryError(true);
      setErrorMessage(
        "Il ruolo principale deve essere incluso nei ruoli selezionati.",
      );
      return;
    }

    setErrorMessage(null);
    setShowPrimaryError(false);

    if (form.primaryRole !== initialForm?.primaryRole) {
      trackProfileEvent("director_primary_role_changed", {
        profileType: "director",
        section: "professional",
      });
    }

    save.mutate(
      {
        data,
        patch: {
          directorProfile: {
            // Una sola operazione logica: ruoli e ruolo principale non possono
            // divergere perché non esiste un salvataggio che scriva solo uno.
            director_roles: form.roles,
            other_role_label: hasOtherRole
              ? form.otherRoleLabel.trim()
              : null,
            primary_role: form.primaryRole,
          },
        },
      },
      {
        onError: (error) => {
          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "director",
            section: "professional",
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
            roleCount: form.roles.length,
            section: "professional",
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
      testID="director-profile-edit-professional"
      title="Profilo professionale"
    >
      {profileQuery.isPending ? (
        <ProfileEditFieldsSkeleton rows={6} testID="director-edit-skeleton" />
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
              <AppText variant="titleSm">I tuoi ruoli</AppText>
              <AppText color="secondary" variant="bodySm">
                Seleziona i ruoli in cui hai maturato esperienza.
              </AppText>
            </View>

            <View style={styles.cards}>
              {roleOptions.map((option) => (
                <RoleCard
                  emphasizeSelection
                  icon={option.icon}
                  key={option.value}
                  label={option.label}
                  onPress={() => toggleRole(option.value)}
                  selected={form.roles.includes(option.value)}
                  selectionMode="multiple"
                  testID={`director-professional-role-${option.value}`}
                />
              ))}
            </View>

            {/* Il campo esiste solo quando serve davvero (REV-ONB-07 §H). */}
            {hasOtherRole ? (
              <OnboardingTextField
                autoCapitalize="sentences"
                label="Specifica ruolo"
                onChangeText={(value) => patch({ otherRoleLabel: value })}
                placeholder="Es. Responsabile area tecnica"
                testID="director-professional-other-role"
                value={form.otherRoleLabel}
              />
            ) : null}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText variant="titleSm">Ruolo principale</AppText>
              <AppText color="secondary" variant="bodySm">
                Seleziona il ruolo da mostrare come predefinito nel tuo profilo.
              </AppText>
            </View>

            <OnboardingSelectField
              disabled={primaryRoleOptions.length === 0}
              errorMessage={
                showPrimaryError ? "Seleziona il ruolo principale." : undefined
              }
              onChange={(value) => patch({ primaryRole: value })}
              options={primaryRoleOptions}
              placeholder="Seleziona il ruolo principale"
              sheetTitle="Ruolo principale"
              testID="director-professional-primary-role"
              /*
                Il vecchio ruolo principale resta nella bozza ma non si mostra
                finché non torna fra i selezionati: il campo chiede una scelta
                nuova invece di esibire un valore incoerente.
              */
              value={isPrimaryRoleSelectable ? form.primaryRole : ""}
            />

            <InfoMessage message="Il ruolo principale verrà mostrato sotto il tuo nome." />
          </View>
        </>
      ) : null}
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  cards: {
    gap: spacing[8],
  },
  section: {
    gap: spacing[12],
  },
  sectionHeader: {
    gap: spacing[4],
  },
});
