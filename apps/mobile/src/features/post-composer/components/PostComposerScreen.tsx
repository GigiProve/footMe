/**
 * Schermata del composer Post: Nuovo post e Modifica post (HOM-06.1 §6–10, §14–17,
 * §31–38, §68–72, §119–130, §137–140, §144–154, §158, §163–164, §169–177, §187–195).
 *
 * UNA schermata per le due modalità (§144): cambiano titolo, CTA e quali
 * controlli esistono, non il componente.
 *
 * Full-screen (§6): la route sta fuori da `(tabs)`, quindi niente header PROLINK,
 * campanella, «+», tab Per te/Seguiti né bottom navigation. Struttura (§37–38):
 *
 *   ComposerHeader                         Annulla | Nuovo post | Pubblica
 *   ComposerIdentityRow                    chi pubblica (selector solo se >1, §16–17)
 *   ScrollView                             testo, media, anteprima link, riga «Con …»
 *   ComposerStatusBanner                   solo se c'è qualcosa da dire
 *   MentionSuggestions                     sopra la toolbar mentre si digita «@»
 *   ComposerToolbar                        sticky sopra la tastiera: Foto/video · Tagga
 *
 * Toolbar e suggerimenti stanno FUORI dallo scroll, dentro un `KeyboardAvoidingView`
 * (stesso pattern di `TagPeopleSheet`): restano raggiungibili a tastiera aperta.
 * L'inset inferiore dell'home indicator vale solo a tastiera chiusa.
 *
 * Chiusura (§121–127, §164): il composer è sempre una push sopra la superficie
 * d'origine, quindi si torna con `router.back()` — stessa tab, stesso Feed, nessun
 * reset dello scroll. Senza stack (deep link, ricreazione dopo recovery) si va
 * alla Home. Il feedback è un toast («Post pubblicato» + «Visualizza», «Post
 * aggiornato»): nessuna schermata di successo (§130). Il `ToastProvider` sta nel
 * layout radice, sopra lo Stack: il toast sopravvive alla chiusura del composer.
 *
 * HOM-06.2 (bozze e programmazione) nello STESSO composer, senza un secondo (§83):
 *  • «Pubblicazione · Ora ›» sopra la toolbar, solo se l'identity ha
 *    `can_schedule_content` (§84–§85); la CTA segue la scelta: Pubblica / Programma
 *    (§79, §88, §92), «Salva» su un programmato (§167);
 *  • «Bozza salvata» discreto accanto, mai un toast (§119–§120, §247);
 *  • uscita a tre azioni per una bozza (§133–§136); un programmato o un Post
 *    pubblicato conservano «Annullare le modifiche?» (nessuna bozza da eliminare);
 *  • `?draft_type=&draft_id=` riapre una bozza, un programmato o un fallito (§147).
 */

import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button, useToast } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { contentDetailHref } from "../../feed/content-routes";
import { AutosaveStatus } from "../../publishing/components/AutosaveStatus";
import { ExitDraftDialog } from "../../publishing/components/ExitDraftDialog";
import { PublicationRow } from "../../publishing/components/PublicationRow";
import { PublicationSheet } from "../../publishing/components/PublicationSheet";
import { trackPublishing } from "../../publishing/publishing-analytics";
import { submitSuccessCopy } from "../../publishing/publishing-presentation";
import { parseDraftRef } from "../../publishing/publishing-routes";
import {
  canPublish,
  composerCtaLabel,
  errorCopy,
  hasIdentityChoice,
  hasProcessingVideo,
  identityAccessibilityLabel,
  isEditingScheduled,
  mediaAccessibilityLabel,
  scheduleBlockReason,
  shouldShowRichPreview,
  tagSummary,
  COMPOSER_NOT_FOUND_COPY,
  COMPOSER_VIDEO_PREPARING_COPY,
} from "../composer-presentation";
import type { ComposerState } from "../composer-reducer";
import {
  COMPOSER_FALLBACK_HREF,
  contentOriginForComposer,
  parseComposerCreateParams,
  parseComposerEditParams,
} from "../composer-routes";
import { composerStatus, exitDecision, type ExitDecision } from "../composer-status";
import { usePostComposer, usePostComposerSource, type ComposerPublishedResult } from "../use-post-composer";
import { ComposerBodyInput } from "./ComposerBodyInput";
import { ComposerHeader, type ComposerHeaderCtaState } from "./ComposerHeader";
import { ComposerIdentityRow } from "./ComposerIdentityRow";
import { ComposerLinkPreviewCard } from "./ComposerLinkPreviewCard";
import { ComposerMediaGrid } from "./ComposerMediaGrid";
import { ComposerMediaPreview } from "./ComposerMediaPreview";
import { ComposerStatusBanner } from "./ComposerStatusBanner";
import { ComposerTagSummary } from "./ComposerTagSummary";
import { ComposerToolbar } from "./ComposerToolbar";
import { DiscardDraftDialog } from "./DiscardDraftDialog";
import { MentionSuggestions } from "./MentionSuggestions";
import { PublishAsSheet } from "./PublishAsSheet";
import { TagPeopleSheet } from "./TagPeopleSheet";

