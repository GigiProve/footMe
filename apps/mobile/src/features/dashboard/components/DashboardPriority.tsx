import { Fragment } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import type { DashboardPriorityTypeId } from "../priority/priority-types";

/**
 * Icona per tipo di priorità.
 *
 * Vive qui e non nel registry perché il registry è logica pura, testata
 * senza montare nulla: farvi entrare il tipo di Ionicons costringerebbe ogni
 * test di ranking a risolvere una libreria di icone.
 */
export const PRIORITY_ICONS: Record<
  DashboardPriorityTypeId,
  keyof typeof Ionicons.glyphMap
> = {
  new_applications: "people-outline",
  profile_requirements_missing: "person-circle-outline",
  publication_failed: "alert-circle-outline",
  saved_deadline: "calendar-outline",
};

export type DashboardPriorityItem = {
  /** Etichetta completa per screen reader: oggetto + contesto + destinazione. */
  accessibilityLabel: string;
  /** Verbo specifico: "Valuta candidature", non "Apri". */
  actionLabel: string;
  /** Il contesto, non una ripetizione del titolo. */
  description: string | null;
  icon: keyof typeof Ionicons.glyphMap;
  id: string;
  onPress: () => void;
  /** `card` = superficie con icona; `row` = gruppo compatto con divider. */
  presentation: "card" | "row";
  title: string;
};

type Props = {
  items: DashboardPriorityItem[];
  /**
   * Accesso contestuale alla lista completa quando gli elementi eleggibili
   * superano le due preview mostrate (§16). `null` quando non è utile o non
   * esiste una destinazione supportata.
   */
  overflowAction?: { label: string; onPress: () => void } | null;
};

/**
 * Sezione "Da gestire" (DAS-REV-03 §13, §16).
 *
 * Quando non ci sono priorità la sezione **sparisce del tutto**: titolo,
 * contenitore e spazio riservato. È la ragione del `return null` — non un
 * contenitore vuoto di altezza zero, che lascerebbe il `gap` del genitore —
 * e §13 vieta di sostituirla con un "Tutto sotto controllo".
 *
 * Due trattamenti, non due sezioni: le scadenze sono righe compatte dentro
 * un solo gruppo con divider (§16), i requisiti obbligatori restano la card
 * della Foundation. Le righe consecutive si raggruppano da sole, così due
 * scadenze non diventano due cartelli.
 *
 * Ogni elemento dice oggetto, motivo e destinazione. Niente punteggi,
 * percentuali, countdown o etichette "critiche": il livello interno non
 * arriva fin qui, e il blu leggero è l'unico accento.
 */
export function DashboardPriority({ items, overflowAction = null }: Props) {
  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.block}>
      <AppText accessibilityRole="header" variant="headingSm">
        Da gestire
      </AppText>

      {groupItems(items).map((group, index) =>
        group.presentation === "card" ? (
          <Fragment key={group.key}>
            {group.items.map((item) => (
              <PriorityCard item={item} key={item.id} />
            ))}
          </Fragment>
        ) : (
          <Fragment key={group.key}>
            <View style={styles.group}>
              {group.items.map((item, rowIndex) => (
                <PriorityRow
                  item={item}
                  key={item.id}
                  showDivider={rowIndex > 0}
                />
              ))}
            </View>

            {/* Accesso contestuale alla lista completa (§16): sotto il
                gruppo e allineato a destra, come un "Vedi tutte" di sezione —
                non un secondo pulsante dentro la superficie azzurra. */}
            {overflowAction && index === 0 ? (
              <Pressable
                accessibilityLabel={overflowAction.label}
                accessibilityRole="button"
                hitSlop={8}
                onPress={overflowAction.onPress}
                style={({ pressed }) => [
                  styles.overflow,
                  pressed ? styles.pressed : null,
                ]}
              >
                <AppText color="accent" variant="actionLabel">
                  {overflowAction.label}
                </AppText>
              </Pressable>
            ) : null}
          </Fragment>
        ),
      )}
    </View>
  );
}

