/**
 * «Accesso alla lista» — campi condivisi da Crea lista e Gestisci accesso
 * (DAS-REV-27 §10, §11, §13 — screen 02, 03, 06, 16).
 *
 * Un solo componente per i due form, perché §3 vieta «una variante del form
 * che salva le liste con regole di accesso differenti». Radio Solo io /
 * Condividi con persone specifiche, helper collegato alla radio, e — solo
 * con la condivisione — la checklist delle persone eleggibili lette dal
 * server (§11: «filtrate server-side»).
 *
 * Tutto è draft: niente autosave del radio o delle checkbox (§13). Le scelte
 * sono id, mantenuti anche fuori dalle pagine caricate (§11: «Il set salvato
 * comprende tutte le scelte, non solo quelle renderizzate»). Errore di
 * caricamento ≠ zero persone (§11, Q27-10): il primo ha Riprova, il secondo
 * «Nessuna persona disponibile».
 */
import { Pressable, StyleSheet, View } from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";

import { colors, radius, sizes, spacing } from "../../../../../theme/tokens";
import { AppText, Button, Skeleton } from "../../../../../ui";
import { SHORTLIST_QK } from "../../shortlist-keys";
import { CUSTOM_COPY, toggleSelection } from "../custom-shortlist-presentation";
import { fetchShareCandidates } from "../custom-shortlist-service";
import type { AccessChoice, PeoplePage } from "../custom-shortlist-types";
import { ShortlistPersonRow } from "./ShortlistPersonRow";

/**
 * Radio della modalità d'accesso. §4: «Link e selezioni usano il token
 * accent esistente» con testo in nero neutro — la `Radio` condivisa offre
 * soltanto indicatore e testo entrambi neutri o entrambi della palette ink.
 * Stesso disegno della radio di `ShortlistPersonRow`.
 */
function AccessRadio({
  checked,
  disabled,
  label,
  onPress,
  testID,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.radioRow, pressed ? styles.pressed : null]}
      testID={testID}
    >
      <View style={[styles.radio, checked ? styles.radioOn : null]}>
        {checked ? <View style={styles.radioDot} /> : null}
      </View>
      <AppText color="neutral" style={styles.flex} variant="bodySm">
        {label}
      </AppText>
    </Pressable>
  );
}

type Props = {
  actorId: string;
  choice: AccessChoice | null;
  clubId: string;
  disabled?: boolean;
  error: string | null;
  /** Testo sotto le radio per una lista storica 'scope' (§25). */
  legacyNote?: string | null;
  onChoice: (choice: AccessChoice) => void;
  onSelected: (ids: string[]) => void;
  selected: readonly string[];
  /** Lista esistente (Gestisci accesso) oppure null (draft di creazione). */
  shortlistId: string | null;
  /** Ambito del draft; `undefined` = non ancora scelto. */
  teamId: string | null | undefined;
};

