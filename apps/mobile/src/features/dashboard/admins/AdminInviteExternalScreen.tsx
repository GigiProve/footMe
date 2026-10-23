/**
 * Invita su PROLINK (DAS-REV-13, screen 05) e ricondivisione (§12).
 *
 * Una schermata, due stati:
 *
 *   · **nuova proposta** — email, ruolo, ambito, "Condividi invito". Il link
 *     si apre **solo dopo** che il backend ha validato e creato l'invito:
 *     §12 vuole «solo dopo il successo apri il native share del dispositivo».
 *   · **ricondivisione** — destinatario, ruolo e ambito in sola lettura, CTA
 *     invariata. «Non lasciare selector apparentemente modificabili che poi
 *     cambiano o ignorano silenziosamente la proposta.»
 *
 * «Se l'utente annulla il native share, l'invito già creato resta pending e
 * ricondivisibile. Non cancellarlo silenziosamente e non definirlo
 * consegnato»: lo stato mostrato è **Link pronto**, mai "inviato".
 */
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button, ConfirmModal, Input } from "../../../ui";
import { useToast } from "../../../ui/Toast/ToastProvider";
import { useSession } from "../../auth/use-session";
import { NetworkNavBar } from "../../network/components/NetworkNavBar";
import { STALE_MS } from "../cache/freshness-policy";
import { DashboardGlobalEmpty } from "../components/DashboardStates";
import { SocietyIdentityHeader } from "../components/SocietyIdentityHeader";
import { useDashboardIdentity } from "../identity/use-dashboard-identity";
import { AdminInviteFields } from "./components/AdminInviteFields";
import { ADMINS_QK } from "./admins-keys";
import { trackAdminEvent } from "./admins-analytics";
import {
  ADMIN_COPY,
  describeAdminError,
  shareMessage,
  validateDraft,
} from "./admins-presentation";
import {
  buildAdminInviteUrl,
  copyAdminInviteLink,
  newAdminOperationKey,
  shareAdminInvite,
} from "./admin-invite-link";
import {
  createAdminInvite,
  fetchAdminCenter,
  fetchAssignableRoles,
  fetchAssignableTeams,
  fetchAdminInvites,
  reshareAdminInvite,
  toAdminError,
} from "./admins-service";
import type { AdminScopeMode } from "./admins-types";

