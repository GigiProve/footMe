/**
 * Modifica lista (DAS-REV-27 §14 — screen 08, 09).
 *
 * Separata da Gestisci accesso (§14: «nessuna duplicazione della checklist
 * persone»). Nome, descrizione e ambito, con i limiti centrali della 26.
 * Lo sheet «Ambito della lista» è lo stesso del form di creazione:
 * Conferma aggiorna solo il draft (Q27-16), X/back scartano la scelta
 * temporanea.
 *
 * Prima del commit, se l'ambito cambia, l'anteprima del server dice chi
 * perderebbe l'accesso — per nome all'owner, in forma generica a un gestore
 * che non legge le ACL (Q27-19) — e se l'owner resterebbe valido: se no,
 * Salva è bloccato (Q27-17). L'anteprima non sostituisce la rivalidazione:
 * il comando ricontrolla tutto al commit e riconcilia gli accessi nello
 * stesso commit (§14).
 *
 * Salva modifiche invia soltanto i campi cambiati e la versione osservata.
 *
 * Il chiamante lo monta solo quando è aperto: ogni apertura riparte dai
 * valori confermati della lista, senza un effetto di reset.
 */
import { useState } from "react";
import { Modal, Pressable, SafeAreaView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { KeyboardAwareForm } from "../../../../components/ui/keyboard-aware-form";
import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Button, ConfirmModal, Input, useToast } from "../../../../ui";
import { useDashboardConnection } from "../../state/use-dashboard-connection";
import { SCOPE_SOCIETY, ShortlistScopeSheet, scopeValue } from "../components/ShortlistScopeSheet";
import {
  PROFILE_SHORTLIST_COPY,
  createErrorFields,
  validateListForm,
  type ListFormErrors,
} from "../profile/profile-shortlist-presentation";
import { fetchCustomScopeOptions } from "../profile/profile-shortlist-service";
import type { CustomScopeOption } from "../profile/profile-shortlist-types";
import { useIntentKeys } from "../profile/use-intent-key";
import { SHORTLIST_CROSS_PREFIXES, SHORTLIST_QK, SHORTLIST_QK_PREFIXES } from "../shortlist-keys";
import { ShortlistError } from "../shortlist-types";
import {
  CUSTOM_COPY,
  editDirty,
  editPatch,
  governanceErrorCopy,
  isRevocation,
  scopeImpactLine,
} from "./custom-shortlist-presentation";
import { previewCustomShortlistScope, updateCustomShortlist } from "./custom-shortlist-service";
import type { CustomShortlistDetail, ListUpdateOutcome } from "./custom-shortlist-types";

type Props = {
  actorId: string;
  detail: CustomShortlistDetail;
  onClose: () => void;
  onRevoked: () => void;
  onSaved: (outcome: ListUpdateOutcome) => void;
  visible: boolean;
};

const NO_ERRORS: ListFormErrors = { description: null, name: null, scope: null };
const NO_OPTIONS: CustomScopeOption[] = [];