export function ShortlistAccessFields({
  actorId,
  choice,
  clubId,
  disabled = false,
  error,
  legacyNote,
  onChoice,
  onSelected,
  selected,
  shortlistId,
  teamId,
}: Props) {
  const scopeKnown = shortlistId !== null || teamId !== undefined;
  const peopleQuery = useInfiniteQuery<
    PeoplePage,
    Error,
    { pageParams: (string | null)[]; pages: PeoplePage[] },
    readonly unknown[],
    string | null
  >({
    enabled: choice === "shared" && scopeKnown && !!actorId && !!clubId,
    getNextPageParam: (last) => last.nextCursor,
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      fetchShareCandidates({
        clubId,
        cursor: pageParam,
        shortlistId,
        teamId: teamId ?? null,
      }),
    queryKey: SHORTLIST_QK.shareCandidates(actorId, clubId, shortlistId, teamId ?? null),
    retry: 1,
  });

  const people = peopleQuery.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <View style={styles.group} testID="access-fields">
      <AppText accessibilityRole="header" color="neutral" variant="metaStrong">
        {CUSTOM_COPY.accessSection}
      </AppText>

      {legacyNote ? (
        <AppText color="neutralMuted" variant="meta">
          {legacyNote}
        </AppText>
      ) : null}

      <View accessibilityRole="radiogroup" style={styles.radios}>
        <View>
          <AccessRadio
            checked={choice === "owner_only"}
            disabled={disabled}
            label={CUSTOM_COPY.soloIo}
            onPress={() => onChoice("owner_only")}
            testID="access-solo"
          />
          {/* §10: helper collegato alla radio, sotto la sua etichetta. */}
          {choice === "owner_only" ? (
            <AppText color="neutralMuted" style={styles.helper} variant="meta">
              {CUSTOM_COPY.soloIoHelper}
            </AppText>
          ) : null}
        </View>

        <AccessRadio
          checked={choice === "shared"}
          disabled={disabled}
          label={CUSTOM_COPY.shareSpecific}
          onPress={() => onChoice("shared")}
          testID="access-shared"
        />
      </View>

      {choice === "shared" ? (
        <View style={styles.people} testID="access-people">
          {!scopeKnown ? (
            <AppText color="neutralMuted" variant="meta">
              {CUSTOM_COPY.scopeFirst}
            </AppText>
          ) : peopleQuery.isLoading ? (
            <View style={styles.skeleton}>
              <Skeleton.Row />
              <Skeleton.Row />
            </View>
          ) : peopleQuery.isError && people.length === 0 ? (
            <View style={styles.state} testID="access-people-error">
              <AppText color="neutral" variant="bodySm">
                {CUSTOM_COPY.peopleLoadError}
              </AppText>
              <Button
                label="Riprova"
                onPress={() => void peopleQuery.refetch()}
                size="sm"
                testID="access-people-retry"
                variant="secondary"
              />
            </View>
          ) : people.length === 0 ? (
            <View style={styles.state} testID="access-people-empty">
              <AppText color="neutral" variant="bodySm">
                {CUSTOM_COPY.noPeopleTitle}
              </AppText>
              <AppText color="neutralMuted" variant="meta">
                {CUSTOM_COPY.noPeopleBody}
              </AppText>
            </View>
          ) : (
            <>
              {people.map((person, index) => (
                <ShortlistPersonRow
                  control="checkbox"
                  disabled={disabled}
                  key={person.profileId}
                  onPress={() => onSelected(toggleSelection(selected, person.profileId))}
                  person={person}
                  selected={selected.includes(person.profileId)}
                  showDivider={index > 0}
                  testID={`access-person-${person.profileId}`}
                />
              ))}

              {peopleQuery.hasNextPage ? (
                <Button
                  label="Mostra altre persone"
                  loading={peopleQuery.isFetchingNextPage}
                  onPress={() => void peopleQuery.fetchNextPage()}
                  size="sm"
                  testID="access-people-more"
                  variant="link"
                />
              ) : null}
            </>
          )}
        </View>
      ) : null}

      {error ? (
        <View accessibilityLiveRegion="polite" style={styles.error} testID="access-error">
          <AppText color="danger" variant="meta">
            {error}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing[8],
  },
  radios: {
    gap: 0,
  },
  radioRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
  },
  radio: {
    alignItems: "center",
    borderColor: colors.borderStrong,
    borderRadius: radius.full,
    borderWidth: 1.5,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  radioOn: {
    borderColor: colors.accent,
  },
  radioDot: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    height: 12,
    width: 12,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  helper: {
    marginTop: -spacing[8],
    paddingBottom: spacing[4],
    /* Allineato al testo: radio 22 + gap 12. */
    paddingLeft: spacing[22] + spacing[12],
  },
  people: {
    paddingLeft: spacing[4],
  },
  skeleton: {
    gap: spacing[8],
    paddingVertical: spacing[8],
  },
  state: {
    alignItems: "flex-start",
    gap: spacing[6],
    paddingVertical: spacing[8],
  },
  error: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 12,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
  },
});