/**
 * Righe consecutive dello stesso trattamento finiscono in un solo gruppo.
 * L'ordine non viene toccato: il ranking della Foundation ha già deciso, e
 * raggruppare riordinando sarebbe un secondo algoritmo (§6).
 */
function groupItems(items: DashboardPriorityItem[]) {
  const groups: {
    items: DashboardPriorityItem[];
    key: string;
    presentation: "card" | "row";
  }[] = [];

  for (const item of items) {
    const last = groups[groups.length - 1];

    if (last && last.presentation === item.presentation) {
      last.items.push(item);
      continue;
    }

    groups.push({
      items: [item],
      key: `${item.presentation}-${item.id}`,
      presentation: item.presentation,
    });
  }

  return groups;
}

function PriorityCard({ item }: { item: DashboardPriorityItem }) {
  return (
    <View style={styles.card}>
      <View style={styles.iconCircle}>
        <Ionicons color={colors.accent} name={item.icon} size={20} />
      </View>

      <View style={styles.body}>
        <AppText variant="titleMd">{item.title}</AppText>

        {item.description ? (
          <AppText color="secondary" variant="meta">
            {item.description}
          </AppText>
        ) : null}

        <Pressable
          accessibilityLabel={item.accessibilityLabel}
          accessibilityRole="button"
          hitSlop={8}
          onPress={item.onPress}
          style={({ pressed }) => [
            styles.action,
            pressed ? styles.pressed : null,
          ]}
        >
          <AppText color="accent" variant="actionLabel">
            {item.actionLabel}
          </AppText>
          <Ionicons color={colors.accent} name="arrow-forward" size={14} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Riga compatta di una scadenza.
 *
 * Il link "Vedi opportunità →" **non** è un secondo Pressable: §16 chiede che
 * row e link portino alla stessa destinazione «senza doppi eventi o doppi
 * push nello stack», e due target annidati producono esattamente quello.
 * Qui è un'affordance visiva dentro l'unico target della riga.
 */
function PriorityRow({
  item,
  showDivider,
}: {
  item: DashboardPriorityItem;
  showDivider: boolean;
}) {
  return (
    <View>
      {showDivider ? <View style={styles.divider} /> : null}

      <Pressable
        accessibilityLabel={item.accessibilityLabel}
        accessibilityRole="button"
        onPress={item.onPress}
        style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      >
        <Ionicons
          color={colors.accent}
          name={item.icon}
          size={20}
          style={styles.rowIcon}
        />

        <View style={styles.rowBody}>
          <AppText variant="titleMd">{item.title}</AppText>

          {item.description ? (
            <AppText color="secondary" variant="meta">
              {item.description}
            </AppText>
          ) : null}

          <View style={styles.rowLink}>
            <AppText color="accent" variant="actionLabel">
              {item.actionLabel}
            </AppText>
            <Ionicons color={colors.accent} name="arrow-forward" size={14} />
          </View>
        </View>

        <Ionicons
          color={colors.textMuted}
          name="chevron-forward"
          size={18}
          style={styles.rowIcon}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[10],
  },
  card: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoftBorder,
    borderRadius: radius[12],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[14],
  },
  group: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoftBorder,
    borderRadius: radius[12],
    borderWidth: 1,
    paddingHorizontal: spacing[14],
  },
  divider: {
    backgroundColor: colors.accentSoftBorder,
    height: 1,
  },
  row: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[12],
  },
  rowIcon: {
    marginTop: spacing[4],
  },
  rowBody: {
    flex: 1,
    gap: spacing[4],
  },
  rowLink: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
    marginTop: spacing[4],
  },
  overflow: {
    alignItems: "center",
    alignSelf: "flex-end",
    flexDirection: "row",
    minHeight: sizes.touchTarget - spacing[14],
  },
  iconCircle: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  action: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
    marginTop: spacing[6],
    minHeight: sizes.touchTarget - spacing[14],
  },
  pressed: {
    opacity: 0.6,
  },
});
