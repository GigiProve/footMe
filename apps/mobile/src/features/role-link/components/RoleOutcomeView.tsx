import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Avatar } from "../../../ui";

type Props = {
  avatarUrl?: string | null;
  body: string;
  helper?: string | null;
  /** Nome sotto il segno: la persona dell'esito, non un titolo. */
  name?: string | null;
  testID?: string;
  title: string;
};

/**
 * Esito di un'operazione sul rapporto (§22 screen 12, §38 screen 24).
 *
 * §5: «Il check dello screen 12 è neutro, non un nuovo badge di verifica del
 * ruolo» — il segno è un contorno nero neutro, non il check blu della
 * società verificata, e non ha riempimento.
 *
 * §5 vieta anche «hero di successo, confetti»: niente illustrazione, niente
 * colore di stato, una sola colonna.
 */
export function RoleOutcomeView({
  avatarUrl,
  body,
  helper,
  name,
  testID,
  title,
}: Props) {
  return (
    <View style={styles.root} testID={testID}>
      <View style={styles.mark}>
        <Ionicons color={colors.textNeutral} name="checkmark" size={26} />
      </View>

      <AppText
        accessibilityRole="header"
        color="neutral"
        style={styles.title}
        variant="headingSm"
      >
        {title}
      </AppText>

      {name ? (
        <View style={styles.person}>
          <Avatar name={name} size="lg" uri={avatarUrl ?? undefined} />

          <AppText color="neutral" variant="titleSm">
            {name}
          </AppText>
        </View>
      ) : null}

      <AppText color="neutralMuted" style={styles.body} variant="bodyLg">
        {body}
      </AppText>

      {helper ? (
        <AppText color="neutralMuted" style={styles.helper} variant="bodySm">
          {helper}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    gap: spacing[12],
    paddingVertical: spacing[32],
  },
  mark: {
    alignItems: "center",
    borderColor: colors.borderNeutralStrong,
    borderRadius: 24,
    borderWidth: 1.5,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  title: {
    textAlign: "center",
  },
  person: {
    alignItems: "center",
    gap: spacing[8],
    paddingTop: spacing[8],
  },
  body: {
    paddingHorizontal: spacing[16],
    textAlign: "center",
  },
  helper: {
    textAlign: "center",
  },
});
