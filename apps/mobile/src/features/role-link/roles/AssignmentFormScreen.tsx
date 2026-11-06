/**
 * Form condiviso di modifica e aggiunta (§29, §30, §31 — screen 16 e 17).
 *
 * «Utilizza un unico modello di configurazione, con modalità e permessi
 * espliciti, condiviso fra persona e società.» Quattro combinazioni —
 * modifica/aggiunta × persona/società — e una sola schermata: cambiano il
 * titolo, l'helper, la CTA e il destinatario della notifica, non la forma.
 *
 * «Salva/Aggiungi eseguono direttamente la mutation valida. Nessun nuovo
 * invito, richiesta di approvazione, stato In attesa o secondo popup per una
 * modifica ordinaria.»
 */
import { useEffect, useMemo, useState } from "react";
import { StyleSheet } from "react-native";
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
import {
  RoleAssignmentFields,
  hasFieldErrors,
  validateRoleFields,
  type RoleFieldsErrors,
  type RoleFieldsValue,
} from "../components/RoleAssignmentFields";
import { RoleLinkScaffold } from "../components/RoleLinkScaffold";
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
  firstName,
  roleLinkErrorMessage,
} from "../role-link-presentation";
import {
  addAssignment,
  fetchMyAssignment,
  fetchRoleCatalog,
  fetchRoleLinkBlock,
  fetchRoleTeams,
  fetchSocietyAssignment,
  fetchSocietyPersonLink,
  toRoleLinkError,
  updateAssignment,
} from "../role-link-service";
import { useRoleLinkExitGuard } from "../use-role-link-exit-guard";

type Props = {
  /** Modifica: l'incarico da far evolvere. */
  assignmentId?: string | null;
  /** Aggiunta: la società in cui aprire una nuova linea. */
  clubId?: string | null;
  mode: "add" | "edit";
  /** Aggiunta lato Società: la persona. Assente = aggiunta personale (§8). */
  profileId?: string | null;
};

