/**
 * Persone con un incarico societario (§32).
 *
 * «Gli incarichi Dirigente Intera società si raggiungono dall'area societaria
 * appropriata, senza Team fittizio. Se manca l'integrazione minima per
 * raggiungere tali persone, completa la destinazione usando gli stessi
 * componenti e lo stesso dominio.»
 *
 * L'Organico canonico è per squadra: chi ha ambito Intera società non vi
 * compare, e inventargli una squadra sarebbe il bug che §9 vieta. Questa
 * lista è la destinazione mancante — stessa riga, stesso dominio, stessa
 * gestione della persona.
 */
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { colors, spacing } from "../../../theme/tokens";
import { Avatar, EmptyState } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { STALE_MS } from "../../dashboard/cache/freshness-policy";
import {
  DashboardGlobalError,
  DashboardSkeleton,
} from "../../dashboard/components/DashboardStates";
import { SocietyContextHeader } from "../../dashboard/components/SocietyContextHeader";
import { RoleListRow } from "../components/RoleListRow";
import { ROLE_LINK_QK } from "../role-link-keys";
import { ROLE_LINK_FAILURES } from "../role-link-presentation";
import { ROLE_LINK_HREFS } from "../role-link-routes";
import { fetchSocietyWideMembers } from "../role-link-service";

export function SocietyWideMembersScreen({ clubId }: { clubId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";

  const membersQuery = useQuery({
    enabled: !!actorId && !!clubId,
    queryFn: () => fetchSocietyWideMembers(clubId),
    queryKey: ROLE_LINK_QK.societyWide(actorId, clubId),
    staleTime: STALE_MS.management,
  });

  const onBack = () => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace("/(tabs)/dashboard/structure" as never);
  };

  const members = membersQuery.data ?? [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.pad}>
        <SocietyContextHeader
          isVerified={false}
          logoUrl={null}
          name="Ruoli societari"
          onBack={onBack}
        />

        {membersQuery.isLoading ? (
          <DashboardSkeleton />
        ) : membersQuery.isError ? (
          <DashboardGlobalError
            body={ROLE_LINK_FAILURES.load}
            onRetry={() => void membersQuery.refetch()}
            title="Ruoli societari non disponibili"
          />
        ) : members.length === 0 ? (
          <EmptyState
            description="Gli incarichi con ambito Intera società compaiono qui."
            title="Nessun ruolo societario"
          />
        ) : (
          <View>
            {members.map((member, index) => (
              <View
                key={member.profileId}
                style={[styles.row, index > 0 ? styles.divided : null]}
              >
                <Avatar
                  name={member.personName}
                  size="md"
                  uri={member.avatarUrl ?? undefined}
                />

                <View style={styles.rowBody}>
                  <RoleListRow
                    onPress={() =>
                      router.push(
                        ROLE_LINK_HREFS.societyPerson(
                          clubId,
                          member.profileId,
                          { from: "structure" },
                        ) as never,
                      )
                    }
                    showDivider={false}
                    subtitle={member.roleLines.join(" · ")}
                    testID={`society-wide-member-${member.profileId}`}
                    title={member.personName}
                  />
                </View>
              </View>
            ))}

          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  pad: {
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  rowBody: {
    flex: 1,
  },
  divided: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: 0.5,
  },
});
