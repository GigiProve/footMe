/**
 * Il selector della scadenza candidature (DAS-REV-18 §9, §13; screen 02, 05).
 *
 * **Uno solo**, condiviso da bozza e pubblicata. §3 lo chiede
 * esplicitamente — «La proprietà del container non giustifica una seconda
 * implementazione del comando» — e il mockup lo conferma: gli screen 02 e 05
 * sono lo stesso controllo con un titolo, una riga di contesto e una CTA
 * diversi, non due componenti.
 *
 * Due sole modalità, come §9: **Nessuna scadenza** e **Imposta una data**.
 * Niente ora, niente fuso, niente durata, niente preset 7/14/30 giorni,
 * niente «Applica a tutte» (§11 e §47 li escludono tutti).
 *
 * Il valore è un **giorno civile** `YYYY-MM-DD`: non un istante, non una
 * stringa già formattata. Il cutoff lo deriva il server, nel fuso della
 * società, e qui non compare nessun `toISOString()` — convertirebbe in UTC e
 * sposterebbe il giorno di chi vive a ovest di Greenwich (§8).
 */
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, BottomSheet, Button, Radio } from "../../../../ui";
import { POSITIONS_COPY, formatCivilDateLabel } from "../positions-presentation";

type Props = {
  busy?: boolean;
  /** «Data analyst · Prima squadra» sotto il titolo, solo su una pubblicata. */
  contextLabel?: string | null;
  error?: string | null;
  /**
   * `draft` è la configurazione prima di pubblicare (CTA «Conferma»),
   * `published` la modifica di un termine già attivo (CTA «Salva scadenza»).
   * §13: la differenza è nella CTA e nel contesto mostrato, non nel comando.
   */
  mode: "draft" | "published";
  onClose: () => void;
  /**
   * Il parent decide che farne: su una pubblicata con ricezione già chiusa,
   * `null` apre il chiarimento di §16 invece di salvare subito.
   */
  onConfirm: (deadlineDate: string | null) => void;
  /** `true` quando la scadenza attuale ha già interrotto la ricezione (§15). */
  receivingClosed?: boolean;
  value: string | null;
  visible: boolean;
};

const COPY = {
  currentLabel: "Scadenza attuale",
  dateInvalid: "Seleziona una data valida.",
  datePast: "La data scelta è trascorsa. Seleziona oggi o una data successiva.",
  modeDate: "Imposta una data",
  pickDate: "Scegli una data",
  saveDraft: "Conferma",
  savePublished: "Salva scadenza",
  titleDraft: POSITIONS_COPY.deadlineLabel,
  titlePublished: "Modifica scadenza",
} as const;

