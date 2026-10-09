/**
 * Profilo professionale del Procuratore (REV-PROF-16, schermata 3).
 *
 * La schermata governa un dato solo — l'abilitazione — e lo dice chiaramente:
 * agenzia, ruolo attuale, anno di ingresso e stato dell'incarico **non hanno
 * un campo qui**. Derivano dalla carriera (REV-PROF-15), e la card
 * informativa in fondo è l'unico modo di cambiarli. Duplicarli avrebbe
 * significato due posti da cui scrivere la stessa situazione, con la certezza
 * che prima o poi avrebbero detto cose diverse.
 *
 * Sul numero di licenza vale una regola che non finisce qui:
 *
 *  - è facoltativo anche con l'abilitazione attiva, come nell'onboarding;
 *  - viene normalizzato (maiuscolo, senza spazi superflui) prima di essere
 *    salvato, così lo stesso numero scritto in due modi non diventa due dati;
 *  - **non è mai pubblico, e non per scelta dell'interfaccia.** Vive in
 *    `agent_license_credentials`, che ha una RLS owner-only: non sta in
 *    `agent_profiles`, che qualunque utente autenticato può leggere. Per
 *    questo arriva da una query a parte invece che dal profilo completo.
 *    `buildAgentLicenseLabel` costruisce la pill dalla sola federazione, le
 *    analytics non lo toccano e nessun messaggio di errore lo riporta.
 *
 * Il toggle "Mostra l'ente nel profilo" governa soltanto la visibilità della
 * federazione (`show_federation`): spegnerlo nasconde il nome dell'ente ma
 * lascia la pill "Licenza federale" e non tocca `is_federation_licensed`,
 * che resta il fatto di avere l'abilitazione.
 */
