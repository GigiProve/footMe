/**
 * Percorso autenticato del destinatario di un Link di invito
 * (DAS-REV-20, screen 07-11).
 *
 * Una sola rotta con una macchina a stati interna invece di cinque schermate:
 * la squadra arriva dal link e resta sola lettura (mai un selector "Ambito" o
 * una nuova ricerca della squadra). La categoria è una scelta singola
 * (`Radio`, mai checkbox) perché §12/§14 vietano più incarichi nella stessa
 * conferma. Quando la persona ha una sola categoria o un solo ruolo ammessi,
 * lo step si salta ma il valore resta visibile, prefillato, nella conferma.
 *
 * La conferma (screen 10) è l'unico consenso che crea il collegamento: niente
 * popup di conferma aggiuntivo. La `operationKey`, derivata da un nonce fisso
 * per sessione e dai parametri scelti, rende sicuro un retry dopo una
 * risposta persa, evitando una doppia iscrizione.
 *
 * Gli stati terminali (non disponibile, profilo incompatibile, già collegato,
 * riammissione bloccata, collegamento concluso) non espongono mai il motivo
 * tecnico e non offrono mai un cambio di account o una riapertura
 * dell'onboarding.
 */
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Avatar, Button, Input, Radio } from "../../../../ui";
import { useSession } from "../../../auth/use-session";
import { DashboardSkeleton } from "../../components/DashboardStates";
import { trackJoinLinksEvent } from "../join-links-analytics";
import { JOIN_LINKS_QK } from "../join-links-keys";
import { newJoinSessionNonce, operationKeyOf } from "../operation-key";
import {
  FIELD_ERRORS,
  JOIN_LINKS_COPY,
  alreadyConnectedSentence,
  normalizeCustomRole,
  personCategoryLabel,
  successSentence,
  wrongDataSentence,
  mutationErrorCopy,
} from "../join-links-presentation";
import type {
  JoinContext,
  JoinContextState,
  JoinProfileType,
  JoinRedeemResult,
} from "../join-links-types";
import {
  fetchAssignmentRoles,
  redeemJoinLink,
  resolveJoinContext,
  toJoinLinksError,
} from "../join-links-service";

type AssignmentRole = {
  id: string;
  label: string;
  profileType: JoinProfileType;
  isCustom: boolean;
};

type RolesCatalog = {
  roles: AssignmentRole[];
  customRoleMax: number;
};

type Step = "profile" | "role" | "confirm" | "result";

/** I candidati di ruolo per la categoria scelta (§14/§23): player/coach non
 * hanno uno step di ruolo, staff vede l'intera tassonomia, director vede solo
 * gli id che la Società ha autorizzato sul link. */
function getRoleCandidates(
  type: JoinProfileType,
  context: JoinContext,
  catalog: RolesCatalog,
): AssignmentRole[] {
  if (type === "staff") {
    return catalog.roles.filter((role) => role.profileType === "staff");
  }

  if (type === "director") {
    const allowed = new Set(context.allowedExecutiveRoles);

    return catalog.roles.filter(
      (role) => role.profileType === "director" && allowed.has(role.id),
    );
  }

  return [];
}

function TerminalScreen({
  heading,
  body,
  club,
  ctaLabel,
  onPress,
  testID,
  tone = "exit",
}: {
  heading: string;
  body?: string;
  /** Stemma e nome della Società, quando l'esito la riguarda (§26). */
  club?: { isVerified: boolean; logoUrl: string | null; name: string } | null;
  ctaLabel: string;
  onPress: () => void;
  testID: string;
  tone?: "exit" | "success";
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
      {club ? (
        <View style={styles.terminalClub}>
          <Avatar
            name={club.name}
            size="lg"
            square
            tone="ink"
            uri={club.logoUrl ?? undefined}
          />

          <View style={styles.contextRow}>
            <AppText color="neutral" variant="titleMd">
              {club.name}
            </AppText>

            {club.isVerified ? (
              <Ionicons
                accessibilityLabel="Società verificata"
                color={colors.accent}
                name="checkmark-circle"
                size={16}
              />
            ) : null}
          </View>
        </View>
      ) : null}

      <AppText color="neutral" style={styles.center} variant="headingLg">
        {heading}
      </AppText>

      {body ? (
        <AppText color="neutralMuted" style={styles.center} variant="bodyLg">
          {body}
        </AppText>
      ) : null}

      <Button
        fullWidth
        label={ctaLabel}
        onPress={onPress}
        size="lg"
        style={styles.terminalCta}
        testID={testID}
        variant={tone === "success" ? "primary" : "neutralOutline"}
      />
    </View>
  );
}

