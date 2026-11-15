/**
 * Il flow Segnala (HOM-11 §79–§162, §184, §188–§190, §204): stato, invio idempotente,
 * esiti e cache.
 *
 * L'invio sta in `createReportSubmitter`, senza React e con le dipendenze iniettate, così
 * si prova senza renderizzare niente; `useReportFlow` lo lega alle stores, alle RPC, alla
 * cache del Feed e agli eventi.
 *
 *  • bozza per target (§98–§99): categoria, sottocategoria, dettagli e chiave vivono
 *    nello store, non nel componente; un errore non costringe a ricominciare;
 *  • chiave di idempotenza STABILE per bozza (§100–§101): doppio tap, «Riprova» e
 *    timeout ambiguo riusano la stessa chiave e il server risponde con lo stesso report;
 *  • un solo invio in volo per target (§96): la guardia è un set, non lo stato React;
 *  • successo (§114, §123): il target entra nello store dei segnalati — sparisce dalla
 *    superficie del reporter (Feed, commento collassato) — e le pagine del Feed in
 *    cache lo perdono (§125, §293). Mai un Follow cambiato, mai un Block (§150–§151),
 *    mai un «Non mi interessa»: tre domini, nessuna cascata (§167);
 *  • fallimento (§155–§158): niente falso successo, dati intatti, retry con la stessa
 *    chiave. Un'identità di interazione viaggia solo come metadata (§77).
 *
 * §189: nessun evento porta il testo libero.
 */

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";

import { useSession } from "../auth/use-session";
import { FEED_QK } from "../feed/feed-keys";
import { asFeedContentType } from "../feed/feed-post-mapper";
import { removeCanonicalContent } from "../feed/feed-signal-cache";
import type { FeedPage, FeedPageParam, FeedScope } from "../feed/feed-types";
import { likeStore } from "../interactions/like-store";
import { MODERATION_QK } from "./moderation-keys";
import {
  buildSubmission,
  chooseCategory as draftChooseCategory,
  chooseSubcategory as draftChooseSubcategory,
  clearCategory as draftClearCategory,
  findCategory,
  isSubmitEnabled,
  needsSubcategory,
  nextOperationKey,
  phaseForCreateStatus,
  phaseForReportState,
  reportStep,
  reportTargetKey,
  setDetails as draftSetDetails,
  submissionFingerprint,
  subcategoriesOf,
  allowsDetails,
  rootCategories,
} from "./moderation-presentation";
import { trackReport, type ReportAnalyticsEvent } from "./moderation-analytics";
import {
  createModerationReport,
  fetchReportCategories,
  fetchReportState,
} from "./moderation-service";
import type {
  ContextualIdentity,
  ReportCategory,
  ReportPhase,
  ReportTarget,
} from "./moderation-types";
import { newReportOperationKey } from "./operation-key";
import { reportDraftStore, useReportDraft, type ReportDraftStore } from "./report-draft-store";
import { reportedStore, type ReportedStore } from "./reported-store";

type FeedData = InfiniteData<FeedPage, FeedPageParam>;

const FEED_SCOPES: readonly FeedScope[] = ["per_te", "seguiti"];
const CATEGORIES_STALE_MS = 5 * 60 * 1000;

export type SubmitOutcome = {
  phase: ReportPhase;
  /** `invalid_category`: le categorie del client erano vecchie, vanno rilette. */
  staleCategories: boolean;
};

type SubmitDeps = {
  drafts: ReportDraftStore;
  reported: ReportedStore;
  create: typeof createModerationReport;
  newKey: () => string;
  identity: () => ContextualIdentity | null;
  track: (event: ReportAnalyticsEvent) => void;
  /** Dopo un report riuscito o già esistente: pulizia delle cache del Feed. */
  onReported: (target: ReportTarget) => void;
};

function baseOf(target: ReportTarget) {
  return {
    contentType: target.contentType,
    origin: target.origin,
    targetType: target.targetType,
  };
}

