/**
 * Toolbar di formattazione dell'Articolo (HOM-06.2 §43–§45, §252, §255; mockup
 * 2–3): «Aa | B | I | Lista | 1. Lista | Link».
 *
 *  • ogni comando ha un nome accessibile («Grassetto», non «B») e lo stato attivo
 *    non è affidato al solo colore: `accessibilityState.selected` più una barra di
 *    2px sotto il comando (§252);
 *  • bersagli da 44pt (§255);
 *  • due varianti dello stesso componente: `inline`, sotto la copertina, a
 *    tastiera chiusa (come nel mockup); `sticky`, sopra la tastiera quando si
 *    scrive nel corpo (§45). Non sono mai montate insieme.
 *
 * Il componente non conosce l'editor: riceve i comandi e lo stato dei formati.
 */

import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../styles";
import { AppText } from "../../../ui";
import type { ActiveFormats } from "../article-editing";

type Props = {
  formats: ActiveFormats;
  enabled: boolean;
  variant: "inline" | "sticky";
  onHeading: () => void;
  onBold: () => void;
  onItalic: () => void;
  onBullet: () => void;
  onNumbered: () => void;
  onLink: () => void;
};

type CommandProps = {
  label: string;
  selected: boolean;
  enabled: boolean;
  onPress: () => void;
  testID: string;
  children: ReactNode;
};

function Command({ label, selected, enabled, onPress, testID, children }: CommandProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled, selected }}
      disabled={!enabled}
      onPress={onPress}
      style={({ pressed }) => [styles.command, selected ? styles.commandSelected : null, pressed ? styles.pressed : null]}
      testID={testID}
    >
      {children}
      {selected ? <View style={styles.indicator} /> : null}
    </Pressable>
  );
}

export function ArticleToolbar({ formats, enabled, variant, onHeading, onBold, onItalic, onBullet, onNumbered, onLink }: Props) {
  const tint = (selected: boolean) => (selected ? colors.accent : colors.textPrimary);

  return (
    <View
      accessibilityLabel="Formattazione del testo"
      accessibilityRole="toolbar"
      style={[styles.container, variant === "sticky" ? styles.sticky : styles.inline, enabled ? null : styles.disabled]}
      testID={`article-toolbar-${variant}`}
    >
      <Command enabled={enabled} label="Titolo di sezione" onPress={onHeading} selected={formats.heading} testID="article-toolbar-heading">
        <AppText color={formats.heading ? "accent" : "primary"} variant="titleMd">
          Aa
        </AppText>
      </Command>
      <Command enabled={enabled} label="Grassetto" onPress={onBold} selected={formats.bold} testID="article-toolbar-bold">
        <AppText color={formats.bold ? "accent" : "primary"} style={styles.bold} variant="titleMd">
          B
        </AppText>
      </Command>
      <Command enabled={enabled} label="Corsivo" onPress={onItalic} selected={formats.italic} testID="article-toolbar-italic">
        <AppText color={formats.italic ? "accent" : "primary"} style={styles.italic} variant="titleMd">
          I
        </AppText>
      </Command>
      <Command enabled={enabled} label="Elenco puntato" onPress={onBullet} selected={formats.bullet} testID="article-toolbar-bullet">
        <Ionicons color={tint(formats.bullet)} name="list-outline" size={22} />
      </Command>
      <Command enabled={enabled} label="Elenco numerato" onPress={onNumbered} selected={formats.numbered} testID="article-toolbar-numbered">
        <View style={styles.numbered}>
          <AppText color={formats.numbered ? "accent" : "primary"} variant="actionLabel">
            1.
          </AppText>
          <Ionicons color={tint(formats.numbered)} name="list-outline" size={18} />
        </View>
      </Command>
      <Command enabled={enabled} label="Link" onPress={onLink} selected={formats.link} testID="article-toolbar-link">
        <Ionicons color={tint(formats.link)} name="link-outline" size={22} />
      </Command>
    </View>
  );
}

const styles = StyleSheet.create({
  bold: {
    // Il «B» è l'unico punto della toolbar che mostra la formattazione che applica.
    fontWeight: "800",
  },
  command: {
    alignItems: "center",
    borderRadius: radius.full,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
  },
  commandSelected: {
    backgroundColor: colors.accentSoft,
  },
  container: {
    alignItems: "center",
    backgroundColor: colors.surface,
    flexDirection: "row",
    paddingHorizontal: spacing[8],
  },
  disabled: {
    opacity: 0.45,
  },
  indicator: {
    backgroundColor: colors.accent,
    borderRadius: 1,
    bottom: spacing[4],
    height: 2,
    position: "absolute",
    width: 16,
  },
  inline: {
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    borderTopColor: colors.divider,
    borderTopWidth: 1,
  },
  italic: {
    fontStyle: "italic",
  },
  numbered: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  pressed: {
    opacity: 0.6,
  },
  sticky: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
});
