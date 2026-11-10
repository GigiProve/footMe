/**
 * Step 3 — Riepilogo (DAS-REV-32 §20; PNG 12).
 *
 * Controllo finale: avatar/fallback, nome, Società, Squadra, persone incluse
 * (creator una volta sola) e amministratore iniziale. Le due azioni
 * secondarie riaprono gli step; l'unica CTA «Crea gruppo» sta nel footer
 * della cornice. Nessun «Sei sicuro?»: questo passaggio è la conferma.
 */
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../../../theme/tokens";
import { AppText, Avatar } from "../../../../../ui";
import { GroupAvatar } from "../../components/GroupAvatar";
import { GROUPS_COPY } from "../../groups-copy";
import type { SummaryPerson } from "../../groups-presentation";

type Props = {
  adminName: string;
  avatarUri: string | null;
  locked: boolean;
  more: number;
  name: string;
  notice: ReactNode;
  onEditInfo: () => void;
  onEditPeople: () => void;
  people: readonly SummaryPerson[];
  societyName: string;
  teamLabel: string;
  total: number;
};

export function GroupSummaryStep({
  adminName,
  avatarUri,
  locked,
  more,
  name,
  notice,
  onEditInfo,
  onEditPeople,
  people,
  societyName,
  teamLabel,
  total,
}: Props) {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {notice}

      <View style={styles.identity}>
        <GroupAvatar name={name} path={null} previewUri={avatarUri} size="xl" />
        <AppText align="center" color="neutral" style={styles.groupName} variant="titleMd">
          {name}
        </AppText>
      </View>

      <View style={styles.card}>
        <SummaryRow label={GROUPS_COPY.summarySociety} value={societyName} />
        <SummaryRow label={GROUPS_COPY.summaryTeam} value={teamLabel} />
        <SummaryRow label={GROUPS_COPY.summaryPeople} value={GROUPS_COPY.peopleIncludingYou(total)} />
        <SummaryRow label={GROUPS_COPY.summaryAdmin} last value={adminName} />
      </View>

      <View style={styles.listBlock}>
        <AppText accessibilityRole="header" color="neutralMuted" variant="eyebrow">
          {GROUPS_COPY.summaryIncluded}
        </AppText>

        {people.map((person) => (
          <View key={person.profileId} style={styles.person}>
            <Avatar name={person.fullName} size="sm" uri={person.avatarUrl ?? undefined} />
            <View style={styles.personText}>
              <AppText color="neutral" numberOfLines={2} variant="bodyLg">
                {person.isCreator ? GROUPS_COPY.summaryYou(person.fullName) : person.fullName}
              </AppText>
              {person.roleLabel ? (
                <AppText color="neutralMuted" numberOfLines={1} variant="meta">
                  {person.roleLabel}
                </AppText>
              ) : null}
            </View>
          </View>
        ))}

        {more > 0 ? (
          <AppText color="neutralMuted" testID="group-summary-more" variant="bodySm">
            {GROUPS_COPY.moreSelectedPeople(more)}
          </AppText>
        ) : null}
      </View>

      {locked ? null : (
        <View style={styles.links}>
          <Pressable accessibilityRole="button" onPress={onEditInfo} style={styles.link} testID="group-edit-info">
            <AppText color="accent" variant="actionLabel">
              {GROUPS_COPY.editInfo}
            </AppText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onEditPeople} style={styles.link} testID="group-edit-people">
            <AppText color="accent" variant="actionLabel">
              {GROUPS_COPY.editPeople}
            </AppText>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function SummaryRow({ label, last = false, value }: { label: string; last?: boolean; value: string }) {
  return (
    <View style={[styles.row, last ? null : styles.rowDivider]}>
      <AppText color="neutralMuted" variant="bodySm">
        {label}
      </AppText>
      <AppText align="right" color="neutral" style={styles.rowValue} variant="bodyLg">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[16],
  },
  content: {
    gap: spacing[20],
    paddingBottom: spacing[24],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
  },
  groupName: {
    alignSelf: "stretch",
  },
  identity: {
    alignItems: "center",
    gap: spacing[12],
  },
  link: {
    alignItems: "flex-start",
    justifyContent: "center",
    minHeight: 44,
  },
  links: {
    gap: spacing[4],
  },
  listBlock: {
    gap: spacing[10],
  },
  person: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 44,
  },
  personText: {
    flex: 1,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[16],
    justifyContent: "space-between",
    minHeight: 48,
    paddingVertical: spacing[8],
  },
  rowDivider: {
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowValue: {
    flex: 1,
  },
});