export function EditListModal({ actorId, detail, onClose, onRevoked, onSaved, visible }: Props) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { connection } = useDashboardConnection();
  const keys = useIntentKeys(`shortlist-edit:${detail.shortlistId}`);

  const original = {
    description: detail.description ?? "",
    name: detail.name,
    teamId: detail.teamId,
  };
  const [name, setName] = useState(original.name);
  const [description, setDescription] = useState(original.description);
  const [teamId, setTeamId] = useState<string | null>(original.teamId);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [errors, setErrors] = useState<ListFormErrors>(NO_ERRORS);
  const [banner, setBanner] = useState<string | null>(null);

  const optionsQuery = useQuery({
    enabled: visible && !!actorId,
    queryFn: () => fetchCustomScopeOptions(detail.clubId, false),
    queryKey: SHORTLIST_QK.scopeOptions(actorId, detail.clubId, false),
  });
  const options = optionsQuery.data ?? NO_OPTIONS;

  const scopeChanged = teamId !== original.teamId;
  const previewQuery = useQuery({
    enabled: visible && scopeChanged,
    queryFn: () => previewCustomShortlistScope(detail.shortlistId, teamId),
    queryKey: SHORTLIST_QK.scopePreview(actorId, detail.shortlistId, teamId),
    staleTime: 0,
  });
  const preview = scopeChanged ? previewQuery.data ?? null : null;
  const impact = scopeImpactLine(preview);
  const ownerBlocked = !!preview && !preview.ownerValid;

  const draft = { description, name, teamId };
  const dirty = editDirty(original, draft);
  const liveErrors = validateListForm({ description, name, scopeChosen: true });
  const shownErrors: ListFormErrors = {
    description: errors.description ?? liveErrors.description,
    name: errors.name ?? liveErrors.name,
    scope: errors.scope,
  };
  const scopeLabel = scopeChanged
    ? options.find((o) => o.teamId === teamId)?.label ?? ""
    : detail.scopeLabel;
  const patch = editPatch(original, draft);
  const signature = JSON.stringify([patch, detail.version]);

  const mutation = useMutation({
    mutationFn: () =>
      updateCustomShortlist({
        expectedVersion: detail.version,
        idempotencyKey: keys.key(signature),
        patch,
        shortlistId: detail.shortlistId,
      }),
    onError: (err) => {
      const kind = err instanceof ShortlistError ? err.kind : "network";

      if (kind !== "network") {
        keys.settle(signature);
      }

      if (isRevocation(kind)) {
        onRevoked();
        return;
      }

      const fields = createErrorFields(kind);

      if (fields.name || fields.description) {
        setErrors({ description: fields.description ?? null, name: fields.name ?? null, scope: null });
        return;
      }

      if (kind === "scopeInvalid" || kind === "ownerScopeInvalid") {
        void optionsQuery.refetch();
        void previewQuery.refetch();
      }

      setBanner(governanceErrorCopy(kind, "edit", connection === "offline"));
    },
    onSuccess: (outcome) => {
      keys.settle(signature);

      for (const prefix of [...SHORTLIST_QK_PREFIXES, ...SHORTLIST_CROSS_PREFIXES]) {
        void queryClient.invalidateQueries({ queryKey: [prefix] });
      }

      showToast({ id: "shortlist-list-updated", message: CUSTOM_COPY.changesSaved });
      onSaved(outcome);
    },
  });

  const submittable =
    dirty &&
    !liveErrors.name &&
    !liveErrors.description &&
    !ownerBlocked &&
    !(scopeChanged && previewQuery.isLoading) &&
    !mutation.isPending;

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

  return (
    <Modal animationType="slide" onRequestClose={requestClose} visible={visible}>
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={requestClose}
            style={styles.headerAction}
            testID="edit-list-cancel"
          >
            <AppText color="accent" variant="actionLabel">
              {CUSTOM_COPY.cancel}
            </AppText>
          </Pressable>
          <AppText accessibilityRole="header" color="neutral" variant="titleMd">
            {CUSTOM_COPY.editTitle}
          </AppText>
          <View style={styles.headerAction} />
        </View>

        <KeyboardAwareForm contentContainerStyle={styles.body}>
          {banner ? (
            <AppText accessibilityLiveRegion="polite" color="danger" testID="edit-list-error" variant="bodySm">
              {banner}
            </AppText>
          ) : null}

          <Input
            error={!!shownErrors.name}
            helperText={shownErrors.name ?? undefined}
            label={PROFILE_SHORTLIST_COPY.formName}
            onChangeText={(value) => {
              setName(value);
              setErrors((prev) => ({ ...prev, name: null }));
              setBanner(null);
            }}
            testID="edit-list-name"
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
              setBanner(null);
            }}
            placeholder={PROFILE_SHORTLIST_COPY.formDescriptionPlaceholder}
            testID="edit-list-description"
            value={description}
          />

          <View style={styles.group}>
            <AppText color="neutral" variant="metaStrong">
              {PROFILE_SHORTLIST_COPY.formScope}
            </AppText>
            <Pressable
              accessibilityLabel={`${PROFILE_SHORTLIST_COPY.formScope}: ${scopeLabel}`}
              accessibilityRole="button"
              disabled={options.length === 0}
              onPress={() => setScopeOpen(true)}
              style={styles.selectRow}
              testID="edit-list-scope"
            >
              <AppText color="neutral" style={styles.flex} variant="bodyLg">
                {scopeLabel}
              </AppText>
              <Ionicons color={colors.textNeutralSoft} name="chevron-forward" size={18} />
            </Pressable>

            {impact ? (
              <View accessibilityLiveRegion="polite" style={styles.impact} testID="edit-list-impact">
                <Ionicons
                  color={ownerBlocked ? colors.danger : colors.textNeutralMuted}
                  name="information-circle-outline"
                  size={16}
                />
                <AppText color={ownerBlocked ? "danger" : "neutralMuted"} style={styles.flex} variant="meta">
                  {impact}
                </AppText>
              </View>
            ) : null}
          </View>
        </KeyboardAwareForm>

        <View style={styles.footer}>
          <Button
            disabled={!submittable}
            fullWidth
            label={CUSTOM_COPY.saveChanges}
            loading={mutation.isPending}
            onPress={() => {
              setBanner(null);
              mutation.mutate();
            }}
            size="lg"
            testID="edit-list-save"
            variant="primary"
          />
        </View>

        <ShortlistScopeSheet
          onClose={() => setScopeOpen(false)}
          onConfirm={(value) => {
            setTeamId(value === SCOPE_SOCIETY ? null : value);
            setScopeOpen(false);
            setBanner(null);
          }}
          options={options}
          value={teamId === null ? SCOPE_SOCIETY : scopeValue({ label: "", teamId })}
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
  body: {
    gap: spacing[20],
    padding: spacing[20],
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
  flex: {
    flex: 1,
  },
  impact: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[6],
  },
  footer: {
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[12],
  },
});