export function createReportSubmitter(deps: SubmitDeps, inFlight: Set<string> = new Set<string>()) {
  const { create, drafts, identity, newKey, onReported, reported, track } = deps;

  /**
   * Invia la bozza. `null` = non si invia: manca una selezione obbligatoria (§95) o un
   * invio per questo target è già in volo (§96).
   */
  async function submit(
    target: ReportTarget,
    categories: readonly ReportCategory[],
  ): Promise<SubmitOutcome | null> {
    const key = reportTargetKey(target);
    const draft = drafts.get(key);
    const submission = buildSubmission(draft, categories);

    if (!submission || inFlight.has(key)) {
      return null;
    }
    inFlight.add(key);

    const base = baseOf(target);
    const fingerprint = submissionFingerprint(submission);
    const isRetry = draft.operationKey !== null && draft.attemptedFingerprint === fingerprint;
    // §100–§101: stessa chiave finché il contenuto inviato è lo stesso.
    const operationKey = nextOperationKey(draft, fingerprint, newKey);
    drafts.update(key, (current) => ({
      ...current,
      attemptedFingerprint: fingerprint,
      operationKey,
    }));

    track({
      ...base,
      categoryId: submission.categoryId,
      hasDetails: submission.details !== null,
      isRetry,
      name: "report_submit_attempt",
      subcategoryId: submission.subcategoryId,
    });

    try {
      const result = await create({
        categoryId: submission.categoryId,
        contextualIdentity: identity(),
        details: submission.details,
        operationKey,
        subcategoryId: submission.subcategoryId,
        target,
      });
      const phase = phaseForCreateStatus(result.status);

      if (phase === "error") {
        track({ ...base, categoryId: submission.categoryId, name: "report_submit_failure", reason: "invalid_category" });
        return { phase, staleCategories: true };
      }

      // Esito definitivo: la bozza ha fatto il suo lavoro.
      drafts.clear(key);

      if (phase === "success") {
        track({ ...base, categoryId: submission.categoryId, name: "report_submit_success" });
      } else if (phase === "duplicate") {
        track({ ...base, name: "report_duplicate_detected", via: "submit" });
      } else if (phase === "not_allowed") {
        track({ ...base, categoryId: submission.categoryId, name: "report_submit_failure", reason: "not_allowed" });
      }

      if (phase === "success" || phase === "duplicate") {
        // §123, §125, §131: il reporter non lo rivede, e il menu non offre un secondo invio.
        reported.add(key);
        onReported(target);
      }

      return { phase, staleCategories: false };
    } catch {
      // §155–§158: nessun successo inventato; la bozza e la chiave restano per il retry.
      track({ ...base, categoryId: submission.categoryId, name: "report_submit_failure", reason: "network" });
      return { phase: "error", staleCategories: false };
    } finally {
      inFlight.delete(key);
    }
  }

  return { submit };
}

