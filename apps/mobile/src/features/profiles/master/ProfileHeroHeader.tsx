/**
 * Header del Master Profile (REV-PROF-01 §7, §8).
 *
 * Non è specifico del Calciatore: prende identità, righe meta e azioni già
 * risolte e le dispone sempre allo stesso modo, così le tipologie di profilo
 * successive riusano questo header invece di riscriverne uno.
 */
import { type ReactNode } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Avatar } from "../../../ui";

/**
 * Cover compatta (§7): resta una fascia editoriale sopra l'identità, non un
 * hero. Il valore non va alzato senza rivedere lo Screen Master.
 */
export const PROFILE_COVER_HEIGHT = 150;
/** `Avatar size="xl"` misura 104: l'overlap è calcolato su quella misura. */
const AVATAR_SIZE = 104;
const AVATAR_OVERLAP = 46;
/**
 * Logo di una realtà (REV-PROF-21). Più piccolo dell'avatar personale, come
 * lo stemma della Società: un marchio non è un ritratto, non va riempito a
 * forza in un cerchio e non deve dominare il nome.
 */
const LOGO_SIZE = 84;
const LOGO_OVERLAP = 42;

export type ProfileHeroMetaRow = {
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  key: string;
  text: string;
};

export type ProfileHeroBadge = {
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  key: string;
  label: string;
};

type ProfileHeroHeaderProps = {
  /** Azioni della riga sotto l'identità: cambiano fra Owner e Visitor (§6). */
  actions?: ReactNode;
  avatarUrl: string | null | undefined;
  /**
   * Badge compatti sotto le righe meta: licenza professionale, certificazioni.
   * Testo costruito dai dati reali del profilo, mai un'etichetta fissa
   * (REV-PROF-13 §"Licenza"). Lista vuota: nessuna riga, nessuno spazio.
   */
  badges?: readonly ProfileHeroBadge[];
  /**
   * Disponibilità: visibile ma discreta — testo navy e un punto blu, mai un
   * badge verde o una card dedicata (§7).
   */
  availabilityLabel?: string;
  coverImageUrl?: string | null;
  /**
   * Descrizione sintetica sotto la riga di ruolo (REV-PROF-21): una sola
   * frase, due righe al massimo, il testo completo vive nella tab Info.
   * Assente, la riga non esiste e al Visitor non compare nessun placeholder.
   */
  description?: string | null;
  /**
   * Identità di una realtà e non di una persona (REV-PROF-21): il logo è un
   * marchio, quindi quadrato con angoli morbidi e `contain`, con un
   * monogramma come fallback al posto dell'avatar di default.
   */
  entityMode?: boolean;
  /**
   * Azione terziaria su una riga propria sotto le azioni principali — "Visita
   * sito". Fuori dalla gerarchia dei due pulsanti, perché non è la stessa
   * cosa di Segui e Messaggio.
   */
  footerAction?: ReactNode;
  fullName: string;
  /**
   * Badge di verifica accanto al nome. Compare solo su un profilo verificato
   * davvero: l'assenza del dato non è una verifica mancata da disegnare, è una
   * verifica che non c'è.
   */
  isVerified?: boolean;
  /** Monogramma del logo quando manca l'immagine (solo `entityMode`). */
  logoInitials?: string;
  metaRows?: readonly ProfileHeroMetaRow[];
  /**
   * Rende il ruolo secondario un collegamento. Serve alla squadra del cuore
   * del Tifoso (REV-PROF-19), che sta accanto alla label di ruolo e apre il
   * Master Profile della società. Assente: resta testo, e non promette una
   * navigazione che non esiste.
   */
  onSecondaryRolePress?: () => void;
  primaryRole?: string;
  secondaryRole?: string;
  testID?: string;
};

