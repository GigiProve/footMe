import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useSession } from "../auth/use-session";
import { getPlayerPositionLabel } from "../profiles/player-sports";
import { formatUpdateLabel } from "../dashboard/personal/personal-presentation";
import { acknowledgeApplicationEvent } from "../dashboard/adapters/personal-adapter";
import { colors, radius, spacing } from "../../theme/tokens";
import { AppText, Avatar, Badge, Button, EmptyState, Skeleton } from "../../ui";
import {
  applicationStatusLabel,
  formatOutcomeLine,
  POSITION_CLOSED_A11Y,
  POSITION_CLOSED_NOTE,
  SELECTION_COMPLETED_LABEL,
} from "./application-presentation";
import { fetchApplicationDetail } from "./applications-service";

/**
 * Dettaglio della candidatura (DAS-REV-03 §9, §20).
 *
 * «L'intera row apre il dettaglio della candidatura tramite il suo ID. Non
 * aprire soltanto la posizione quando l'intenzione è consultare stato e
 * percorso della candidatura.» Questa schermata è quella destinazione, ed è
 * la ragione per cui esiste: senza, la row della Dashboard non avrebbe dove
 * andare.
 *
 * Mostra ciò che il dominio sa davvero — stato corrente, percorso degli
 * eventi reali, messaggio inviato, accesso alla posizione — e nulla che il
 * dominio non sappia. In particolare **non** mostra una valutazione, una
 * probabilità o un esito previsto, e non offre il ritiro: è di DAS-REV-04.
 *
 * Il percorso usa `recruiting_application_events`, non `updated_at`: §11 è
 * esplicito nel vietare che una scrittura qualsiasi diventi la data di un
 * aggiornamento professionale. Una candidatura senza eventi non ne ha avuti,
 * e lo dice.
 *
 * DAS-REV-04 aggiunge qui tre cose e nessuna UX nuova: il metadato della
 * posizione chiusa (§7), l'esito reale di una candidatura conclusa (§14) e
 * l'acknowledgement dell'ultimo evento (§12), inviato solo dopo che il
 * dettaglio si è davvero caricato.
 */