export function useReportFlow(target: ReportTarget) {
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const viewerId = profile?.id ?? "";
  const key = reportTargetKey(target);
  const draft = useReportDraft(key);
  const [phase, setPhase] = useState<ReportPhase>("form");
  const inFlightRef = useRef(new Set<string>());

  const categoriesQuery = useQuery({
    queryFn: () => fetchReportCategories(target.targetType),
    queryKey: MODERATION_QK.categories(target.targetType),
    staleTime: CATEGORIES_STALE_MS,
  });
  const categories = categoriesQuery.data;

  // D6, §126, §159: lo stato del target per questo viewer, sempre fresco all'apertura.
  // Un guasto non blocca il flow: l'invio rivalida tutto sul server (§182).
  const stateQuery = useQuery({
    enabled: viewerId.length > 0,
    queryFn: () => fetchReportState(target),
    queryKey: MODERATION_QK.state(viewerId, target),
    refetchOnMount: "always",
    retry: false,
    staleTime: 0,
  });
  const remotePhase = stateQuery.data ? phaseForReportState(stateQuery.data) : null;
  const effectivePhase: ReportPhase = phase === "form" && remotePhase ? remotePhase : phase;

  const base = baseOf(target);

  // §188: una volta per apertura del flow.
  const openTrackedRef = useRef(false);
  useEffect(() => {
    if (openTrackedRef.current) {
      return;
    }
    openTrackedRef.current = true;
    const opened = {
      contentType: target.contentType,
      origin: target.origin,
      targetType: target.targetType,
    };
    trackReport({ ...opened, name: "report_flow_open" });
    if (target.targetType === "COMMENT") {
      trackReport({ ...opened, name: "report_comment_open" });
    }
  }, [target.contentType, target.origin, target.targetType]);

  // §295: «già segnalato» scoperto sul server (altro device) vale come segnalato anche qui.
  const duplicateTrackedRef = useRef(false);
  useEffect(() => {
    if (remotePhase === "duplicate" && phase === "form" && !duplicateTrackedRef.current) {
      duplicateTrackedRef.current = true;
      reportedStore.add(key);
      trackReport({
        contentType: target.contentType,
        name: "report_duplicate_detected",
        origin: target.origin,
        targetType: target.targetType,
        via: "state",
      });
    }
  }, [key, phase, remotePhase, target.contentType, target.origin, target.targetType]);

  const submitter = createReportSubmitter(
    {
      create: createModerationReport,
      drafts: reportDraftStore,
      identity: () => {
        const current = likeStore.getIdentity();
        return current ? { id: current.id, type: current.type } : null;
      },
      newKey: newReportOperationKey,
      onReported: (reported) => {
        // §125, §171, §293: il contenuto esce dalle pagine in cache di entrambe le tab.
        const contentType = reported.targetType === "CONTENT" ? asFeedContentType(reported.contentType) : null;
        if (contentType && viewerId) {
          for (const scope of FEED_SCOPES) {
            queryClient.setQueryData<FeedData>(FEED_QK.feed(scope, viewerId), (data) =>
              removeCanonicalContent(data, contentType, reported.targetId),
            );
          }
        }
        // §126: lo stato «già segnalato» è già noto: niente nuovo giro verso il server.
        queryClient.setQueryData(MODERATION_QK.state(viewerId, reported), {
          alreadyReported: true,
          available: true,
          // Come il server: già segnalato ⇒ non si può inviare una NUOVA segnalazione.
          reportable: false,
        });
      },
      reported: reportedStore,
      track: trackReport,
    },
    inFlightRef.current,
  );

  const selectedCategory = findCategory(categories ?? [], draft.categoryId);
  const canSubmit = isSubmitEnabled({ categories: categories ?? [], draft, phase: effectivePhase });

  return {
    actions: {
      chooseCategory: (category: ReportCategory) => {
        reportDraftStore.update(key, (current) => draftChooseCategory(current, category.categoryId));
        trackReport({ ...base, categoryId: category.categoryId, name: "report_category_selected" });
      },
      chooseSubcategory: (subcategory: ReportCategory) => {
        if (!draft.categoryId) {
          return;
        }
        reportDraftStore.update(key, (current) => draftChooseSubcategory(current, subcategory.categoryId));
        trackReport({
          ...base,
          categoryId: draft.categoryId,
          name: "report_subcategory_selected",
          subcategoryId: subcategory.categoryId,
        });
      },
      /** §93 «Modifica» e la freccia indietro: il testo resta. */
      clearCategory: () => {
        reportDraftStore.update(key, draftClearCategory);
        // L'errore di un invio non segue chi torna a scegliere: si riparte da un modulo pulito.
        setPhase((current) => (current === "error" ? "form" : current));
      },
      retryCategories: () => void categoriesQuery.refetch(),
      setDetails: (value: string) => reportDraftStore.update(key, (current) => draftSetDetails(current, value)),
      submit: async () => {
        // Un invio già in volo per questo target (doppio tap nello stesso frame, con la closure
        // ancora «abilitata») non tocca la fase: il loading resta fino alla risposta (§96–§97).
        if (!categories || !canSubmit || inFlightRef.current.has(key)) {
          return;
        }
        setPhase("submitting");
        const outcome = await submitter.submit(target, categories);

        if (!outcome) {
          // Nessun invio è partito (selezione mancante): torna il modulo.
          setPhase("form");
          return;
        }
        setPhase(outcome.phase);

        if (outcome.staleCategories) {
          // Categorie vecchie: si rileggono e si torna alla scelta, senza perdere il testo.
          reportDraftStore.update(key, draftClearCategory);
          void categoriesQuery.refetch();
        }
      },
    },
    categories,
    categoriesStatus: categoriesQuery.isError
      ? ("error" as const)
      : categoriesQuery.isLoading
        ? ("loading" as const)
        : ("ready" as const),
    draft,
    isSubmitting: effectivePhase === "submitting",
    phase: effectivePhase,
    rootCategories: rootCategories(categories ?? []),
    selectedCategory,
    showDetails: allowsDetails(selectedCategory),
    showSubcategories: needsSubcategory(categories ?? [], selectedCategory),
    step: reportStep(draft),
    subcategories: selectedCategory ? subcategoriesOf(categories ?? [], selectedCategory.categoryId) : [],
    canSubmit,
  };
}
