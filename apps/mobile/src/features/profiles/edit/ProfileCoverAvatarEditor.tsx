/**
 * Copertina e foto profilo del modulo "Foto e dati personali"
 * (REV-PROF-05 e REV-PROF-08, schermata 2).
 *
 * La geometria è quella del Master Profile — copertina alta 150, avatar xl che
 * la scavalca — perché questa è un'anteprima di come il profilo verrà visto,
 * non un secondo layout.
 *
 * Due comandi, e solo due:
 *
 *  - "Modifica copertina", una pill sopra la copertina;
 *  - l'icona fotocamera sovrapposta all'avatar.
 *
 * Il pulsante rettangolare separato "Modifica foto" **non esiste**: è
 * esplicitamente vietato dalla task, e non va reintrodotto nemmeno come testo
 * accanto all'avatar. Chi tocca l'avatar apre lo stesso menu del badge, così
 * il bersaglio grande non resta inerte.
 */
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Avatar } from "../../../ui";
import { PROFILE_COVER_HEIGHT } from "../master/ProfileHeroHeader";

type ProfileCoverAvatarEditorProps = {
  avatarUrl: string | null;
  coverUrl: string | null;
  fullName: string;
  onEditAvatar: () => void;
  onEditCover: () => void;
  /** Prefisso dei testID: ogni ruolo conserva i propri. */
  testIDPrefix: string;
  uploading: "avatar" | "cover" | null;
};

export function ProfileCoverAvatarEditor({
  avatarUrl,
  coverUrl,
  fullName,
  onEditAvatar,
  onEditCover,
  testIDPrefix,
  uploading,
}: ProfileCoverAvatarEditorProps) {
  const isBusy = uploading !== null;

  return (
    <View style={styles.container} testID={`${testIDPrefix}-cover-avatar-editor`}>
      <View style={styles.cover}>
        {coverUrl ? (
          <Image
            accessibilityIgnoresInvertColors
            source={{ uri: coverUrl }}
            style={styles.coverImage}
          />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons color={colors.textMuted} name="image-outline" size={28} />
          </View>
        )}

        <Pressable
          accessibilityLabel="Modifica copertina"
          accessibilityRole="button"
          accessibilityState={{ busy: uploading === "cover", disabled: isBusy }}
          disabled={isBusy}
          // La pill segue il mockup nell ingombro; il target reale arriva a
          // 44pt grazie allo hitSlop, senza ingrassare il pulsante.
          hitSlop={8}
          onPress={onEditCover}
          style={({ pressed }) => [
            styles.coverAction,
            pressed ? styles.pressed : null,
          ]}
          testID={`${testIDPrefix}-cover-edit`}
        >
          {uploading === "cover" ? (
            <ActivityIndicator color={colors.textPrimary} size="small" />
          ) : (
            <Ionicons color={colors.textPrimary} name="camera-outline" size={16} />
          )}
          <AppText variant="actionLabel">Modifica copertina</AppText>
        </Pressable>
      </View>

      <Pressable
        accessibilityLabel="Modifica foto profilo"
        accessibilityRole="button"
        accessibilityState={{ busy: uploading === "avatar", disabled: isBusy }}
        disabled={isBusy}
        onPress={onEditAvatar}
        style={styles.avatarShell}
        testID={`${testIDPrefix}-avatar-edit`}
      >
        <Avatar name={fullName} size="xl" uri={avatarUrl ?? undefined} />

        {uploading === "avatar" ? (
          <View style={styles.avatarOverlay}>
            <ActivityIndicator color={colors.inkInvert} />
          </View>
        ) : null}

        {/*
          Il badge è decorativo: l'etichetta accessibile sta sul Pressable che
          lo contiene, altrimenti lo screen reader annuncerebbe due bersagli
          per lo stesso comando.
        */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.avatarBadge}
        >
          <Ionicons color={colors.inkInvert} name="camera" size={14} />
        </View>
      </Pressable>
    </View>
  );
}

const AVATAR_SIZE = 104;
const AVATAR_OVERLAP = 46;

const styles = StyleSheet.create({
  avatarBadge: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 2,
    bottom: 2,
    height: 30,
    justifyContent: "center",
    position: "absolute",
    right: 2,
    width: 30,
  },
  avatarOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(12, 27, 42, 0.45)",
    borderRadius: radius.full,
    bottom: 3,
    justifyContent: "center",
    left: 3,
    position: "absolute",
    right: 3,
    top: 3,
  },
  avatarShell: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    height: AVATAR_SIZE + 6,
    marginLeft: spacing[16],
    marginTop: -AVATAR_OVERLAP,
    padding: 3,
    width: AVATAR_SIZE + 6,
  },
  container: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    // Il blocco esce dal padding dello scaffold: copertina e avatar toccano i
    // bordi dello schermo come nel Master Profile.
    marginHorizontal: -spacing[16],
    marginTop: -spacing[16],
    paddingBottom: spacing[12],
  },
  cover: {
    backgroundColor: colors.surfacePlaceholder,
    height: PROFILE_COVER_HEIGHT,
    width: "100%",
  },
  coverAction: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    flexDirection: "row",
    gap: spacing[6],
    minHeight: 36,
    paddingHorizontal: spacing[12],
    position: "absolute",
    right: spacing[12],
    top: spacing[12],
  },
  coverImage: {
    height: "100%",
    width: "100%",
  },
  coverPlaceholder: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.75,
  },
});
