/**
 * Blocchi del dettaglio evento (DAS-REV-29 §4, §7, §11; screen 01, 08-16).
 *
 * Quattro pezzi piccoli in un file solo perché li usano insieme dettaglio,
 * vista pubblica in app e richiesta: barra Società, riga informativa con
 * icona, riquadro di stato, locandina. Stile Foundation (§4): base bianca,
 * testo nero neutro, metadati grigi, hairline, nessuna ombra, nessun verde
 * decorativo per «Iscrizione confermata».
 */
import type { ComponentProps } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../../../theme/tokens";
import { AppText, Avatar } from "../../../../../ui";
import type { Notice } from "../event-detail-presentation";

/**
 * Back, logo reale, nome e check solo con verifica reale (§7). Senza logo il
 * fallback condiviso di `Avatar` (iniziali): nessuno stemma inventato.
 */
export function EventClubBar({
  isVerified,
  logoUrl,
  menuLabel,
  name,
  onBack,
  onMenu,
}: {
  isVerified: boolean;
  logoUrl: string | null;
  /** DAS-REV-31 §17–§18: etichetta accessibile del menu «Gestisci evento». */
  menuLabel?: string;
  name: string;
  onBack?: () => void;
  /** DAS-REV-31 screen 07–08: presente solo con almeno un'azione autorizzata. */
  onMenu?: () => void;
}) {
  return (
    <View style={styles.bar}>
      {onBack ? (
        <Pressable
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onBack}
          style={({ pressed }) => [styles.back, pressed ? styles.pressed : null]}
          testID="event-detail-back"
        >
          <Ionicons color={colors.textNeutral} name="chevron-back" size={24} />
        </Pressable>
      ) : null}

      {/* Caricamento e contenuto indisponibile: solo il back, nessuna
          identità della Società (§25, screen 20). */}
      {name ? (
        <>
          <Avatar name={name} size="sm" square tone="ink" uri={logoUrl ?? undefined} />
          <AppText color="neutral" numberOfLines={1} style={styles.clubName} variant="titleSm">
            {name}
          </AppText>
        </>
      ) : null}

      {isVerified ? (
        <Ionicons
          accessibilityLabel="Società verificata"
          color={colors.accent}
          name="checkmark-circle"
          size={16}
        />
      ) : null}

      {onMenu ? (
        <Pressable
          accessibilityLabel={menuLabel}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onMenu}
          style={({ pressed }) => [styles.menu, pressed ? styles.pressed : null]}
          testID="event-manage-menu"
        >
          <Ionicons color={colors.textNeutral} name="ellipsis-horizontal" size={22} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * DAS-REV-31 §5, §15, §19: stato testuale sobrio («Evento iniziato», «Evento
 * concluso», «Evento annullato»). Pillola neutra: nessun verde per il
 * concluso, nessun rosso per l'annullato, che non è un errore.
 */
export function EventStatusPill({ label, testID }: { label: string; testID?: string }) {
  return (
    <View accessible accessibilityLabel={label} accessibilityRole="text" style={styles.pill} testID={testID}>
      <Ionicons color={colors.textNeutral} name="information-circle-outline" size={16} />
      <AppText color="neutral" variant="meta">
        {label}
      </AppText>
    </View>
  );
}

/**
 * Contenuto realmente indisponibile (§25, screen 20 in app): nessun titolo,
 * Società o dettaglio, e nessun «Riprova» — non è un errore di rete.
 */
export function EventUnavailableState({ body, title }: { body: string; title: string }) {
  return (
    <View accessible accessibilityRole="text" style={styles.unavailable} testID="event-unavailable">
      <Ionicons color={colors.textNeutralMuted} name="document-outline" size={40} />
      <AppText align="center" color="neutral" variant="titleMd">
        {title}
      </AppText>
      <AppText align="center" color="neutralMuted" variant="bodySm">
        {body}
      </AppText>
    </View>
  );
}

/** Riga con icona e una o più righe di testo (data, luogo, capienza). */
export function EventInfoRow({
  icon,
  lines,
  testID,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  lines: readonly string[];
  testID?: string;
}) {
  if (lines.length === 0) {
    return null;
  }

  return (
    <View accessible accessibilityLabel={lines.join(", ")} style={styles.infoRow} testID={testID}>
      <Ionicons color={colors.textNeutral} name={icon} size={18} style={styles.infoIcon} />
      <View style={styles.infoBody}>
        {lines.map((line) => (
          <AppText color="neutral" key={line} variant="bodySm">
            {line}
          </AppText>
        ))}
      </View>
    </View>
  );
}

/** Titolo di sezione grigio + testo (anni, descrizione, requisiti). */
export function EventTextSection({
  body,
  strongTitle = false,
  testID,
  title,
}: {
  body: string | null;
  strongTitle?: boolean;
  testID?: string;
  title: string;
}) {
  if (!body) {
    return null;
  }

  return (
    <View style={styles.textSection} testID={testID}>
      <AppText color={strongTitle ? "neutral" : "neutralMuted"} variant={strongTitle ? "metaStrong" : "meta"}>
        {title}
      </AppText>
      <AppText color="neutral" variant="bodySm">
        {body}
      </AppText>
    </View>
  );
}

/**
 * Riquadro di stato: icona, titolo, righe. Neutro per gli stati di business
 * (§4: «Verde non è necessario … check, testo e gerarchia bastano»), giallo
 * tenue solo per l'avviso informativo sugli anni (screen 10).
 */
export function EventNoticeCard({ notice, testID }: { notice: Notice; testID?: string }) {
  const warning = notice.tone === "warning";

  return (
    <View
      accessible
      accessibilityLabel={[notice.title, ...notice.lines].join(". ")}
      accessibilityRole="text"
      style={[styles.notice, warning ? styles.noticeWarning : null]}
      testID={testID}
    >
      <Ionicons
        color={warning ? colors.warning : colors.textNeutral}
        name={notice.icon}
        size={22}
        style={styles.noticeIcon}
      />
      <View style={styles.noticeBody}>
        <AppText color="neutral" variant="titleSm">
          {notice.title}
        </AppText>
        {notice.lines.map((line) => (
          <AppText color={warning ? "warning" : "neutralMuted"} key={line} variant="bodySm">
            {line}
          </AppText>
        ))}
      </View>
    </View>
  );
}

/**
 * Locandina (§8): `contain` dentro un riquadro con il rapporto reale,
 * riservato prima del caricamento (niente salti), nessun crop distruttivo.
 * Se l'immagine fallisce o non è firmabile il riquadro non compare: i dati
 * strutturati restano la fonte (QA-126).
 */
export function EventFlyerImage({
  height,
  onError,
  title,
  uri,
  width,
}: {
  height: number | null;
  onError?: () => void;
  title: string;
  uri: string | null;
  width: number | null;
}) {
  if (!uri) {
    return null;
  }

  const ratio = width && height ? Math.min(Math.max(width / height, 0.5), 2) : 4 / 5;

  return (
    <View style={[styles.flyer, { aspectRatio: ratio }]} testID="event-flyer">
      <Image
        accessibilityIgnoresInvertColors
        accessibilityLabel={`Locandina: ${title}`}
        onError={onError}
        resizeMode="contain"
        source={{ uri }}
        style={styles.flyerImage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    marginLeft: -spacing[12],
    width: sizes.touchTarget,
  },
  bar: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
  },
  clubName: {
    flexShrink: 1,
    fontWeight: "600",
  },
  flyer: {
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius[16],
    overflow: "hidden",
    width: "100%",
  },
  flyerImage: {
    height: "100%",
    width: "100%",
  },
  infoBody: {
    flex: 1,
    gap: spacing[4],
  },
  menu: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    marginLeft: "auto",
    marginRight: -spacing[12],
    width: sizes.touchTarget,
  },
  pill: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.full,
    flexDirection: "row",
    gap: spacing[6],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[6],
  },
  infoIcon: {
    marginTop: 1,
  },
  infoRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
  },
  notice: {
    alignItems: "flex-start",
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius[16],
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  noticeBody: {
    flex: 1,
    gap: spacing[4],
  },
  noticeIcon: {
    marginTop: 1,
  },
  noticeWarning: {
    backgroundColor: colors.noticeWarnSurface,
    borderColor: colors.noticeWarnBorder,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.6,
  },
  textSection: {
    gap: spacing[4],
  },
  unavailable: {
    alignItems: "center",
    gap: spacing[8],
    paddingHorizontal: spacing[24],
    paddingTop: spacing[48],
  },
});