export function AdminInviteExternalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const params = useLocalSearchParams<{ inviteId?: string }>();
  const existingInviteId =
    typeof params.inviteId === "string" ? params.inviteId : null;
  const isReshare = existingInviteId !== null;

  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<string | null>(null);
  const [scopeMode, setScopeMode] = useState<AdminScopeMode>("society");
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  /**
   * §12: «In caso di ritorno dal native share, conserva lo stesso form e
   * invite_id. Il back può tornare al centro: non ripresentare un form nuovo
   * che genera un duplicato.»
   */
  const [created, setCreated] = useState<{ id: string; link: string } | null>(
    null,
  );

  /**
   * §19: la chiave segue la proposta — destinatario, ruolo e ambito. Un
   * retry della stessa proposta la riusa; una proposta diversa è «una nuova
   * operazione da confermare».
   */
  const proposalKey = `${email.trim().toLowerCase()}|${roleId ?? ""}|${scopeMode}|${[...teamIds].sort().join(",")}`;
  const operationKey = useMemo(
    () => newAdminOperationKey(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [proposalKey],
  );

  const centerQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchAdminCenter(clubId as string),
    queryKey: ADMINS_QK.center(actorId, clubId ?? ""),
    staleTime: STALE_MS.operational,
  });

  const rolesQuery = useQuery({
    enabled: !!clubId && !!actorId && !isReshare,
    queryFn: () => fetchAssignableRoles(clubId as string),
    queryKey: ADMINS_QK.roles(actorId, clubId ?? ""),
    staleTime: STALE_MS.management,
  });

  const teamsQuery = useQuery({
    enabled: !!clubId && !!actorId && !isReshare,
    queryFn: () => fetchAssignableTeams(clubId as string),
    queryKey: ADMINS_QK.teams(actorId, clubId ?? ""),
    staleTime: STALE_MS.management,
  });

  /** La proposta da ricondividere si rilegge dal dominio, non dalla route. */
  const invitesQuery = useQuery({
    enabled: !!clubId && !!actorId && isReshare,
    queryFn: () => fetchAdminInvites({ clubId: clubId as string }),
    queryKey: ADMINS_QK.invites(actorId, clubId ?? ""),
    staleTime: STALE_MS.operational,
  });

  const existing =
    invitesQuery.data?.rows.find((row) => row.inviteId === existingInviteId) ??
    null;

  const center = centerQuery.data ?? null;

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ADMINS_QK.invites(actorId, clubId ?? ""),
    });
    void queryClient.invalidateQueries({
      queryKey: ADMINS_QK.center(actorId, clubId ?? ""),
    });
  }, [actorId, clubId, queryClient]);

  /**
   * Apertura del canale. Il valore restituito descrive la **sheet**, non la
   * consegna (§12, §32): un `dismissed` non revoca nulla e non promette
   * niente.
   */
  const openShare = useCallback(
    async (link: string) => {
      const message = shareMessage({
        clubName: center?.clubName ?? "La società",
        link,
      });

      const outcome = await shareAdminInvite(message);

      trackAdminEvent("admin_invite_share_opened", { outcome });

      if (outcome === "unavailable") {
        /* §12: «Se il dispositivo non supporta il native share, offri "Copia
           link" attraverso il fallback standard, senza fingere l'invio.» */
        const copied = await copyAdminInviteLink(link);

        trackAdminEvent("admin_invite_link_copied", { outcome: copied });
        showToast({
          message: copied ? "Link copiato" : "Link pronto",
          tone: copied ? "success" : "neutral",
        });

        return;
      }

      showToast({ message: "Link pronto", tone: "neutral" });
    },
    [center?.clubName, showToast],
  );

  const create = useMutation({
    mutationFn: () =>
      createAdminInvite({
        clubId: clubId as string,
        email,
        idempotencyKey: operationKey,
        roleId: roleId as string,
        scopeMode,
        teamIds,
      }),
    onError: (raw) => {
      const parsed = toAdminError(raw);
      setError(describeAdminError(parsed.code));
      trackAdminEvent("admin_invite_result", {
        error_code: parsed.code,
        outcome: "error",
        path: "external",
      });
    },
    onSuccess: async (invite) => {
      trackAdminEvent("admin_invite_link_created", { scope: scopeMode });
      invalidate();

      if (!invite.token) {
        /* Il server non ha restituito un handle: l'invito esiste comunque e
           la riga nel centro lo mostrerà. Non si inventa un link. */
        setError(describeAdminError("UNKNOWN"));

        return;
      }

      const link = buildAdminInviteUrl(invite.token);
      setCreated({ id: invite.inviteId, link });

      await openShare(link);
    },
  });

  const reshare = useMutation({
    mutationFn: () =>
      reshareAdminInvite({
        clubId: clubId as string,
        inviteId: existingInviteId as string,
      }),
    onError: (raw) => {
      const parsed = toAdminError(raw);
      setError(describeAdminError(parsed.code));
    },
    onSuccess: async (invite) => {
      const link = buildAdminInviteUrl(invite.token);
      setCreated({ id: invite.inviteId, link });

      await openShare(link);
    },
  });

  const isPending = create.isPending || reshare.isPending;
  const hasDraft = email.trim().length > 0 || roleId !== null;

  const goBack = useCallback(() => {
    /* §24: «Dopo una creazione confermata, chiudere il form o annullare lo
       share non revoca l'invito»: niente conferma di uscita, e nessuna copy
       che prometta una cancellazione. */
    if (!isReshare && !created && hasDraft && !isPending) {
      setConfirmExit(true);

      return;
    }

    router.back();
  }, [created, hasDraft, isPending, isReshare, router]);

  if (!clubId) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <DashboardGlobalEmpty
          copy={{
            actionLabel: "Torna alla Dashboard",
            body: "Seleziona la società da amministrare.",
            icon: "business-outline",
            title: "Nessuna società selezionata",
          }}
          onAction={() => router.replace("/(tabs)/dashboard" as never)}
        />
      </View>
    );
  }

  const validation = isReshare
    ? null
    : validateDraft({ email, isExternal: true, roleId, scopeMode, teamIds });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>
        <NetworkNavBar onBack={goBack} title={ADMIN_COPY.externalTitle} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing[32] + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        testID="admin-external-scroll"
      >
        {center ? (
          <SocietyIdentityHeader
            isVerified={center.clubIsVerified}
            logoUrl={center.clubLogoUrl}
            name={center.clubName}
          />
        ) : null}

        <View style={styles.section}>
          <AppText color="neutralMuted" variant="meta">
            {ADMIN_COPY.emailLabel}
          </AppText>

          {isReshare ? (
            <AppText color="neutral" variant="bodyLg">
              {existing?.emailDisplay ?? "Destinatario"}
            </AppText>
          ) : (
            <Input
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={(value) => {
                setEmail(value);
                setError(null);
              }}
              placeholder="nome@esempio.it"
              testID="admin-external-email"
              value={email}
            />
          )}
        </View>

        <AdminInviteFields
          onRoleChange={(value) => {
            setRoleId(value);
            setError(null);
            trackAdminEvent("admin_invite_role_selected");
          }}
          onScopeModeChange={(mode) => {
            setScopeMode(mode);
            setError(null);
            trackAdminEvent("admin_invite_scope_selected", { scope: mode });
          }}
          onTeamsChange={setTeamIds}
          readOnly={isReshare}
          readOnlyLabels={{
            role: existing?.roleLabel ?? null,
            scope: existing?.scopeLabel ?? null,
          }}
          roleId={roleId}
          roles={rolesQuery.data ?? []}
          scopeMode={scopeMode}
          teamIds={teamIds}
          teams={teamsQuery.data ?? []}
        />

        <AppText color="neutralSoft" variant="bodySm">
          {ADMIN_COPY.shareBody}
        </AppText>

        {error ? (
          <AppText accessibilityRole="alert" color="danger" variant="bodySm">
            {error}
          </AppText>
        ) : null}

        <AppText color="neutralMuted" variant="meta">
          {ADMIN_COPY.shareHint}
        </AppText>

        <Button
          disabled={validation !== null || isPending}
          fullWidth
          label={ADMIN_COPY.shareCta}
          loading={isPending}
          onPress={() => {
            if (isReshare) {
              reshare.mutate();

              return;
            }

            /* §12: una seconda condivisione della stessa proposta riusa
               l'invito già creato invece di crearne un altro. */
            if (created) {
              void openShare(created.link);

              return;
            }

            const message = validateDraft({
              email,
              isExternal: true,
              roleId,
              scopeMode,
              teamIds,
            });

            if (message) {
              setError(message);

              return;
            }

            setError(null);
            trackAdminEvent("admin_invite_submitted", { path: "external" });
            create.mutate();
          }}
          size="lg"
          testID="admin-external-submit"
          variant="primary"
        />

        {created ? (
          <Button
            fullWidth
            label="Copia link"
            onPress={() => {
              void copyAdminInviteLink(created.link).then((copied) => {
                trackAdminEvent("admin_invite_link_copied", {
                  outcome: copied,
                });
                showToast({
                  message: copied ? "Link copiato" : "Link pronto",
                  tone: copied ? "success" : "neutral",
                });
              });
            }}
            size="md"
            testID="admin-external-copy"
            variant="neutralOutline"
          />
        ) : null}
      </ScrollView>

      <ConfirmModal
        cancelLabel={ADMIN_COPY.exitKeep}
        confirmLabel={ADMIN_COPY.exitLeave}
        message={ADMIN_COPY.exitBody}
        onCancel={() => setConfirmExit(false)}
        onConfirm={() => {
          setConfirmExit(false);
          trackAdminEvent("admin_unsaved_exit", { path: "external" });
          router.back();
        }}
        title={ADMIN_COPY.exitTitle}
        visible={confirmExit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  navWrap: {
    paddingHorizontal: spacing[20],
  },
  content: {
    gap: spacing[16],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  section: {
    gap: spacing[6],
  },
});
