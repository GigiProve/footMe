/**
 * Riga del Centro Notifiche (HOM-14 §24–§29, §238–§254).
 *
 * Lista aperta, non una card (§25): padding 20, separatore `colors.divider` in
 * fondo, nessun bordo. Non aperta = fondo azzurrino leggero `heroSoft` (§26) più
 * un piccolo dot; aperta = fondo bianco (§27). Il fondo non è l'unico segnale:
 * l'etichetta di accessibilità dice «Non aperta» (§249).
 *
 * Attore (avatar/logo, nome, check standard) e copy sociale arrivano da
 * `notification-presentation`; le righe operative senza attore mostrano l'icona
 * della categoria. Nessun troncamento del testo essenziale (§250): il nome può
 * andare a capo, la preview è limitata a due righe (§251).
 *
 * DAS-REV-34 §15–§17, screen 07/08: le notifiche strutturali dei gruppi (target
 * `conversation`) mostrano l'avatar del gruppo (`GroupAvatar`, iniziali senza
 * immagine), il titolo del server e una riga di contesto «AC Como · Ora»: il tempo
 * passa lì, non nella colonna a destra. Nessuna categoria né filtro nuovi.
 */

import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { formatCompactRelativeTime, formatRelativeTime } from "../../lib/relative-time";
import { colors, radius, spacing } from "../../styles";
import { AppText, Avatar, VerifiedCheck } from "../../ui";
import { GroupAvatar } from "../dashboard/groups/components/GroupAvatar";
import {
  conversationContextLine,
  conversationNotificationDisplay,
  isSocialNotification,
  notificationAccessibilityLabel,
  notificationActorName,
  notificationPreview,
  notificationPrimaryText,
  notificationSecondaryText,
} from "./notification-presentation";
import type { InboxNotification } from "./notification-types";
import { iconNameForNotificationType, resolveNotificationCategory } from "./notifications-helpers";

type NotificationRowProps = {
  notification: InboxNotification;
  onPress: (notification: InboxNotification) => void;
};

export function NotificationRow({ notification, onPress }: NotificationRowProps) {
  const isUnopened = !notification.isOpened;
  const social = isSocialNotification(notification);
  const conversation = conversationNotificationDisplay(notification);
  const actor = notification.actor;
  const secondary = notificationSecondaryText(notification);
  const preview = notificationPreview(notification);
  const iconName = iconNameForNotificationType(
    notification.type,
    resolveNotificationCategory(notification),
  ) as keyof typeof Ionicons.glyphMap;

  return (
    <Pressable
      accessibilityLabel={notificationAccessibilityLabel(notification)}
      accessibilityRole="button"
      onPress={() => onPress(notification)}
      style={({ pressed }) => [
        styles.container,
        isUnopened ? styles.unopened : null,
        pressed ? styles.pressed : null,
      ]}
    >
      {conversation ? (
        /* Stessa resa dei gruppi in Inbox e Centro (`GroupAvatar`); l'hairline tiene il cerchio sull'azzurrino. */
        <View style={styles.avatarRing}>
          <GroupAvatar name={conversation.groupName} path={conversation.avatarPath} size="md" />
        </View>
      ) : social && actor ? (
        /* Le iniziali su `accentSoft` sparirebbero sulla riga azzurrina (`heroSoft`): l'hairline tiene il cerchio. */
        <View style={[styles.avatarRing, actor.type === "society" ? styles.avatarRingSquare : null]}>
          <Avatar
            name={notificationActorName(notification)}
            size="md"
            square={actor.type === "society"}
            tone={actor.type === "society" ? "ink" : "accent"}
            uri={actor.available ? actor.avatarUrl : null}
          />
        </View>
      ) : (
        <View style={styles.iconCircle}>
          <Ionicons color={colors.accent} name={iconName} size={22} />
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <AppText style={styles.name} variant="titleMd">
            {notificationPrimaryText(notification)}
          </AppText>
          {social && actor?.available && actor.verified ? <VerifiedCheck size={15} /> : null}
        </View>
        {secondary ? (
          <AppText color="secondary" variant="feedBody">
            {secondary}
          </AppText>
        ) : null}
        {preview ? (
          <AppText color="muted" numberOfLines={2} variant="feedBody">
            {`“${preview}”`}
          </AppText>
        ) : null}
        {conversation ? (
          /* Screen 07/08: «AC Como · Ora». Il tempo sta qui, non nella colonna a destra. */
          <AppText color="muted" variant="feedMeta">
            {conversationContextLine(notification, formatRelativeTime(notification.displayAt))}
          </AppText>
        ) : null}
      </View>

      <View style={styles.meta}>
        {conversation ? null : (
          <AppText color="muted" variant="feedMeta">
            {formatCompactRelativeTime(notification.displayAt)}
          </AppText>
        )}
        {isUnopened ? <View style={styles.dot} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatarRing: {
    // In riga con un titolo su due righe l'anello si stirava in verticale (capsula).
    alignSelf: "flex-start",
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  avatarRingSquare: {
    borderRadius: radius[11],
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  container: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[14],
  },
  dot: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    height: 8,
    width: 8,
  },
  iconCircle: {
    alignItems: "center",
    // Sulla riga azzurrina `accentSoft` sparirebbe (stesso valore di `heroSoft`): hairline e fondo bianco.
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  meta: {
    alignItems: "flex-end",
    gap: spacing[8],
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
    opacity: 0.82,
  },
  unopened: {
    backgroundColor: colors.heroSoft,
  },
});