export function PositionDeadlineSheet({
  busy = false,
  contextLabel,
  error,
  mode,
  onClose,
  onConfirm,
  receivingClosed = false,
  value,
  visible,
}: Props) {
  const [choice, setChoice] = useState<"none" | "date">(value ? "date" : "none");
  const [draftDate, setDraftDate] = useState<string | null>(value);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  /* §9: «Chiudere/back senza confermare conserva il valore precedente.» Alla
     riapertura lo sheet riparte sempre dal valore confermato, mai da quello
     rimasto da un'apertura abbandonata. */
  useEffect(() => {
    if (visible) {
      setChoice(value ? "date" : "none");
      setDraftDate(value);
      setPickerOpen(false);
      setLocalError(null);
    }
  }, [value, visible]);

  const published = mode === "published";
  const currentLabel = formatCivilDateLabel(value);

  /* §15: «Quando la nuova data riabilita la ricezione, spiega prima di
     salvare.» La condizione è esatta: solo una posizione la cui ricezione è
     oggi interrotta, e solo una scelta che la riapre davvero. */
  const reopens =
    published &&
    receivingClosed &&
    (choice === "none" || (draftDate !== null && !isPast(draftDate)));

  const helper = reopens
    ? POSITIONS_COPY.deadlineReopensHelper
    : POSITIONS_COPY.deadlineSheetHelper;

  const confirm = () => {
    if (choice === "none") {
      setLocalError(null);
      onConfirm(null);
      return;
    }

    if (!draftDate) {
      setLocalError(COPY.dateInvalid);
      return;
    }

    /* §38: il rifiuto è inline, accanto al controllo. Il server rivalida
       comunque al commit — una pagina aperta prima di mezzanotte non congela
       il tempo — ma non è questo il modo di dirlo a chi sta scegliendo. */
    if (isPast(draftDate)) {
      setLocalError(COPY.datePast);
      return;
    }

    setLocalError(null);
    onConfirm(draftDate);
  };

  return (
    <BottomSheet
      onClose={onClose}
      title={published ? COPY.titlePublished : COPY.titleDraft}
      visible={visible}
    >
      {published && contextLabel ? (
        <AppText color="neutralMuted" style={styles.context} variant="bodySm">
          {contextLabel}
        </AppText>
      ) : null}

      {/* Screen 05: il valore corrente **prima** della scelta. §13 — «Leggi e
          visualizza sempre il valore corrente prima della modifica.» */}
      {published ? (
        <View style={styles.current}>
          <AppText color="neutralMuted" variant="meta">
            {COPY.currentLabel}
          </AppText>

          <AppText color="neutral" testID="deadline-current" variant="bodyLg">
            {currentLabel ?? POSITIONS_COPY.deadlineNone}
          </AppText>
        </View>
      ) : null}

      <View accessibilityRole="radiogroup" style={styles.options}>
        <Radio
          checked={choice === "none"}
          label={POSITIONS_COPY.deadlineNone}
          onPress={() => {
            setChoice("none");
            setDraftDate(null);
            setPickerOpen(false);
            setLocalError(null);
          }}
          testID="deadline-mode-none"
        />

        <Radio
          checked={choice === "date"}
          label={COPY.modeDate}
          onPress={() => {
            setChoice("date");
            setPickerOpen(true);
            setLocalError(null);
          }}
          testID="deadline-mode-date"
        />
      </View>

      {choice === "date" ? (
        <View style={styles.picker}>
          {Platform.OS === "ios" ? (
            /* §9: «Lo screen 02 illustra una ruota nativa; riutilizza
               l'equivalente di piattaforma già previsto, senza creare un
               calendario custom decorativo.» */
            <DateTimePicker
              display="spinner"
              minimumDate={startOfToday()}
              mode="date"
              onChange={(_event, date) => {
                if (date) {
                  setDraftDate(toCivilDate(date));
                  setLocalError(null);
                }
              }}
              testID="deadline-picker"
              value={fromCivilDate(draftDate)}
            />
          ) : (
            <>
              <Pressable
                accessibilityLabel={`${COPY.pickDate}${draftDate ? `: ${formatCivilDateLabel(draftDate)}` : ""}`}
                accessibilityRole="button"
                onPress={() => setPickerOpen(true)}
                style={styles.androidDate}
                testID="deadline-picker-open"
              >
                <AppText color="neutral" variant="bodyLg">
                  {formatCivilDateLabel(draftDate) ?? COPY.pickDate}
                </AppText>
              </Pressable>

              {pickerOpen ? (
                <DateTimePicker
                  display="default"
                  minimumDate={startOfToday()}
                  mode="date"
                  onChange={(_event, date) => {
                    setPickerOpen(false);

                    if (date) {
                      setDraftDate(toCivilDate(date));
                      setLocalError(null);
                    }
                  }}
                  testID="deadline-picker"
                  value={fromCivilDate(draftDate)}
                />
              ) : null}
            </>
          )}
        </View>
      ) : null}

      <AppText color="neutralMuted" style={styles.helper} variant="bodySm">
        {helper}
      </AppText>

      {/* L'errore locale vince su quello del server: è il più recente, e
          riguarda la scelta che l'utente ha appena fatto. */}
      {(localError ?? error) ? (
        <AppText
          accessibilityRole="alert"
          color="danger"
          style={styles.error}
          testID="deadline-error"
          variant="meta"
        >
          {localError ?? error}
        </AppText>
      ) : null}

      <View style={styles.confirm}>
        <Button
          fullWidth
          label={published ? COPY.savePublished : COPY.saveDraft}
          loading={busy}
          onPress={confirm}
          testID="deadline-confirm"
        />
      </View>
    </BottomSheet>
  );
}

/**
 * `Date` → `YYYY-MM-DD` nel fuso **locale**.
 *
 * `toISOString()` convertirebbe in UTC e, per chi sta a ovest di Greenwich,
 * restituirebbe il giorno precedente (§8).
 */
function toCivilDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

/** `new Date("YYYY-MM-DD")` sarebbe UTC: il costruttore a tre argomenti no. */
function fromCivilDate(value: string | null): Date {
  if (!value) {
    return startOfToday();
  }

  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function startOfToday(): Date {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * «Trascorso» sul calendario locale, non su una differenza di 24 ore.
 *
 * §8: «Consenti oggi se, all'istante della conferma, il relativo cutoff non è
 * ancora passato.» Il cutoff di oggi è la mezzanotte di domani, quindi oggi
 * non è mai passato — ed è questo che il confronto fra giorni esprime, mentre
 * un confronto fra istanti lo negherebbe dal primo minuto del mattino.
 *
 * Il verdetto resta indicativo: il fuso della società può differire da quello
 * del telefono, e l'unica autorità è il server, che rivalida al commit (§8).
 */
function isPast(civilDate: string): boolean {
  return civilDate < toCivilDate(startOfToday());
}

const styles = StyleSheet.create({
  androidDate: {
    justifyContent: "center",
    minHeight: sizes.touchTarget,
  },
  confirm: {
    paddingTop: spacing[16],
  },
  context: {
    paddingBottom: spacing[12],
  },
  current: {
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[4],
    paddingBottom: spacing[12],
  },
  error: {
    paddingTop: spacing[8],
  },
  helper: {
    paddingTop: spacing[12],
  },
  options: {
    paddingTop: spacing[8],
  },
  picker: {
    paddingTop: spacing[8],
  },
});
