import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";

import { logout } from "../../features/auth/logout";
import { useSession } from "../../features/auth/use-session";
import { withDefaultProfileAvatar } from "../../features/profiles/profile-avatar";
import { colors, radius, shadows, sizes, spacing, typography, zIndex } from "../../theme/tokens";

type SidebarRoute = "/(tabs)" | "/(tabs)/announcements" | "/(tabs)/messages" | "/(tabs)/profile" | "/settings";

type AppSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

type SidebarHeaderProps = {
  avatarUrl: string | null | undefined;
  fullName: string;
  headline: string;
  locationLabel: string;
};

type SidebarItemProps = {
  accessibilityLabel?: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: "default" | "system" | "danger";
};

type SidebarFooterProps = {
  isLoading: boolean;
  onLogout: () => Promise<void>;
};

const sidebarWidth = Math.min(Math.round(Dimensions.get("window").width * 0.82), 360);

const navigationItems: {
  icon: SidebarItemProps["icon"];
  label: string;
  route: SidebarRoute;
}[] = [
  {
    icon: "person-outline",
    label: "Profilo",
    route: "/(tabs)/profile",
  },
  {
    icon: "grid-outline",
    label: "I miei contenuti",
    route: "/(tabs)",
  },
  {
    icon: "megaphone-outline",
    label: "Annunci",
    route: "/(tabs)/announcements",
  },
  {
    icon: "chatbubble-ellipses-outline",
    label: "Messaggi",
    route: "/(tabs)/messages",
  },
];

