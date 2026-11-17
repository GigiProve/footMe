/**
 * Snackbar unica dell'app (HOM-15 §221).
 *
 * §227: sta sopra la bottom nav quando è visibile (il layout delle tab registra
 * la propria altezza con `useToastBottomInset`), sopra la safe area e, su iOS,
 * sopra la tastiera. Su Android la finestra si ridimensiona da sé con la
 * tastiera (`softwareKeyboardLayoutMode: resize`, lo stesso presupposto di
 * `ContentDetailFrame`), quindi non si somma nulla.
 *
 * §266: il messaggio è il nome parlato della snackbar ed è annunciato quando
 * compare (live region su Android, annuncio esplicito su iOS); «tocca per
 * chiudere» è un suggerimento, non sostituisce il testo. §366: l'unica ombra
 * è `shadows.overlay`, quella degli elementi che galleggiano sulla pagina.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, shadows, spacing } from "../../styles";
import { AppText } from "../AppText/AppText";

type IoniconsName = ComponentProps<typeof Ionicons>["name"];

export type ToastTone = "neutral" | "success";

export type ToastAction = {
  label: string;
  onPress: () => void;
};

export type ToastOptions = {
  /**
   * Azione inline a destra del messaggio. Serve alla snackbar di
   * aggiornamento fallito della Dashboard (DAS-REV-02 §28), che senza un
   * "Riprova" raggiungibile sarebbe un avviso senza uscita.
   */
  action?: ToastAction;
  /**
   * Identità del messaggio. Due show consecutivi con lo stesso `id`
   * ri-mostrano lo stesso avviso invece di accodarne un secondo: §28 chiede
   * che gli avvisi già presenti non si moltiplichino a ogni tentativo.
   */
  id?: string;
  message: string;
  tone?: ToastTone;
  icon?: IoniconsName;
  /**
   * Colora solo l'icona di verde, lasciando il toast neutro (HOM-09 §246: un
   * normale success icon, non un fondo verde). Con `tone: "success"` non serve.
   */
  iconTone?: "success";
};

type ToastContextValue = {
  showToast: (options: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * §227: chi copre il fondo dello schermo (oggi solo la bottom nav) registra qui
 * la propria altezza. Il default è un no-op, così il gancio non richiede il
 * provider nei test.
 */
const ToastInsetContext = createContext<(inset: number) => void>(() => undefined);

const DISMISS_DURATION = 2500;
/** Con un'azione da leggere e toccare, 2,5 s non bastano. */
const DISMISS_DURATION_WITH_ACTION = 6000;
const ANIMATION_DURATION = 200;
/** Etichetta ~18pt + 13 sopra e sotto = 44pt di area di tocco (HOM-11 §206). */
const ACTION_HIT_SLOP = { bottom: 13, left: 8, right: 8, top: 13 };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [bottomInset, setBottomInset] = useState(0);
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isVisible = useRef(false);
  const visibleId = useRef<string | null>(null);

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
      visibleId.current = null;
    });
  }, [opacity, translateY]);

  const show = useCallback(
    (options: ToastOptions) => {
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
        dismissTimer.current = null;
      }

      // Stesso avviso già a schermo: si rinnova il contenuto e si riarma il
      // timer, senza rianimare l'ingresso. È ciò che impedisce la raffica di
      // snackbar quando un refresh in background fallisce più volte.
      const isSameVisible =
        isVisible.current && !!options.id && visibleId.current === options.id;

      setToast(options);
      isVisible.current = true;
      visibleId.current = options.id ?? null;

      if (!isSameVisible) {
        opacity.setValue(0);
        translateY.setValue(8);
        // §266: iOS non ha live region, l'annuncio è esplicito. Android legge il
        // contenitore (`accessibilityLiveRegion`) e non va annunciato due volte.
        if (Platform.OS === "ios") {
          AccessibilityInfo.announceForAccessibility(options.message);
        }
      }

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

      dismissTimer.current = setTimeout(
        () => {
          hide();
        },
        options.action ? DISMISS_DURATION_WITH_ACTION : DISMISS_DURATION,
      );
    },
    [opacity, translateY, hide],
  );

  return (
    <ToastContext.Provider value={{ showToast: show }}>
      <ToastInsetContext.Provider value={setBottomInset}>{children}</ToastInsetContext.Provider>
      <ToastAnchor
        bottomInset={bottomInset}
        opacity={opacity}
        translateY={translateY}
        visible={toast !== null}
      >
        {toast ? (
          <View
            accessibilityLiveRegion="polite"
            style={[
              styles.pill,
              toast.tone === "success" ? styles.pillSuccess : styles.pillNeutral,
            ]}
          >
            <Pressable
              accessibilityHint="Tocca per chiudere"
              accessibilityLabel={toast.message}
              onPress={hide}
              style={styles.messageArea}
            >
              {toast.icon ? (
                <Ionicons
                  name={toast.icon}
                  size={16}
                  color={
                    toast.tone === "success" || toast.iconTone === "success"
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

            {toast.action ? (
              <Pressable
                accessibilityLabel={toast.action.label}
                accessibilityRole="button"
                // HOM-11 §206: l'etichetta è alta ~18pt; l'area di tocco arriva a 44pt
                // senza cambiare l'aspetto della snackbar.
                hitSlop={ACTION_HIT_SLOP}
                onPress={() => {
                  const action = toast.action;
                  hide();
                  action?.onPress();
                }}
                style={({ pressed }) => [
                  styles.action,
                  pressed ? styles.actionPressed : null,
                ]}
              >
                <AppText color="accent" variant="actionLabel">
                  {toast.action.label}
                </AppText>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ToastAnchor>
    </ToastContext.Provider>
  );
}

/**
 * Posizione della snackbar (§227): sopra safe area, bottom nav registrata e
 * tastiera. La tastiera è ascoltata qui, non nel provider, perché aprirla e
 * chiuderla non ridisegni ogni consumatore di `useToast`.
 */
function ToastAnchor({
  bottomInset,
  children,
  opacity,
  translateY,
  visible,
}: {
  bottomInset: number;
  children: ReactNode;
  opacity: Animated.Value;
  translateY: Animated.Value;
  visible: boolean;
}) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useIosKeyboardHeight();

  if (!visible) {
    return null;
  }

  // A tastiera aperta è lei a coprire bottom nav e safe area: vale il massimo.
  const bottom = Math.max(insets.bottom, bottomInset, keyboardHeight) + spacing[16];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.container, { bottom, opacity, transform: [{ translateY }] }]}
    >
      {children}
    </Animated.View>
  );
}

/** Altezza della tastiera su iOS; 0 su Android, dove la finestra si ridimensiona da sé. */
function useIosKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "ios") {
      return undefined;
    }

    const show = Keyboard.addListener("keyboardWillShow", (event) =>
      setHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener("keyboardWillHide", () => setHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}

/**
 * §227: dichiara che il fondo dello schermo è coperto per `inset` punti (es. la
 * bottom nav finché è a schermo). 0 = niente da evitare; allo smontaggio torna 0.
 */
export function useToastBottomInset(inset: number): void {
  const setInset = useContext(ToastInsetContext);

  useEffect(() => {
    setInset(inset);

    return () => setInset(0);
  }, [inset, setInset]);
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
    ...shadows.overlay,
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
  messageArea: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
  },
  action: {
    paddingLeft: spacing[12],
  },
  actionPressed: {
    opacity: 0.6,
  },
});
