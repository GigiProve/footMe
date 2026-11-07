/**
 * Filtro multiplo a due dimensioni (§14, screen 03).
 *
 * «Due sole dimensioni: Squadre (Team reali autorizzati, checkbox
 * multiselezione) e Posizioni (Position autorizzate, checkbox
 * multiselezione, con gruppi leggeri Attive/Chiuse quando pertinenti).»
 *
 * Tre comportamenti che §14 chiede e che qui sono strutturali:
 *
 *  · la copia **pending** vive nello sheet. «X, back o dismiss senza Applica
 *    scartano i cambi pending e conservano i filtri già applicati» — se lo
 *    stato vivesse nel genitore ogni tocco sarebbe già applicato;
 *  · «Azzera nello sheet azzera la copia pending; Applica rende effettivo il
 *    reset.» Azzera non chiude e non ricarica niente;
 *  · cambiando una Squadra le Position divenute incompatibili escono dalla
 *    selezione pending, con un avviso leggibile — §14 vieta di «lasciare
 *    filtri invisibili o contraddittori».
 *
 * Nessun chip sotto la checklist: §14 — «Le checkbox sono sufficienti: non
 * aggiungere chip duplicati». E nessuna opzione disabled per ciò che l'actor
 * non può leggere: il server non la manda proprio.
 */
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, BottomSheet, Button, Checkbox } from "../../../../ui";
import {
  APPLICATIONS_COPY,
  reconcilePendingFilter,
} from "../applications-presentation";
import type {
  ApplicationFilterOption,
  ApplicationsFilter,
} from "../applications-types";

type Props = {
  applied: ApplicationsFilter;
  error: boolean;
  loading: boolean;
  onApply: (filter: ApplicationsFilter) => void;
  onClose: () => void;
  onRetry: () => void;
  options: readonly ApplicationFilterOption[];
  visible: boolean;
};

function toggle(values: readonly string[], id: string): string[] {
  return values.includes(id)
    ? values.filter((value) => value !== id)
    : [...values, id];
}

