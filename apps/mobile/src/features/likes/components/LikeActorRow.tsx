/**
 * Riga della lista Mi piace (HOM-07 §47–§57, §179–§180, §197, §199).
 *
 * Persona, Società e Media hanno la stessa struttura: avatar (logo quadrato per
 * le Società), nome con check di verifica, UNA riga di metadata, CTA Follow a
 * destra. Righe separate da whitespace e divider, non da card (§199).
 *
 * Avatar, nome e riga sono un solo bersaglio che apre l'identità per id (§53) e
 * un'unica unità per lo screen reader (§179). Il Follow è un bersaglio a parte:
 * `FollowAction`, lo stesso componente e lo stesso copy della Home («Segui» /
 * «Seguito», §56), con stato e azione nell'etichetta parlata (§180). Nessuna CTA
 * per l'identità del viewer (§57).
 */

import { Pressable, StyleSheet, View } from "react-native";

import { colors, spacing, sizes } from "../../../theme/tokens";
import { AppText, Avatar, VerifiedCheck } from "../../../ui";
import { FollowAction } from "../../feed/components/items/FollowAction";
import {
  canFollowActor,
  likeActorAccessibilityLabel,
  likeActorMetaLine,
} from "../likes-presentation";
import type { LikeActor } from "../likes-types";

type LikeActorRowProps = {
  actor: LikeActor;
  isFollowBusy: boolean;
  onOpen: () => void;
  onToggleFollow: () => void;
};

export function LikeActorRow({ actor, isFollowBusy, onOpen, onToggleFollow }: LikeActorRowProps) {
  const meta = likeActorMetaLine(actor);

  return (
    <View style={styles.row} testID={`like-actor-${actor.key}`}>
      <Pressable
        accessibilityLabel={likeActorAccessibilityLabel(actor)}
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [styles.identity, pressed ? styles.pressed : null]}
        testID={`like-actor-open-${actor.key}`}
      >
        <Avatar
          name={actor.name}
          size="md"
          square={actor.actorType === "society"}
          uri={actor.avatarUrl ?? undefined}
        />
        <View style={styles.text}>
          <View style={styles.nameRow}>
            <AppText numberOfLines={1} style={styles.name} variant="titleMd">
              {actor.name}
            </AppText>
            {actor.isVerified ? <VerifiedCheck /> : null}
          </View>
          {meta ? (
            <AppText color="muted" numberOfLines={1} variant="feedMeta">
              {meta}
            </AppText>
          ) : null}
        </View>
      </Pressable>

      {canFollowActor(actor) ? (
        <FollowAction
          isBusy={isFollowBusy}
          isFollowing={actor.isFollowing}
          name={actor.name}
          onPress={onToggleFollow}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  identity: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
  },
  name: {
    flexShrink: 1,
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  pressed: {
    opacity: 0.7,
  },
  row: {
    alignItems: "center",
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  text: {
    flex: 1,
    gap: spacing[4],
  },
});
