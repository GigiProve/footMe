import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Animated, Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, spacing } from "../../styles";
import { AppText } from "../AppText/AppText";

type IoniconsName = ComponentProps<typeof Ionicons>["name"];

export type ToastTone = "neutral" | "success";

export type ToastOptions = {
  message: string;
  tone?: ToastTone;
  icon?: IoniconsName;
};

type ToastContextValue = {
  showToast: (options: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DISMISS_DURATION = 2500;
const ANIMATION_DURATION = 200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isVisible = useRef(false);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 8,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToast(null);
      isVisible.current = false;
    });
  }, [opacity, translateY]);

  const show = useCallback(
    (options: ToastOptions) => {
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
        dismissTimer.current = null;
      }

      setToast(options);
      isVisible.current = true;

      opacity.setValue(0);
      translateY.setValue(8);

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start();

      dismissTimer.current = setTimeout(() => {
        hide();
      }, DISMISS_DURATION);
    },
    [opacity, translateY, hide],
  );

  const bottomOffset = insets.bottom + spacing[16];

  return (
    <ToastContext.Provider value={{ showToast: show }}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.container,
            { bottom: bottomOffset, opacity, transform: [{ translateY }] },
          ]}
        >
          <Pressable
            accessibilityLabel="Chiudi notifica"
            onPress={hide}
            style={[
              styles.pill,
              toast.tone === "success" ? styles.pillSuccess : styles.pillNeutral,
            ]}
          >
            {toast.icon ? (
              <Ionicons
                name={toast.icon}
                size={16}
                color={
                  toast.tone === "success"
                    ? colors.success
                    : colors.textSecondary
                }
                style={styles.icon}
              />
            ) : null}
            <AppText
              variant="bodySm"
              color={toast.tone === "success" ? "success" : "secondary"}
              style={styles.message}
            >
              {toast.message}
            </AppText>
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    left: spacing[20],
    position: "absolute",
    right: spacing[20],
    zIndex: 9999,
    elevation: 9999,
  },
  pill: {
    alignItems: "center",
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[10],
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  pillNeutral: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  pillSuccess: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  icon: {
    marginRight: spacing[6],
  },
  message: {
    flexShrink: 1,
  },
});
