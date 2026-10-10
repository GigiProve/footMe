/**
 * Configura la richiesta (master 04).
 *
 * §11: «Mantenere visibile la Society corrente e il riepilogo della
 * controparte selezionata. Niente selector per cambiare identità
 * amministrativa dentro questo form.»
 *
 * La frase direzionale è il cuore della schermata: §7 chiede che «se la
 * direzione viene invertita, aggiornare correttamente ruoli e frase. Non
 * limitarsi a invertire le label senza modificare i dati canonici». Qui il
 * ruolo scelto **è** il dato canonico inviato al server, e la frase nasce dal
 * template del catalogo applicato ai due nomi nella direzione scelta: non c'è
 * modo di mostrarne una e inviarne un'altra.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { spacing } from "../../../theme/tokens";
import { AppText, ConfirmModal, useToast } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { DashboardSkeleton } from "../../dashboard/components/DashboardStates";
import { NetworkScaffold } from "../components/NetworkScaffold";
import { NetworkFieldRow } from "../components/NetworkFieldRow";
import { NetworkOptionSheet } from "../components/NetworkOptionSheet";
import { SocietyIdentityRow } from "../components/SocietyIdentityRow";
import { NETWORK_QK } from "../network-keys";
import {
  buildDraftSentence,
  describeNetworkError,
  locationLabel,
  roleOptions,
} from "../network-presentation";
import {
  createRelationshipRequest,
  fetchLinkEligibility,
  fetchNetworkHeader,
  fetchRelationshipTypes,
  toNetworkError,
} from "../network-service";
import { invalidateNetwork } from "../RelationshipDetailScreen";
import { newNetworkOperationKey } from "../operation-key";
import { trackNetworkEvent } from "../network-analytics";

type Props = {
  clubId: string;
  targetClubId: string;
};

export function LinkConfigureScreen({ clubId, targetClubId }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";

  const [typeId, setTypeId] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [picker, setPicker] = useState<"type" | "role" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exitPrompt, setExitPrompt] = useState(false);
  const operationKeyRef = useRef(newNetworkOperationKey());

  const headerQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchNetworkHeader(clubId),
    queryKey: NETWORK_QK.center(actorId, clubId),
  });

  const eligibilityQuery = useQuery({
    enabled: !!clubId && !!targetClubId,
    queryFn: () => fetchLinkEligibility(clubId, [targetClubId]),
    queryKey: NETWORK_QK.eligibility(actorId, clubId, [targetClubId]),
  });

  const typesQuery = useQuery({
    queryFn: fetchRelationshipTypes,
    queryKey: NETWORK_QK.types(),
    staleTime: 15 * 60 * 1000,
  });

  const eligibility = eligibilityQuery.data?.[0] ?? null;
  const target = eligibility?.society ?? null;

  /**
   * §10: «Se la policy permette un diverso tipo tra gli stessi club, mostrare
   * lo stato esistente e rendere selezionabili nel form solo le proposte
   * realmente ammesse.» L'elenco dei tipi proponibili lo decide il backend.
   */
  const types = useMemo(() => {
    const all = (typesQuery.data ?? []).filter((type) => type.isSelectable);

    if (!eligibility) {
      return all;
    }

    return all.filter((type) => eligibility.availableTypeIds.includes(type.id));
  }, [eligibility, typesQuery.data]);

  const selectedType = types.find((type) => type.id === typeId);
  const roles = roleOptions(selectedType);
  const needsRole = selectedType?.isDirectional ?? false;
  const canSubmit = !!typeId && (!needsRole || !!roleId);
  const isDirty = !!typeId || !!roleId;

  const currentName = headerQuery.data?.name ?? "";

  const sentence = buildDraftSentence({
    currentName,
    roleId,
    targetName: target?.name ?? "",
    type: selectedType,
  });

  const submit = useMutation({
    mutationFn: () =>
      createRelationshipRequest({
        clubId,
        idempotencyKey: operationKeyRef.current,
        roleId: needsRole ? roleId : null,
        targetClubId,
        typeId: typeId as string,
      }),
    onError: (error) => {
      const parsed = toNetworkError(error);
      setErrorMessage(
        parsed.code === "UNKNOWN"
          ? "Non è stato possibile inviare la richiesta. Riprova."
          : describeNetworkError(parsed.code),
      );
      trackNetworkEvent("network_request_result", {
        error_code: parsed.code,
        outcome: "error",
      });

      // §12: «Riaprire la richiesta esistente nel ruolo corretto» invece di
      // creare una copia. Il server restituisce quale.
      if (parsed.code === "REQUEST_ALREADY_PENDING" && parsed.relationshipId) {
        router.replace(
          `/society-link/review?clubId=${encodeURIComponent(clubId)}&relationshipId=${encodeURIComponent(parsed.relationshipId)}`,
        );
      }
    },
    onSuccess: () => {
      trackNetworkEvent("network_request_result", { outcome: "ok" });
      showToast({ message: "Richiesta inviata" });
      invalidateNetwork(queryClient);
      // §12: «ritorno alla tab Richieste nel contesto originario».
      router.back();
      router.back();
    },
  });

  const requestExit = useCallback(() => {
    // §28: la conferma compare solo se c'è davvero una bozza.
    if (isDirty && !submit.isPending) {
      setExitPrompt(true);
      return;
    }

    router.back();
  }, [isDirty, router, submit.isPending]);

  if (headerQuery.isLoading || eligibilityQuery.isLoading || typesQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  const current = headerQuery.data;

  return (
    <>
      <NetworkScaffold
        errorMessage={errorMessage}
        onBack={requestExit}
        // §5: il disabled è appropriato per un form incompleto; è il permesso
        // mancante che si omette, non il campo non ancora compilato.
        onPrimary={() => submit.mutate()}
        primaryDisabled={!canSubmit || submit.isPending}
        primaryLabel="Invia richiesta di collegamento"
        primaryLoading={submit.isPending}
        testID="network-configure"
        title="Collega una società"
      >
        {current ? (
          <SocietyIdentityRow
            society={{
              city: current.city,
              clubId: current.clubId,
              isVerified: current.isVerified,
              logoUrl: current.logoUrl,
              name: current.name,
              province: current.province,
              region: current.region,
            }}
            subtitle="Società"
          />
        ) : null}

        {target ? (
          <View style={styles.target}>
            <AppText color="neutral" variant="titleMd">
              {target.name}
            </AppText>
            <AppText color="neutralMuted" variant="meta">
              {locationLabel(target.city, target.province, target.region) ?? ""}
            </AppText>
          </View>
        ) : null}

        <NetworkFieldRow
          label="Tipo di collegamento"
          onPress={() => setPicker("type")}
          placeholder="Seleziona"
          testID="network-configure-type"
          value={selectedType?.label ?? null}
        />

        {needsRole ? (
          <NetworkFieldRow
            label={`${currentName} sarà`}
            onPress={() => setPicker("role")}
            placeholder="Seleziona"
            testID="network-configure-role"
            value={roles.find((role) => role.id === roleId)?.label ?? null}
          />
        ) : null}

        {sentence ? (
          <AppText color="neutral" testID="network-configure-sentence" variant="bodyLg">
            {sentence}
          </AppText>
        ) : null}

        <AppText color="neutralSoft" variant="meta">
          Il collegamento si attiva dopo l'accettazione della società.
        </AppText>
      </NetworkScaffold>

      <NetworkOptionSheet
        onClose={() => setPicker(null)}
        onSelect={(id) => {
          setTypeId(id);
          // §7: passando a un tipo simmetrico i metadata direzionali escono
          // dalla bozza e dal payload, non restano nascosti.
          setRoleId(null);
          setErrorMessage(null);
          // §26: cambiano i termini, quindi è un'altra operazione.
          operationKeyRef.current = newNetworkOperationKey();
          setPicker(null);
          trackNetworkEvent("network_type_selected", { type_id: id });
        }}
        options={types.map((type) => ({
          description: type.description,
          id: type.id,
          label: type.label,
        }))}
        selectedId={typeId}
        title="Tipo di collegamento"
        visible={picker === "type"}
      />

      <NetworkOptionSheet
        onClose={() => setPicker(null)}
        onSelect={(id) => {
          setRoleId(id);
          setErrorMessage(null);
          operationKeyRef.current = newNetworkOperationKey();
          setPicker(null);
          trackNetworkEvent("network_role_selected", { role_id: id });
        }}
        options={roles.map((role) => ({ id: role.id, label: role.label }))}
        selectedId={roleId}
        title={`${currentName} sarà`}
        visible={picker === "role"}
      />

      <ConfirmModal
        cancelLabel="Continua a modificare"
        confirmLabel="Esci senza salvare"
        message="Le modifiche effettuate andranno perse."
        onCancel={() => setExitPrompt(false)}
        onConfirm={() => {
          trackNetworkEvent("network_unsaved_exit", {});
          setExitPrompt(false);
          router.back();
        }}
        title="Uscire senza salvare?"
        visible={exitPrompt}
      />
    </>
  );
}

const styles = StyleSheet.create({
  target: {
    gap: spacing[4],
  },
});
