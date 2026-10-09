/**
 * "Dove sei disponibile?" — editor focalizzato delle aree (DAS-REV-06 §12, §19).
 *
 * È il **contenitore canonico** del selector: back in alto, contenuto
 * scrollabile, CTA sticky "Salva modifiche", safe area inferiore. Niente
 * bottom navigation, niente progress bar, niente campanella (§12).
 *
 * §19 lo dice in una riga: «Il contenitore canonico focalizzato mostra Salva
 * modifiche e persiste soltanto le aree. Successo → ritorno alla Dashboard.»
 * Il selector è lo stesso che vive dentro i moduli Modifica profilo e dentro
 * l'onboarding; lì il punto di conferma appartiene a quei flussi, qui è questa
 * schermata. Un solo punto di conferma per contesto, mai due in fila.
 *
 * Il feedback di successo è un toast — «Modifiche salvate.» — mostrato subito
 * prima del ritorno: il provider vive sopra il navigatore, quindi l'avviso
 * compare sulla Dashboard, come nello screen 06 del master. Nessuna pagina
 * celebrativa, nessuna percentuale (§20).
 */
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { spacing } from "../../../theme/tokens";
import { AppText, useToast } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { trackProfileEvent } from "../profile-analytics";
import { ProfileEditScaffold } from "../edit/ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../edit/ProfileEditStates";
import { useUnsavedChangesGuard } from "../edit/use-unsaved-changes-guard";
import { AvailabilityAreasSelector } from "./AvailabilityAreasSelector";
import {
  AVAILABILITY_AREAS_COPY,
  areAvailabilityAreasEqual,
  validateAvailabilityAreas,
  type AvailabilityAreasDraft,
  type AvailabilityAreasValidationError,
} from "./availability-areas-model";
import {
  AvailabilityAreasConflictError,
  useAvailabilityAreasQuery,
  useSaveAvailabilityAreas,
  type AvailabilityAreasConfig,
} from "./availability-areas-service";

export function AvailabilityAreasScreen() {
  const { session } = useSession();
  const profileId = session?.user.id ?? null;

  const configQuery = useAvailabilityAreasQuery(profileId);
  const save = useSaveAvailabilityAreas(profileId);
  const { showToast } = useToast();

  const config = configQuery.data ?? null;

  const [draft, setDraft] = useState<AvailabilityAreasDraft | null>(null);
  const [showError, setShowError] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /*
    Configurazione di partenza. §16: con un dato valido si precaricano modalità
    e selezioni; con un dato realmente assente **nessuna modalità** risulta
    selezionata — in particolare non Tutta Italia, che §15 vieta di
    preselezionare per completare un profilo privo di aree.
  */
  const initialDraft = useMemo<AvailabilityAreasDraft | null>(
    () => (config ? toDraft(config) : null),
    [config],
  );

  const form = draft ?? initialDraft;
  const isDirty = Boolean(
    form && initialDraft && !areAvailabilityAreasEqual(form, initialDraft),
  );

  const validationError: AvailabilityAreasValidationError | null = form
    ? validateAvailabilityAreas(form)
    : null;

  const handleBack = useUnsavedChangesGuard({
    isDirty,
    isSaving: save.isPending,
    onLeave: () => router.back(),
  });

  const handleChange = useCallback((next: AvailabilityAreasDraft) => {
    setSaveError(null);
    setDraft(next);
  }, []);

  function handleSave() {
    if (!form || !config || save.isPending) {
      return;
    }

    if (validateAvailabilityAreas(form)) {
      /*
        §17: «Con selezione incompleta la CTA non può inviare una modifica
        invalida; rendere comprensibile il requisito anche quando il pulsante
        è disabilitato». La CTA resta abilitata finché c'è qualcosa da
        salvare, e il tap rivela l'errore accanto al controllo invece di non
        fare nulla.
      */
      setShowError(true);
      return;
    }

    setSaveError(null);

    save.mutate(
      { draft: form, expectedRevision: config.revision },
      {
        onError: (error) => {
          trackProfileEvent("profile_area_save_failed", {
            geographicMode: form.mode ?? undefined,
            source: "dashboard",
          });
          setSaveError(
            error instanceof AvailabilityAreasConflictError
              ? error.message
              : AVAILABILITY_AREAS_COPY.saveError,
          );
        },
        onSuccess: (saved) => {
          trackProfileEvent("profile_area_saved", {
            geographicMode: saved.mode ?? undefined,
            source: "dashboard",
            territoryCount: saved.provinces.length + saved.regions.length,
          });
          /*
            Il draft locale viene abbandonato a favore della configurazione
            confermata: §20 chiede che il segnale si risolva sul dato
            persistito, non sull'intenzione dell'utente.
          */
          setDraft(null);
          showToast({
            icon: "checkmark-circle",
            id: "availability-areas-saved",
            message: AVAILABILITY_AREAS_COPY.saved,
            tone: "success",
          });
          router.back();
        },
      },
    );
  }

  const isReadOnly = Boolean(config && !config.canEdit);

  return (
    <ProfileEditScaffold
      errorMessage={saveError}
      onBack={handleBack}
      onSave={form && !isReadOnly ? handleSave : undefined}
      saveDisabled={!isDirty}
      saveLabel={AVAILABILITY_AREAS_COPY.save}
      saving={save.isPending}
      testID="availability-areas-screen"
    >
      <View style={styles.heading}>
        <AppText variant="screenTitle">{AVAILABILITY_AREAS_COPY.title}</AppText>
        <AppText color="secondary" variant="bodySm">
          {AVAILABILITY_AREAS_COPY.subtitle}
        </AppText>
      </View>

      {configQuery.isPending ? (
        <ProfileEditFieldsSkeleton
          rows={3}
          testID="availability-areas-skeleton"
        />
      ) : null}

      {configQuery.isError ? (
        <ProfileEditErrorState
          message={AVAILABILITY_AREAS_COPY.loadError}
          onRetry={() => void configQuery.refetch()}
          testID="availability-areas-error"
        />
      ) : null}

      {form && !configQuery.isError ? (
        <>
          {config?.unknownAreas.length ? (
            /*
              §17: aree persistite che non esistono più nella tassonomia. Non
              vengono rimosse d'ufficio — §24 vieta le conversioni
              distruttive — ma l'utente deve sapere di doverle controllare.
            */
            <AppText
              accessibilityLiveRegion="polite"
              color="danger"
              variant="bodySm"
            >
              Alcune aree non sono più disponibili. Controlla la selezione.
            </AppText>
          ) : null}

          <AvailabilityAreasSelector
            draft={form}
            error={showError ? validationError : null}
            onChange={handleChange}
            onModeChange={(mode) =>
              trackProfileEvent("profile_area_mode_changed", {
                geographicMode: mode,
                section: "areas",
                source: "dashboard",
              })
            }
          />
        </>
      ) : null}
    </ProfileEditScaffold>
  );
}

function toDraft(config: AvailabilityAreasConfig): AvailabilityAreasDraft {
  return {
    mode: config.mode,
    provinces: config.provinces,
    regions: config.regions,
  };
}

const styles = StyleSheet.create({
  heading: {
    gap: spacing[6],
    marginBottom: spacing[16],
  },
});
