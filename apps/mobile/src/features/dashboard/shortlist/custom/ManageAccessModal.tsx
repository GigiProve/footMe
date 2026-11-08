/**
 * Gestisci accesso (DAS-REV-27 §13 — screen 06, 16).
 *
 * Schermata focalizzata, senza bottom navigation (§4): nome e ambito della
 * lista, Proprietario come riga distinta e non rimovibile, poi gli stessi
 * campi «Accesso alla lista» del form di creazione. Owner-only: il read
 * model lo nega a chiunque altro, e la voce di menu compare solo con
 * `canManageAccess` (§8, CUS-14).
 *
 * Le modifiche restano draft fino a Salva accesso (§13, Q27-08): niente
 * optimistic update dei permessi. Un errore non chiude e non svuota il
 * draft (screen 16); un conflitto di versione non rilancia il vecchio set
 * (Q27-13) ma chiede di ricaricare; un destinatario non più eleggibile
 * rilegge l'elenco, conserva le scelte ancora valide e chiede un nuovo
 * Salva (Q27-09). Un «non disponibile» è una revoca: il modale si chiude e
 * il chiamante rimuove i dati (§18).
 */
import { useEffect, useState } from "react";
import { Modal, Pressable, SafeAreaView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { KeyboardAwareForm } from "../../../../components/ui/keyboard-aware-form";
import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Avatar, Button, ConfirmModal, Skeleton, useToast } from "../../../../ui";
import { useDashboardConnection } from "../../state/use-dashboard-connection";
import { PROFILE_SHORTLIST_COPY } from "../profile/profile-shortlist-presentation";
import { useIntentKeys } from "../profile/use-intent-key";
import { SHORTLIST_CROSS_PREFIXES, SHORTLIST_QK, SHORTLIST_QK_PREFIXES } from "../shortlist-keys";
import { ShortlistError } from "../shortlist-types";
import { ShortlistAccessFields } from "./components/ShortlistAccessFields";
import { ShortlistPersonRow } from "./components/ShortlistPersonRow";
import {
  CUSTOM_COPY,
  accessDirty,
  accessSubmittable,
  governanceErrorCopy,
  initialChoice,
  isRevocation,
  reconcileSelection,
  validateAccessDraft,
} from "./custom-shortlist-presentation";
import {
  fetchAllShareCandidateIds,
  fetchCustomShortlistAccess,
  updateCustomShortlistAccess,
} from "./custom-shortlist-service";
import type { AccessChoice, AccessUpdateOutcome } from "./custom-shortlist-types";

type Props = {
  actorId: string;
  clubId: string;
  onClose: () => void;
  onRevoked: () => void;
  onSaved: (outcome: AccessUpdateOutcome) => void;
  shortlistId: string;
  society: { logoUrl: string | null; name: string };
  visible: boolean;
};

