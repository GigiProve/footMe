/**
 * Tab Info del Master Profile Media/Creator (REV-PROF-21, Screen 5).
 *
 * Cinque sezioni, in quest'ordine: identità editoriale, copertura, contenuti,
 * aree coperte, canali ufficiali. Sono i dati editoriali pubblici della
 * realtà, non quelli personali di chi la amministra: le aree sono la
 * copertura dichiarata, non la residenza del proprietario, e non esiste nessun
 * fallback che possa trasformare l'una nell'altra.
 *
 * Al Visitor una sezione senza dati non esiste: nessun placeholder, nessun
 * "Da completare", nessuna card vuota.
 */
import { Linking, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import { ProfileIconChips } from "../master/ProfileIconChips";
import { ProfileSectionBlock, ProfileSectionError } from "../master/ProfileSectionBlock";
import type { MediaChannelRow } from "./media-channel-view";
import type { MediaInfoChip } from "./media-master-profile";

export type MediaInfoTabProps = {
  areasLabel: string | null;
  channels: readonly MediaChannelRow[];
  contentTypes: readonly MediaInfoChip[];
  coverage: readonly MediaInfoChip[];
  /** Descrizione completa: qui, non troncata come nell'header. */
  description: string | null;
  entityTypeLabel: string | null;
  errorMessage?: string | null;
  isLoading: boolean;
  isOwner: boolean;
  onChannelPress?: (channel: MediaChannelRow) => void;
  onEditProfilePress?: () => void;
  onRetry: () => void;
};

export function MediaInfoTab({
  areasLabel,
  channels,
  contentTypes,
  coverage,
  description,
  entityTypeLabel,
  errorMessage,
  isLoading,
  isOwner,
  onChannelPress,
  onEditProfilePress,
  onRetry,
}: MediaInfoTabProps) {
  if (isLoading) {
    return <InfoSkeleton />;
  }

  if (errorMessage) {
    return (
      <View style={styles.container}>
        <ProfileSectionError
          message={errorMessage}
          onRetry={onRetry}
          testID="media-info-error"
        />
      </View>
    );
  }

  const hasIdentity = Boolean(entityTypeLabel || description);
  const hasAnyInfo =
    hasIdentity ||
    coverage.length > 0 ||
    contentTypes.length > 0 ||
    Boolean(areasLabel) ||
    channels.length > 0;

  if (!hasAnyInfo) {
    return (
      <View style={styles.empty} testID="media-info-empty">
        <AppText variant="titleSm">
          {isOwner
            ? "Completa le informazioni del profilo"
            : "Informazioni non disponibili"}
        </AppText>
        <AppText align="center" color="secondary" variant="bodySm">
          {isOwner
            ? "Aggiungi identità, copertura e canali ufficiali."
            : "Questo profilo non ha ancora aggiunto informazioni pubbliche."}
        </AppText>
        {isOwner && onEditProfilePress ? (
          <Button
            label="Modifica profilo"
            onPress={onEditProfilePress}
            size="sm"
            testID="media-info-empty-cta"
            variant="outline"
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container} testID="media-info-tab">
      {hasIdentity ? (
        <ProfileSectionBlock testID="media-info-identity" title="Identità editoriale">
          <View style={styles.identityCard}>
            {entityTypeLabel ? (
              <AppText variant="titleSm">{entityTypeLabel}</AppText>
            ) : null}
            {description ? (
              /*
                Testo multilinea preservato così com'è stato scritto: nessun
                markup eseguito, nessun URL trasformato in link.
              */
              <AppText color="secondary" variant="bodyLg">
                {description}
              </AppText>
            ) : null}
          </View>
        </ProfileSectionBlock>
      ) : null}

      {coverage.length > 0 ? (
        <ProfileSectionBlock title="Copertura">
          <ProfileIconChips chips={coverage} testID="media-info-coverage" />
        </ProfileSectionBlock>
      ) : null}

      {contentTypes.length > 0 ? (
        <ProfileSectionBlock title="Contenuti">
          <ProfileIconChips
            chips={contentTypes}
            testID="media-info-content-types"
          />
        </ProfileSectionBlock>
      ) : null}

      {areasLabel ? (
        <ProfileSectionBlock title="Aree coperte">
          <View style={styles.areasCard} testID="media-info-areas">
            <Ionicons
              color={colors.textMuted}
              name="location-outline"
              size={14}
            />
            <AppText color="primary" style={styles.areasText} variant="meta">
              {areasLabel}
            </AppText>
          </View>
        </ProfileSectionBlock>
      ) : null}

      {channels.length > 0 ? (
        <ProfileSectionBlock title="Canali ufficiali">
          <View style={styles.channelList} testID="media-info-channels">
            {channels.map((channel, index) => (
              <Pressable
                accessibilityHint="Apre il canale in una scheda esterna"
                accessibilityLabel={`${channel.label}, link esterno`}
                accessibilityRole="link"
                key={channel.key}
                onPress={() => {
                  onChannelPress?.(channel);
                  void Linking.openURL(channel.url);
                }}
                style={({ pressed }) => [
                  styles.channelRow,
                  index > 0 ? styles.channelRowDivided : null,
                  pressed ? styles.pressed : null,
                ]}
                testID={`media-info-channel-${channel.key}`}
              >
                <Ionicons
                  color={colors.accent}
                  name={channel.icon}
                  size={18}
                />
                <AppText style={styles.channelLabel} variant="bodyLg">
                  {channel.label}
                </AppText>
                <Ionicons
                  color={colors.textMuted}
                  name="open-outline"
                  size={16}
                />
              </Pressable>
            ))}
          </View>
        </ProfileSectionBlock>
      ) : null}
    </View>
  );
}

function InfoSkeleton() {
  return (
    <View
      accessible
      accessibilityLabel="Caricamento delle informazioni in corso"
      accessibilityRole="progressbar"
      style={styles.container}
      testID="media-info-skeleton"
    >
      <View style={styles.skeletonSection}>
        <View style={[styles.skeletonLine, styles.skeletonHeading]} />
        <View style={styles.skeletonCard} />
      </View>
      <View style={styles.skeletonSection}>
        <View style={[styles.skeletonLine, styles.skeletonHeading]} />
        <View style={styles.skeletonChips}>
          <View style={styles.skeletonChip} />
          <View style={styles.skeletonChip} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  areasCard: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[8],
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
  },
  areasText: {
    flexShrink: 1,
    minWidth: 0,
  },
  channelLabel: {
    flexShrink: 1,
    minWidth: 0,
  },
  channelList: {
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  channelRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    // 44 pt: il target minimo di una riga apribile.
    minHeight: 48,
    paddingHorizontal: spacing[14],
  },
  channelRowDivided: {
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  container: {
    gap: spacing[24],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[20],
  },
  empty: {
    alignItems: "center",
    gap: spacing[8],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[32],
  },
  identityCard: {
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing[6],
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
  },
  pressed: {
    opacity: 0.7,
  },
  skeletonCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[16],
    height: 72,
  },
  skeletonChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    flexGrow: 1,
    height: 38,
    minWidth: 150,
  },
  skeletonChips: {
    flexDirection: "row",
    gap: spacing[8],
  },
  skeletonHeading: {
    height: 18,
    width: 160,
  },
  skeletonLine: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[4],
    height: 14,
  },
  skeletonSection: {
    gap: spacing[12],
  },
});