export function TeamJoinScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";

  const [step, setStep] = useState<Step>("profile");
  const [profileType, setProfileType] = useState<JoinProfileType | null>(null);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [customRole, setCustomRole] = useState("");
  const [customRoleError, setCustomRoleError] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [result, setResult] = useState<JoinRedeemResult | null>(null);
  const [forcedState, setForcedState] = useState<JoinContextState | null>(
    null,
  );

  const nonceRef = useRef(newJoinSessionNonce());
  const resolvedTrackedRef = useRef(false);

  const contextQuery = useQuery({
    enabled: Boolean(token) && Boolean(actorId),
    queryFn: () => resolveJoinContext(token),
    queryKey: JOIN_LINKS_QK.joinContext(actorId, token),
    staleTime: 0,
  });

  const needsRoles = profileType === "staff" || profileType === "director";

  const rolesQuery = useQuery({
    enabled: Boolean(actorId) && needsRoles,
    queryFn: fetchAssignmentRoles,
    queryKey: JOIN_LINKS_QK.roles(actorId),
  });

  const context = contextQuery.data;
  const effectiveState: JoinContextState | undefined =
    forcedState ?? context?.state;

  useEffect(() => {
    if (!context || resolvedTrackedRef.current) {
      return;
    }

    resolvedTrackedRef.current = true;
    trackJoinLinksEvent("join_context_resolved", { state: context.state });
  }, [context]);

  /* Scelta automatica della categoria quando ce n'è una sola (§14): lo step
     "profile" non viene mai mostrato in quel caso. */
  useEffect(() => {
    if (!context || context.state !== "valid" || profileType) {
      return;
    }

    const only =
      context.eligibleProfileTypes.length === 1
        ? context.eligibleProfileTypes[0]
        : null;

    if (only) {
      setProfileType(only);
      setStep(only === "player" || only === "coach" ? "confirm" : "role");
      setRoleId(only === "player" || only === "coach" ? only : null);
    } else {
      setStep("profile");
    }
  }, [context, profileType]);

  /*
   * Dalla categoria al passo successivo (§14, §21, §23).
   *
   * Player e Coach non hanno uno step di ruolo: il loro ruolo canonico è già
   * noto. Per Staff e Dirigente, se il link ne autorizza uno solo, quello
   * viene confermato direttamente «senza chiedere una scelta ridondante».
   */
  const advanceFromProfile = (type: JoinProfileType) => {
    if (type === "player" || type === "coach") {
      setRoleId(type);
      setStep("confirm");

      return;
    }

    /* Senza catalogo non si può sapere se il ruolo è unico: in quel caso lo
       step di scelta resta, e mostrerà il proprio caricamento. */
    const candidates =
      context && rolesQuery.data
        ? getRoleCandidates(type, context, rolesQuery.data)
        : [];

    if (candidates.length === 1) {
      setRoleId(candidates[0]?.id ?? null);
      setStep("confirm");

      return;
    }

    setStep("role");
  };

  const redeemMutation = useMutation({
    mutationFn: async () => {
      const customRoleValue =
        profileType === "staff" && isCustomRoleSelected
          ? normalizeCustomRole(customRole)
          : profileType === "director" && isCustomRoleSelected
            ? (context?.executiveCustomRoleName ?? null)
            : null;

      const operationKey = operationKeyOf(
        nonceRef.current,
        `${token}|${profileType}|${roleId}|${customRoleValue ?? ""}`,
      );

      return redeemJoinLink({
        token,
        profileType: profileType as JoinProfileType,
        roleId: roleId as string,
        customRole: customRoleValue,
        operationKey,
      });
    },
    onError: (error) => {
      const joinError = toJoinLinksError(error);

      trackJoinLinksEvent("join_consent_result", { outcome: "error" });

      if (joinError.code === "JOIN_LINK_REENTRY_BLOCKED") {
        setForcedState("blocked_removed");

        return;
      }

      if (joinError.code === "JOIN_LINK_CONNECTION_ENDED") {
        setForcedState("blocked_ended");

        return;
      }

      setRedeemError(
        mutationErrorCopy(joinError.code, "redeem", joinError.detail),
      );
    },
    onSuccess: (outcome) => {
      trackJoinLinksEvent("join_consent_result", { outcome: outcome.outcome });
      setResult(outcome);
      setStep("result");
    },
  });

  if (!token || contextQuery.isLoading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <DashboardSkeleton />
      </View>
    );
  }

  if (contextQuery.isError) {
    return (
      <TerminalScreen
        body={JOIN_LINKS_COPY.listError}
        ctaLabel={JOIN_LINKS_COPY.retry}
        heading={JOIN_LINKS_COPY.listError}
        onPress={() => void contextQuery.refetch()}
        testID="join-landing-retry"
      />
    );
  }

  if (!context) {
    return null;
  }

  if (effectiveState === "unavailable") {
    return (
      <TerminalScreen
        body={JOIN_LINKS_COPY.unavailableBody}
        ctaLabel={JOIN_LINKS_COPY.close}
        heading={JOIN_LINKS_COPY.unavailableTitle}
        onPress={() => router.replace("/" as never)}
        testID="join-landing-close"
      />
    );
  }

  if (effectiveState === "incompatible_profile") {
    return (
      <TerminalScreen
        ctaLabel={JOIN_LINKS_COPY.close}
        heading={JOIN_LINKS_COPY.incompatibleTitle}
        onPress={() => router.replace("/" as never)}
        testID="join-landing-close"
      />
    );
  }

  if (effectiveState === "already_connected") {
    return (
      <TerminalScreen
        body={alreadyConnectedSentence({
          clubName: context.clubName ?? "",
          roleLabel: context.currentRoleLabel,
          teamName: context.teamName ?? "",
        })}
        club={{
          isVerified: context.clubIsVerified,
          logoUrl: context.clubLogoUrl,
          name: context.clubName ?? "",
        }}
        ctaLabel={JOIN_LINKS_COPY.goToProfile}
        tone="success"
        heading={JOIN_LINKS_COPY.alreadyCompletedTitle}
        onPress={() => router.replace("/(tabs)/profile" as never)}
        testID="join-result-profile"
      />
    );
  }

  if (effectiveState === "blocked_removed") {
    return (
      <TerminalScreen
        body={JOIN_LINKS_COPY.reentryBody}
        ctaLabel={JOIN_LINKS_COPY.close}
        heading={JOIN_LINKS_COPY.reentryTitle}
        onPress={() => router.replace("/" as never)}
        testID="join-landing-close"
      />
    );
  }

  if (effectiveState === "blocked_ended") {
    return (
      <TerminalScreen
        ctaLabel={JOIN_LINKS_COPY.close}
        heading={JOIN_LINKS_COPY.endedTitle}
        onPress={() => router.replace("/" as never)}
        testID="join-landing-close"
      />
    );
  }

  /* ---------------------------------------------------------------- */
  /* step "result" (screen 11)                                        */
  /* ---------------------------------------------------------------- */
  if (step === "result" && result) {
    if (result.outcome === "already_connected") {
      return (
        <TerminalScreen
          body={alreadyConnectedSentence({
            clubName: context.clubName ?? "",
            roleLabel: result.roleLabel ?? "",
            teamName: context.teamName ?? "",
          })}
          club={{
            isVerified: context.clubIsVerified,
            logoUrl: context.clubLogoUrl,
            name: context.clubName ?? "",
          }}
          ctaLabel={JOIN_LINKS_COPY.goToProfile}
          tone="success"
          heading={JOIN_LINKS_COPY.alreadyCompletedTitle}
          onPress={() => router.replace("/(tabs)/profile" as never)}
          testID="join-result-profile"
        />
      );
    }

    return (
      <TerminalScreen
        body={successSentence({
          clubName: context.clubName ?? "",
          roleLabel: result.roleLabel ?? "",
          teamName: context.teamName ?? "",
        })}
        club={{
          isVerified: context.clubIsVerified,
          logoUrl: context.clubLogoUrl,
          name: context.clubName ?? "",
        }}
        ctaLabel={JOIN_LINKS_COPY.goToProfile}
        tone="success"
        heading={JOIN_LINKS_COPY.completedTitle}
        onPress={() => router.replace("/(tabs)/profile" as never)}
        testID="join-result-profile"
      />
    );
  }

  const eligibleTypes = context.eligibleProfileTypes;
  const roleCandidates =
    profileType && context
      ? getRoleCandidates(profileType, context, rolesQuery.data ?? { roles: [], customRoleMax: 0 })
      : [];

  const selectedRole = roleCandidates.find((role) => role.id === roleId) ?? null;
  const isCustomRoleSelected = Boolean(selectedRole?.isCustom);

  const canGoBackFromConfirm =
    eligibleTypes.length > 1 || roleCandidates.length > 1;

  const roleLabel = (() => {
    if (!profileType) {
      return null;
    }

    if (profileType === "player" || profileType === "coach") {
      return null;
    }

    if (selectedRole?.isCustom) {
      return profileType === "director"
        ? context.executiveCustomRoleName
        : normalizeCustomRole(customRole) || null;
    }

    return selectedRole?.label ?? null;
  })();

  /* ---------------------------------------------------------------- */
  /* step "profile" (screen 07)                                       */
  /* ---------------------------------------------------------------- */
  if (step === "profile") {
    return (
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing[32], paddingBottom: spacing[32] },
        ]}
        style={styles.root}
      >
        <JoinContextBar
          clubName={context.clubName ?? ""}
          isVerified={context.clubIsVerified}
          logoUrl={context.clubLogoUrl}
          teamName={context.teamName ?? ""}
        />

        <AppText color="neutral" variant="headingLg">
          {JOIN_LINKS_COPY.chooseProfileTitle(context.teamName ?? "")}
        </AppText>

        <AppText color="neutralMuted" variant="bodySm">
          {JOIN_LINKS_COPY.chooseProfileHelper}
        </AppText>

        <View style={styles.optionList}>
          {eligibleTypes.map((type) => (
            <Radio
              checked={profileType === type}
              key={type}
              label={personCategoryLabel(type)}
              onPress={() => {
                trackJoinLinksEvent("join_profile_selected", { type });
                setProfileType(type);
              }}
              testID={`join-profile-${type}`}
              tone="neutral"
            />
          ))}
        </View>

        <Button
          disabled={profileType === null}
          fullWidth
          label={JOIN_LINKS_COPY.continueCta}
          onPress={() => {
            if (profileType) {
              advanceFromProfile(profileType);
            }
          }}
          size="lg"
          testID="join-continue"
          variant="primary"
        />
      </ScrollView>
    );
  }

  /* ---------------------------------------------------------------- */
  /* step "role" (screen 08 e 09)                                     */
  /* ---------------------------------------------------------------- */
  if (step === "role" && profileType) {
    if (rolesQuery.isLoading) {
      return (
        <View style={[styles.root, { paddingTop: insets.top }]}>
          <DashboardSkeleton />
        </View>
      );
    }

    const customRoleMax = rolesQuery.data?.customRoleMax ?? 0;

    const onContinue = () => {
      if (!roleId) {
        return;
      }

      if (profileType === "staff" && isCustomRoleSelected) {
        const normalized = normalizeCustomRole(customRole);

        if (!normalized) {
          setCustomRoleError(FIELD_ERRORS.customRole);

          return;
        }

        setCustomRoleError(null);
      }

      trackJoinLinksEvent("join_role_selected", {
        isCustom: isCustomRoleSelected,
      });
      setStep("confirm");
    };

    return (
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing[32], paddingBottom: spacing[32] },
        ]}
        style={styles.root}
      >
        <JoinContextBar
          clubName={context.clubName ?? ""}
          isVerified={context.clubIsVerified}
          logoUrl={context.clubLogoUrl}
          teamName={context.teamName ?? ""}
        />

        <AppText color="neutral" variant="headingLg">
          {JOIN_LINKS_COPY.chooseRoleTitle}
        </AppText>

        <AppText color="neutralMuted" variant="bodySm">
          {JOIN_LINKS_COPY.chooseRoleHelper}
        </AppText>

        <View style={styles.optionList}>
          {roleCandidates.map((role) => {
            const label =
              role.isCustom && profileType === "director"
                ? context.executiveCustomRoleName
                : role.label;

            return (
              <View key={role.id}>
                <Radio
                  checked={roleId === role.id}
                  label={label ?? ""}
                  onPress={() => setRoleId(role.id)}
                  testID={`join-role-${role.id}`}
                  tone="neutral"
                />

                {role.isCustom &&
                profileType === "staff" &&
                roleId === role.id ? (
                  <Input
                    error={Boolean(customRoleError)}
                    helperText={customRoleError ?? undefined}
                    label={JOIN_LINKS_COPY.customRoleField}
                    maxLength={customRoleMax}
                    onChangeText={(value: string) => {
                      setCustomRole(value);
                      setCustomRoleError(null);
                    }}
                    testID="join-custom-role"
                    value={customRole}
                  />
                ) : null}
              </View>
            );
          })}
        </View>

        <Button
          fullWidth
          label={JOIN_LINKS_COPY.continueCta}
          onPress={onContinue}
          size="lg"
          testID="join-continue"
          variant="primary"
        />
      </ScrollView>
    );
  }

  /* ---------------------------------------------------------------- */
  /* step "confirm" (screen 10)                                       */
  /* ---------------------------------------------------------------- */
  if (step === "confirm" && profileType) {
    const onWrongData = () => {
      if (eligibleTypes.length > 1) {
        setProfileType(null);
        setRoleId(null);
        setStep("profile");

        return;
      }

      if (roleCandidates.length > 1) {
        setStep("role");
      }
    };

    return (
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing[32], paddingBottom: spacing[32] },
        ]}
        style={styles.root}
      >
        <JoinContextBar
          clubName={context.clubName ?? ""}
          isVerified={context.clubIsVerified}
          logoUrl={context.clubLogoUrl}
          teamName={context.teamName ?? ""}
        />

        <AppText color="neutral" variant="headingLg">
          {JOIN_LINKS_COPY.confirmTitle}
        </AppText>

        <View style={styles.personRow}>
          <Avatar
            name={context.personName ?? ""}
            size="md"
            uri={context.personAvatarUrl ?? undefined}
          />

          <AppText color="neutral" variant="titleMd">
            {context.personName}
          </AppText>
        </View>

        <View style={styles.summary}>
          <SummaryRow
            label={JOIN_LINKS_COPY.profileField}
            value={personCategoryLabel(profileType)}
          />

          <SummaryRow label={JOIN_LINKS_COPY.societyField} value={context.clubName ?? ""} />

          <SummaryRow label={JOIN_LINKS_COPY.teamField} value={context.teamName ?? ""} />

          {roleLabel ? (
            <SummaryRow label={JOIN_LINKS_COPY.roleField} value={roleLabel} />
          ) : null}
        </View>

        <AppText color="neutralMuted" variant="bodySm">
          {JOIN_LINKS_COPY.confirmSource}
        </AppText>

        {canGoBackFromConfirm ? (
          <Button
            label={JOIN_LINKS_COPY.wrongData}
            onPress={onWrongData}
            testID="join-wrong-data"
            variant="link"
          />
        ) : (
          <AppText color="neutralMuted" variant="bodySm">
            {wrongDataSentence({
              allowedProfileTypes: context.allowedProfileTypes,
              teamName: context.teamName ?? "",
            })}
          </AppText>
        )}

        {redeemError ? (
          <AppText accessibilityRole="alert" color="danger" variant="bodySm">
            {redeemError}
          </AppText>
        ) : null}

        <Button
          fullWidth
          label={JOIN_LINKS_COPY.confirmCta}
          loading={redeemMutation.isPending}
          onPress={() => {
            if (redeemMutation.isPending) {
              return;
            }

            setRedeemError(null);
            trackJoinLinksEvent("join_consent_submitted");
            redeemMutation.mutate();
          }}
          size="lg"
          testID="join-confirm"
          variant="primary"
        />
      </ScrollView>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <DashboardSkeleton />
    </View>
  );
}

