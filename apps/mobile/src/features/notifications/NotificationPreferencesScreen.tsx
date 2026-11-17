/**
 * HOM-14 §180-§201, §282 — pagina «Preferenze notifiche».
 *
 * Sezioni Push (§183-§188) per le notifiche push; sezione separata «Altre attività»
 * con i toggle operativi storici, che continuano a controllare l'in-app (decisione di
 * prodotto). Lo stato Push viene dal permesso reale del sistema operativo (§184-§186):
 * se è negato gli switch mostrano la scelta salvata ma la pagina dichiara che non
 * arriveranno push. Il prompt OS parte solo dal gesto esplicito sul rail del modulo.
 *
 * DAS-REV-34 §15–§17: sezione «Messaggi» con due interruttori globali dell'account,
 * «Messaggi» (push_messages) e «Mostra anteprima» (message_preview). Stesso pattern
 * dei toggle esistenti: aggiornamento ottimistico, rollback e toast in caso di errore.
 */

import { useEffect, useRef, useState } from "react";
import { AppState, Linking, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Screen } from "../../components/ui/screen";
import { KeyboardAwareForm } from "../../components/ui/keyboard-aware-form";
import { spacing } from "../../styles";
import {
  AppText,
  Button,
  ContentModule,
  EmptyState,
  ScreenHeader,
  Toggle,
  useToast,
} from "../../ui";
import { useSession } from "../auth/use-session";
import { notificationKeys } from "./notification-keys";
import {
  MANAGED_IDENTITIES_COPY,
  OTHER_ACTIVITY_SECTION,
  OTHER_SECTION_MICROCOPY,
  PUSH_BLOCKED_NOTICE,
  PUSH_INTERACTION_SECTION,
  PUSH_MESSAGES_SECTION,
  PUSH_PUBLISHING_SECTION,
  PUSH_SECTION_MICROCOPY,
  SYSTEM_ROW_LABEL,
  SYSTEM_ROW_SUBTITLE,
  applyPreferenceChange,
  isPushPreferenceKey,
  readPreference,
  type PreferenceSectionConfig,
} from "./notification-preferences-presentation";
import {
  fetchMyNotificationPreferences,
  setNotificationPreference,
  type NotificationPreferenceKey,
  type NotificationPreferences,
} from "./notification-preferences-service";
import { trackPush } from "./push/push-analytics";
import {
  pushActionLabel,
  pushPermissionAction,
  pushStatusHint,
  pushStatusLabel,
  pushTogglesBlocked,
  type PushPermissionInfo,
} from "./push/push-presentation";
import {
  readPushPermission,
  registerPushDevice,
  requestPushPermission,
} from "./push/push-service";

