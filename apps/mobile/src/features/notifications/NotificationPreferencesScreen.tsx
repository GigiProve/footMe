import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Screen } from "../../components/ui/screen";
import { KeyboardAwareForm } from "../../components/ui/keyboard-aware-form";
import { spacing } from "../../styles";
import { AppText, Button, EmptyState, ScreenHeader, Toggle, useToast } from "../../ui";
import {
  fetchMyNotificationPreferences,
  setNotificationPreference,
  type NotificationPreferenceKey,
  type NotificationPreferences,
} from "./notification-preferences-service";

const PREFERENCES_QUERY_KEY = ["notification-preferences"];

type PreferenceRow = {
  key: NotificationPreferenceKey;
  label: string;
  subtitle?: string;
};

const PREFERENCE_ROWS: PreferenceRow[] = [
  { key: "requests", label: "Richieste" },
  { key: "applications", label: "Candidature" },
  { key: "content_tags", label: "Tag nei contenuti" },
  { key: "new_followers", label: "Nuovi follower" },
  { key: "store", label: "Store" },
  { key: "promotions", label: "Promozioni" },
];

export function NotificationPreferencesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: preferences, isLoading, isError } = useQuery({
    queryKey: PREFERENCES_QUERY_KEY,
    queryFn: fetchMyNotificationPreferences,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      key,
      value,
    }: {
      key: NotificationPreferenceKey;
      value: boolean;
    }) => setNotificationPreference(key, value),
    onMutate: async ({ key, value }) => {
      await queryClient.cancelQueries({ queryKey: PREFERENCES_QUERY_KEY });
      const previous = queryClient.getQueryData<NotificationPreferences>(
        PREFERENCES_QUERY_KEY,
      );
      queryClient.setQueryData<NotificationPreferences>(
        PREFERENCES_QUERY_KEY,
        (old) => (old ? { ...old, [key]: value } : old),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(PREFERENCES_QUERY_KEY, context.previous);
      }
      showToast({ message: "Impossibile aggiornare la preferenza" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PREFERENCES_QUERY_KEY });
    },
  });

  function handleToggle(key: NotificationPreferenceKey, value: boolean) {
    updateMutation.mutate({ key, value });
  }

  return (
    <Screen>
      <KeyboardAwareForm contentContainerStyle={styles.content}>
        <Button
          label="Indietro"
          onPress={() => router.back()}
          size="sm"
          variant="link"
        />

        <ScreenHeader title="Preferenze notifiche" />

        <AppText color="secondary" variant="bodySm">
          Scegli quali aggiornamenti vuoi ricevere.
        </AppText>

        {isLoading ? (
          <AppText color="muted" variant="bodySm">
            Caricamento...
          </AppText>
        ) : isError || !preferences ? (
          <EmptyState
            icon="alert-circle-outline"
            title="Errore"
            description="Impossibile caricare le preferenze. Riprova."
            variant="error"
          />
        ) : (
          <View style={styles.list}>
            {PREFERENCE_ROWS.map((row) => (
              <Toggle
                key={row.key}
                label={row.label}
                onValueChange={(value) => handleToggle(row.key, value)}
                value={preferences[row.key]}
              />
            ))}
            <Toggle
              disabled
              label="Sistema e sicurezza"
              onValueChange={() => {}}
              subtitle="Consigliato sempre attivo"
              value
            />
          </View>
        )}
      </KeyboardAwareForm>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[18],
  },
  list: {
    gap: spacing[12],
  },
});