export function AssignmentFormScreen({
  assignmentId,
  clubId,
  mode,
  profileId,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  /* Il lato è dedotto dal contesto d'ingresso, e il server lo ri-deduce
     dalla sessione: §8 — il client non lo dichiara. */
  const isSocietyActor = !!profileId;
  const [nonce] = useState(newRoleLinkNonce);
  const [errors, setErrors] = useState<RoleFieldsErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [draft, setDraft] = useState<RoleFieldsValue | null>(null);

  const personalDetailQuery = useQuery({
    enabled: mode === "edit" && !isSocietyActor && !!assignmentId && !!actorId,
    queryFn: () => fetchMyAssignment(assignmentId as string),
    queryKey: ROLE_LINK_QK.myAssignment(actorId, assignmentId ?? ""),
    staleTime: STALE_MS.operational,
  });

  const societyDetailQuery = useQuery({
    enabled: mode === "edit" && isSocietyActor && !!assignmentId && !!actorId,
    queryFn: () => fetchSocietyAssignment(assignmentId as string),
    queryKey: ROLE_LINK_QK.societyAssignment(actorId, assignmentId ?? ""),
    staleTime: STALE_MS.operational,
  });

  const detail = personalDetailQuery.data ?? societyDetailQuery.data ?? null;
  const resolvedClubId = clubId ?? detail?.clubId ?? "";

  const personLinkQuery = useQuery({
    enabled: mode === "add" && isSocietyActor && !!resolvedClubId && !!profileId,
    queryFn: () =>
      fetchSocietyPersonLink(resolvedClubId, profileId as string),
    queryKey: ROLE_LINK_QK.societyPerson(
      actorId,
      resolvedClubId,
      profileId ?? "",
    ),
    staleTime: STALE_MS.operational,
  });

  /*
   * Aggiunta personale: non esiste né un incarico da cui leggere il club né
   * un rapporto gestionale. L'identità arriva dalla stessa lettura privata
   * che serve il blocco contestuale — §12 chiede «il nome reale
   * parametrico», e passarlo per route sarebbe una copia del dato
   * visualizzato (§6).
   */
  const clubQuery = useQuery({
    enabled: mode === "add" && !isSocietyActor && !!resolvedClubId && !!actorId,
    queryFn: () => fetchRoleLinkBlock(resolvedClubId),
    queryKey: ROLE_LINK_QK.block(actorId, resolvedClubId),
    staleTime: STALE_MS.operational,
  });

  const catalogQuery = useQuery({
    enabled: !!actorId,
    queryFn: fetchRoleCatalog,
    queryKey: ROLE_LINK_QK.catalog(actorId),
    staleTime: STALE_MS.presentation,
  });

  const teamsQuery = useQuery({
    enabled: !!actorId && !!resolvedClubId,
    queryFn: () => fetchRoleTeams(resolvedClubId),
    queryKey: ROLE_LINK_QK.teams(actorId, resolvedClubId),
    staleTime: STALE_MS.management,
  });

  const catalog = catalogQuery.data ?? null;
  const teams = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data]);

  /*
   * §29: «tipo/ruolo/ambito/Team correnti precompilati». Il valore iniziale
   * è **derivato** dalla lettura, non copiato in stato da un effetto: lo
   * stato contiene soltanto ciò che la persona ha cambiato, e questo rende
   * `isDirty` una differenza reale invece di un confronto con una copia
   * che potrebbe essere invecchiata.
   */
  const initial = useMemo<RoleFieldsValue | null>(() => {
    if (mode === "add") {
      return {
        customRole: "",
        profileType: null,
        roleId: null,
        scopeType: "team",
        teamId: null,
      };
    }

    if (!detail) return null;

    return {
      customRole: detail.customRoleName ?? "",
      profileType: detail.profileType,
      roleId: detail.roleId,
      scopeType: detail.scopeType,
      teamId: detail.teamId,
    };
  }, [detail, mode]);

  const value = draft ?? initial;

  useEffect(() => {
    trackRoleLinkEvent("role_link_assignment_form_opened", {
      actor_type: isSocietyActor ? "society" : "person",
      operation: mode,
    });
  }, [isSocietyActor, mode]);

  const isDirty =
    !!value &&
    !!initial &&
    (value.profileType !== initial.profileType ||
      value.roleId !== initial.roleId ||
      value.scopeType !== initial.scopeType ||
      value.teamId !== initial.teamId ||
      value.customRole.trim() !== initial.customRole.trim());

  const onBack = useRoleLinkExitGuard({
    fallbackHref: resolvedClubId
      ? `/profile/societies/${resolvedClubId}`
      : "/profile/societies",
    isDirty,
  });

  const save = useMutation({
    mutationFn: () => {
      if (!value?.profileType || !value.roleId) {
        throw new Error("ASSIGNMENT_ROLE_INVALID");
      }

      const role = catalog?.roles.find((item) => item.roleId === value.roleId);
      const custom = role?.isCustom ? value.customRole : null;

      if (mode === "edit") {
        if (!detail) throw new Error("ASSIGNMENT_NOT_FOUND");

        return updateAssignment({
          assignmentId: detail.assignmentId,
          customRole: custom,
          expectedRevision: detail.revision,
          operationKey: roleLinkOperationKey(
            nonce,
            [
              "edit",
              detail.assignmentId,
              detail.revision,
              value.profileType,
              value.roleId,
              (custom ?? "").trim().toLowerCase(),
              value.scopeType,
              value.teamId ?? "",
            ].join("|"),
          ),
          profileType: value.profileType,
          roleId: value.roleId,
          scopeType: value.scopeType,
          teamId: value.teamId,
        });
      }

      return addAssignment({
        clubId: resolvedClubId,
        customRole: custom,
        operationKey: roleLinkOperationKey(
          nonce,
          [
            "add",
            resolvedClubId,
            profileId ?? "self",
            value.profileType,
            value.roleId,
            (custom ?? "").trim().toLowerCase(),
            value.scopeType,
            value.teamId ?? "",
          ].join("|"),
        ),
        profileId: profileId ?? null,
        profileType: value.profileType,
        roleId: value.roleId,
        scopeType: value.scopeType,
        teamId: value.teamId,
      });
    },
    onError: (raw) => {
      const error = toRoleLinkError(raw);

      trackRoleLinkEvent(
        mode === "edit"
          ? "role_link_assignment_save_result"
          : "role_link_assignment_add_result",
        { outcome: "error", reason: error.code },
      );
      setFailure(
        error.code === "UNKNOWN"
          ? ROLE_LINK_FAILURES.save
          : roleLinkErrorMessage(error.code),
      );

      /* §30: «Versioni obsolete producono un conflitto controllato … Mantieni
         il draft separato dai dati server e permetti una revisione.» Il
         draft resta, la lettura si aggiorna. */
      if (
        error.code === "ASSIGNMENT_REVISION_CONFLICT" ||
        error.code === "ASSIGNMENT_NOT_ACTIVE"
      ) {
        void personalDetailQuery.refetch();
        void societyDetailQuery.refetch();
      }
    },
    onSuccess: (result) => {
      trackRoleLinkEvent(
        mode === "edit"
          ? "role_link_assignment_save_result"
          : "role_link_assignment_add_result",
        { outcome: result.changed ? "changed" : "unchanged" },
      );

      for (const prefix of [
        ...ROLE_LINK_QK_PREFIXES,
        ...ROLE_LINK_RELATED_PREFIXES,
      ]) {
        void queryClient.invalidateQueries({ queryKey: [prefix] });
      }

      /* §30: «Salvataggio senza modifiche semantiche: restituisci lo stato
         corrente senza creare un segmento, notifiche o audit di cambiamento
         fittizi.» E senza annunciare un aggiornamento che non è avvenuto. */
      if (result.changed) {
        showToast({
          message:
            mode === "edit"
              ? ROLE_LINK_COPY.roleUpdated
              : ROLE_LINK_COPY.roleAdded,
          tone: "success",
        });
      }

      if (router.canGoBack()) {
        router.back();

        return;
      }

      router.replace(`/profile/societies/${resolvedClubId}` as never);
    },
  });

  const isLoading =
    catalogQuery.isLoading ||
    teamsQuery.isLoading ||
    personalDetailQuery.isLoading ||
    societyDetailQuery.isLoading ||
    personLinkQuery.isLoading ||
    clubQuery.isLoading ||
    !value;

  const title =
    mode === "edit"
      ? ROLE_LINK_COPY.editTitle
      : isSocietyActor
        ? ROLE_LINK_COPY.addTitleSociety
        : ROLE_LINK_COPY.addTitle;

  if (isLoading) {
    return (
      <RoleLinkScaffold onBack={onBack} title={title}>
        <DashboardSkeleton />
      </RoleLinkScaffold>
    );
  }

  if (mode === "edit" && !detail) {
    return (
      <RoleLinkScaffold onBack={onBack} title={title}>
        <DashboardGlobalError
          body={ROLE_LINK_FAILURES.load}
          onRetry={() => {
            void personalDetailQuery.refetch();
            void societyDetailQuery.refetch();
          }}
          title="Incarico non disponibile"
        />
      </RoleLinkScaffold>
    );
  }

  const clubName =
    detail?.clubName ??
    personLinkQuery.data?.clubName ??
    clubQuery.data?.clubName ??
    "";
  const personName =
    personLinkQuery.data?.personName ??
    (societyDetailQuery.data?.personName ?? "");

  const helper =
    mode === "add"
      ? ROLE_LINK_COPY.addHelper
      : isSocietyActor
        ? ROLE_LINK_COPY.editHelperSociety(firstName(personName) || "La persona")
        : ROLE_LINK_COPY.editHelperPerson(clubName);

  return (
    <RoleLinkScaffold
      footer={
        <Button
          fullWidth
          label={
            mode === "edit"
              ? ROLE_LINK_COPY.saveChanges
              : ROLE_LINK_COPY.addSubmit
          }
          loading={save.isPending}
          onPress={() => {
            if (!value) return;

            const next = validateRoleFields(value, catalog);

            setErrors(next);
            setFailure(null);

            if (hasFieldErrors(next)) return;

            save.mutate();
          }}
          size="lg"
          testID="role-link-form-submit"
          variant="primary"
        />
      }
      onBack={onBack}
      subheader={
        <ClubIdentityRow
          city={null}
          isVerified={
            detail?.clubIsVerified ?? clubQuery.data?.clubIsVerified ?? false
          }
          logoUrl={
            detail?.clubLogoUrl ??
            personLinkQuery.data?.clubLogoUrl ??
            clubQuery.data?.clubLogoUrl ??
            null
          }
          name={clubName}
        />
      }
      testID="role-link-assignment-form"
      title={title}
    >
      {/* Lato Società l'aggiunta nomina la persona nel contesto (§29). */}
      {isSocietyActor && personName ? (
        <AppText color="neutralMuted" style={styles.context} variant="meta">
          {personName}
        </AppText>
      ) : null}

      {value ? (
        <RoleAssignmentFields
          catalog={catalog}
          errors={errors}
          mode="manage"
          onChange={setDraft}
          teams={teams}
          value={value}
        />
      ) : null}

      <AppText color="neutralMuted" style={styles.helper} variant="meta">
        {helper}
      </AppText>

      {failure ? (
        <AppText
          accessibilityRole="alert"
          color="danger"
          style={styles.helper}
          variant="meta"
        >
          {failure}
        </AppText>
      ) : null}
    </RoleLinkScaffold>
  );
}

const styles = StyleSheet.create({
  context: {
    paddingBottom: spacing[8],
  },
  helper: {
    paddingTop: spacing[16],
  },
});
