import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { Button, EmptyState } from "../../../ui";
import { spacing } from "../../../theme/tokens";

export function ShortlistAccessDenied() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <EmptyState
        icon="lock-closed-outline"
        title="Accesso non disponibile"
        description="Non hai i permessi per visualizzare o modificare le shortlist della società."
        action={
          <Button
            label="Torna alla Dashboard"
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
                return;
              }
              router.push("/");
            }}
            style={styles.action}
            variant="primary"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    marginTop: spacing[4],
  },
  container: {
    flex: 1,
    justifyContent: "center",
  },
});
