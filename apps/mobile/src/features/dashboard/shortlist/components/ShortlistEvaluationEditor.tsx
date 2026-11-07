/**
 * Editor di valutazione (DAS-REV-25 §17, §18, §19, §20 — screen 06 e 07).
 *
 * «Usa un unico editor condiviso per apertura dalla scheda interna e dallo
 * sheet Application.» È un componente e non una route proprio per questo: il
 * ritorno dopo Salva è quello di §19 — «alla stessa scheda Profilo in
 * shortlist se l'editor è stato aperto da lì; alla stessa candidatura se
 * aperto dal suo sheet di azioni» — e con una modale sopra l'origine quel
 * ritorno è vero per costruzione, non per un parametro da ricordare.
 *
 * È anche il motivo per cui non è dentro lo Stack delle tab: §17 — «Nessuna
 * bottom navigation, step del wizard, pulsante Pubblica o schermata
 * celebrativa.»
 *
 * Tre stati separati, come §20 impone: lo stato del server (`entry`), il
 * draft dell'editor e la selezione temporanea del selector — quest'ultima
 * dentro `ShortlistStatusSheet`. «Un mount, una chiusura o un cambio del
 * selector non devono produrre salvataggi impliciti»: niente autosave, e
 * l'unica mutation è il tap su Salva modifiche (§19).
 *
 * Permessi parziali (§8): i campi leggibili si vedono anche quando non sono
 * scrivibili, e quelli non leggibili **non esistono** nel modulo — «Un campo
 * non leggibile non deve comparire vuoto come se fosse assente né essere
 * serializzato nel payload client.» La patch inviata contiene soltanto i
 * campi davvero cambiati e davvero autorizzati (§18).
 */
import { useEffect, useState } from "react";
import { Modal, Pressable, SafeAreaView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { KeyboardAwareForm } from "../../../../components/ui/keyboard-aware-form";
import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Avatar, Button, ConfirmModal, Input, Radio } from "../../../../ui";
import { formatRole } from "../../../profiles/profile-display-helpers";
import { getPlayerPositionLabel } from "../../../profiles/player-sports";
import {
  EVALUATION_LABELS,
  SHORTLIST_COPY,
  SHORTLIST_NOTE_MAX_LENGTH,
} from "../shortlist-presentation";
import type {
  ShortlistEntryDetail,
  ShortlistEvaluationPatch,
  ShortlistEvaluationStatus,
  ShortlistPriority,
} from "../shortlist-types";
import { ShortlistStatusSheet } from "./ShortlistStatusSheet";

/**
 * §17: «Priorità: selezione singola Nessuna, Alta, Media, Bassa. Nessuna
 * serializza null; non una stringa visualizzata.»
 */
const PRIORITIES: readonly (ShortlistPriority | null)[] = [
  null,
  "alta",
  "media",
  "bassa",
];

type Props = {
  busy: boolean;
  entry: ShortlistEntryDetail;
  error: string | null;
  onClose: () => void;
  onSave: (patch: ShortlistEvaluationPatch) => void;
  visible: boolean;
};

type Draft = {
  note: string;
  priority: ShortlistPriority | null;
  status: ShortlistEvaluationStatus;
};

function initialDraft(entry: ShortlistEntryDetail): Draft {
  return {
    note: entry.note ?? "",
    priority: entry.priority,
    status: entry.evaluationStatus,
  };
}

