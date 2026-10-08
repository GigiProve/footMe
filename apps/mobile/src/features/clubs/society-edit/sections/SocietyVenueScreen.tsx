/**
 * Sede e impianto (REV-PROF-18, schermata 4).
 *
 * Due sezioni e un toggle. Il toggle è la parte che vale la pena spiegare:
 * "Usa lo stesso indirizzo della sede" è un dato salvato, non il risultato di
 * un confronto fra due stringhe. Due indirizzi scritti in modo leggermente
 * diverso non significano che l'utente abbia chiesto di tenerli allineati, e
 * riallinearli da soli perderebbe il valore distinto.
 *
 * Con il toggle acceso l'indirizzo dell'impianto non viene copiato nel campo:
 * il campo sparisce e l'indirizzo lo risolve il database. Spegnendolo torna
 * il valore che c'era prima nella sessione, se c'era.
 *
 * La città non è la stringa digitata: è un comune della tassonomia, con la
 * sua provincia e la sua regione.
 */
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import {
  CityAutocompleteField,
  OnboardingTextField,
  ToggleRow,
} from "../../../onboarding/ui";
import { trackProfileEvent } from "../../../profiles/profile-analytics";
import { ProfileEditScaffold } from "../../../profiles/edit/ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../../../profiles/edit/ProfileEditStates";
import { useUnsavedChangesGuard } from "../../../profiles/edit/use-unsaved-changes-guard";
import { validateVenue } from "../society-edit-rules";
import { useSocietySectionEditor } from "./use-society-section-editor";

type VenueForm = {
  city: string;
  fieldAddress: string;
  headquartersAddress: string;
  region: string;
  sameAddress: boolean;
  stadium: string;
};

export function SocietyVenueScreen() {
  const editor = useSocietySectionEditor("venue");
  const club = editor.club;

  const initialForm = useMemo<VenueForm | null>(() => {
    if (!club) {
      return null;
    }

    return {
      city: club.city,
      fieldAddress: club.venueAddressSameAsHeadquarters
        ? ""
        : club.fieldAddress ?? "",
      headquartersAddress: club.headquartersAddress ?? "",
      region: club.region,
      sameAddress: club.venueAddressSameAsHeadquarters,
      stadium: club.stadium ?? "",
    };
  }, [club]);

  const [draft, setDraft] = useState<VenueForm | null>(null);
  /*
    Memoria del campo nascosto: spegnere il toggle deve restituire
    l'indirizzo che l'utente aveva scritto, non un campo vuoto.
  */
  const [parkedFieldAddress, setParkedFieldAddress] = useState("");
  const form = draft ?? initialForm;

  const isDirty = Boolean(
    form && initialForm && JSON.stringify(form) !== JSON.stringify(initialForm),
  );

  const handleBack = useUnsavedChangesGuard({
    isDirty,
    isSaving: editor.saving,
    onLeave: () => {
      editor.trackUnsavedExit(isDirty);
      router.back();
    },
  });

  const patch = useCallback(
    (changes: Partial<VenueForm>) => {
      editor.clearError();
      setDraft((current) => {
        const base = current ?? initialForm;

        return base ? { ...base, ...changes } : base;
      });
    },
    [editor, initialForm],
  );

  function handleToggleSameAddress(next: boolean) {
    if (!form) {
      return;
    }

    trackProfileEvent("society_profile_venue_same_address_toggled", {
      profileType: "society",
      section: "venue",
      visible: next,
    });

    if (next) {
      setParkedFieldAddress(form.fieldAddress);
      patch({ fieldAddress: "", sameAddress: true });
      return;
    }

    patch({ fieldAddress: parkedFieldAddress, sameAddress: false });
  }

  function handleSave() {
    if (!form) {
      return;
    }

    const error = validateVenue({
      city: form.city,
      headquartersAddress: form.headquartersAddress,
      region: form.region,
    });

    if (error) {
      editor.setErrorMessage(error);
      return;
    }

    editor.save(
      {
        city: form.city,
        // Con il toggle acceso l'indirizzo lo risolve il database dalla sede:
        // il client non manda una seconda copia che potrebbe divergere.
        field_address: form.sameAddress ? "" : form.fieldAddress,
        headquarters_address: form.headquartersAddress,
        // La provincia non si manda: la ricava il trigger `clubs_geocode`
        // dal comune, e due sorgenti per lo stesso dato divergono sempre.
        region: form.region,
        stadium: form.stadium,
        venue_address_same_as_headquarters: form.sameAddress,
      },
      () => setDraft(null),
    );
  }

  return (
    <ProfileEditScaffold
      errorMessage={editor.errorMessage}
      onBack={handleBack}
      onSave={form ? handleSave : undefined}
      onSecondary={editor.hasConflict ? editor.reload : undefined}
      saveDisabled={!isDirty}
      saving={editor.saving}
      secondaryLabel={editor.hasConflict ? "Ricarica" : undefined}
      testID="society-profile-edit-venue"
      title="Sede e impianto"
    >
      {editor.isPending ? (
        <ProfileEditFieldsSkeleton rows={4} testID="society-edit-skeleton" />
      ) : null}

      {editor.isError ? (
        <ProfileEditErrorState
          onRetry={editor.reload}
          testID="society-edit-error"
        />
      ) : null}

      {form ? (
        <>
          <View style={styles.block}>
            <AppText variant="titleSm">Sede del club</AppText>

            <CityAutocompleteField
              onChangeText={(value) => patch({ city: value })}
              onSelectCity={(option) =>
                patch({
                  city: option.name,
                  region: option.region,
                })
              }
              selectedRegion={form.region}
              testID="society-venue-city"
              value={form.city}
            />

            <OnboardingTextField
              label="Indirizzo sede"
              onChangeText={(value) => patch({ headquartersAddress: value })}
              optional
              placeholder="Via e numero civico"
              testID="society-venue-headquarters"
              value={form.headquartersAddress}
            />
          </View>

          <View style={styles.block}>
            <AppText variant="titleSm">Campo principale</AppText>

            <OnboardingTextField
              label="Nome impianto"
              onChangeText={(value) => patch({ stadium: value })}
              optional
              placeholder="Es. Stadio Comunale"
              testID="society-venue-stadium"
              value={form.stadium}
            />

            {/*
              Il campo compare solo quando serve: con il toggle acceso non
              esiste un secondo indirizzo da correggere, quindi non si mostra
              disabilitato — si toglie.
            */}
            {form.sameAddress ? null : (
              <OnboardingTextField
                label="Indirizzo impianto"
                onChangeText={(value) => patch({ fieldAddress: value })}
                optional
                placeholder="Via e numero civico"
                testID="society-venue-field-address"
                value={form.fieldAddress}
              />
            )}

            <ToggleRow
              label="Usa lo stesso indirizzo della sede"
              onValueChange={handleToggleSameAddress}
              testID="society-venue-same-address"
              value={form.sameAddress}
            />
          </View>
        </>
      ) : null}
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[12],
  },
});
