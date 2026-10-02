/**
 * Schermata 3 — Ricerca agenzia o studio (REV-PROF-15).
 *
 * La ricerca interroga le organizzazioni realmente presenti su PROLINK: nessun
 * risultato dimostrativo, nessun elenco statico. Selezionare un risultato salva
 * l'id canonico della pagina e ne usa nome, logo e località — senza attribuire
 * all'utente nessun permesso su quella pagina e senza modificarla.
 *
 * L'inserimento manuale non è un'alternativa alla pari: compare **dopo** che
 * una ricerca è stata fatta, perché il primo tentativo deve restare quello di
 * collegarsi alla pagina vera.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, Button, SearchField } from "../../../../ui";
import { InfoMessage } from "../../../onboarding/ui";
import type { AgentOrganizationResult } from "../agent-career-service";

/** Attesa prima di interrogare il backend: una lettera non è una ricerca. */
const SEARCH_DEBOUNCE_MS = 300;

/** Sotto le due lettere la ricerca non parte: troppo rumore, nessun segnale. */
const MIN_QUERY_LENGTH = 2;

type AgentOrganizationSearchStepProps = {
  /** Query corrente: la possiede il flusso, così tornare indietro la ritrova. */
  query: string;
  onChangeQuery: (value: string) => void;
  onManualEntry: () => void;
  onSelect: (organization: AgentOrganizationResult) => void;
  /** Ricerca reale. Separata dal componente per poterla sostituire nei test. */
  search: (query: string) => Promise<AgentOrganizationResult[]>;
  /** Tracciamento: avvio ricerca, ricerca vuota, errore. Mai la query. */
  onSearchStarted?: () => void;
  onSearchEmpty?: () => void;
  onSearchFailed?: () => void;
};