export function ApplicationDetailScreen() {
  const router = useRouter();
  const { profile } = useSession();
  const profileId = profile?.id ?? null;
  const { id } = useLocalSearchParams<{ id: string }>();

  const detailQuery = useQuery({
    enabled: !!profileId && !!id,
    queryFn: () => fetchApplicationDetail(profileId as string, id as string),
    queryKey: ["application-detail", id, profileId],
  });

  const detail = detailQuery.data;
  // Istante congelato all'apertura: le etichette relative (oggi, ieri)
  // non devono cambiare durante la permanenza sulla schermata.
  const [now] = useState(() => Date.now());

  // §12: «inviarlo dopo il caricamento riuscito della destinazione
  // pertinente», riferito all'evento effettivamente consultato — qui il più
  // recente, che è quello mostrato in cima al percorso. Un evento arrivato
  // dopo avrà un id diverso e non viene coperto da questo ack.
  useLatestEventAck(detail?.events[0]?.id ?? null);

  return (
    <>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed ? styles.pressed : null,
          ]}
        >
          <Ionicons color={colors.textPrimary} name="arrow-back" size={20} />
        </Pressable>
      </View>

      {detailQuery.isLoading ? (
        <View style={styles.loader}>
          <Skeleton.Row />
          <Skeleton.Row />
          <Skeleton.Row style={styles.skeletonShort} />
        </View>
      ) : !detail ? (
        <EmptyState
          description="Questa candidatura non è più disponibile."
          icon="document-text-outline"
          title="Candidatura non disponibile"
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          <AppText style={styles.title} variant="headingMd">
            {getPlayerPositionLabel(detail.role, detail.role)}
          </AppText>

          <View style={styles.clubRow}>
            <Avatar
              name={detail.clubName}
              size="sm"
              square
              uri={detail.clubLogoUrl ?? undefined}
            />
            <View style={styles.clubText}>
              <AppText variant="titleSm">{detail.clubName}</AppText>
              {detail.teamName ? (
                <AppText color="muted" variant="bodySm">
                  {detail.teamName}
                </AppText>
              ) : null}
            </View>
          </View>

          <View style={styles.statusRow}>
            {/* §7: lo stato reale resta quello che è. Una selezione conclusa
                non lo riscrive in "Rifiutata". */}
            <Badge label={applicationStatusLabel(detail.status)} />
            <AppText color="muted" variant="caption">
              {`Inviata il ${new Date(detail.createdAt).toLocaleDateString("it-IT")}`}
            </AppText>
          </View>

          {detail.group === "completed" ? (
            <AppText color="secondary" style={styles.contextLine} variant="bodySm">
              {formatOutcomeLine({
                concludedAt: detail.concludedAt,
                outcome: detail.outcome,
                status: detail.status,
              })}
            </AppText>
          ) : !detail.positionAccepting ? (
            // §7: la posizione non accetta più candidature, la selezione
            // prosegue. Metadato, non stato terminale.
            <AppText
              accessibilityLabel={POSITION_CLOSED_A11Y}
              color="secondary"
              style={styles.contextLine}
              variant="bodySm"
            >
              {POSITION_CLOSED_NOTE}
            </AppText>
          ) : null}

          <AppText accessibilityRole="header" style={styles.sectionTitle} variant="headingSm">
            Percorso
          </AppText>

          {detail.events.length === 0 ? (
            <AppText color="secondary" variant="bodySm">
              Nessun aggiornamento dalla società.
            </AppText>
          ) : (
            <View style={styles.timeline}>
              {detail.events.map((event) => (
                <View key={event.id} style={styles.timelineRow}>
                  <AppText variant="titleSm">
                    {event.kind === "selection_completed" || !event.toStatus
                      ? SELECTION_COMPLETED_LABEL
                      : applicationStatusLabel(event.toStatus)}
                  </AppText>
                  <AppText color="muted" variant="caption">
                    {formatUpdateLabel(event.occurredAt, now)}
                  </AppText>
                </View>
              ))}
            </View>
          )}

          {detail.coverMessage ? (
            <>
              <AppText
                accessibilityRole="header"
                style={styles.sectionTitle}
                variant="headingSm"
              >
                Il tuo messaggio
              </AppText>
              <AppText color="secondary" variant="bodySm">
                {detail.coverMessage}
              </AppText>
            </>
          ) : null}

          <Button
            label="Vedi la posizione"
            onPress={() => router.push(`/position/${detail.adId}` as never)}
            style={styles.positionButton}
            variant="secondary"
          />
        </ScrollView>
      )}
    </>
  );
}

/**
 * Acknowledgement dell'ultimo evento consultato (§12).
 *
 * Idempotente server-side: una seconda chiamata non produce effetti doppi, e
 * un fallimento non viene ritentato in loop — la consultazione non è
 * dichiarata e la prossima apertura riproverà.
 */
function useLatestEventAck(eventId: string | null) {
  const sentRef = useRef<string | null>(null);

  useEffect(() => {
    if (!eventId || sentRef.current === eventId) {
      return;
    }

    sentRef.current = eventId;
    void acknowledgeApplicationEvent(eventId).catch(() => {
      sentRef.current = null;
    });
  }, [eventId]);
}

const styles = StyleSheet.create({
  headerRow: {
    marginBottom: spacing[16],
  },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  loader: {
    gap: spacing[8],
  },
  skeletonShort: {
    width: "60%",
  },
  scroll: {
    flex: 1,
  },
  title: {
    marginBottom: spacing[12],
  },
  clubRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    marginBottom: spacing[16],
  },
  clubText: {
    flex: 1,
    gap: spacing[4],
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    marginBottom: spacing[8],
  },
  contextLine: {
    marginBottom: spacing[8],
  },
  sectionTitle: {
    marginBottom: spacing[8],
    marginTop: spacing[16],
  },
  timeline: {
    gap: spacing[10],
  },
  timelineRow: {
    borderLeftColor: colors.border,
    borderLeftWidth: 2,
    gap: spacing[4],
    paddingLeft: spacing[12],
  },
  positionButton: {
    alignSelf: "flex-start",
    marginBottom: spacing[24],
    marginTop: spacing[24],
  },
  pressed: {
    opacity: 0.75,
  },
});
