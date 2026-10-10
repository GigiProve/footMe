/**
 * Cerca una società (master 03) e Invita la società (master 06).
 *
 * §10: «Riutilizzare Search con un filtro contestuale di entità e
 * visibilità. Non creare un secondo motore.» Il motore è
 * `search_clubs_page` con `p_kind = 'club'`, lo stesso di Cerca → Società:
 * esclude Team e persone e applica la visibilità. L'unica cosa che si
 * aggiunge è lo stato del collegamento, in **una** chiamata per pagina.
 *
 * Lo screen 06 non è una schermata: è uno sheet sopra questa ricerca (§4),
 * e per questo vive nello stesso file e condivide la query e i selector.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText, BottomSheet, Button, Input, SearchField } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { searchClubsPage } from "../../search/search-service";
import { NetworkScaffold } from "../components/NetworkScaffold";
import { NetworkFieldRow } from "../components/NetworkFieldRow";
import { NetworkOptionSheet } from "../components/NetworkOptionSheet";
import { SocietyIdentityRow } from "../components/SocietyIdentityRow";
import { SocietyListRow } from "../components/SocietyListRow";
import { NETWORK_QK } from "../network-keys";
import {
  NETWORK_EMPTY,
  describeNetworkError,
  eligibilityLabel,
  isSelectableResult,
  locationLabel,
  roleOptions,
} from "../network-presentation";
import {
  fetchLinkEligibility,
  fetchNetworkHeader,
  fetchRelationshipTypes,
  issueSocietyInvite,
  toNetworkError,
} from "../network-service";
import {
  buildSocietyInviteMessage,
  buildSocietyInviteUrl,
  shareSocietyInvite,
} from "../network-invite-link";
import { newNetworkOperationKey } from "../operation-key";
import { trackNetworkEvent } from "../network-analytics";
import type { LinkEligibility, SocietySummary } from "../network-types";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const PAGE_SIZE = 20;

export function LinkSearchScreen({ clubId }: { clubId: string }) {
  const router = useRouter();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const [query, setQuery] = useState("");
  const [committed, setCommitted] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  // §10: debounce e nessuna applicazione delle risposte obsolete. La chiave
  // di query contiene il termine, quindi una response precedente non può
  // ripopolare la lista del termine corrente.
  useEffect(() => {
    const trimmed = query.trim();
    const timer = setTimeout(() => {
      if (trimmed.length === 0 || trimmed.length >= MIN_QUERY_LENGTH) {
        setCommitted(trimmed);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const headerQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchNetworkHeader(clubId),
    queryKey: NETWORK_QK.center(actorId, clubId),
  });

  const resultsQuery = useQuery({
    enabled: committed.length >= MIN_QUERY_LENGTH,
    // `keepPreviousData` non si usa qui: §10 vuole che «restino i risultati
    // dell'ultima query attiva», e tenere i precedenti mentre il termine è
    // cambiato è esattamente il contrario.
    queryFn: () =>
      searchClubsPage({
        filters: null,
        kind: "club",
        page: 0,
        pageSize: PAGE_SIZE,
        query: committed,
      }),
    queryKey: ["society-link-search", committed],
  });

  const resultIds = useMemo(
    () => (resultsQuery.data?.rows ?? []).map((row) => row.entity_id),
    [resultsQuery.data],
  );

  const eligibilityQuery = useQuery({
    enabled: resultIds.length > 0 && !!clubId,
    queryFn: () => fetchLinkEligibility(clubId, resultIds),
    queryKey: NETWORK_QK.eligibility(actorId, clubId, resultIds),
  });

  const eligibilityById = useMemo(() => {
    const map = new Map<string, LinkEligibility>();

    for (const row of eligibilityQuery.data ?? []) {
      map.set(row.targetClubId, row);
    }

    return map;
  }, [eligibilityQuery.data]);

  const openConfigure = useCallback(
    (society: SocietySummary) => {
      trackNetworkEvent("network_search_result_selected", {});
      router.push(
        `/society-link/configure?clubId=${encodeURIComponent(clubId)}&targetClubId=${encodeURIComponent(society.clubId)}`,
      );
    },
    [clubId, router],
  );

  const currentSociety: SocietySummary | null = headerQuery.data
    ? {
        city: headerQuery.data.city,
        clubId: headerQuery.data.clubId,
        isVerified: headerQuery.data.isVerified,
        logoUrl: headerQuery.data.logoUrl,
        name: headerQuery.data.name,
        province: headerQuery.data.province,
        region: headerQuery.data.region,
      }
    : null;

  const hasQuery = committed.length >= MIN_QUERY_LENGTH;
  const rows = resultsQuery.data?.rows ?? [];
  const showEmpty = hasQuery && !resultsQuery.isLoading && !resultsQuery.isError && rows.length === 0;

  return (
    <>
      <NetworkScaffold onBack={() => router.back()} title="Collega una società">
        {currentSociety ? (
          <SocietyIdentityRow society={currentSociety} subtitle="Società" />
        ) : null}

        <SearchField
          autoFocus
          onChangeText={setQuery}
          placeholder="Cerca una società"
          testID="network-search-field"
          value={query}
        />

        {resultsQuery.isLoading && hasQuery ? (
          <ActivityIndicator color={colors.textNeutralMuted} />
        ) : null}

        {/* §10: «La ricerca fallita conserva la query e mostra Riprova; non
            diventa Nessuna società trovata.» */}
        {resultsQuery.isError ? (
          <View style={styles.retry}>
            <AppText color="neutral" variant="bodyLg">
              Non è stato possibile caricare i risultati.
            </AppText>
            <Button
              label="Riprova"
              onPress={() => void resultsQuery.refetch()}
              testID="network-search-retry"
              variant="neutralOutline"
            />
          </View>
        ) : null}

        {!hasQuery && !resultsQuery.isError ? (
          /* §10: «La ricerca vuota non mostra una lista casuale infinita.» */
          <AppText color="neutralSoft" variant="bodySm">
            Digita almeno due lettere per cercare una società.
          </AppText>
        ) : null}

        {showEmpty ? (
          <View style={styles.empty} testID="network-search-empty">
            <AppText color="neutral" variant="titleMd">
              {NETWORK_EMPTY.search.title}
            </AppText>
            <AppText color="neutralMuted" variant="bodySm">
              {NETWORK_EMPTY.search.body}
            </AppText>
            {/* §3: negli empty state l'azione primaria autorizzata riusa lo
                stesso pulsante blu con testo bianco. */}
            <Button
              fullWidth
              label="Invita la società su PROLINK"
              onPress={() => {
                trackNetworkEvent("network_invite_started", { origin: "empty" });
                setInviteOpen(true);
              }}
              size="lg"
              testID="network-invite-from-empty"
              variant="primary"
            />
          </View>
        ) : null}

        <FlatList
          data={rows}
          keyExtractor={(row) => row.entity_id}
          renderItem={({ item }) => {
            const eligibility = eligibilityById.get(item.entity_id);
            const society: SocietySummary = eligibility?.society ?? {
              city: item.city,
              clubId: item.entity_id,
              isVerified: false,
              logoUrl: item.logo_url,
              name: item.name,
              province: null,
              region: item.region,
            };
            const selectable = isSelectableResult(eligibility);

            return (
              <SocietyListRow
                detail={eligibilityLabel(eligibility)}
                disabled={!selectable}
                location={locationLabel(society.city, society.province, society.region)}
                onPress={selectable ? () => openConfigure(society) : undefined}
                society={society}
                testID={`network-search-row-${item.entity_id}`}
              />
            );
          }}
          scrollEnabled={false}
        />

        {hasQuery && rows.length > 0 ? (
          /* §10, §3: link testuale blu, senza riempimento. */
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              trackNetworkEvent("network_invite_started", { origin: "link" });
              setInviteOpen(true);
            }}
            style={styles.link}
            testID="network-invite-link"
          >
            <AppText color="accent" variant="actionLabel">
              Non trovi la società?
            </AppText>
          </Pressable>
        ) : null}
      </NetworkScaffold>

      {/* Montato solo quando serve: lo sheet riparte dal termine cercato
          senza doverlo sincronizzare con un effetto. */}
      {inviteOpen ? (
        <InviteSheet
          clubId={clubId}
          initialName={committed}
          inviterName={currentSociety?.name ?? ""}
          onClose={() => setInviteOpen(false)}
        />
      ) : null}
    </>
  );
}

