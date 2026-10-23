/**
 * Selezione del nuovo Owner (DAS-REV-14, screen 11).
 *
 * «Trasferisci Owner apre un pannello sopra il dettaglio corrente» (§19):
 * una sheet, non una route — chiudere deve riportare al dettaglio Owner
 * senza una transizione di pagina.
 *
 * «Tap sulla row seleziona soltanto il destinatario; Continua apre la
 * conferma e non trasferisce nulla.» Qui non esiste nessuna mutation: la
 * sheet sceglie, e basta.
 *
 * «La lista del mockup è un viewport: con altre persone attive eleggibili la
 * lista continua nello scroll. Non hardcodare tre candidati.» Da cui la
 * paginazione: i tre del PNG sono un'inquadratura, non l'insieme.
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { colors, sizes, spacing } from "../../../../../theme/tokens";
import Ionicons from "@expo/vector-icons/Ionicons";

import { AppText, Avatar, BottomSheet, Button } from "../../../../../ui";
import { useSession } from "../../../../auth/use-session";
import { RolesAccessError } from "../../../roles/roles-service";
import { ACCESS_QK } from "../access-keys";
import { ACCESS_COPY } from "../access-presentation";
import { fetchOwnerCandidates } from "../access-service";
import type { OwnerCandidate } from "../access-types";

const PAGE_SIZE = 20;

type Props = {
  clubId: string;
  onClose: () => void;
  onContinue: (candidate: OwnerCandidate) => void;
  visible: boolean;
};

export function OwnerCandidateSheet({
  clubId,
  onClose,
  onContinue,
  visible,
}: Props) {
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const candidatesQuery = useQuery({
    enabled: visible && !!clubId && !!actorId,
    queryFn: () => fetchOwnerCandidates({ clubId, limit }),
    queryKey: [...ACCESS_QK.candidates(actorId, clubId), limit],
    retry: (failureCount, error) =>
      !(error instanceof RolesAccessError) && failureCount < 1,
  });

  /* Selezione e paginazione nascono con il pannello: il parent lo monta con
     `key` sull'apertura, quindi non serve azzerarle a mano. */
  const page = candidatesQuery.data ?? null;
  const rows = page?.rows ?? [];
  const selected = rows.find((row) => row.profileId === selectedId) ?? null;

  return (
    <BottomSheet
      onClose={onClose}
      title={ACCESS_COPY.transferPickerTitle}
      visible={visible}
    >
      <View style={styles.content}>
        {candidatesQuery.error ? (
          <View style={styles.block}>
            <AppText accessibilityRole="alert" color="danger" variant="bodySm">
              {ACCESS_COPY.candidatesError}
            </AppText>

            <Button
              label="Riprova"
              onPress={() => void candidatesQuery.refetch()}
              size="sm"
              variant="ghost"
            />
          </View>
        ) : rows.length === 0 && !candidatesQuery.isLoading ? (
          <View style={styles.block}>
            <AppText color="neutral" variant="titleSm">
              {ACCESS_COPY.transferEmptyTitle}
            </AppText>

            <AppText color="neutralMuted" variant="meta">
              {ACCESS_COPY.transferEmptyHelper}
            </AppText>
          </View>
        ) : (
          <ScrollView style={styles.list}>
            {rows.map((row, index) => {
              const isSelected = row.profileId === selectedId;
              const context = row.scopeLabel
                ? `${row.roleLabel} · ${row.scopeLabel}`
                : row.roleLabel;

              return (
                <Pressable
                  accessibilityLabel={`${row.fullName}, ${context}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  key={row.profileId}
                  onPress={() => setSelectedId(row.profileId)}
                  style={[styles.row, index > 0 ? styles.divided : null]}
                  testID={`owner-candidate-${row.profileId}`}
                >
                  {/* La riga **è** il radio: annidarne uno con etichetta
                      vuota darebbe due controlli per la stessa scelta e due
                      annunci al lettore di schermo. */}
                  <Ionicons
                    color={isSelected ? colors.accent : colors.textNeutralSoft}
                    name={isSelected ? "radio-button-on" : "radio-button-off"}
                    size={20}
                  />

                  <Avatar
                    name={row.fullName}
                    size="sm"
                    uri={row.avatarUrl ?? undefined}
                  />

                  <View style={styles.body}>
                    <AppText color="neutral" numberOfLines={2} variant="bodyLg">
                      {row.fullName}
                    </AppText>

                    <AppText color="neutralMuted" variant="meta">
                      {context}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}

            {page && rows.length < page.total ? (
              <Button
                label="Mostra altri"
                onPress={() => setLimit((value) => value + PAGE_SIZE)}
                size="sm"
                testID="owner-candidates-more"
                variant="ghost"
              />
            ) : null}
          </ScrollView>
        )}

        {rows.length > 0 ? (
          <Button
            disabled={!selected}
            fullWidth
            label={ACCESS_COPY.transferContinueCta}
            onPress={() => {
              if (selected) {
                onContinue(selected);
              }
            }}
            size="lg"
            testID="owner-candidates-continue"
            variant="primary"
          />
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[16],
  },
  block: {
    gap: spacing[8],
    paddingVertical: spacing[16],
  },
  list: {
    maxHeight: 360,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[10],
  },
  divided: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
});