export function AppSidebar({ isOpen, onClose }: AppSidebarProps) {
  const router = useRouter();
  const { profile, session } = useSession();
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const translateX = useRef(new Animated.Value(-sidebarWidth)).current;

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      translateX.setValue(-sidebarWidth);
      Animated.timing(translateX, {
        duration: 180,
        toValue: 0,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(translateX, {
      duration: 160,
      toValue: -sidebarWidth,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsMounted(false);
      }
    });
  }, [isOpen, translateX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          gestureState.dx < -6,
        onPanResponderMove: (_event, gestureState) => {
          if (gestureState.dx < 0) {
            translateX.setValue(Math.max(gestureState.dx, -sidebarWidth));
          }
        },
        onPanResponderRelease: (_event, gestureState) => {
          if (gestureState.dx < -sidebarWidth / 4 || gestureState.vx < -0.65) {
            onClose();
            return;
          }

          Animated.timing(translateX, {
            duration: 140,
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [onClose, translateX],
  );

  if (!isMounted) {
    return null;
  }

  const displayName =
    profile?.full_name?.trim() || session?.user.email?.trim() || "Utente footMe";
  const headline = formatHeadline(profile?.role);
  const locationLabel = formatSupportingMeta(profile?.club_name, profile?.city, profile?.region);

  function handleNavigate(route: SidebarRoute) {
    onClose();
    router.push(route);
  }

  async function handleLogout() {
    try {
      setIsLoggingOut(true);
      await logout();
      onClose();
      router.replace("/(auth)/sign-in");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossibile terminare la sessione.";
      Alert.alert("Logout non riuscito", message);
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <Modal
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent
      visible
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="Chiudi menu laterale"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.overlay}
        />
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.drawer,
            {
              transform: [{ translateX }],
              width: sidebarWidth,
            },
          ]}
        >
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.content}>
              <ScrollView
                bounces={false}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                <SidebarHeader
                  avatarUrl={profile?.avatar_url}
                  fullName={displayName}
                  headline={headline}
                  locationLabel={locationLabel}
                />
                <View style={styles.sectionDivider} />
                <View style={styles.sectionGroup}>
                  {navigationItems.map((item) => (
                    <SidebarItem
                      key={item.label}
                      accessibilityLabel={`Apri ${item.label}`}
                      icon={item.icon}
                      label={item.label}
                      onPress={() => handleNavigate(item.route)}
                    />
                  ))}
                </View>
              </ScrollView>

              <View style={styles.footerArea}>
                <View style={styles.sectionDivider} />
                <SidebarItem
                  accessibilityLabel="Apri impostazioni"
                  icon="settings-outline"
                  label="Impostazioni"
                  onPress={() => handleNavigate("/settings")}
                  tone="system"
                />
                <View style={styles.sectionDivider} />
                <SidebarFooter isLoading={isLoggingOut} onLogout={handleLogout} />
              </View>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

export function SidebarHeader({
  avatarUrl,
  fullName,
  headline,
  locationLabel,
}: SidebarHeaderProps) {
  return (
    <View style={styles.header}>
      <Image
        accessibilityLabel="Avatar utente"
        source={{ uri: withDefaultProfileAvatar(avatarUrl) }}
        style={styles.avatar}
      />
      <View style={styles.headerCopy}>
        <Text style={styles.fullName}>{fullName}</Text>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.location}>{locationLabel}</Text>
      </View>
    </View>
  );
}

export function SidebarItem({
  accessibilityLabel,
  icon,
  label,
  onPress,
  tone = "default",
}: SidebarItemProps) {
  const iconColor =
    tone === "danger"
      ? colors.dangerStrong
      : tone === "system"
        ? colors.hero
        : colors.textPrimary;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        pressed ? styles.itemPressed : null,
        tone === "danger" ? styles.itemDanger : null,
      ]}
    >
      <View style={styles.itemIconWrap}>
        <Ionicons
          accessibilityElementsHidden
          color={iconColor}
          name={icon}
          size={22}
        />
      </View>
      <Text
        style={[
          styles.itemLabel,
          tone === "system" ? styles.systemLabel : null,
          tone === "danger" ? styles.dangerLabel : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SidebarFooter({ isLoading, onLogout }: SidebarFooterProps) {
  return (
    <SidebarItem
      accessibilityLabel="Logout"
      icon="log-out-outline"
      label={isLoading ? "Logout in corso..." : "Logout"}
      onPress={() => {
        void onLogout();
      }}
      tone="danger"
    />
  );
}

function formatHeadline(role: string | null | undefined) {
  switch (role) {
    case "player":
      return "Calciatore";
    case "coach":
      return "Allenatore";
    case "staff":
      return "Staff";
    case "club_admin":
      return "Societa'";
    default:
      return "Profilo footMe";
  }
}

function formatSupportingMeta(
  clubName: string | null | undefined,
  city: string | null | undefined,
  region: string | null | undefined,
) {
  const location = [city, region].filter(Boolean).join(", ");

  if (clubName && location) {
    return `${clubName} · ${location}`;
  }

  return clubName || location || "Squadra e localita' da completare";
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 3,
    height: 72,
    width: 72,
  },
  content: {
    flex: 1,
  },
  dangerLabel: {
    color: colors.dangerStrong,
  },
  drawer: {
    backgroundColor: colors.surface,
    borderBottomRightRadius: radius[28],
    borderTopRightRadius: radius[28],
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    ...shadows.card,
  },
  footerArea: {
    gap: spacing[14],
    paddingBottom: spacing[20],
  },
  fullName: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[24],
    fontWeight: typography.fontWeight.heavy,
    lineHeight: typography.lineHeight[32],
  },
  header: {
    gap: spacing[16],
  },
  headerCopy: {
    gap: spacing[6],
  },
  headline: {
    color: colors.textSecondary,
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.bold,
  },
  item: {
    alignItems: "center",
    borderRadius: radius[20],
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget + spacing[12],
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
  },
  itemDanger: {
    backgroundColor: colors.dangerSoft,
  },
  itemIconWrap: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    width: sizes.touchTarget,
  },
  itemLabel: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.medium,
  },
  itemPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  location: {
    color: colors.textMuted,
    fontSize: typography.fontSize[14],
    lineHeight: typography.lineHeight[22],
  },
  modalRoot: {
    backgroundColor: "rgba(29, 34, 38, 0.38)",
    flex: 1,
    zIndex: zIndex.modal,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing[18],
    paddingBottom: spacing[20],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[28],
  },
  sectionDivider: {
    backgroundColor: colors.border,
    height: 1,
    marginHorizontal: spacing[20],
  },
  sectionGroup: {
    gap: spacing[4],
  },
  systemLabel: {
    color: colors.hero,
    fontWeight: typography.fontWeight.semibold,
  },
});