function JoinContextBar({
  clubName,
  isVerified,
  logoUrl,
  teamName,
}: {
  clubName: string;
  isVerified: boolean;
  logoUrl: string | null;
  teamName: string;
}) {
  return (
    <View style={styles.contextBar}>
      <View style={styles.contextRow}>
        <Avatar name={clubName} size="sm" square tone="ink" uri={logoUrl ?? undefined} />

        <AppText color="neutral" numberOfLines={1} variant="titleSm">
          {clubName}
        </AppText>

        {isVerified ? (
          <Ionicons
            accessibilityLabel="Società verificata"
            color={colors.accent}
            name="checkmark-circle"
            size={16}
          />
        ) : null}
      </View>

      <AppText color="neutralMuted" variant="bodySm">
        {teamName}
      </AppText>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <AppText color="neutralMuted" variant="bodySm">
        {label}
      </AppText>

      <AppText color="neutral" variant="bodyLg">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  terminalClub: {
    alignItems: "center",
    gap: spacing[8],
    paddingBottom: spacing[8],
  },
  terminalCta: {
    marginTop: spacing[8],
  },
  contextBar: {
    gap: spacing[4],
    paddingBottom: spacing[8],
  },
  contextRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  centered: {
    alignItems: "center",
    gap: spacing[16],
    justifyContent: "center",
    paddingHorizontal: spacing[24],
  },
  center: {
    textAlign: "center",
  },
  content: {
    gap: spacing[16],
    paddingHorizontal: spacing[24],
  },
  optionList: {
    gap: spacing[8],
  },
  personRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  summary: {
    borderColor: colors.dividerNeutral,
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing[12],
    padding: spacing[16],
  },
  summaryRow: {
    gap: spacing[4],
  },
});
