import { useEffect, useState } from "react";
import { Image, Modal, Pressable, SafeAreaView, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { KeyboardAwareForm } from "../../../components/ui/keyboard-aware-form";
import { AppText, Button, ConfirmModal, Divider, Input, ModalHeader, useToast } from "../../../ui";
import { colors, sizes, spacing } from "../../../theme/tokens";
import { useSession } from "../../auth/use-session";
import {
  SCOPE_UNSET,
  ShortlistScopeSheet,
  scopeValue,
} from "../../dashboard/shortlist/components/ShortlistScopeSheet";
import {
  SHORTLIST_CROSS_PREFIXES,
  SHORTLIST_QK,
  SHORTLIST_QK_PREFIXES,
} from "../../dashboard/shortlist/shortlist-keys";
import {
  LIST_DESCRIPTION_MAX_LENGTH,
  LIST_NAME_MAX_LENGTH,
  PROFILE_SHORTLIST_COPY,
  createErrorFields,
  formIntentLine,
  isDefinitiveFailure,
  listFormSubmittable,
  validateListForm,
  type ListFormErrors,
} from "../../dashboard/shortlist/profile/profile-shortlist-presentation";
import {
  createCustomShortlist,
  fetchCustomScopeOptions,
} from "../../dashboard/shortlist/profile/profile-shortlist-service";
import type {
  CustomCreateOutcome,
  CustomScopeOption,
} from "../../dashboard/shortlist/profile/profile-shortlist-types";
import { useIntentKeys } from "../../dashboard/shortlist/profile/use-intent-key";
import { ShortlistError } from "../../dashboard/shortlist/shortlist-types";

/**
 * Form CUSTOM canonico (DAS-REV-24 §25, DAS-REV-26 §16-§19 — screen 07, 15).
 *
 * Un solo form per due ingressi: il centro Shortlist e il profilo. §16 —
 * «Riutilizza il form CUSTOM canonico con una modalità di ingresso dal
 * profilo.» La modalità profilo aggiunge l'intento iniziale («Aggiungerai
 * {Nome} alla nuova lista.»), la Società operativa e la CTA «Crea e
 * aggiungi»; tutto il resto — campi, limiti, ambito, accesso, servizio — è
 * lo stesso.
 *
 * Tre cose cambiano rispetto al form della 24, tutte richieste dalla 26:
 *
 *   · il comando è `create_custom_shortlist`, non un insert diretto: crea la
 *     lista e, dal profilo, la membership iniziale nella **stessa
 *     transazione** (§19), con una chiave idempotente per intento;
 *   · l'accesso non è più «Solo utenti autorizzati»: ogni nuova CUSTOM nasce
 *     **Solo io** sul server (§18), e il form lo dice come informazione non
 *     interattiva — niente toggle fittizio finché la condivisione della 27
 *     non esiste;
 *   · l'ambito è una scelta singola fra le sole opzioni autorizzate dal
 *     server (§17), e non ha più Intera società come default: «Non usare
 *     Intera società come fallback quando lo scope manca.»
 *
 * Nessun record server all'apertura: §16 — «Nessun record server vuoto viene
 * creato all'apertura del form. Una lettura degli ambiti non salva il draft
 * o la lista.»
 */

type ProfileTarget = {
  fullName: string;
  personId: string;
};

type SocietyLine = {
  logoUrl: string | null;
  name: string;
};

type CreateListModalProps = {
  clubId: string;
  /** Storico: l'owner lo deriva il server (§18). Accettato e ignorato. */
  createdByProfileId?: string;
  onClose: () => void;
  onCreated?: (listId: string) => void;
  onDismiss?: () => void;
  /** Ingresso dal profilo (§16): la persona da inserire nella nuova lista. */
  profileTarget?: ProfileTarget;
  /** Ingresso dal profilo: esito della creazione con inserimento (§19). */
  onProfileOutcome?: (outcome: CustomCreateOutcome) => void;
  society?: SocietyLine;
  successMode?: "panel" | "skip";
  visible: boolean;
};

const NO_ERRORS: ListFormErrors = { description: null, name: null, scope: null };
/* Costante di modulo: un `[]` nuovo a ogni render farebbe ripartire
   l'effetto di precompilazione dell'ambito a ogni render. */
const NO_OPTIONS: CustomScopeOption[] = [];

function initialScope(options: CustomScopeOption[]): string {
  /* §17: «Un'eventuale sola opzione valida può essere precompilata;
     altrimenti … chiedi la scelta.» */
  return options.length === 1 ? scopeValue(options[0]) : SCOPE_UNSET;
}

export function CreateListModal({
  clubId,
  onClose,
  onCreated,
  onDismiss,
  onProfileOutcome,
  profileTarget,
  society,
  successMode = "panel",
  visible,
}: CreateListModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const withProfile = !!profileTarget;
  const keys = useIntentKeys(`shortlist-create:${clubId}`);

  const [step, setStep] = useState<"form" | "success">("form");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<string>(SCOPE_UNSET);
  const [scopeTouched, setScopeTouched] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [errors, setErrors] = useState<ListFormErrors>(NO_ERRORS);
  const [banner, setBanner] = useState<string | null>(null);
  const [created, setCreated] = useState<CustomCreateOutcome | null>(null);

  const optionsQuery = useQuery({
    enabled: visible && !!clubId && !!actorId,
    queryFn: () => fetchCustomScopeOptions(clubId, withProfile),
    queryKey: SHORTLIST_QK.scopeOptions(actorId, clubId, withProfile),
  });

  const options = optionsQuery.data ?? NO_OPTIONS;

  useEffect(() => {
    if (!visible) {
      setStep("form");
      setName("");
      setDescription("");
      setScope(SCOPE_UNSET);
      setScopeTouched(false);
      setScopeOpen(false);
      setExitOpen(false);
      setErrors(NO_ERRORS);
      setBanner(null);
      setCreated(null);
    }
  }, [visible]);

  /* La precompilazione dell'unica opzione vale finché l'utente non ha
     scelto: una rilettura delle opzioni non sovrascrive una scelta fatta. */
  useEffect(() => {
    if (visible && !scopeTouched) {
      setScope(initialScope(options));
    }
  }, [options, scopeTouched, visible]);

  const selectedOption = options.find((option) => scopeValue(option) === scope) ?? null;
  const scopeChosen = !!selectedOption;
  const liveErrors = validateListForm({ description, name, scopeChosen });
  const shownErrors: ListFormErrors = {
    description: errors.description ?? liveErrors.description,
    name: errors.name ?? liveErrors.name,
    scope: errors.scope,
  };
  const dirty =
    name.trim().length > 0 || description.trim().length > 0 || scopeTouched;

  const signature = JSON.stringify([
    name.trim(),
    description.trim(),
    selectedOption?.teamId ?? null,
    profileTarget?.personId ?? null,
  ]);

  const reconcile = () => {
    for (const prefix of [...SHORTLIST_QK_PREFIXES, ...SHORTLIST_CROSS_PREFIXES]) {
      void queryClient.invalidateQueries({ queryKey: [prefix] });
    }
    void queryClient.invalidateQueries({ queryKey: ["shortlist-overview", clubId] });
  };

  const mutation = useMutation({
    mutationFn: () =>
      createCustomShortlist({
        clubId,
        description: description.trim(),
        idempotencyKey: keys.key(signature),
        name: name.trim(),
        personId: profileTarget?.personId ?? null,
        teamId: selectedOption?.teamId ?? null,
      }),
    onError: (error) => {
      const kind = error instanceof ShortlistError ? error.kind : "network";

      /* §19: «Un timeout non dimostra che la lista non esista.» Dopo un
         errore di rete la chiave resta: il prossimo tap è la verifica della
         stessa operazione, e il server restituisce la stessa lista. */
      if (isDefinitiveFailure(kind)) {
        keys.settle(signature);
      }

      const fields = createErrorFields(kind);

      if (fields.scope) {
        /* §17: «Se l'accesso cambia prima del commit, ricarica le opzioni e
           richiedi una scelta ancora valida senza allargare
           automaticamente lo scope.» */
        setScopeTouched(false);
        void optionsQuery.refetch();
      }

      setErrors({
        description: fields.description ?? null,
        name: fields.name ?? null,
        scope: fields.scope ?? null,
      });
      setBanner(fields.banner ?? null);
    },
    onSuccess: (outcome) => {
      keys.settle(signature);
      reconcile();

      if (withProfile) {
        onProfileOutcome?.(outcome);
        return;
      }

      if (successMode === "skip") {
        if (onCreated) {
          onCreated(outcome.shortlistId);
        } else {
          /* Il centro passa solo `onClose`: senza questa chiusura il form
             resterebbe aperto sopra la lista appena creata. */
          showToast({ id: "shortlist-list-created", message: "Lista creata." });
          onClose();
        }
        return;
      }

      setCreated(outcome);
      setStep("success");
    },
  });

  const submittable =
    listFormSubmittable({ description, name, scopeChosen }) && !mutation.isPending;

  const requestClose = () => {
    if (mutation.isPending) {
      return;
    }

    /* §16: «Annulla/back con modifiche non salvate segue la conferma
       comune.» Senza modifiche si torna subito indietro. */
    if (step === "form" && dirty) {
      setExitOpen(true);
      return;
    }

    onClose();
  };

  const submit = () => {
    setErrors(NO_ERRORS);
    setBanner(null);
    mutation.mutate();
  };

  const submitLabel = withProfile
    ? PROFILE_SHORTLIST_COPY.formSubmitWithProfile
    : PROFILE_SHORTLIST_COPY.formSubmitCenter;

  return (
    <Modal
      animationType="slide"
      onDismiss={onDismiss}
      onRequestClose={requestClose}
      visible={visible}
    >
      <SafeAreaView style={styles.root}>
        {step === "form" ? (
          <>
            {withProfile ? (
              /* Screen 07: «Header Annulla | Nuova lista.» Nessuna bottom
                 navigation nel form focalizzato (§4). */
              <View style={styles.header}>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={requestClose}
                  style={styles.headerAction}
                  testID="create-list-cancel"
                >
                  <AppText color="accent" variant="actionLabel">
                    {PROFILE_SHORTLIST_COPY.formCancel}
                  </AppText>
                </Pressable>
                <AppText accessibilityRole="header" color="neutral" variant="titleMd">
                  {PROFILE_SHORTLIST_COPY.formTitle}
                </AppText>
                <View style={styles.headerAction} />
              </View>
            ) : (
              <ModalHeader onClose={requestClose} title="Crea lista" />
            )}

            <KeyboardAwareForm contentContainerStyle={styles.scrollContent}>
              {withProfile && society ? (
                <View style={styles.society}>
                  {society.logoUrl ? (
                    <Image source={{ uri: society.logoUrl }} style={styles.logo} />
                  ) : (
                    <Ionicons color={colors.textNeutralMuted} name="shield-outline" size={20} />
                  )}
                  <View style={styles.societyText}>
                    <AppText color="neutral" variant="bodyLg">
                      {society.name}
                    </AppText>
                    <AppText color="neutralMuted" variant="meta">
                      {formIntentLine(profileTarget.fullName)}
                    </AppText>
                  </View>
                </View>
              ) : null}

              {banner ? (
                <AppText accessibilityLiveRegion="polite" color="danger" variant="bodySm">
                  {banner}
                </AppText>
              ) : null}

              <Input
                accessibilityHint={shownErrors.name ?? undefined}
                error={!!shownErrors.name}
                helperText={shownErrors.name ?? undefined}
                label={PROFILE_SHORTLIST_COPY.formName}
                onChangeText={(value) => {
                  setName(value);
                  setErrors((prev) => ({ ...prev, name: null }));
                }}
                placeholder="Es. Osservati settembre"
                testID="create-list-name"
                value={name}
              />
              <Input
                error={!!shownErrors.description}
                helperText={shownErrors.description ?? undefined}
                label={PROFILE_SHORTLIST_COPY.formDescription}
                multiline
                onChangeText={(value) => {
                  setDescription(value);
                  setErrors((prev) => ({ ...prev, description: null }));
                }}
                placeholder={PROFILE_SHORTLIST_COPY.formDescriptionPlaceholder}
                testID="create-list-description"
                value={description}
              />

              <View style={styles.group}>
                <AppText color="neutral" variant="metaStrong">
                  {PROFILE_SHORTLIST_COPY.formScope}
                </AppText>
                <Pressable
                  accessibilityHint={shownErrors.scope ?? undefined}
                  accessibilityLabel={`${PROFILE_SHORTLIST_COPY.formScope}: ${
                    selectedOption?.label ?? PROFILE_SHORTLIST_COPY.formScopePlaceholder
                  }`}
                  accessibilityRole="button"
                  disabled={options.length === 0}
                  onPress={() => setScopeOpen(true)}
                  style={[styles.selectRow, shownErrors.scope ? styles.selectRowError : null]}
                  testID="create-list-scope"
                >
                  <AppText
                    color={selectedOption ? "neutral" : "neutralMuted"}
                    style={styles.selectValue}
                    variant="bodyLg"
                  >
                    {selectedOption?.label ?? PROFILE_SHORTLIST_COPY.formScopePlaceholder}
                  </AppText>
                  <Ionicons color={colors.textNeutralSoft} name="chevron-forward" size={18} />
                </Pressable>
                {shownErrors.scope ? (
                  <AppText color="danger" variant="meta">
                    {shownErrors.scope}
                  </AppText>
                ) : null}
              </View>

              {/* §18: informazione non interattiva — niente chevron né toggle
                  finché la condivisione selettiva (27) non esiste. */}
              <View style={styles.group}>
                <AppText color="neutral" variant="metaStrong">
                  {PROFILE_SHORTLIST_COPY.formAccess}
                </AppText>
                <View accessible style={styles.accessRow}>
                  <Ionicons color={colors.textNeutral} name="lock-closed-outline" size={18} />
                  <View style={styles.societyText}>
                    <AppText color="neutral" variant="bodyLg">
                      {PROFILE_SHORTLIST_COPY.formAccessValue}
                    </AppText>
                    <AppText color="neutralMuted" variant="meta">
                      {PROFILE_SHORTLIST_COPY.formAccessHelper}
                    </AppText>
                  </View>
                </View>
              </View>

              <AppText color="neutralSoft" variant="meta">
                {`Nome fino a ${LIST_NAME_MAX_LENGTH} caratteri, descrizione fino a ${LIST_DESCRIPTION_MAX_LENGTH}.`}
              </AppText>
            </KeyboardAwareForm>

            <View style={styles.footer}>
              <Button
                disabled={!submittable}
                fullWidth
                label={submitLabel}
                loading={mutation.isPending}
                onPress={submit}
                size="lg"
                testID="create-list-submit"
                variant="primary"
              />
            </View>

            <ShortlistScopeSheet
              onClose={() => setScopeOpen(false)}
              onConfirm={(value) => {
                setScope(value);
                setScopeTouched(true);
                setScopeOpen(false);
                setErrors((prev) => ({ ...prev, scope: null }));
              }}
              options={options}
              value={scope}
              visible={scopeOpen}
            />

            <ConfirmModal
              cancelLabel={PROFILE_SHORTLIST_COPY.exitStay}
              confirmLabel={PROFILE_SHORTLIST_COPY.exitLeave}
              message={PROFILE_SHORTLIST_COPY.exitBody}
              onCancel={() => setExitOpen(false)}
              onConfirm={() => {
                setExitOpen(false);
                onClose();
              }}
              title={PROFILE_SHORTLIST_COPY.exitTitle}
              visible={exitOpen}
            />
          </>
        ) : (
          <>
            <ModalHeader onClose={onClose} title="Lista creata" />
            <View style={styles.successContent}>
              <Ionicons color={colors.textNeutral} name="checkmark-circle-outline" size={64} />
              <AppText align="center" color="neutral" variant="headingSm">
                Lista creata
              </AppText>
              <AppText align="center" color="neutral" variant="titleMd">
                {created?.name ?? name.trim()}
              </AppText>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <AppText color="neutralMuted" variant="bodySm">
                    {PROFILE_SHORTLIST_COPY.formScope}
                  </AppText>
                  <AppText color="neutral" variant="bodySm">
                    {created?.scopeLabel ?? selectedOption?.label ?? ""}
                  </AppText>
                </View>
                <Divider spacing={8} />
                <View style={styles.summaryRow}>
                  <AppText color="neutralMuted" variant="bodySm">
                    {PROFILE_SHORTLIST_COPY.formAccess}
                  </AppText>
                  <View style={styles.lockRow}>
                    <Ionicons color={colors.textNeutralMuted} name="lock-closed-outline" size={14} />
                    <AppText color="neutral" variant="bodySm">
                      {PROFILE_SHORTLIST_COPY.formAccessValue}
                    </AppText>
                  </View>
                </View>
              </View>
              <Button
                fullWidth
                label="Aggiungi profili"
                onPress={() => {
                  onClose();
                  if (created) {
                    router.push(`/shortlist/${created.shortlistId}` as never);
                  }
                }}
                variant="primary"
              />
              <Button fullWidth label="Torna a Shortlist" onPress={onClose} variant="link" />
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    alignItems: "center",
    borderBottomColor: colors.dividerNeutral,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: sizes.touchTarget + spacing[8],
    paddingHorizontal: spacing[16],
  },
  headerAction: {
    justifyContent: "center",
    minHeight: sizes.touchTarget,
    minWidth: 72,
  },
  scrollContent: {
    gap: spacing[20],
    padding: spacing[20],
  },
  society: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  societyText: {
    flex: 1,
    gap: spacing[4],
  },
  logo: {
    borderRadius: 6,
    height: 28,
    width: 28,
  },
  group: {
    gap: spacing[8],
  },
  selectRow: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: sizes.touchTarget + spacing[4],
    paddingHorizontal: spacing[14],
  },
  selectRowError: {
    borderColor: colors.danger,
  },
  selectValue: {
    flex: 1,
  },
  accessRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[12],
  },
  lockRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  successContent: {
    alignItems: "center",
    flex: 1,
    gap: spacing[16],
    paddingHorizontal: spacing[24],
    paddingTop: spacing[24],
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing[8],
    padding: spacing[16],
    width: "100%",
  },
  summaryRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