/**
 * Sheet "Invita la società" (master 06).
 *
 * §17: «Solo dopo aver ottenuto il link reale aprire lo share sheet
 * nativo.» Il link si genera, e se la generazione fallisce tipo e ruolo
 * restano compilati e si può riprovare — senza mai aprire una share sheet
 * con un URL falso.
 */
function InviteSheet({
  clubId,
  initialName,
  inviterName,
  onClose,
}: {
  clubId: string;
  initialName: string;
  inviterName: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [typeId, setTypeId] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [picker, setPicker] = useState<"type" | "role" | null>(null);
  const [isBusy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Il token in chiaro esce una volta sola: conservarlo in memoria è ciò che
  // permette di ri-condividere lo stesso invito senza ruotarlo (§17).
  const tokenRef = useRef<string | null>(null);
  const operationKeyRef = useRef(newNetworkOperationKey());

  const typesQuery = useQuery({
    queryFn: fetchRelationshipTypes,
    queryKey: NETWORK_QK.types(),
    staleTime: 15 * 60 * 1000,
  });

  const types = useMemo(
    () => (typesQuery.data ?? []).filter((type) => type.isSelectable),
    [typesQuery.data],
  );

  const selectedType = types.find((type) => type.id === typeId);
  const roles = roleOptions(selectedType);
  const needsRole = selectedType?.isDirectional ?? false;
  const canSubmit = !!typeId && (!needsRole || !!roleId);

  // Funzione semplice e non `useCallback`: legge e scrive due ref, quindi una
  // memoizzazione manuale qui non sarebbe preservabile dal compiler e il
  // progetto non aggiunge memo senza un bisogno misurato.
  const share = async () => {
    if (!typeId || isBusy) {
      return;
    }

    setBusy(true);
    setErrorMessage(null);

    try {
      let token = tokenRef.current;

      if (!token) {
        const issued = await issueSocietyInvite({
          clubId,
          descriptiveName: name.trim() || null,
          idempotencyKey: operationKeyRef.current,
          roleId: needsRole ? roleId : null,
          // Senza token in memoria non si può ri-condividere lo stesso link:
          // si ruota sulla **stessa riga**, non se ne crea una seconda (§17).
          rotate: true,
          typeId,
        });

        token = issued.token;
        tokenRef.current = issued.token;
        trackNetworkEvent("network_invite_link_result", { outcome: "ok" });
      }

      if (!token) {
        throw new Error("INVITE_INVALID");
      }

      const link = buildSocietyInviteUrl(token);

      trackNetworkEvent("network_invite_share_opened", {});

      // §17: l'esito della sheet riguarda la sheet, non la consegna.
      await shareSocietyInvite(
        buildSocietyInviteMessage({
          descriptiveName: name.trim() || null,
          inviterName,
          link,
        }),
      );
    } catch (error) {
      const parsed = toNetworkError(error);
      setErrorMessage(
        parsed.code === "UNKNOWN"
          ? "Non è stato possibile generare il link. Riprova."
          : describeNetworkError(parsed.code),
      );
      trackNetworkEvent("network_invite_link_result", {
        error_code: parsed.code,
        outcome: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <BottomSheet onClose={onClose} title="Invita la società" visible>
        <View style={styles.sheet}>
          <Input
            label="Invito per"
            onChangeText={setName}
            placeholder="Nome della società"
            testID="network-invite-name"
            value={name}
          />

          <NetworkFieldRow
            label="Tipo di collegamento"
            onPress={() => setPicker("type")}
            placeholder="Seleziona"
            testID="network-invite-type"
            value={selectedType?.label ?? null}
          />

          {needsRole ? (
            <NetworkFieldRow
              label={`${inviterName} sarà`}
              onPress={() => setPicker("role")}
              placeholder="Seleziona"
              testID="network-invite-role"
              value={roles.find((role) => role.id === roleId)?.label ?? null}
            />
          ) : null}

          <AppText color="neutralSoft" variant="meta">
            Condividi un link. Dopo l'accesso, la società potrà verificare e
            accettare la richiesta.
          </AppText>

          {errorMessage ? (
            <AppText accessibilityRole="alert" color="danger" variant="bodySm">
              {errorMessage}
            </AppText>
          ) : null}

          {/* §3, riga 06 della matrice: primaria blu PROLINK, testo bianco. */}
          <Button
            disabled={!canSubmit}
            fullWidth
            label="Condividi invito"
            loading={isBusy}
            onPress={() => void share()}
            size="lg"
            testID="network-invite-share"
            variant="primary"
          />
        </View>
      </BottomSheet>

      <NetworkOptionSheet
        onClose={() => setPicker(null)}
        onSelect={(id) => {
          setTypeId(id);
          // §7: «Cambiando da un tipo direzionale a uno simmetrico, eliminare
          // dalla bozza i metadata direzionali non applicabili.»
          setRoleId(null);
          tokenRef.current = null;
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
          tokenRef.current = null;
          operationKeyRef.current = newNetworkOperationKey();
          setPicker(null);
          trackNetworkEvent("network_role_selected", { role_id: id });
        }}
        options={roles.map((role) => ({ id: role.id, label: role.label }))}
        selectedId={roleId}
        title={`${inviterName} sarà`}
        visible={picker === "role"}
      />
    </>
  );
}

const styles = StyleSheet.create({
  retry: {
    alignItems: "flex-start",
    gap: spacing[12],
  },
  empty: {
    gap: spacing[12],
    paddingTop: spacing[16],
  },
  link: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: sizes.touchTarget,
  },
  sheet: {
    gap: spacing[16],
    paddingBottom: spacing[8],
  },
});