export function ProfileHeroHeader({
  actions,
  avatarUrl,
  availabilityLabel,
  badges = [],
  coverImageUrl,
  description,
  entityMode = false,
  footerAction,
  fullName,
  isVerified = false,
  logoInitials,
  metaRows = [],
  onSecondaryRolePress,
  primaryRole,
  secondaryRole,
  testID,
}: ProfileHeroHeaderProps) {
  return (
    <View style={styles.container} testID={testID}>
      {/*
        La cover è decorativa: annunciarla ruberebbe il turno al nome, che è
        l'informazione vera dell'header (§39).
      */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.cover}
      >
        {coverImageUrl ? (
          <Image source={{ uri: coverImageUrl }} style={styles.coverImage} />
        ) : null}
      </View>

      {entityMode ? (
        <View
          accessible
          accessibilityLabel={`Logo di ${fullName}`}
          accessibilityRole="image"
          style={styles.logoShell}
        >
          {avatarUrl ? (
            <Image
              // `contain`: un logo verticale o orizzontale non va riempito a
              // forza in un quadrato, altrimenti si deforma.
              resizeMode="contain"
              source={{ uri: avatarUrl }}
              style={styles.logoImage}
            />
          ) : (
            <View
              style={styles.logoFallback}
              testID={testID ? `${testID}-logo-fallback` : undefined}
            >
              <AppText color="inverse" variant="headingMd">
                {logoInitials || "·"}
              </AppText>
            </View>
          )}
        </View>
      ) : (
        <View
          accessible
          accessibilityLabel={`Foto profilo di ${fullName}`}
          accessibilityRole="image"
          style={styles.avatarShell}
        >
          <Avatar name={fullName} size="xl" uri={avatarUrl ?? undefined} />
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <AppText numberOfLines={2} style={styles.name} variant="heroName">
            {fullName}
          </AppText>
          {isVerified ? (
            <Ionicons
              accessibilityLabel="Profilo verificato"
              color={colors.accent}
              name="checkmark-circle"
              size={20}
              style={styles.verifiedBadge}
            />
          ) : null}
        </View>

        {primaryRole ? (
          <View style={styles.roleRow}>
            <AppText color="accent" variant="titleMd">
              {primaryRole}
            </AppText>
            {/*
              Ruolo secondario assente: niente separatore orfano e niente
              ripetizione del principale (§7).
            */}
            {secondaryRole ? (
              <>
                <AppText color="muted" variant="titleMd">
                  ·
                </AppText>
                {onSecondaryRolePress ? (
                  <Pressable
                    accessibilityLabel={secondaryRole}
                    accessibilityRole="link"
                    hitSlop={8}
                    onPress={onSecondaryRolePress}
                    style={({ pressed }) => (pressed ? styles.rolePressed : null)}
                    testID={testID ? `${testID}-secondary-role` : undefined}
                  >
                    <AppText color="accent" variant="titleMd">
                      {secondaryRole}
                    </AppText>
                  </Pressable>
                ) : (
                  <AppText color="primary" variant="titleMd">
                    {secondaryRole}
                  </AppText>
                )}
              </>
            ) : null}
          </View>
        ) : null}

        {description ? (
          <AppText
            color="primary"
            numberOfLines={2}
            style={styles.description}
            variant="metaStrong"
          >
            {description}
          </AppText>
        ) : null}

        {metaRows.length > 0 ? (
          <View style={styles.metaStack}>
            {metaRows.map((row) => (
              <View key={row.key} style={styles.metaRow}>
                {row.icon ? (
                  <Ionicons
                    color={colors.textMuted}
                    name={row.icon}
                    size={13}
                    style={styles.metaIcon}
                  />
                ) : null}
                <AppText color="secondary" style={styles.metaText} variant="meta">
                  {row.text}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}

        {badges.length > 0 ? (
          <View style={styles.badgeRow}>
            {badges.map((badge) => (
              /*
                Pill, non card: la licenza è un attributo dell'identità, non una
                sezione. Il testo è già annunciato, quindi l'icona resta muta.
              */
              <View accessible key={badge.key} style={styles.badge}>
                {badge.icon ? (
                  <Ionicons
                    color={colors.accent}
                    name={badge.icon}
                    size={13}
                  />
                ) : null}
                <AppText color="accent" variant="metaStrong">
                  {badge.label}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}

        {availabilityLabel ? (
          <View style={styles.availabilityRow}>
            <View style={styles.availabilityDot} />
            <AppText color="primary" variant="metaStrong">
              {availabilityLabel}
            </AppText>
          </View>
        ) : null}

        {actions ? <View style={styles.actionsRow}>{actions}</View> : null}

        {footerAction ? (
          <View style={styles.footerActionRow}>{footerAction}</View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    paddingTop: spacing[6],
  },
  availabilityDot: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    height: 6,
    width: 6,
  },
  availabilityRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    paddingTop: spacing[4],
  },
  badge: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    flexDirection: "row",
    gap: spacing[6],
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
  },
  badgeRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[6],
    paddingTop: spacing[6],
  },
  avatarShell: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    // Misura fissa: l'avatar non sposta il testo quando l'immagine finisce
    // di caricare, perché lo spazio è già riservato (§7).
    height: AVATAR_SIZE + 6,
    marginLeft: spacing[16],
    marginTop: -AVATAR_OVERLAP,
    padding: 3,
    width: AVATAR_SIZE + 6,
  },
  body: {
    gap: spacing[6],
    paddingBottom: spacing[16],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[10],
  },
  container: {
    backgroundColor: colors.surface,
  },
  cover: {
    backgroundColor: colors.backgroundStrong,
    height: PROFILE_COVER_HEIGHT,
    width: "100%",
  },
  coverImage: {
    height: "100%",
    width: "100%",
  },
  description: {
    paddingTop: spacing[4],
  },
  footerActionRow: {
    alignItems: "center",
    paddingTop: spacing[8],
  },
  logoFallback: {
    alignItems: "center",
    backgroundColor: colors.hero,
    borderRadius: radius[12],
    flex: 1,
    justifyContent: "center",
  },
  logoImage: {
    borderRadius: radius[12],
    flex: 1,
    width: "100%",
  },
  logoShell: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: StyleSheet.hairlineWidth,
    // Misura fissa: il logo non sposta il testo quando l'immagine finisce di
    // caricare, perché lo spazio è già riservato.
    height: LOGO_SIZE,
    marginLeft: spacing[16],
    marginTop: -LOGO_OVERLAP,
    padding: 4,
    width: LOGO_SIZE,
  },
  metaIcon: {
    marginTop: 1,
  },
  metaRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[6],
  },
  metaStack: {
    gap: spacing[4],
    paddingTop: spacing[4],
  },
  name: {
    flexShrink: 1,
    minWidth: 0,
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  metaText: {
    flexShrink: 1,
  },
  rolePressed: {
    opacity: 0.6,
  },
  roleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[6],
  },
  verifiedBadge: {
    flexShrink: 0,
  },
});