export const COMPOSER_PUBLISHED_TOAST = "Post pubblicato"; // §128
export const COMPOSER_VIEW_ACTION = "Visualizza"; // §128–129
export const COMPOSER_UPDATED_TOAST = "Post aggiornato"; // §163
/** HOM-06.2 §170: «Cambia data e ora» e «Salva» su un programmato con la data cambiata. */
export const COMPOSER_RESCHEDULED_TOAST = "Programmazione aggiornata";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Vista minima del navigatore per `beforeRemove` (stesso approccio di
 * `features/profiles/edit/use-unsaved-changes-guard.ts`): scatta per Annulla, back
 * hardware Android e gesture iOS, non solo per `router.back()` chiamato a mano.
 */
type ExitNavigator = {
  addListener: (type: "beforeRemove", callback: (event: { preventDefault: () => void }) => void) => () => void;
};

export type PostComposerScreenProps = {
  kind: "create" | "edit";
  /** I search params grezzi della route: li interpreta `composer-routes.ts`. */
  search: SearchParams;
};

/* ------------------------------------------------------------------ */
/* Guscio: carica, poi monta il form                                   */
/* ------------------------------------------------------------------ */

function ComposerMessage({
  message,
  onRetry,
  onClose,
}: {
  message: string;
  onRetry?: () => void;
  onClose: () => void;
}) {
  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.root}>
      <View style={styles.centered}>
        <AppText align="center" color="secondary" variant="bodyLg">
          {message}
        </AppText>
        <View style={styles.messageActions}>
          {onRetry ? <Button label="Riprova" onPress={onRetry} variant="secondary" /> : null}
          <Button label="Chiudi" onPress={onClose} variant="outline" />
        </View>
      </View>
    </SafeAreaView>
  );
}

export function PostComposerScreen({ kind, search }: PostComposerScreenProps) {
  const router = useRouter();
  const { profile, session } = useSession();
  const userId = session?.user.id ?? profile?.id ?? "";
  const profileId = profile?.id ?? userId;

  const createParams = parseComposerCreateParams(search);
  const editParams = kind === "edit" ? parseComposerEditParams(search) : null;

  // Modifica con parametri inutilizzabili: nessuna query, «non disponibile».
  const isBrokenEdit = kind === "edit" && editParams === null;

  const source = usePostComposerSource({
    // §147: una bozza, un programmato o un fallito si riapre nello stesso composer di creazione.
    draftRef: kind === "create" ? parseDraftRef(search) : null,
    edit: editParams
      ? { contentId: editParams.contentId, contentType: editParams.contentType, origin: editParams.origin }
      : null,
    identityHint: createParams.identityId,
    origin: createParams.origin,
    userId: isBrokenEdit ? "" : userId,
  });

  // §122–127: indietro alla superficie d'origine; senza stack, la Home.
  function close() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(COMPOSER_FALLBACK_HREF as never);
    }
  }

  if (isBrokenEdit) {
    return <ComposerMessage message={COMPOSER_NOT_FOUND_COPY} onClose={close} />;
  }

  if (source.status === "loading") {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={styles.root}>
        <View style={styles.centered} testID="composer-loading">
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (source.status === "error") {
    const retryable = source.code === "network" || source.code === "unknown";

    return (
      <ComposerMessage
        message={errorCopy(source.code, kind)}
        onClose={close}
        onRetry={retryable ? source.retry : undefined}
      />
    );
  }

  return <PostComposerForm initialState={source.initialState} onClose={close} profileId={profileId} userId={userId} />;
}

