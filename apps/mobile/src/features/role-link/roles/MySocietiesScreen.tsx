/**
 * Società e ruoli (§26, screen 13).
 *
 * «Riutilizza/inserisci l'accesso owner Società e ruoli nel proprio Profilo,
 * con lo stesso percorso per Calciatore, Allenatore, Staff e Dirigente. Non
 * obbligare a ritrovare la società in Cerca per gestire un rapporto
 * attivo.»
 *
 * L'elenco raggruppa per società e non per incarico: §26 — «Non ripetere AC
 * Como per ogni assignment». Il conteggio «riguarda incarichi correnti
 * distinti», e arriva dal backend già calcolato così.
 */
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText, Avatar, Button, EmptyState } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { STALE_MS } from "../../dashboard/cache/freshness-policy";
import {
  DashboardGlobalError,
  DashboardSkeleton,
} from "../../dashboard/components/DashboardStates";
import { RoleLinkScaffold } from "../components/RoleLinkScaffold";
import { trackRoleLinkEvent } from "../role-link-analytics";
import { ROLE_LINK_QK } from "../role-link-keys";
import {
  ROLE_LINK_COPY,
  ROLE_LINK_FAILURES,
  societyContextLines,
  societySummary,
} from "../role-link-presentation";
import { ROLE_LINK_HREFS } from "../role-link-routes";
import { fetchMySocieties } from "../role-link-service";
import type { MySocietyRow } from "../role-link-types";

export function MySocietiesScreen() {
  const router = useRouter();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";

  const societiesQuery = useQuery({
    enabled: !!actorId,
    queryFn: fetchMySocieties,
    queryKey: ROLE_LINK_QK.mySocieties(actorId),
    staleTime: STALE_MS.management,
  });

  useEffect(() => {
    trackRoleLinkEvent("role_link_societies_opened");
  }, []);

  const onBack = () => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace("/(tabs)/profile" as never);
  };

  const societies = societiesQuery.data ?? [];

  return (
    <RoleLinkScaffold
      onBack={onBack}
      testID="role-link-societies"
      title={ROLE_LINK_COPY.societiesTitle}
    >
      <View style={styles.person}>
        <Avatar
          name={profile?.full_name ?? ""}
          size="md"
          uri={profile?.avatar_url ?? undefined}
        />

        <AppText color="neutral" variant="titleSm">
          {profile?.full_name ?? ""}
        </AppText>
      </View>

      <AppText color="neutralMuted" style={styles.helper} variant="meta">
        {ROLE_LINK_COPY.societiesHelper}
      </AppText>

      {societiesQuery.isLoading ? (
        <DashboardSkeleton />
      ) : societiesQuery.isError ? (
        /* §26: «Errore e assenza di dati sono stati separati.» */
        <DashboardGlobalError
          body={ROLE_LINK_FAILURES.load}
          onRetry={() => void societiesQuery.refetch()}
          title="Società non disponibili"
        />
      ) : societies.length === 0 ? (
        <EmptyState
          action={
            <Button
              label={ROLE_LINK_COPY.searchClub}
              onPress={() => router.push("/(tabs)/cerca" as never)}
              size="sm"
              variant="outline"
            />
          }
          description={ROLE_LINK_COPY.societiesEmptyBody}
          title={ROLE_LINK_COPY.societiesEmpty}
        />
      ) : (
        <View style={styles.list}>
          {societies.map((society, index) => (
            <SocietyRow
              isFirst={index === 0}
              key={society.clubId}
              onPress={() =>
                router.push(
                  ROLE_LINK_HREFS.society(society.clubId, {
                    from: "profile",
                  }) as never,
                )
              }
              society={society}
            />
          ))}
        </View>
      )}
    </RoleLinkScaffold>
  );
}

function SocietyRow({
  isFirst,
  onPress,
  society,
}: {
  isFirst: boolean;
  onPress: () => void;
  society: MySocietyRow;
}) {
  const summary = societySummary(society);
  const contextLines = societyContextLines(society.roleLines, society.activeCount);

  return (
    <Pressable
      accessibilityLabel={[society.clubName, summary, ...contextLines].join(", ")}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.rowWrap,
        isFirst ? null : styles.divided,
        pressed ? styles.pressed : null,
      ]}
      testID={`role-link-society-${society.clubId}`}
    >
      <Avatar
        name={society.clubName}
        size="md"
        square
        tone="ink"
        uri={society.clubLogoUrl ?? undefined}
      />

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <AppText color="neutral" variant="bodyLg">
            {society.clubName}
          </AppText>

          {society.clubIsVerified ? (
            <Ionicons color={colors.accent} name="checkmark-circle" size={14} />
          ) : null}
        </View>

        <AppText color="neutralMuted" variant="meta">
          {summary}
        </AppText>

        {/* §26: «eventuali due righe di contesto». */}
        {contextLines.map((line) => (
          <AppText color="neutralMuted" key={line} variant="meta">
            {line}
          </AppText>
        ))}
      </View>

      <Ionicons color={colors.textNeutralSoft} name="chevron-forward" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  person: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingBottom: spacing[4],
  },
  helper: {
    paddingBottom: spacing[16],
  },
  list: {
    paddingTop: spacing[4],
  },
  rowWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[12],
  },
  divided: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  pressed: {
    opacity: 0.6,
  },
});
