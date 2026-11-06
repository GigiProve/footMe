/**
 * Il rapporto con una società, lato persona (§27, §36 — screen 14, 18, 20).
 *
 * «Contesto AC Como, heading I tuoi ruoli, una riga per incarico attivo.»
 * Lo screen 14 ne ha due e lo screen 18 tre: è la stessa schermata, e «3
 * ruoli attivi deve derivare dai dati reali, non essere una label statica».
 *
 * Due livelli di azione, distinti come §27 chiede: le righe aprono il
 * singolo incarico, mentre «+ Aggiungi un altro ruolo» e, in fondo e
 * separata, «Scollegati dalla società» agiscono sul rapporto.
 */
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { spacing } from "../../../theme/tokens";
import { AppText, Button, useToast } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { STALE_MS } from "../../dashboard/cache/freshness-policy";
import {
  DashboardGlobalError,
  DashboardSkeleton,
} from "../../dashboard/components/DashboardStates";
import { ClubIdentityRow } from "../components/ClubIdentityRow";
import { RoleConfirmSheet } from "../components/RoleConfirmSheet";
import { RoleLinkScaffold } from "../components/RoleLinkScaffold";
import { RoleListRow } from "../components/RoleListRow";
import { newRoleLinkNonce, roleLinkOperationKey } from "../operation-key";
import { trackRoleLinkEvent } from "../role-link-analytics";
import {
  ROLE_LINK_QK,
  ROLE_LINK_QK_PREFIXES,
  ROLE_LINK_RELATED_PREFIXES,
} from "../role-link-keys";
import {
  ROLE_LINK_COPY,
  ROLE_LINK_FAILURES,
  roleLinkErrorMessage,
} from "../role-link-presentation";
import { ROLE_LINK_HREFS } from "../role-link-routes";
import {
  fetchMySocietyLink,
  leaveSociety,
  toRoleLinkError,
} from "../role-link-service";