/* ------------------------------------------------------------------ */
/* Form                                                                */
/* ------------------------------------------------------------------ */

type PostComposerFormProps = {
  initialState: ComposerState;
  userId: string;
  profileId: string;
  onClose: () => void;
};

function PostComposerForm({ initialState, userId, profileId, onClose }: PostComposerFormProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [publishAsOpen, setPublishAsOpen] = useState(false);
  const [publicationOpen, setPublicationOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // §135–§136: «Esci e conserva» / «Elimina bozza» sono asincroni; il dialogo resta aperto e occupato.
  const [exitBusy, setExitBusy] = useState(false);
  const [exitError, setExitError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  // Distingue drag da «Sposta prima/dopo» (§55, §58) per gli analytics.
  const draggingRef = useRef(false);

  // §37: l'inset dell'home indicator serve solo a tastiera chiusa.
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardOpen(false));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const navigation = useNavigation() as unknown as ExitNavigator;
  // `leavingRef`: si sta già uscendo di proposito (Annulla confermato, successo) →
  // `beforeRemove` lascia passare e `leave()` non parte due volte (niente doppio
  // `router.back()`, che farebbe saltare anche la schermata d'origine).
  const leavingRef = useRef(false);
  const mountedRef = useRef(true);
  // Ultimo stato di uscita, letto SOLO dal listener quando scatta.
  const exitRef = useRef<{ decision: ExitDecision; discard: () => void }>({
    decision: "leave",
    discard: () => undefined,
  });

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  function leave() {
    if (leavingRef.current) {
      return;
    }

    leavingRef.current = true;
    onClose();
  }

  // §138: back hardware Android e gesture iOS valgono Annulla.
  useEffect(() => {
    return navigation.addListener("beforeRemove", (event) => {
      if (leavingRef.current) {
        return;
      }

      const { decision, discard } = exitRef.current;

      if (decision === "leave") {
        discard();
        return;
      }

      event.preventDefault();

      if (decision === "confirm") {
        setConfirmOpen(true);
      }
    });
  }, [navigation]);

  function handlePublished(result: ComposerPublishedResult, published: ComposerState) {
    // Un successo che arriva dopo che l'utente è già uscito non chiude niente: sarebbe un secondo back.
    if (mountedRef.current) {
      leave();
    }

    // §209–§212: nessuna schermata celebrativa, solo un toast.
    if (result.publication === "keep") {
      showToast({ message: COMPOSER_UPDATED_TOAST, tone: "success" });
      return;
    }

    if (result.status === "scheduled" && result.publication.mode === "scheduled") {
      showToast({
        message: isEditingScheduled(published)
          ? COMPOSER_RESCHEDULED_TOAST
          : submitSuccessCopy("post", result.publication),
        tone: "success",
      });
      return;
    }

    showToast({
      action: {
        label: COMPOSER_VIEW_ACTION,
        onPress: () =>
          router.push(
            contentDetailHref(result.contentType, result.contentId, {
              origin: contentOriginForComposer(published.origin),
            }) as never,
          ),
      },
      message: COMPOSER_PUBLISHED_TOAST,
      tone: "success",
    });
  }

  function handleUpdated() {
    if (mountedRef.current) {
      leave();
    }
    showToast({ message: COMPOSER_UPDATED_TOAST, tone: "success" });
  }

  const composer = usePostComposer({
    initialState,
    onPublished: handlePublished,
    onUpdated: handleUpdated,
    profileId,
    userId,
  });
  const { actions, state } = composer;

  const isEdit = state.mode.kind === "edit";
  const isScheduledEdit = isEditingScheduled(state);
  const isPublishing = state.publish.status === "publishing";
  const ctaState: ComposerHeaderCtaState = isPublishing ? "loading" : canPublish(state) ? "enabled" : "disabled";
  const status = composerStatus(state, composer.notice);
  const summary = tagSummary(state.tagged);
  const showPreview = shouldShowRichPreview(state);
  // §84–§85: la riga Pubblicazione esiste solo con `can_schedule_content`; mai nella Modifica di un pubblicato (§83).
  const showPublication = !isEdit && state.identity?.canSchedule === true;
  // Una bozza (nuova, riaperta o fallita) ha l'uscita a tre azioni (§133–§136); un programmato e un Post pubblicato no.
  const usesDraftExit = !isEdit && !isScheduledEdit;
  const publicationNote =
    state.publication.mode === "scheduled" && hasProcessingVideo(state.media) ? COMPOSER_VIDEO_PREPARING_COPY : null;

  const decision = exitDecision({ isDirty: composer.isDirty, isPublishing });

  useEffect(() => {
    exitRef.current = { decision, discard: actions.discard };
  });

  function handleCancel() {
    // §137: composer vuoto → chiude senza dialog. §138: con contenuto, conferma.
    // Durante l'invio Annulla non fa nulla (§119).
    if (decision === "block") {
      return;
    }

    if (decision === "confirm") {
      setConfirmOpen(true);
      return;
    }

    actions.discard();
    leave();
  }

  function handleDiscard() {
    setConfirmOpen(false);
    actions.discard();
    leave();
  }

  /** §135 «Esci e conserva bozza». */
  async function handleKeepDraft() {
    setExitBusy(true);
    setExitError(null);
    await actions.keepDraft();

    if (mountedRef.current) {
      setExitBusy(false);
      setConfirmOpen(false);
    }

    leave();
  }

  /** §136 «Elimina bozza»: se il server rifiuta, la bozza resta e lo si dice. */
  async function handleDeleteDraft() {
    setExitBusy(true);
    setExitError(null);
    const result = await actions.deleteDraft();

    if (!mountedRef.current) {
      return;
    }

    setExitBusy(false);

    if (!result.ok) {
      setExitError(result.error);
      return;
    }

    setConfirmOpen(false);
    leave();
  }

  function handleContinueEditing() {
    setConfirmOpen(false);
    setExitError(null);
  }

  function handleDragActiveChange(active: boolean) {
    draggingRef.current = active;
    setDragging(active);
  }

  function handleMove(localId: string, toIndex: number) {
    actions.moveMedia(localId, toIndex, draggingRef.current ? "drag" : "buttons");
  }

  const link = state.link;
  const retryLink = link.status === "failed" && link.retryable ? actions.retryLink : undefined;
  const openLink =
    link.status === "idle"
      ? undefined
      : () => {
          void Linking.openURL(link.status === "ready" ? link.finalUrl : link.url);
        };

  return (
    <SafeAreaView edges={keyboardOpen ? ["top"] : ["top", "bottom"]} style={styles.root}>
      <ComposerHeader
        cancelDisabled={isPublishing}
        ctaLabel={composerCtaLabel(state)}
        ctaState={ctaState}
        onCancel={handleCancel}
        onSubmit={() => {
          void actions.submit();
        }}
        title={isEdit || isScheduledEdit ? "Modifica post" : "Nuovo post"}
      />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        {state.identity ? (
          <ComposerIdentityRow
            accessibilityLabel={identityAccessibilityLabel(state.identity)}
            identity={state.identity}
            onPress={() => setPublishAsOpen(true)}
            selectable={hasIdentityChoice(state) && !isPublishing}
          />
        ) : null}

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!dragging}
          style={styles.flex}
        >
          <ComposerBodyInput
            autoFocus={!isEdit}
            editable={!isPublishing && state.canEdit}
            maxLength={state.limits.maxBodyLength}
            onChangeText={actions.setBody}
            onSelectionChange={actions.setSelection}
            value={state.body}
          />

          <ComposerMediaGrid
            getAccessibilityLabel={mediaAccessibilityLabel}
            items={state.media}
            onDragActiveChange={handleDragActiveChange}
            onMove={handleMove}
            onOpen={setPreviewId}
            onRemove={actions.removeMedia}
            onRetry={actions.retryMedia}
            readOnly={isEdit || isPublishing}
            showReadOnlyNote={isEdit}
            showReorderHint={composer.showReorderHint}
          />

          {showPreview ? (
            <ComposerLinkPreviewCard
              onDismiss={actions.dismissLink}
              onOpenLink={openLink}
              onRetry={retryLink}
              state={state.link}
            />
          ) : null}

          {summary ? (
            <ComposerTagSummary
              highlightedNames={state.tagged.slice(0, 2).map((identity) => identity.displayName)}
              onPress={actions.openTagSheet}
              text={summary}
            />
          ) : null}
        </ScrollView>

        {status ? <ComposerStatusBanner message={status.message} tone={status.tone} /> : null}

        <MentionSuggestions
          candidates={composer.mention.candidates}
          loading={composer.mention.loading}
          onSelect={actions.selectMention}
        />

        {showPublication ? (
          <PublicationRow
            disabled={isPublishing}
            note={publicationNote}
            onPress={() => {
              trackPublishing({ format: "post", name: "schedule_opened" });
              setPublicationOpen(true);
            }}
            publication={state.publication}
          />
        ) : null}

        {usesDraftExit && composer.autosave.status !== "idle" ? (
          <View style={styles.autosaveRow}>
            <AutosaveStatus status={composer.autosave} />
          </View>
        ) : null}

        <ComposerToolbar
          mediaDisabled={isPublishing}
          onPressMedia={() => {
            void actions.addMedia();
          }}
          onPressTag={actions.openTagSheet}
          showMedia={!isEdit}
          tagDisabled={isPublishing}
        />
      </KeyboardAvoidingView>

      <PublishAsSheet
        identities={state.identities}
        onClose={() => setPublishAsOpen(false)}
        onSelect={(identity) => {
          actions.changeIdentity(identity);
          setPublishAsOpen(false);
        }}
        selected={state.identity ? { id: state.identity.id, type: state.identity.type } : null}
        visible={publishAsOpen}
      />

      <TagPeopleSheet
        errorMessage={composer.tag.error}
        isSelected={(identity) =>
          composer.tag.draft.some(
            (draft) => draft.identityType === identity.identityType && draft.identityId === identity.identityId,
          )
        }
        limitReached={composer.tag.draft.length >= state.limits.maxTags}
        loading={composer.tag.loading}
        onClose={actions.closeTagSheet}
        onDone={actions.confirmTags}
        onQueryChange={actions.setTagQuery}
        onToggle={actions.toggleTag}
        query={composer.tag.query}
        results={composer.tag.results}
        selectedCount={composer.tag.draft.length}
        visible={composer.tag.open}
      />

      {showPublication ? (
        <PublicationSheet
          blockedReason={scheduleBlockReason(state.media)}
          futureOnly={isScheduledEdit}
          onClose={() => setPublicationOpen(false)}
          onConfirm={(publication) => {
            actions.setPublication(publication);
            setPublicationOpen(false);
          }}
          policy={state.schedule}
          publication={state.publication}
          visible={publicationOpen}
        />
      ) : null}

      {usesDraftExit ? (
        <ExitDraftDialog
          busy={exitBusy}
          canDelete
          error={exitError}
          onContinue={handleContinueEditing}
          onDelete={() => {
            void handleDeleteDraft();
          }}
          onKeep={() => {
            void handleKeepDraft();
          }}
          visible={confirmOpen}
        />
      ) : (
        <DiscardDraftDialog
          mode="edit"
          onContinue={() => setConfirmOpen(false)}
          onDiscard={handleDiscard}
          visible={confirmOpen}
        />
      )}

      <ComposerMediaPreview
        item={state.media.find((item) => item.localId === previewId) ?? null}
        onClose={() => setPreviewId(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  autosaveRow: {
    alignItems: "flex-start",
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[6],
  },
  centered: {
    alignItems: "center",
    flex: 1,
    gap: spacing[16],
    justifyContent: "center",
    paddingHorizontal: spacing[24],
  },
  content: {
    paddingBottom: spacing[24],
  },
  flex: {
    flex: 1,
  },
  messageActions: {
    alignSelf: "stretch",
    gap: spacing[12],
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
});