export function AgentOrganizationSearchStep({
  onChangeQuery,
  onManualEntry,
  onSearchEmpty,
  onSearchFailed,
  onSearchStarted,
  onSelect,
  query,
  search,
}: AgentOrganizationSearchStepProps) {
  const [results, setResults] = useState<AgentOrganizationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  /*
    Il fallback manuale resta disponibile una volta che una ricerca è stata
    tentata, anche se poi è fallita: chi non trova l'organizzazione non deve
    restare bloccato dietro a un backend che non risponde.
  */
  const [hasSearched, setHasSearched] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const requestRef = useRef(0);

  const trimmedQuery = query.trim();
  const isQueryReady = trimmedQuery.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    /*
      Sotto la soglia non si azzera niente: i risultati e gli stati restano
      dove sono e semplicemente non vengono mostrati. Spegnerli qui
      significherebbe un render in più a ogni carattere cancellato, e il
      prossimo avvio di ricerca li riscrive comunque.
    */
    if (!isQueryReady) {
      return;
    }

    const requestId = requestRef.current + 1;

    requestRef.current = requestId;

    const timer = setTimeout(() => {
      // Lo skeleton compare quando la ricerca parte davvero, non a ogni
      // carattere: durante il debounce resta a schermo quello che c'era.
      setIsSearching(true);
      setHasFailed(false);
      onSearchStarted?.();

      search(trimmedQuery)
        .then((next) => {
          // Una risposta lenta di una query precedente non deve sovrascrivere
          // quella che l'utente sta guardando adesso.
          if (requestRef.current !== requestId) {
            return;
          }

          setResults(next);
          setHasSearched(true);
          setIsSearching(false);

          if (next.length === 0) {
            onSearchEmpty?.();
          }
        })
        .catch(() => {
          if (requestRef.current !== requestId) {
            return;
          }

          setHasFailed(true);
          setHasSearched(true);
          setIsSearching(false);
          onSearchFailed?.();
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // `attempt` è il bottone "Riprova": cambia per rieseguire la stessa query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, isQueryReady, trimmedQuery]);

  const manualFallback = useMemo(
    () => (
      <View style={styles.fallback} testID="agent-organization-fallback">
        <AppText variant="titleSm">Non trovi l&apos;organizzazione?</AppText>
        <AppText color="secondary" variant="bodySm">
          Puoi inserire i dati essenziali manualmente.
        </AppText>
        <Button
          fullWidth
          label="Inserisci manualmente"
          onPress={onManualEntry}
          size="md"
          testID="agent-organization-manual"
          variant="secondary"
        />
      </View>
    ),
    [onManualEntry],
  );

  return (
    <View style={styles.container}>
      <SearchField
        onChangeText={onChangeQuery}
        placeholder="Cerca per nome"
        testID="agent-organization-search"
        value={query}
      />

      {!isQueryReady ? (
        <View style={styles.state} testID="agent-organization-initial">
          <AppText color="secondary" variant="bodySm">
            Scrivi il nome dell&apos;agenzia o dello studio per cercarla fra le
            organizzazioni presenti su PROLINK.
          </AppText>
        </View>
      ) : null}

      {isQueryReady && isSearching ? (
        <View style={styles.results} testID="agent-organization-loading">
          {/* Skeleton della riga risultato: stessa altezza e stesso raggio. */}
          {[0, 1, 2].map((index) => (
            <View key={index} style={styles.skeletonRow} />
          ))}
        </View>
      ) : null}

      {isQueryReady && !isSearching && hasFailed ? (
        <View style={styles.state} testID="agent-organization-error">
          <InfoMessage
            message="Non è stato possibile caricare le organizzazioni. Riprova."
            tone="warning"
          />
          <Button
            label="Riprova"
            onPress={() => setAttempt((value) => value + 1)}
            size="sm"
            testID="agent-organization-retry"
            variant="secondary"
          />
        </View>
      ) : null}

      {!isSearching && !hasFailed && isQueryReady && results.length === 0 ? (
        <View style={styles.state} testID="agent-organization-empty">
          <AppText variant="titleMd">Nessuna organizzazione trovata</AppText>
          <AppText color="secondary" variant="bodySm">
            Controlla il nome oppure inserisci l&apos;organizzazione manualmente.
          </AppText>
        </View>
      ) : null}

      {isQueryReady && !isSearching && !hasFailed && results.length > 0 ? (
        <View style={styles.results} testID="agent-organization-results">
          {results.map((organization) => (
            <OrganizationRow
              key={organization.id}
              onSelect={() => onSelect(organization)}
              organization={organization}
            />
          ))}
        </View>
      ) : null}

      {isQueryReady && hasSearched ? manualFallback : null}
    </View>
  );
}

function OrganizationRow({
  onSelect,
  organization,
}: {
  onSelect: () => void;
  organization: AgentOrganizationResult;
}) {
  const metaLines = [organization.city ?? organization.region, organization.category]
    .filter((line): line is string => Boolean(line));

  return (
    <View style={styles.row} testID={`agent-organization-${organization.id}`}>
      <View style={styles.logo}>
        {organization.logoUrl ? (
          <Image
            accessibilityElementsHidden
            importantForAccessibility="no"
            source={{ uri: organization.logoUrl }}
            style={styles.logoImage}
          />
        ) : (
          <View style={styles.logoFallback}>
            <Ionicons color={colors.accent} name="business-outline" size={18} />
          </View>
        )}
      </View>

      <View style={styles.rowBody}>
        <AppText numberOfLines={2} variant="titleSm">
          {organization.name}
        </AppText>
        {metaLines.map((line) => (
          <AppText color="secondary" key={line} numberOfLines={1} variant="meta">
            {line}
          </AppText>
        ))}
      </View>

      <Button
        label="Seleziona"
        onPress={onSelect}
        size="sm"
        testID={`agent-organization-${organization.id}-select`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[16],
  },
  state: {
    alignItems: "flex-start",
    gap: spacing[8],
  },
  results: {
    gap: spacing[12],
  },
  row: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 64,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[12],
  },
  rowBody: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  logo: {
    borderRadius: radius.full,
    flexShrink: 0,
    height: 40,
    overflow: "hidden",
    width: 40,
  },
  logoFallback: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  logoImage: {
    height: "100%",
    width: "100%",
  },
  skeletonRow: {
    backgroundColor: colors.backgroundStrong,
    borderRadius: radius[16],
    height: 64,
  },
  fallback: {
    alignItems: "flex-start",
    backgroundColor: colors.accentSoft,
    borderRadius: radius[16],
    gap: spacing[8],
    padding: spacing[16],
  },
});