export function SocietyRolesScreen({ clubId }: { clubId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce] = useState(newRoleLinkNonce);

  const linkQuery = useQuery({
    enabled: !!actorId && !!clubId,
    queryFn: () => fetchMySocietyLink(clubId),
    queryKey: ROLE_LINK_QK.mySocietyLink(actorId, clubId),
    staleTime: STALE_MS.operational,
  });

  const link = linkQuery.data ?? null;

  useEffect(() => {
    if (linkQuery.isSuccess) {
      trackRoleLinkEvent("role_link_society_opened");
    }
  }, [linkQuery.isSuccess]);

  const leave = useMutation({
    mutationFn: () => {
      if (!link) throw new Error("ROLE_LINK_NOT_ACTIVE");

      return leaveSociety({
        clubId,
        /*
         * §36: «Usa una versione aggregata della relazione … Se tra apertura
         * dello sheet e conferma cambia l'insieme dei ruoli, aggiorna il
         * riepilogo e richiedi la conferma sullo stato corrente.» La
         * versione letta con la lista è quella su cui l'utente ha
         * acconsentito.
         */
        expectedRevision: link.aggregateRevision,
        operationKey: roleLinkOperationKey(
          nonce,
          `leave|${clubId}|${link.aggregateRevision}`,
        ),
      });
    },
    onError: (raw) => {
      const failure = toRoleLinkError(raw);

      trackRoleLinkEvent("role_link_terminate_result", {
        outcome: "error",
        reason: failure.code,
      });
      setSheetOpen(false);
      setError(
        failure.code === "UNKNOWN"
          ? ROLE_LINK_FAILURES.terminate
          : roleLinkErrorMessage(failure.code, { club: link?.clubName }),
      );
      void linkQuery.refetch();
    },
    onSuccess: () => {
      trackRoleLinkEvent("role_link_terminate_result", { outcome: "left" });
      setSheetOpen(false);

      for (const prefix of [
        ...ROLE_LINK_QK_PREFIXES,
        ...ROLE_LINK_RELATED_PREFIXES,
      ]) {
        void queryClient.invalidateQueries({ queryKey: [prefix] });
      }

      showToast({ message: ROLE_LINK_COPY.terminatedTitle });
      router.replace(ROLE_LINK_HREFS.societies as never);
    },
  });

  const onBack = () => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace(ROLE_LINK_HREFS.societies as never);
  };

  if (linkQuery.isLoading && !link) {
    return (
      <RoleLinkScaffold onBack={onBack} title={null}>
        <DashboardSkeleton />
      </RoleLinkScaffold>
    );
  }

  if (!link) {
    return (
      <RoleLinkScaffold onBack={onBack} title={null}>
        <DashboardGlobalError
          body={
            linkQuery.isError
              ? ROLE_LINK_FAILURES.load
              : roleLinkErrorMessage("ROLE_LINK_NOT_ACTIVE")
          }
          onRetry={() => void linkQuery.refetch()}
          title="Rapporto non disponibile"
        />
      </RoleLinkScaffold>
    );
  }

  return (
    <View style={styles.root}>
      <RoleLinkScaffold
        onBack={onBack}
        subheader={
          <ClubIdentityRow
            city={link.clubCity}
            isVerified={link.clubIsVerified}
            logoUrl={link.clubLogoUrl}
            name={link.clubName}
          />
        }
        testID="role-link-society-roles"
        title={null}
      >
        <View style={styles.heading}>
          <AppText accessibilityRole="header" color="neutral" variant="titleMd">
            {ROLE_LINK_COPY.rolesHeading}
          </AppText>

          {/* §27: il numero deriva dai dati. */}
          {link.activeCount > 1 ? (
            <AppText color="neutralMuted" testID="role-link-active-count" variant="meta">
              {`${link.activeCount} ruoli attivi`}
            </AppText>
          ) : null}
        </View>

        <View>
          {link.roles.map((role, index) => (
            <RoleListRow
              key={role.assignmentId}
              onPress={() =>
                router.push(
                  ROLE_LINK_HREFS.assignment(role.assignmentId) as never,
                )
              }
              showDivider={index > 0}
              subtitle={role.contextLabel}
              testID={`role-link-role-${role.assignmentId}`}
              title={role.roleLabel}
            />
          ))}
        </View>

        <View style={styles.addRow}>
          <Button
            label={`+ ${ROLE_LINK_COPY.addRole}`}
            onPress={() =>
              router.push(ROLE_LINK_HREFS.assignmentAdd(clubId) as never)
            }
            size="md"
            testID="role-link-add-role"
            variant="link"
          />
        </View>

        {error ? (
          <AppText
            accessibilityRole="alert"
            color="danger"
            style={styles.error}
            variant="meta"
          >
            {error}
          </AppText>
        ) : null}

        {/* §27: «in fondo, separata, Scollegati dalla società». */}
        <View style={styles.leaveRow}>
          <Button
            destructive
            label={ROLE_LINK_COPY.leaveSociety}
            onPress={() => {
              trackRoleLinkEvent("role_link_terminate_confirm_opened", {
                actor_type: "person",
              });
              setSheetOpen(true);
            }}
            size="md"
            testID="role-link-leave"
            variant="link"
          />
        </View>
      </RoleLinkScaffold>

      <RoleConfirmSheet
        body={ROLE_LINK_COPY.leaveSheetBody(link.clubName)}
        cancelLabel={ROLE_LINK_COPY.cancelLabel}
        confirmLabel={ROLE_LINK_COPY.leaveConfirm}
        destructive
        isBusy={leave.isPending}
        note={ROLE_LINK_COPY.leaveSheetKeep}
        onCancel={() => setSheetOpen(false)}
        onConfirm={() => leave.mutate()}
        testID="role-link-leave-sheet"
        title={ROLE_LINK_COPY.leaveSheetTitle(link.clubName)}
        visible={sheetOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  heading: {
    gap: spacing[4],
    paddingBottom: spacing[8],
    paddingTop: spacing[8],
  },
  addRow: {
    alignItems: "flex-start",
    paddingTop: spacing[12],
  },
  leaveRow: {
    alignItems: "flex-start",
    borderTopColor: "transparent",
    paddingTop: spacing[32],
  },
  error: {
    paddingTop: spacing[12],
  },
});
