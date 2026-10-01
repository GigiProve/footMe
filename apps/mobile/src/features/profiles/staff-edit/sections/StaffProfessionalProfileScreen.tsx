/**
 * Profilo professionale dello Staff tecnico (REV-PROF-08, schermata 3).
 *
 * Due decisioni, una sola scrittura: quali ruoli si sono ricoperti e quale fra
 * questi mostrare sotto il proprio nome. Partono insieme nello stesso payload
 * perché uno stato in cui il ruolo principale non appartiene ai ruoli
 * dichiarati non deve nemmeno poter raggiungere il backend.
 *
 * Tre cose che questa schermata **non** fa, e che la task vieta esplicitamente:
 *
 *  - non tocca la carriera. Cambiare il ruolo principale non riscrive il ruolo
 *    di nessuna stagione, e cambiare una stagione non sposta il ruolo
 *    principale: sono due dati diversi che si somigliano;
 *  - non duplica la situazione attuale. Società, ruolo e categoria correnti
 *    restano calcolati dalla carriera di REV-PROF-07;
 *  - non riscrive la tassonomia. L'elenco è `STAFF_ROLE_OPTIONS`, quello
 *    dell'onboarding.
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
  RoleCard,
} from "../../../onboarding/ui";
import { trackProfileEvent } from "../../profile-analytics";
import { ProfileEditScaffold } from "../../edit/ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../../edit/ProfileEditStates";
import { useUnsavedChangesGuard } from "../../edit/use-unsaved-changes-guard";
import { toDelimitedString } from "../../profile-edit-helpers";
import { getStaffProfileRoleOptions } from "../staff-role-options";
import {
  useCompleteProfileQuery,
  useStaffSectionSave,
} from "../staff-profile-edit-service";
import { useStaffEditorGuard } from "../use-staff-editor-guard";

type ProfessionalForm = {
  primaryRole: string;
  roles: string[];
};

const GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";

export function StaffProfessionalProfileScreen() {
  const { userId } = useStaffEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useStaffSectionSave(userId);
  const data = profileQuery.data;

  const initialForm = useMemo<ProfessionalForm | null>(() => {
    if (!data) {
      return null;
    }

    return {
      primaryRole: data.staffProfile?.primary_staff_role?.trim() ?? "",
      roles: (data.staffProfile?.staff_roles ?? [])
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
      getStaffProfileRoleOptions([
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
          profileType: "staff",
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

  /** Il selector mostra solo i ruoli ancora selezionati. */
  const primaryRoleOptions = useMemo(
    () =>
      (form?.roles ?? []).map((role) => ({
        label: roleOptions.find((option) => option.value === role)?.label ?? role,
        value: role,
      })),
    [form?.roles, roleOptions],
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
      trackProfileEvent("staff_primary_role_changed", {
        profileType: "staff",
        section: "professional",
      });
    }

    save.mutate(
      {
        data,
        patch: {
          // Una sola operazione logica: ruoli e ruolo principale non possono
          // divergere perché non esiste un salvataggio che scriva solo uno.
          staffPrimaryRole: form.primaryRole,
          staffRoles: toDelimitedString(form.roles),
        },
      },
      {
        onError: (error) => {
          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "staff",
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
            profileType: "staff",
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
      testID="staff-profile-edit-professional"
      title="Profilo professionale"
    >
      {profileQuery.isPending ? (
        <ProfileEditFieldsSkeleton rows={6} testID="staff-edit-skeleton" />
      ) : null}

      {profileQuery.isError ? (
        <ProfileEditErrorState
          onRetry={() => void profileQuery.refetch()}
          testID="staff-edit-error"
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
                  testID={`staff-professional-role-${option.value}`}
                />
              ))}
            </View>
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
                showPrimaryError
                  ? "Seleziona il ruolo principale."
                  : undefined
              }
              onChange={(value) => patch({ primaryRole: value })}
              options={primaryRoleOptions}
              placeholder="Seleziona il ruolo principale"
              sheetTitle="Ruolo principale"
              testID="staff-professional-primary-role"
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