import { useCallback, useMemo, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import {
  OnboardingSelectField,
  OnboardingTextField,
  ToggleRow,
} from "../../../onboarding/ui";
import { AGENT_FEDERATION_OPTIONS } from "../../../onboarding/agent/agent-taxonomy";
import { trackProfileEvent } from "../../profile-analytics";
import { ProfileEditScaffold } from "../../edit/ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../../edit/ProfileEditStates";
import { useUnsavedChangesGuard } from "../../edit/use-unsaved-changes-guard";
import {
  isAgentLicenseNumberValid,
  normalizeAgentLicenseNumber,
} from "../agent-edit-rules";
import {
  useAgentLicenseQuery,
  useAgentProfilePatch,
  useCompleteProfileQuery,
} from "../agent-profile-edit-service";
import { useAgentEditorGuard } from "../use-agent-editor-guard";

type ProfessionalForm = {
  federation: string;
  isLicensed: boolean;
  licenseNumber: string;
  /** `show_federation`: decide se il nome dell'ente compare nel profilo. */
  showFederation: boolean;
};

const GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";

export function AgentProfessionalProfileScreen() {
  const { userId } = useAgentEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const licenseQuery = useAgentLicenseQuery(userId);
  const save = useAgentProfilePatch(userId);
  const data = profileQuery.data;
  const savedLicenseNumber = licenseQuery.data;

  /*
    Si aspettano entrambe le letture: aprire il form con il numero ancora
    vuoto lo farebbe sembrare mai inserito, e un salvataggio in quello stato
    lo cancellerebbe davvero.
  */
  const initialForm = useMemo<ProfessionalForm | null>(() => {
    if (!data || savedLicenseNumber === undefined) {
      return null;
    }

    const agentProfile = data.agentProfile;
    const hasLicenseData = Boolean(
      agentProfile?.federation?.trim() || savedLicenseNumber.trim(),
    );

    return {
      federation: agentProfile?.federation ?? "",
      /*
        L'abilitazione è attiva se l'ente è pubblicato oppure se ci sono dati
        salvati: un profilo che ha nascosto l'ente non deve riaprire la
        schermata trovando il toggle spento e i suoi dati apparentemente persi.
      */
      isLicensed: Boolean(agentProfile?.is_federation_licensed) || hasLicenseData,
      licenseNumber: savedLicenseNumber,
      showFederation: agentProfile?.show_federation ?? true,
    };
  }, [data, savedLicenseNumber]);

  const [draft, setDraft] = useState<ProfessionalForm | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const form = draft ?? initialForm;

  const isDirty = Boolean(
    form && initialForm && JSON.stringify(form) !== JSON.stringify(initialForm),
  );

  const handleBack = useUnsavedChangesGuard({
    isDirty,
    isSaving: save.isPending,
    onLeave: () => {
      if (isDirty) {
        trackProfileEvent("profile_edit_unsaved_exit", {
          profileType: "agent",
          section: "professional",
        });
      }

      router.back();
    },
  });

  const patch = useCallback(
    (changes: Partial<ProfessionalForm>) => {
      setErrorMessage(null);
      setDraft((current) => {
        const base = current ?? initialForm;

        return base ? { ...base, ...changes } : base;
      });
    },
    [initialForm],
  );

  /*
    Spegnere l'abilitazione in presenza di dati salvati è una cancellazione,
    non un cambio di visibilità: si chiede conferma prima, perché accenderla
    di nuovo non li riporterebbe indietro.
  */
  const handleLicenseToggle = useCallback(
    (next: boolean) => {
      const track = () =>
        trackProfileEvent("agent_license_toggled", {
          profileType: "agent",
          section: "professional",
          visible: next,
        });

      const hasSavedData = Boolean(
        data?.agentProfile?.federation?.trim() || savedLicenseNumber?.trim(),
      );

      if (next || !hasSavedData) {
        track();
        patch({ isLicensed: next });
        return;
      }

      Alert.alert(
        "Rimuovere l'abilitazione?",
        "I dati dell'abilitazione verranno rimossi dal profilo.",
        [
          { style: "cancel", text: "Annulla" },
          {
            // "Annulla" non cambia niente, quindi non traccia niente.
            onPress: () => {
              track();
              patch({
                federation: "",
                isLicensed: false,
                licenseNumber: "",
                showFederation: false,
              });
            },
            style: "destructive",
            text: "Rimuovi",
          },
        ],
      );
    },
    [data?.agentProfile, patch, savedLicenseNumber],
  );

  const handleManageCareer = useCallback(() => {
    trackProfileEvent("agent_career_manage_tapped", {
      profileType: "agent",
      section: "professional",
    });

    /*
      Anche questa è un'uscita dal modulo: se c'è una modifica non salvata la
      si conferma prima, esattamente come per il back.
    */
    if (isDirty) {
      Alert.alert(
        "Vuoi uscire senza salvare?",
        "Le modifiche effettuate andranno perse.",
        [
          { style: "cancel", text: "Continua a modificare" },
          {
            onPress: () => router.push("/profile/agent-career"),
            style: "destructive",
            text: "Esci senza salvare",
          },
        ],
      );
      return;
    }

    router.push("/profile/agent-career");
  }, [isDirty]);

  function handleSave() {
    if (!data || !form) {
      return;
    }

    if (form.isLicensed) {
      if (!form.federation.trim()) {
        setErrorMessage("Seleziona una federazione o un ente.");
        return;
      }

      if (!isAgentLicenseNumberValid(form.licenseNumber)) {
        // Nessun eco del valore inserito: il numero non entra nei messaggi.
        setErrorMessage("Inserisci un numero di licenza valido.");
        return;
      }
    }

    setErrorMessage(null);

    save.mutate(
      {
        data,
        patch: {
          federation: form.isLicensed ? form.federation.trim() || null : null,
          /*
            Due campi distinti: `is_federation_licensed` dice che la licenza
            esiste, `show_federation` se il nome dell'ente è pubblico.
            Tenerli insieme faceva sparire la licenza quando si nascondeva
            l'ente, ed escludeva il profilo dal filtro "con licenza".
          */
          is_federation_licensed: form.isLicensed,
          show_federation: form.showFederation,
          license_number: form.isLicensed
            ? normalizeAgentLicenseNumber(form.licenseNumber) || null
            : null,
        },
      },
      {
        onError: (error) => {
          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "agent",
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
            profileType: "agent",
            section: "professional",
            success: true,
          });
          setDraft(null);
          router.back();
        },
      },
    );
  }

  const licenseNumberInvalid =
    form !== null &&
    form.licenseNumber.trim().length > 0 &&
    !isAgentLicenseNumberValid(form.licenseNumber);

  return (
    <ProfileEditScaffold
      errorMessage={errorMessage}
      onBack={handleBack}
      onSave={form ? handleSave : undefined}
      saving={save.isPending}
      testID="agent-profile-edit-professional"
      title="Profilo professionale"
    >
      {profileQuery.isPending || licenseQuery.isPending ? (
        <ProfileEditFieldsSkeleton rows={4} testID="agent-edit-skeleton" />
      ) : null}

      {profileQuery.isError || licenseQuery.isError ? (
        <ProfileEditErrorState
          onRetry={() => {
            void profileQuery.refetch();
            void licenseQuery.refetch();
          }}
          testID="agent-edit-error"
        />
      ) : null}

      {form ? (
        <>
          <View style={styles.section}>
            <AppText variant="titleSm">Abilitazione professionale</AppText>

            <ToggleRow
              label="Possiedi un'abilitazione ufficiale?"
              onValueChange={handleLicenseToggle}
              testID="agent-professional-license-toggle"
              value={form.isLicensed}
            />

            {form.isLicensed ? (
              <>
                <OnboardingSelectField
                  label="Federazione / ente"
                  onChange={(value) => {
                    trackProfileEvent("agent_federation_changed", {
                      profileType: "agent",
                      section: "professional",
                    });
                    patch({ federation: value });
                  }}
                  options={AGENT_FEDERATION_OPTIONS}
                  placeholder="Seleziona"
                  searchable
                  sheetTitle="Federazione / ente"
                  testID="agent-professional-federation"
                  value={form.federation}
                />

                <OnboardingTextField
                  autoCapitalize="characters"
                  errorMessage={
                    licenseNumberInvalid
                      ? "Inserisci un numero di licenza valido."
                      : undefined
                  }
                  label="Numero licenza"
                  onChangeText={(value) => patch({ licenseNumber: value })}
                  optional
                  placeholder="Numero di licenza"
                  testID="agent-professional-license-number"
                  value={form.licenseNumber}
                />

                <ToggleRow
                  description="Il numero di licenza non sarà pubblico."
                  label="Mostra l'ente nel profilo"
                  onValueChange={(value) => {
                    trackProfileEvent("agent_federation_visibility_changed", {
                      profileType: "agent",
                      section: "professional",
                      visible: value,
                    });
                    patch({ showFederation: value });
                  }}
                  testID="agent-professional-federation-visibility"
                  value={form.showFederation}
                />
              </>
            ) : null}
          </View>

          {/*
            Situazione attuale: un'informativa, non un form. L'unica azione
            possibile da qui porta al modulo che possiede quei dati.
          */}
          <View style={styles.notice} testID="agent-professional-career-notice">
            <Ionicons
              color={colors.accent}
              name="information-circle-outline"
              size={20}
            />
            <AppText color="secondary" style={styles.noticeText} variant="bodySm">
              Agenzia, ruolo e situazione attuale derivano dalla carriera.
            </AppText>
          </View>

          <Button
            fullWidth
            label="Gestisci carriera"
            onPress={handleManageCareer}
            size="md"
            testID="agent-professional-manage-career"
            variant="secondary"
          />
        </>
      ) : null}
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  notice: {
    alignItems: "flex-start",
    backgroundColor: colors.accentSoft,
    borderRadius: radius[16],
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[16],
  },
  noticeText: {
    flex: 1,
  },
  section: {
    gap: spacing[12],
  },
});
