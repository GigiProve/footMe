import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { spacing } from "../../../../theme/tokens";
import { TEAMS_QK } from "../../teams-keys";
import { fetchTeamTypeOptions } from "../../teams-service";
import { TeamLevelSelector } from "../../components/TeamLevelSelector";
import { TeamSelectorModal } from "../../components/TeamSelectorModal";
import { SeasonFieldRow } from "./SeasonFieldRow";

export type ClassificationValue = {
  levelId: string | null;
  levelLabel: string | null;
  typeId: string | null;
  typeLabel: string | null;
};

type Props = {
  clubId: string;
  /** Messaggio sotto il campo Livello, es. invalidazione dopo cambio Tipo. */
  levelNotice?: string | null;
  onChange: (value: ClassificationValue) => void;
  seasonId: string | null;
  seasonLabel: string | null;
  teamId: string | null;
  typeErrorMessage?: string | null;
  value: ClassificationValue;
};

/**
 * La coppia Tipo squadra / Livello-campionato (§14, §19).
 *
 * «Riutilizzare selector e tassonomie di DAS-REV-08»: i due selector sono
 * esattamente quelli del Centro Squadre, incluso il blocco "Non trovi il
 * livello o campionato? → Segnala categoria mancante" che §19 chiede di
 * mantenere. Qui cambia solo il tono cromatico, che è un parametro del
 * componente condiviso e non una seconda copia.
 *
 * Il cambio di Tipo invalida un Livello non più compatibile:
 *
 *   «Quando cambia Tipo, mantenere il Livello solo se ancora valido;
 *    altrimenti rimuoverlo dal draft con spiegazione vicino al campo.»
 *
 * La verifica di compatibilità resta del server — `assert_team_classification`
 * la rifà al salvataggio — ma il draft non deve restare visibilmente
 * incoerente mentre l'utente guarda il form.
 */
export function ClassificationFields({
  clubId,
  levelNotice,
  onChange,
  seasonId,
  seasonLabel,
  teamId,
  typeErrorMessage,
  value,
}: Props) {
  const [typeOpen, setTypeOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);

  const typesQuery = useQuery({
    enabled: typeOpen,
    queryFn: fetchTeamTypeOptions,
    queryKey: TEAMS_QK.types(),
  });

  return (
    <View style={styles.block}>
      <SeasonFieldRow
        errorMessage={typeErrorMessage}
        label="Tipo squadra"
        onPress={() => setTypeOpen(true)}
        placeholder="Seleziona"
        testID="season-type-field"
        value={value.typeLabel}
      />

      <SeasonFieldRow
        helperText={levelNotice}
        label="Livello / campionato"
        onPress={value.typeId ? () => setLevelOpen(true) : undefined}
        placeholder={value.typeId ? "Seleziona" : "Seleziona prima il tipo"}
        readOnly={!value.typeId}
        testID="season-level-field"
        value={value.levelLabel}
      />

      <TeamSelectorModal
        errorMessage={
          typesQuery.isError
            ? "Non è stato possibile caricare i tipi squadra. Riprova."
            : null
        }
        isLoading={typesQuery.isLoading}
        items={(typesQuery.data ?? []).map((option) => ({
          id: option.id,
          label: option.label,
        }))}
        onClose={() => setTypeOpen(false)}
        onRetry={() => void typesQuery.refetch()}
        onSelect={(id) => {
          const option = (typesQuery.data ?? []).find((item) => item.id === id);

          if (!option) {
            return;
          }

          setTypeOpen(false);
          onChange({
            // Il Livello non sopravvive al cambio di Tipo: la compatibilità è
            // dichiarata per coppia e un valore residuo sarebbe incoerente.
            levelId: option.id === value.typeId ? value.levelId : null,
            levelLabel: option.id === value.typeId ? value.levelLabel : null,
            typeId: option.id,
            typeLabel: option.label,
          });
        }}
        title="Tipo squadra"
        tone="neutral"
        value={value.typeId}
        visible={typeOpen}
      />

      <TeamLevelSelector
        clubId={clubId}
        onClose={() => setLevelOpen(false)}
        onSelect={(option) => {
          setLevelOpen(false);
          onChange({
            levelId: option?.id ?? null,
            levelLabel: option?.label ?? null,
            typeId: value.typeId,
            typeLabel: value.typeLabel,
          });
        }}
        seasonId={seasonId}
        seasonLabel={seasonLabel}
        teamId={teamId}
        tone="neutral"
        typeId={value.typeId}
        typeLabel={value.typeLabel}
        value={value.levelId}
        visible={levelOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[16],
  },
});