export function ShortlistEvaluationEditor({
  busy,
  entry,
  error,
  onClose,
  onSave,
  visible,
}: Props) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(entry));
  const [statusOpen, setStatusOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);

  /* Il draft riparte dal server-state a ogni apertura. §20: «Separa server
     state, draft editor e selezione temporanea dello sheet.» */
  useEffect(() => {
    if (visible) {
      setDraft(initialDraft(entry));
      setStatusOpen(false);
      setExitOpen(false);
    }
    /* `entry.revision` e non `entry`: una rilettura che non cambia nulla
       non deve buttare via quello che l'utente sta scrivendo (§26 — «Una
       modifica del profilo live o del solo metadata Application non deve
       resettare il draft della valutazione»). */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, entry.entryId, entry.revision]);

  const statusDirty = draft.status !== entry.evaluationStatus;
  const priorityDirty = draft.priority !== entry.priority;
  const noteDirty = entry.canEditNote && draft.note !== (entry.note ?? "");

  const evaluationDirty = entry.canEditStatus && (statusDirty || priorityDirty);
  const dirty = evaluationDirty || noteDirty;

  const noteTooLong = draft.note.length > SHORTLIST_NOTE_MAX_LENGTH;

  const requestClose = () => {
    /* §20: «Senza modifiche torna direttamente all'origine.» */
    if (!dirty) {
      onClose();

      return;
    }

    setExitOpen(true);
  };

  const submit = () => {
    /* §18: «Salva soltanto i campi modificati e autorizzati.» Un campo che
       l'actor non può scrivere non entra nel payload nemmeno con il suo
       valore attuale, e un campo invariato nemmeno. */
    const patch: ShortlistEvaluationPatch = {};

    if (entry.canEditStatus && statusDirty) {
      patch.evaluationStatus = draft.status;
    }

    if (entry.canEditStatus && priorityDirty) {
      patch.priority = draft.priority;
    }

    if (noteDirty) {
      /* §18: «Un testo vuoto normalizzato può essere null secondo il
         contratto canonico.» La normalizzazione vera la fa il server; qui
         si dichiara l'intenzione di cancellare. */
      patch.note = draft.note.trim().length > 0 ? draft.note : null;
    }

    onSave(patch);
  };

  const identity = [
    entry.role ? formatRole(entry.role) : null,
    entry.primaryPosition
      ? getPlayerPositionLabel(entry.primaryPosition, "")
      : null,
  ]
    .filter((part): part is string => !!part && part.length > 0)
    .join(" · ");

  const context = [entry.positionTitle, entry.scopeLabel]
    .filter((part): part is string => !!part && part.length > 0)
    .join(" · ");

  return (
    <Modal
      animationType="slide"
      onRequestClose={requestClose}
      visible={visible}
    >
      <SafeAreaView style={styles.root}>
        {/* §17: «Header Annulla / Modifica valutazione.» Non la X del
            ModalHeader condiviso: il PNG mostra un'azione testuale, ed è
            l'unica differenza rispetto a quel guscio. */}
        <View style={styles.header}>
          <Pressable
            accessibilityLabel={SHORTLIST_COPY.editorCancel}
            accessibilityRole="button"
            hitSlop={8}
            onPress={requestClose}
            style={({ pressed }) => [
              styles.cancel,
              pressed ? styles.pressed : null,
            ]}
            testID="shortlist-editor-cancel"
          >
            <AppText color="accent" variant="actionLabel">
              {SHORTLIST_COPY.editorCancel}
            </AppText>
          </Pressable>

          <AppText
            accessibilityRole="header"
            color="neutral"
            numberOfLines={1}
            style={styles.title}
            variant="headingSm"
          >
            {SHORTLIST_COPY.editorTitle}
          </AppText>

          <View style={styles.cancel} />
        </View>

        <KeyboardAwareForm contentContainerStyle={styles.content}>
          {/* §17: «identità della persona e contesto della Position». */}
          <View style={styles.identity}>
            <Avatar name={entry.name} size="md" uri={entry.avatarUrl ?? undefined} />

            <View style={styles.identityBody}>
              <AppText color="neutral" numberOfLines={1} variant="titleMd">
                {entry.name}
              </AppText>

              {identity ? (
                <AppText color="neutralMuted" numberOfLines={1} variant="meta">
                  {identity}
                </AppText>
              ) : null}

              {context ? (
                <AppText color="neutralMuted" numberOfLines={1} variant="meta">
                  {context}
                </AppText>
              ) : null}
            </View>
          </View>

          <View style={styles.group}>
            <AppText variant="eyebrow">{SHORTLIST_COPY.editorPriority}</AppText>

            <View accessibilityRole="radiogroup" style={styles.priorities}>
              {PRIORITIES.map((option) => (
                <View key={option ?? "none"} style={styles.priorityCell}>
                  <Radio
                    checked={draft.priority === option}
                    /* §8: «Nascondi azioni non autorizzate, non mostrarle
                       disabilitate» vale per le **azioni**. Un campo
                       leggibile ma non scrivibile resta visibile, e il
                       disabled qui dice esattamente quello. */
                    disabled={!entry.canEditStatus}
                    label={
                      option
                        ? EVALUATION_PRIORITY_LABELS[option]
                        : SHORTLIST_COPY.editorPriorityNone
                    }
                    onPress={() =>
                      setDraft((current) => ({ ...current, priority: option }))
                    }
                    testID={`shortlist-priority-${option ?? "none"}`}
                  />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.group}>
            <AppText variant="eyebrow">{SHORTLIST_COPY.editorStatus}</AppText>

            {/* §17: «La riga mostra il valore del draft; il tap apre lo
                sheet dello screen 07.» */}
            <Pressable
              accessibilityHint="Apre la scelta dello stato"
              accessibilityLabel={`${SHORTLIST_COPY.editorStatus}: ${EVALUATION_LABELS[draft.status]}`}
              accessibilityRole="button"
              disabled={!entry.canEditStatus}
              onPress={() => setStatusOpen(true)}
              style={({ pressed }) => [
                styles.statusField,
                !entry.canEditStatus ? styles.fieldDisabled : null,
                pressed ? styles.pressed : null,
              ]}
              testID="shortlist-status-field"
            >
              <AppText color="neutral" variant="bodyLg">
                {EVALUATION_LABELS[draft.status]}
              </AppText>

              <Ionicons
                color={colors.textNeutralSoft}
                name="chevron-forward"
                size={18}
              />
            </Pressable>
          </View>

          {/* §8: un campo non leggibile non compare vuoto. Senza lettura
              nota il blocco non esiste affatto. */}
          {entry.canViewNotes ? (
            <View style={styles.group}>
              <AppText variant="eyebrow">{SHORTLIST_COPY.editorNote}</AppText>

              <Input
                disabled={!entry.canEditNote}
                error={noteTooLong}
                multiline
                onChangeText={(value) =>
                  setDraft((current) => ({ ...current, note: value }))
                }
                placeholder=""
                testID="shortlist-note-input"
                value={draft.note}
              />

              {/* §18: «Gli errori sono inline vicino al campo; il testo
                  rimane nel draft per errori recuperabili.» */}
              {noteTooLong ? (
                <AppText accessibilityRole="alert" color="danger" variant="meta">
                  {SHORTLIST_COPY.noteTooLong}
                </AppText>
              ) : null}

              <AppText color="neutralMuted" variant="meta">
                {SHORTLIST_COPY.editorNoteHelper}
              </AppText>
            </View>
          ) : null}

          {error ? (
            <AppText accessibilityRole="alert" color="danger" variant="bodySm">
              {error}
            </AppText>
          ) : null}
        </KeyboardAwareForm>

        {/* §17: «CTA sticky Salva modifiche, raggiungibile sopra
            tastiera/safe area.» */}
        <View style={styles.footer}>
          <Button
            /* §19: «Disabilitala quando il draft è invariato, invalido o una
               mutation è in corso, senza confondere questi casi con un
               permesso mancante.» */
            disabled={!dirty || noteTooLong || busy}
            fullWidth
            label={SHORTLIST_COPY.editorSave}
            loading={busy}
            onPress={submit}
            size="lg"
            testID="shortlist-editor-save"
            variant="primary"
          />
        </View>
      </SafeAreaView>

      <ShortlistStatusSheet
        onClose={() => setStatusOpen(false)}
        onConfirm={(status) => {
          setDraft((current) => ({ ...current, status }));
          setStatusOpen(false);
        }}
        value={draft.status}
        visible={statusOpen}
      />

      {/* §20: il pattern condiviso delle modifiche non salvate. Una sola
          conferma: «Non mostrare due conferme consecutive per annullare
          prima uno sheet e poi il medesimo cambiamento.» */}
      <ConfirmModal
        cancelLabel={SHORTLIST_COPY.exitStay}
        confirmLabel={SHORTLIST_COPY.exitLeave}
        destructive
        message={SHORTLIST_COPY.exitBody}
        onCancel={() => setExitOpen(false)}
        onConfirm={() => {
          setExitOpen(false);
          onClose();
        }}
        title={SHORTLIST_COPY.exitTitle}
        visible={exitOpen}
      />
    </Modal>
  );
}

/** Le tre priorità come etichette dell'editor (§17). */
const EVALUATION_PRIORITY_LABELS: Record<ShortlistPriority, string> = {
  alta: "Alta",
  bassa: "Bassa",
  media: "Media",
};

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
    gap: spacing[12],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[12],
  },
  cancel: {
    justifyContent: "center",
    minHeight: sizes.touchTarget,
    minWidth: 64,
  },
  title: {
    flex: 1,
    textAlign: "center",
  },
  content: {
    gap: spacing[24],
    padding: spacing[20],
  },
  identity: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  identityBody: {
    flex: 1,
    gap: 2,
  },
  group: {
    gap: spacing[8],
  },
  priorities: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  priorityCell: {
    /* Due colonne al viewport di riferimento, come il PNG; sotto i ~320 px
       vanno a capo invece di comprimere le etichette (§31). */
    flexBasis: "50%",
    flexGrow: 1,
    minWidth: 140,
    paddingVertical: spacing[4],
  },
  statusField: {
    alignItems: "center",
    borderBottomColor: colors.dividerNeutral,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[10],
  },
  fieldDisabled: {
    opacity: 0.6,
  },
  footer: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[12],
  },
  pressed: {
    opacity: 0.6,
  },
});
