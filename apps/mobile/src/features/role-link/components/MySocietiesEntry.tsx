import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { colors, radius, sizes, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { STALE_MS } from "../../dashboard/cache/freshness-policy";
import { ROLE_LINK_QK } from "../role-link-keys";
import { ROLE_LINK_COPY } from "../role-link-presentation";
import { ROLE_LINK_HREFS } from "../role-link-routes";
import { fetchMySocieties } from "../role-link-service";

/** Le quattro categorie strutturali di §9, e nessun'altra. */
const STRUCTURAL_ROLES = ["player", "coach", "staff", "director"] as const;

/**
 * Accesso owner a «Società e ruoli» dal proprio Profilo (§26, screen 13).
 *
 * «Riutilizza/inserisci l'accesso owner Società e ruoli nel proprio Profilo,
 * con lo stesso percorso per Calciatore, Allenatore, Staff e Dirigente. Non
 * obbligare a ritrovare la società in Cerca per gestire un rapporto
 * attivo.»
 *
 * Il sommario è un conteggio reale, non una label fissa: senza società
 * collegate la riga resta e porta all'empty, che §26 vuole «reale» e con una
 * guida al collegamento. Resta invece nascosta per Tifoso, Media/Creator e
 * Procuratore, che non hanno incarichi strutturali.
 */
export function MySocietiesEntry({ role }: { role: string | null }) {
  const router = useRouter();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const isStructural = (STRUCTURAL_ROLES as readonly string[]).includes(
    role ?? "",
  );

  const societiesQuery = useQuery({
    enabled: !!actorId && isStructural,
    queryFn: fetchMySocieties,
    queryKey: ROLE_LINK_QK.mySocieties(actorId),
    staleTime: STALE_MS.management,
  });

  if (!isStructural || !actorId) return null;

  const societies = societiesQuery.data ?? [];
  const roles = societies.reduce((total, item) => total + item.activeCount, 0);

  /* Un conteggio non ancora noto non diventa zero (§45). */
  const summary = societiesQuery.isSuccess
    ? societies.length === 0
      ? ROLE_LINK_COPY.societiesEmpty
      : `${societies.length} ${societies.length === 1 ? "società" : "società"} · ${roles} ${roles === 1 ? "ruolo attivo" : "ruoli attivi"}`
    : null;

  return (
    <Pressable
      accessibilityLabel={[ROLE_LINK_COPY.societiesTitle, summary]
        .filter(Boolean)
        .join(", ")}
      accessibilityRole="button"
      onPress={() => router.push(ROLE_LINK_HREFS.societies as never)}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      testID="profile-societies-entry"
    >
      <Ionicons color={colors.textNeutral} name="shield-outline" size={20} />

      <View style={styles.body}>
        <AppText color="neutral" variant="bodyLg">
          {ROLE_LINK_COPY.societiesTitle}
        </AppText>

        {summary ? (
          <AppText color="neutralMuted" variant="meta">
            {summary}
          </AppText>
        ) : null}
      </View>

      <Ionicons color={colors.textNeutralSoft} name="chevron-forward" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    marginHorizontal: spacing[20],
    marginTop: spacing[16],
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  pressed: {
    opacity: 0.6,
  },
});