export function ApplicationsFilterSheet({
  applied,
  error,
  loading,
  onApply,
  onClose,
  onRetry,
  options,
  visible,
}: Props) {
  const [pending, setPending] = useState<ApplicationsFilter>(applied);
  const [dropped, setDropped] = useState(0);

  /* All'apertura lo sheet riparte dai filtri **applicati** (§14 — «selezioni
     pending inizializzate dai filtri applicati»): una chiusura senza
     conferma non deve lasciare dietro una selezione mai confermata. */
  useEffect(() => {
    if (visible) {
      setPending(applied);
      setDropped(0);
    }
  }, [applied, visible]);

  const teams = useMemo(
    () => options.filter((option) => option.kind === "team"),
    [options],
  );

  /**
   * §14: «Le opzioni Posizioni si adeguano alla selezione pendente.» A
   * squadre selezionate restano le Position di quelle squadre; a zero
   * squadre restano tutte, SOCIETY comprese.
   */
  const positions = useMemo(() => {
    const all = options.flatMap((option) =>
      option.kind === "position" ? [option] : [],
    );

    if (pending.teamIds.length === 0) {
      return all;
    }

    return all.filter(
      (option) => option.teamId !== null && pending.teamIds.includes(option.teamId),
    );
  }, [options, pending.teamIds]);

  const groups = useMemo(
    () => ({
      active: positions.filter((option) => option.group === "active"),
      closed: positions.filter((option) => option.group === "closed"),
    }),
    [positions],
  );

  const toggleTeam = (teamId: string) => {
    const next = { ...pending, teamIds: toggle(pending.teamIds, teamId) };
    const reconciled = reconcilePendingFilter(next, options);

    setPending(reconciled.filter);
    setDropped(reconciled.dropped);
  };

  const togglePosition = (adId: string) => {
    setDropped(0);
    setPending((current) => ({ ...current, adIds: toggle(current.adIds, adId) }));
  };

  const busy = loading || error;

  return (
    <BottomSheet
      onClose={onClose}
      title={APPLICATIONS_COPY.filterTitle}
      visible={visible}
    >
      {error ? (
        <View style={styles.state}>
          <AppText color="neutralMuted" variant="bodySm">
            Non è stato possibile caricare le opzioni.
          </AppText>
          <Button
            label={APPLICATIONS_COPY.retry}
            onPress={onRetry}
            size="sm"
            testID="applications-filter-retry"
            variant="neutralOutline"
          />
        </View>
      ) : loading ? (
        <AppText color="neutralMuted" style={styles.state} variant="bodySm">
          Caricamento…
        </AppText>
      ) : (
        <ScrollView style={styles.list}>
          {teams.length > 0 ? (
            <>
              <AppText style={styles.section} variant="eyebrow">
                {APPLICATIONS_COPY.filterTeams}
              </AppText>

              {teams.map((option) =>
                option.kind === "team" ? (
                  <Checkbox
                    checked={pending.teamIds.includes(option.teamId)}
                    key={option.teamId}
                    label={option.label}
                    onValueChange={() => toggleTeam(option.teamId)}
                    testID={`applications-filter-team-${option.teamId}`}
                  />
                ) : null,
              )}
            </>
          ) : null}

          {positions.length > 0 ? (
            <AppText style={styles.section} variant="eyebrow">
              {APPLICATIONS_COPY.filterPositions}
            </AppText>
          ) : null}

          {/* I gruppi compaiono solo quando servono davvero a distinguere:
              §14 — «con gruppi leggeri Attive/Chiuse quando pertinenti». */}
          {groups.active.length > 0 && groups.closed.length > 0 ? (
            <AppText color="neutralMuted" style={styles.group} variant="meta">
              {APPLICATIONS_COPY.filterActiveGroup}
            </AppText>
          ) : null}

          {groups.active.map((option) => (
            <Checkbox
              checked={pending.adIds.includes(option.adId)}
              description={option.sublabel ?? undefined}
              key={option.adId}
              label={option.label}
              onValueChange={() => togglePosition(option.adId)}
              testID={`applications-filter-position-${option.adId}`}
            />
          ))}

          {groups.closed.length > 0 && groups.active.length > 0 ? (
            <AppText color="neutralMuted" style={styles.group} variant="meta">
              {APPLICATIONS_COPY.filterClosedGroup}
            </AppText>
          ) : null}

          {groups.closed.map((option) => (
            <Checkbox
              checked={pending.adIds.includes(option.adId)}
              description={option.sublabel ?? undefined}
              key={option.adId}
              label={option.label}
              onValueChange={() => togglePosition(option.adId)}
              testID={`applications-filter-position-${option.adId}`}
            />
          ))}

          {dropped > 0 ? (
            <AppText
              accessibilityRole="alert"
              color="neutralMuted"
              style={styles.notice}
              variant="bodySm"
            >
              {dropped === 1
                ? "Una posizione non compatibile con le squadre scelte è stata deselezionata."
                : `${dropped} posizioni non compatibili con le squadre scelte sono state deselezionate.`}
            </AppText>
          ) : null}
        </ScrollView>
      )}

      <View style={styles.footer}>
        {/* §14: Azzera agisce sulla copia pending e non chiude. È un link,
            non una seconda primaria: la pagina ha una CTA sola. */}
        <Button
          label={APPLICATIONS_COPY.filterReset}
          onPress={() => {
            setDropped(0);
            setPending({ adIds: [], teamIds: [] });
          }}
          size="md"
          testID="applications-filter-reset"
          variant="link"
        />

        <Button
          /* §27: «Uno sheet con opzioni ancora in caricamento non deve
             consentire un Applica ambiguo che cancelli selezioni
             precedenti.» */
          disabled={busy}
          label={APPLICATIONS_COPY.filterApply}
          onPress={() => onApply(pending)}
          size="md"
          testID="applications-filter-apply"
          variant="primary"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    maxHeight: 380,
  },
  section: {
    paddingBottom: spacing[8],
    paddingTop: spacing[12],
  },
  group: {
    paddingBottom: spacing[4],
    paddingTop: spacing[8],
  },
  state: {
    alignItems: "flex-start",
    gap: spacing[12],
    paddingVertical: spacing[16],
  },
  notice: {
    paddingTop: spacing[12],
  },
  footer: {
    alignItems: "center",
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing[16],
    paddingTop: spacing[12],
  },
});
