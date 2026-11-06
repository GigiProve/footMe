/**
 * «Fai parte di questa società?» sul Master Profile Società (§11, screen
 * 01).
 *
 * «Inserisci il blocco contestuale con accesso Richiedi conferma del ruolo,
 * separato dalle azioni Segui/Contatta. È la dichiarazione di un rapporto
 * già esistente nella realtà, non una ricerca di un posto in squadra.»
 *
 * Lo stato arriva da una lettura **privata** dell'actor: §11 — «Gli stati
 * privati del richiedente non entrano nel payload pubblico cacheabile della
 * società». Il Master Profile resta quindi quello che era, cacheabile per
 * tutti.
 *
 * Durante il caricamento mostra uno skeleton locale e **nessuna** CTA: §11 —
 * «non mostrare per un istante una CTA sicuramente non valida».
 */
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { colors, radius, sizes, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { STALE_MS } from "../../dashboard/cache/freshness-policy";
import { trackRoleLinkEvent } from "../role-link-analytics";
import { ROLE_LINK_QK } from "../role-link-keys";
import { ROLE_LINK_COPY } from "../role-link-presentation";
import { ROLE_LINK_HREFS } from "../role-link-routes";
import { fetchRoleLinkBlock } from "../role-link-service";

export function SocietyRoleLinkBlock({ clubId }: { clubId: string }) {
  const router = useRouter();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";

  const blockQuery = useQuery({
    enabled: !!actorId && !!clubId,
    queryFn: () => fetchRoleLinkBlock(clubId),
    queryKey: ROLE_LINK_QK.block(actorId, clubId),
    /* Uno stato relazionale privato invecchia in fretta: una richiesta
       inviata da un altro dispositivo deve comparire qui (§44). */
    staleTime: STALE_MS.operational,
  });

  const block = blockQuery.data ?? null;

  useEffect(() => {
    if (blockQuery.isSuccess && block && block.state !== "ineligible") {
      trackRoleLinkEvent("role_link_block_viewed", { state: block.state });
    }
  }, [block, blockQuery.isSuccess]);

  if (!actorId) return null;

  if (blockQuery.isLoading) {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.block}
        testID="role-link-block-skeleton"
      >
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, styles.skeletonShort]} />
      </View>
    );
  }

  /*
   * §11: «I profili non compatibili o un actor organizzativo non ricevono un
   * form con PERSON inventata.» Un errore di rete non è uno stato: senza
   * dati il blocco non compare, e il resto del profilo resta leggibile.
   */
  if (!block || block.state === "ineligible") return null;

  if (block.state === "active") {
    return (
      <Row
        caption={block.activeSummary}
        label={ROLE_LINK_COPY.blockManage}
        onPress={() =>
          router.push(ROLE_LINK_HREFS.society(clubId, { from: "club" }) as never)
        }
        testID="role-link-block-manage"
        title={ROLE_LINK_COPY.blockTitle}
      />
    );
  }

  if (block.state === "pending" && block.requestId) {
    return (
      <Row
        caption={[block.requestRoleLabel, block.requestContext]
          .filter(Boolean)
          .join(" · ")}
        label={ROLE_LINK_COPY.blockPending}
        onPress={() =>
          router.push(
            ROLE_LINK_HREFS.myRequest(block.requestId as string, {
              from: "club",
            }) as never,
          )
        }
        testID="role-link-block-pending"
        title={ROLE_LINK_COPY.blockTitle}
      />
    );
  }

  if (block.state === "pending_many") {
    return (
      <Row
        caption={null}
        label={ROLE_LINK_COPY.blockPendingMany(block.pendingCount)}
        onPress={() =>
          router.push(ROLE_LINK_HREFS.myClubRequests(clubId) as never)
        }
        testID="role-link-block-pending-many"
        title={ROLE_LINK_COPY.blockTitle}
      />
    );
  }

  return (
    <Row
      caption={null}
      label={ROLE_LINK_COPY.blockAction}
      onPress={() =>
        router.push(ROLE_LINK_HREFS.requestForm(clubId, { from: "club" }) as never)
      }
      testID="role-link-block-request"
      title={ROLE_LINK_COPY.blockTitle}
    />
  );
}

function Row({
  caption,
  label,
  onPress,
  testID,
  title,
}: {
  caption: string | null;
  label: string;
  onPress: () => void;
  testID: string;
  title: string;
}) {
  return (
    <View style={styles.block}>
      <AppText color="neutralMuted" variant="meta">
        {title}
      </AppText>

      <Pressable
        accessibilityLabel={[label, caption].filter(Boolean).join(", ")}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
        testID={testID}
      >
        <View style={styles.body}>
          <AppText color="accent" variant="actionLabel">
            {label}
          </AppText>

          {caption ? (
            <AppText color="neutralMuted" variant="meta">
              {caption}
            </AppText>
          ) : null}
        </View>

        <Ionicons color={colors.accent} name="chevron-forward" size={16} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing[4],
    marginBottom: spacing[16],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  skeletonLine: {
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius[4],
    height: 12,
    width: "60%",
  },
  skeletonShort: {
    width: "40%",
  },
  pressed: {
    opacity: 0.6,
  },
});
