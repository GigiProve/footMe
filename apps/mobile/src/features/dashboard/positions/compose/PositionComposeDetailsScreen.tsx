import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSession } from "../../../auth/use-session";
import { STALE_MS } from "../../cache/freshness-policy";
import { DashboardGlobalEmpty, DashboardSkeleton } from "../../components/DashboardStates";
import { useDashboardIdentity } from "../../identity/use-dashboard-identity";
import { colors, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { ComposerFooter } from "./components/ComposerFooter";
import { ComposerNavBar } from "./components/ComposerNavBar";
import { ComposerStepHeader } from "./components/ComposerStepHeader";
import {
  PositionSchemaFields,
  PositionSchemaFieldsError,
} from "./components/PositionSchemaFields";
import type { PositionDetailsForm } from "./compose-types";
import { COMPOSE_HREFS } from "./compose-routes";
import { COMPOSE_QK } from "./compose-keys";
import { POSITION_SCHEMAS } from "./compose-schema";
import {
  buildDetailsPatch,
  contextSummary,
  describeComposeError,
  detailsFormErrors,
  formFromDraft,
  mergeSecondaryTeamOptions,
} from "./compose-presentation";
import {
  fetchCatalogs,
  fetchComposerContext,
  fetchEligibleTeams,
  fetchPositionDrafts,
  toComposeError,
  updatePositionDraft,
  type PositionPatch,
} from "./compose-service";
import { useUnsavedChangesGuard } from "../../../profiles/edit/use-unsaved-changes-guard";
import { useComposeSession } from "./ComposeSessionProvider";

/**
 * Step 2 di dettaglio: una sola Position (DAS-REV-16 §11-§20, screen 05, 06,
 * 08, 10).
 *
 * I campi e i loro selector vivono in `PositionSchemaFields`, montato anche
 * dall'editor di una Position già persistita (DAS-REV-17 §20): lo schema e
 * l'ordine devono essere gli stessi nelle due superfici, e un componente
 * condiviso è ciò che lo rende vero per costruzione invece che per
 * disciplina.
 */
export function PositionComposeDetailsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const { isDirty, markClean, markDirty } = useComposeSession();

  const params = useLocalSearchParams<{ from?: "hub" | "single"; positionId: string }>();
  const positionId = params.positionId;
  const from = params.from === "single" ? "single" : "hub";

  const draftsQuery = useQuery({
    enabled: !!positionId && !!actorId,
    queryFn: () => fetchPositionDrafts([positionId]),
    queryKey: COMPOSE_QK.drafts(actorId, [positionId]),
    staleTime: STALE_MS.operational,
  });

  const draft = draftsQuery.data?.[0] ?? null;

  const contextQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchComposerContext(clubId as string),
    queryKey: COMPOSE_QK.context(actorId, clubId ?? ""),
    staleTime: STALE_MS.operational,
  });

  /* Il catalogo dipende dal solo profilo, non dall'actor: è pubblico per
     chiunque sia autenticato, e una chiave per amministratore ne avrebbe
     moltiplicato le letture senza cambiarne il contenuto. */
  const profileType = draft?.profileType ?? null;

  const catalogsQuery = useQuery({
    enabled: profileType !== null,
    queryFn: () => fetchCatalogs(profileType ?? "player"),
    queryKey: COMPOSE_QK.catalogs(profileType ?? "player"),
    staleTime: STALE_MS.management,
  });

  const schema = draft ? POSITION_SCHEMAS[draft.profileType] : null;
  const limits = contextQuery.data?.limits ?? null;
  const needsTeams = !!schema?.fields.some((field) => field.kind === "secondaryTeams");

  const teamsQuery = useQuery({
    enabled: needsTeams && !!clubId,
    queryFn: () => fetchEligibleTeams(clubId as string),
    queryKey: COMPOSE_QK.teams(actorId, clubId ?? ""),
    staleTime: STALE_MS.operational,
  });

  const [form, setForm] = useState<PositionDetailsForm | null>(null);
  const [original, setOriginal] = useState<PositionDetailsForm | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncedKey, setSyncedKey] = useState<string | null>(null);

  /**
   * Il buffer locale si risincronizza solo quando arriva una **versione**
   * nuova del draft, non a ogni refetch: §21 vieta di confondere «non ancora
   * caricato» con «appena sovrascritto dall'utente», e TanStack restituisce
   * un oggetto nuovo anche quando i dati non sono cambiati.
   *
   * È un aggiustamento di stato in render, non un effetto: la sincronia con
   * un dato che arriva dall'esterno non ha niente da sottoscrivere, e un
   * `useEffect` farebbe lampeggiare un form vuoto per un frame prima di
   * riempirlo.
   */
  const draftKey = draft ? `${draft.id}:${draft.resourceVersion}` : null;

  if (draft && draftKey && draftKey !== syncedKey) {
    const next = formFromDraft(draft);

    setSyncedKey(draftKey);
    setForm(next);
    setOriginal(next);
    setFieldErrors({});
    setSaveError(null);
  }

  /**
   * La destinazione dopo un salvataggio riuscito dipende da chi ha chiesto
   * il salvataggio, non dal profilo: la CTA segue l'origine (§11), mentre
   * «Salva bozza ed esci» del dialogo di §27 esce e basta.
   */
  const mutation = useMutation({
    mutationFn: ({ patch }: { exitAfter: boolean; patch: PositionPatch }) =>
      updatePositionDraft({
        expectedVersion: draft!.resourceVersion,
        patch,
        positionId: draft!.id,
      }),
    onError: (error) => {
      /* §21: «Un errore mantiene il form e quanto digitato.» Nessuna
         navigazione, nessun `markClean`: il buffer resta da salvare. */
      setSaveError(describeComposeError(toComposeError(error)));
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["position-compose-drafts"] });
      markClean();

      if (variables.exitAfter || from !== "single") {
        router.back();
      } else {
        router.push(COMPOSE_HREFS.previewSingle(draft!.id) as never);
      }
    },
  });

  /**
   * Uscita dal dettaglio (§27).
   *
   * «Con modifiche non persistite mostra Uscire senza salvare? … Azioni:
   * Continua a modificare, Salva bozza ed esci quando il salvataggio è
   * consentito e valido, Esci senza salvare.»
   *
   * `onSaveAndLeave` è `undefined` quando il salvataggio non sarebbe
   * valido: §27 la vuole «quando il salvataggio è consentito e valido», e
   * un pulsante che fallisce sistematicamente non è un'uscita.
   */
  const confirmExit = useUnsavedChangesGuard({
    /* Finché la bozza non è caricata non c'è buffer da proteggere, e un
       dialogo su una schermata ancora vuota bloccherebbe il back. */
    isDirty: isDirty && draft !== null,
    isSaving: mutation.isPending,
    onLeave: () => {
      /* §27: «Scartare il buffer non elimina bozze già persistite.» Il
         record resta dov'è; si butta via solo ciò che non era stato
         ancora salvato. */
      markClean();
      router.back();
    },
    onSaveAndLeave:
      Object.keys(localErrors()).length === 0 ? () => handleSave(true) : undefined,
  });

  if (draftsQuery.isLoading || contextQuery.isLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <DashboardSkeleton />
      </View>
    );
  }

  if (!draft || !form || !original || !schema) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <DashboardGlobalEmpty
          copy={{
            actionLabel: "Torna indietro",
            body: "Potrebbe essere stata eliminata o non essere più nel tuo perimetro.",
            icon: "briefcase-outline",
            title: "Questa posizione non è più disponibile.",
          }}
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const catalogs = catalogsQuery.data ?? null;

  function updateForm(patch: Partial<PositionDetailsForm>) {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
    /* L'errore di un campo sparisce appena quel campo cambia: §21 chiede di
       «mantenere i valori digitati», non di mantenere un errore superato. */
    setFieldErrors((prev) => {
      const next = { ...prev };

      for (const key of Object.keys(patch)) {
        delete next[key === "ageMode" || key === "ageMin" || key === "ageMax" ? "ageRange" : key];
      }

      return next;
    });
    markDirty();
  }

  function navigateAfterNoop(exitAfter = false) {
    markClean();

    if (!exitAfter && from === "single") {
      router.push(COMPOSE_HREFS.previewSingle(draft!.id) as never);
    } else {
      router.back();
    }
  }

  /**
   * Validazione locale, la stessa che decide se «Salva bozza ed esci» sia
   * un'azione offribile (§27: «quando il salvataggio è consentito e
   * valido»). Restituisce la mappa degli errori senza scriverla, così il
   * dialogo può interrogarla senza accendere errori sul form.
   */
  function localErrors(): Record<string, string | null> {
    if (!limits || !form || !schema) {
      return {};
    }

    return detailsFormErrors(form, schema.fields, limits);
  }

  function handleSave(exitAfter = false) {
    if (!limits) {
      return;
    }

    const errors = localErrors();

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      // §11: un errore formale blocca il salvataggio e basta, la CTA non
      // naviga qui qualunque sia l'origine.
      return;
    }

    const patch = buildDetailsPatch(original!, form!);

    if (Object.keys(patch).length === 0) {
      // §21: una patch vuota non deve bumpare resourceVersion per nulla.
      navigateAfterNoop(exitAfter);
      return;
    }

    mutation.mutate({ exitAfter, patch: patch as PositionPatch });
  }

  const showNoDetailsHint =
    from === "single" && schema.guidance !== null && !draft.hasDetails;

  const primaryLabel = from === "hub" ? "Salva dettagli" : "Anteprima";

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ComposerNavBar
        isVerified={contextQuery.data?.clubIsVerified ?? draft.clubIsVerified}
        logoUrl={contextQuery.data?.clubLogoUrl ?? draft.clubLogoUrl}
        name={contextQuery.data?.clubName ?? draft.clubName}
        onBack={confirmExit}
      />

      <ScrollView contentContainerStyle={styles.content} style={styles.scroll}>
        <ComposerStepHeader
          context={contextSummary(draft)}
          step={2}
          title={draft.title ?? "Posizione"}
        />

        {showNoDetailsHint ? (
          <AppText color="neutralMuted" variant="bodySm">
            Puoi proseguire anche senza aggiungere dettagli.
          </AppText>
        ) : null}

        {catalogsQuery.isError ? (
          <PositionSchemaFieldsError
            message={describeComposeError(toComposeError(catalogsQuery.error))}
            onRetry={() => void catalogsQuery.refetch()}
          />
        ) : (
          <PositionSchemaFields
            catalogs={catalogs}
            context={{
              contextLabel: draft.contextLabel,
              primaryTeamId: draft.teamId,
              primaryTeamName: draft.teamName,
              profileType: draft.profileType,
              scope: draft.scope,
            }}
            errors={fieldErrors}
            fields={schema.fields}
            limits={
              limits ?? {
                ageMax: 70,
                ageMin: 5,
                customRoleName: 80,
                description: 2000,
                requirements: 1000,
                responsibilities: 1500,
                staffQualification: 300,
              }
            }
            onChange={updateForm}
            teams={mergeSecondaryTeamOptions(teamsQuery.data ?? [], draft.secondaryTeams)}
            value={form}
          />
        )}
      </ScrollView>

      {saveError ? (
        <AppText accessibilityRole="alert" color="danger" style={styles.saveError} variant="meta">
          {saveError}
        </AppText>
      ) : null}

      <ComposerFooter
        onPrimary={handleSave}
        primaryLabel={primaryLabel}
        primaryLoading={mutation.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[16],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[16],
  },
  saveError: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
  },
  /* §4: «il footer resta sopra safe area e tastiera, con spazio di
     scorrimento sufficiente dopo l'ultimo campo.» Senza `flex: 1` la
     ScrollView si dimensiona sul contenuto e il footer risale sotto
     l'ultimo campo invece di restare in fondo. */
  scroll: {
    flex: 1,
  },
  screen: {
    backgroundColor: colors.surface,
    flex: 1,
  },
});