export function ManageAccessModal({
  actorId,
  clubId,
  onClose,
  onRevoked,
  onSaved,
  shortlistId,
  society,
  visible,
}: Props) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { connection } = useDashboardConnection();
  const keys = useIntentKeys(`shortlist-access:${shortlistId}`);

  const [initialized, setInitialized] = useState(false);
  const [choice, setChoice] = useState<AccessChoice | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);

  const accessQuery = useQuery({
    enabled: visible && !!actorId,
    queryFn: () => fetchCustomShortlistAccess(shortlistId),
    queryKey: SHORTLIST_QK.customAccess(actorId, shortlistId),
    retry: (count, err) => !(err instanceof ShortlistError && err.kind !== "network") && count < 1,
    staleTime: 0,
  });

  const access = accessQuery.data ?? null;

  /* Draft inizializzato una volta per apertura dal read model confermato.
     Il chiamante monta il modale solo quando è aperto, quindi ogni apertura
     riparte da qui; l'aggiustamento avviene in render, non in un effetto. */
  if (access && !initialized) {
    setChoice(initialChoice(access.accessMode));
    setSelected(access.shared.map((p) => p.profileId));
    setInitialized(true);
  }

  useEffect(() => {
    if (accessQuery.error instanceof ShortlistError && isRevocation(accessQuery.error.kind)) {
      onRevoked();
    }
  }, [accessQuery.error, onRevoked]);

  const initial = {
    choice: access ? initialChoice(access.accessMode) : null,
    selected: access?.shared.map((p) => p.profileId) ?? [],
  };
  const draft = { choice, selected };
  const dirty = initialized && accessDirty(initial, draft);
  const inlineError = touched ? validateAccessDraft(draft) : null;
  const signature = JSON.stringify([choice, [...selected].sort(), access?.version ?? 0]);

  const mutation = useMutation({
    mutationFn: () =>
      updateCustomShortlistAccess({
        expectedVersion: access?.version ?? 0,
        idempotencyKey: keys.key(signature),
        mode: choice ?? "owner_only",
        profileIds: selected,
        shortlistId,
      }),
    onError: async (err) => {
      const kind = err instanceof ShortlistError ? err.kind : "network";

      if (kind !== "network") {
        keys.settle(signature);
      }

      if (isRevocation(kind)) {
        onRevoked();
        return;
      }

      if (kind === "shareIneligible") {
        /* Q27-09: elenco riletto, scelte ancora valide conservate, nuovo
           Salva esplicito. Mai un sottoinsieme salvato al posto dell'utente. */
        try {
          const eligible = await fetchAllShareCandidateIds({ clubId, shortlistId, teamId: access?.teamId ?? null });
          setSelected((prev) => reconcileSelection(prev, eligible));
        } catch {
          /* Rilettura fallita: le scelte restano come sono (§11). */
        }
        void queryClient.invalidateQueries({ queryKey: ["society-shortlist-share-candidates"] });
      }

      setConflict(kind === "versionConflict");
      setError(governanceErrorCopy(kind, "access", connection === "offline"));
    },
    onSuccess: (outcome) => {
      keys.settle(signature);

      for (const prefix of [...SHORTLIST_QK_PREFIXES, ...SHORTLIST_CROSS_PREFIXES]) {
        void queryClient.invalidateQueries({ queryKey: [prefix] });
      }

      showToast({ id: "shortlist-access-updated", message: CUSTOM_COPY.accessUpdated });
      onSaved(outcome);
    },
  });

  const requestClose = () => {
    if (mutation.isPending) {
      return;
    }

    if (dirty) {
      setExitOpen(true);
      return;
    }

    onClose();
  };

  const submit = () => {
    setTouched(true);
    setError(null);
    setConflict(false);

    if (!accessSubmittable(draft)) {
      return;
    }

    mutation.mutate();
  };

  /* §22: dopo un conflitto il ricaricamento è esplicito e riparte dallo
     stato confermato più recente; il vecchio set non viene rilanciato. */
  const reload = async () => {
    setTouched(false);
    setError(null);
    setConflict(false);
    const result = await accessQuery.refetch();

    if (result.data) {
      setChoice(initialChoice(result.data.accessMode));
      setSelected(result.data.shared.map((p) => p.profileId));
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={requestClose} visible={visible}>
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Indietro"
            accessibilityRole="button"
            hitSlop={8}
            onPress={requestClose}
            style={styles.headerAction}
            testID="manage-access-back"
          >
            <Ionicons color={colors.textNeutral} name="chevron-back" size={24} />
          </Pressable>
          <AppText accessibilityRole="header" color="neutral" variant="titleMd">
            {CUSTOM_COPY.accessTitle}
          </AppText>
          <View style={styles.headerAction} />
        </View>

        {!access ? (
          <View style={styles.body}>
            {accessQuery.isError ? (
              <View style={styles.loadError}>
                <AppText color="neutral" variant="bodySm">
                  {CUSTOM_COPY.peopleLoadError}
                </AppText>
                <Button label="Riprova" onPress={() => void accessQuery.refetch()} size="sm" variant="secondary" />
              </View>
            ) : (
              <>
                <Skeleton.Row />
                <Skeleton.Row />
                <Skeleton.Row />
              </>
            )}
          </View>
        ) : (
          <>
            <KeyboardAwareForm contentContainerStyle={styles.body}>
              <View style={styles.listRow}>
                <Avatar name={society.name} size="sm" square tone="ink" uri={society.logoUrl ?? undefined} />
                <View style={styles.flex}>
                  <AppText color="neutral" numberOfLines={2} style={styles.strong} variant="bodyLg">
                    {access.name}
                  </AppText>
                  <AppText color="neutralMuted" variant="meta">
                    {access.scopeLabel}
                  </AppText>
                </View>
              </View>

              {access.owner ? (
                <View style={styles.group}>
                  <AppText color="neutral" variant="metaStrong">
                    {CUSTOM_COPY.owner}
                  </AppText>
                  <ShortlistPersonRow control="none" person={access.owner} testID="manage-access-owner" />
                </View>
              ) : null}

              <ShortlistAccessFields
                actorId={actorId}
                choice={choice}
                clubId={clubId}
                disabled={mutation.isPending}
                error={inlineError ?? error}
                legacyNote={access.accessMode === "scope" ? CUSTOM_COPY.legacyAccess : null}
                onChoice={(next) => {
                  setChoice(next);
                  setError(null);
                }}
                onSelected={(ids) => {
                  setSelected(ids);
                  setError(null);
                }}
                selected={selected}
                shortlistId={shortlistId}
                teamId={access.teamId}
              />

              {conflict ? (
                <Button
                  label={CUSTOM_COPY.reload}
                  onPress={() => void reload()}
                  size="sm"
                  testID="manage-access-reload"
                  variant="secondary"
                />
              ) : null}
            </KeyboardAwareForm>

            <View style={styles.footer}>
              <Button
                disabled={choice === null || mutation.isPending}
                fullWidth
                label={CUSTOM_COPY.saveAccess}
                loading={mutation.isPending}
                onPress={submit}
                size="lg"
                testID="manage-access-save"
                variant="primary"
              />
            </View>
          </>
        )}

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
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: sizes.touchTarget + spacing[8],
    paddingHorizontal: spacing[12],
  },
  headerAction: {
    alignItems: "flex-start",
    justifyContent: "center",
    minHeight: sizes.touchTarget,
    minWidth: sizes.touchTarget,
  },
  body: {
    gap: spacing[20],
    padding: spacing[20],
  },
  listRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  flex: {
    flex: 1,
    gap: spacing[4],
  },
  strong: {
    fontWeight: "600",
  },
  group: {
    gap: spacing[4],
  },
  loadError: {
    alignItems: "flex-start",
    gap: spacing[8],
  },
  footer: {
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[12],
  },
});