export function NotificationPreferencesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { session } = useSession();
  const profileId = session?.user.id ?? null;

  const [permission, setPermission] = useState<PushPermissionInfo | null>(null);
  const openTrackedRef = useRef(false);

  // Il permesso si rilegge anche al ritorno in primo piano: l'utente può averlo
  // cambiato dalle impostazioni del dispositivo.
  useEffect(() => {
    let active = true;

    async function refreshPermission() {
      const next = await readPushPermission();

      if (!active) {
        return;
      }

      setPermission(next);

      if (!openTrackedRef.current) {
        openTrackedRef.current = true;
        trackPush({ name: "notification_preferences_open", permission: next.state });
      }
    }

    void refreshPermission();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshPermission();
      }
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const preferencesKey = notificationKeys.preferences(profileId ?? "");

  const { data: preferences, isLoading, isError } = useQuery({
    enabled: profileId !== null,
    queryFn: fetchMyNotificationPreferences,
    queryKey: preferencesKey,
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: NotificationPreferenceKey; value: boolean }) =>
      setNotificationPreference(key, value),
    onError: (
      _error: Error,
      _variables: { key: NotificationPreferenceKey; value: boolean },
      context: { previous?: NotificationPreferences } | undefined,
    ) => {
      if (context?.previous) {
        queryClient.setQueryData(preferencesKey, context.previous);
      }
      showToast({ message: "Impossibile aggiornare la preferenza" });
    },
    onMutate: async ({ key, value }) => {
      await queryClient.cancelQueries({ queryKey: preferencesKey });
      const previous = queryClient.getQueryData<NotificationPreferences>(preferencesKey);
      queryClient.setQueryData<NotificationPreferences>(preferencesKey, (old) =>
        old ? applyPreferenceChange(old, key, value) : old,
      );
      return { previous };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: preferencesKey });
    },
    onSuccess: (_data, { key, value }) => {
      if (isPushPreferenceKey(key)) {
        trackPush({ category: key, name: value ? "push_category_enabled" : "push_category_disabled" });
      }
    },
  });

  const action = permission ? pushPermissionAction(permission) : "none";
  const actionLabel = pushActionLabel(action);

  async function handlePermissionAction() {
    if (!permission) {
      return;
    }

    if (action === "open_settings") {
      trackPush({ name: "open_device_notification_settings", permission: permission.state });
      try {
        await Linking.openSettings();
      } catch {
        showToast({ message: "Impossibile aprire le impostazioni del dispositivo" });
      }
      return;
    }

    const next = await requestPushPermission();
    setPermission(next);

    if (next.state === "granted") {
      // Il token si registra subito, senza attendere il prossimo avvio (§231: mai bloccante).
      void registerPushDevice();
    }
  }

  const blocked = permission ? pushTogglesBlocked(permission) : false;

  function renderToggles(section: PreferenceSectionConfig<NotificationPreferenceKey>, current: NotificationPreferences) {
    return section.rows.map((row) => (
      <Toggle
        key={row.key}
        label={row.label}
        disabled={blocked && isPushPreferenceKey(row.key)}
        onValueChange={(value) => updateMutation.mutate({ key: row.key, value })}
        subtitle={row.subtitle}
        value={readPreference(current, row.key)}
        variant="row"
      />
    ));
  }

  return (
    <Screen>
      <KeyboardAwareForm contentContainerStyle={styles.content}>
        <Button label="Indietro" onPress={() => router.back()} size="sm" variant="link" />

        <ScreenHeader title="Preferenze notifiche" />

        {permission ? (
          <ContentModule
            actions={
              actionLabel
                ? [{ label: actionLabel, onPress: () => void handlePermissionAction() }]
                : undefined
            }
            eyebrow="Push"
          >
            <View style={styles.moduleBody}>
              <AppText variant="bodyLg">{pushStatusLabel(permission)}</AppText>
              <AppText color="secondary" variant="bodySm">
                {pushStatusHint(permission)}
              </AppText>
            </View>
          </ContentModule>
        ) : null}

        {isLoading ? (
          <AppText color="muted" variant="bodySm">
            Caricamento...
          </AppText>
        ) : isError || !preferences ? (
          <EmptyState
            description="Impossibile caricare le preferenze. Riprova."
            icon="alert-circle-outline"
            title="Errore"
            variant="error"
          />
        ) : (
          <>
            <AppText color="secondary" variant="bodySm">
              {PUSH_SECTION_MICROCOPY}
            </AppText>

            {blocked ? (
              <AppText color="secondary" variant="bodySm">
                {PUSH_BLOCKED_NOTICE}
              </AppText>
            ) : null}

            <ContentModule eyebrow={PUSH_INTERACTION_SECTION.eyebrow}>
              <View style={styles.list}>{renderToggles(PUSH_INTERACTION_SECTION, preferences)}</View>
            </ContentModule>

            <ContentModule eyebrow={PUSH_PUBLISHING_SECTION.eyebrow}>
              <View style={styles.list}>{renderToggles(PUSH_PUBLISHING_SECTION, preferences)}</View>
            </ContentModule>

            <ContentModule eyebrow={PUSH_MESSAGES_SECTION.eyebrow}>
              <View style={styles.list}>{renderToggles(PUSH_MESSAGES_SECTION, preferences)}</View>
            </ContentModule>

            <AppText color="secondary" variant="bodySm">
              {MANAGED_IDENTITIES_COPY}
            </AppText>

            <ContentModule eyebrow={OTHER_ACTIVITY_SECTION.eyebrow}>
              <View style={styles.list}>
                <AppText color="secondary" variant="bodySm">
                  {OTHER_SECTION_MICROCOPY}
                </AppText>
                {renderToggles(OTHER_ACTIVITY_SECTION, preferences)}
                <Toggle
                  disabled
                  label={SYSTEM_ROW_LABEL}
                  onValueChange={() => {}}
                  subtitle={SYSTEM_ROW_SUBTITLE}
                  value
                  variant="row"
                />
              </View>
            </ContentModule>
          </>
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
    gap: spacing[4],
  },
  moduleBody: {
    gap: spacing[8],
  },
});
