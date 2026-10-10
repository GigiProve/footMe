import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { sizes, spacing } from "../../../theme/tokens";
import { AppText, BottomSheet, Button, useToast } from "../../../ui";
import { describeNetworkError, inviteStateLabel } from "../network-presentation";
import {
  issueSocietyInvite,
  revokeSocietyInvite,
  toNetworkError,
} from "../network-service";
import {
  buildSocietyInviteMessage,
  buildSocietyInviteUrl,
  shareSocietyInvite,
} from "../network-invite-link";
import { newNetworkOperationKey } from "../operation-key";
import { trackNetworkEvent } from "../network-analytics";
import type { PendingInviteItem } from "../network-types";

type Props = {
  canManage: boolean;
  clubId: string;
  inviterName: string;
  invite: PendingInviteItem | null;
  onClose: () => void;
  onChanged: () => void;
};

/**
 * Azioni su un invito esterno non ancora risolto (§20).
 *
 * «Il mittente autorizzato può Revocare invito finché non risolto, con
 * conferma chiara. Ri-condivisione di un link revocato non lo rende valido.
 * Per un invito scaduto non risolto può essere disponibile Genera nuovo
 * link, con nuova validità server e invalidazione della precedente
 * generazione, senza duplicare il percorso gestionale.»
 *
 * Le due azioni vivono quindi qui e non in una seconda schermata: il
 * percorso gestionale resta uno solo, la tab Richieste.
 *
 * Revocare non annulla una richiesta già indirizzata: §20 lo dice
 * espressamente, e infatti il server rifiuta la revoca di un invito già
 * risolto — a quel punto esiste una richiesta vera, con le sue azioni.
 */
export function InviteActionsSheet({
  canManage,
  clubId,
  invite,
  inviterName,
  onChanged,
  onClose,
}: Props) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [operationKey, setOperationKey] = useState(() => newNetworkOperationKey());

  const revoke = useMutation({
    mutationFn: () =>
      revokeSocietyInvite(invite?.inviteId as string, operationKey),
    onError: (error) => {
      const parsed = toNetworkError(error);
      setErrorMessage(describeNetworkError(parsed.code));
      setOperationKey(newNetworkOperationKey());
      onChanged();
    },
    onSuccess: () => {
      trackNetworkEvent("network_invite_revoked", { outcome: "ok" });
      showToast({ message: "Invito revocato" });
      setConfirmRevoke(false);
      onChanged();
      onClose();
    },
  });

  const regenerate = useMutation({
    mutationFn: async () => {
      if (!invite) {
        return;
      }

      const issued = await issueSocietyInvite({
        clubId,
        descriptiveName: invite.descriptiveName,
        idempotencyKey: operationKey,
        roleId: invite.inviterRoleId,
        // §20: nuova validità server e invalidazione della generazione
        // precedente, sulla stessa riga.
        rotate: true,
        typeId: invite.typeId,
      });

      if (!issued.token) {
        throw new Error("INVITE_INVALID");
      }

      trackNetworkEvent("network_invite_share_opened", { origin: "regenerate" });

      await shareSocietyInvite(
        buildSocietyInviteMessage({
          descriptiveName: invite.descriptiveName,
          inviterName,
          link: buildSocietyInviteUrl(issued.token),
        }),
      );
    },
    onError: (error) => {
      const parsed = toNetworkError(error);
      setErrorMessage(
        parsed.code === "UNKNOWN"
          ? "Non è stato possibile generare il link. Riprova."
          : describeNetworkError(parsed.code),
      );
    },
    onSuccess: () => {
      onChanged();
      void queryClient.invalidateQueries();
    },
  });

  if (!invite) {
    return null;
  }

  const isBusy = revoke.isPending || regenerate.isPending;

  return (
    <BottomSheet
      onClose={() => {
        setConfirmRevoke(false);
        setErrorMessage(null);
        onClose();
      }}
      title={invite.descriptiveName ?? "Invito esterno"}
      visible
    >
      <View style={styles.sheet}>
        <AppText color="neutralMuted" variant="meta">
          {inviteStateLabel(invite)}
        </AppText>

        <AppText color="neutralSoft" variant="meta">
          {/* §16: un invito non è una Society e non lo diventa condividendolo. */}
          Il collegamento si attiva dopo l'accettazione della società.
        </AppText>

        {errorMessage ? (
          <AppText accessibilityRole="alert" color="danger" variant="bodySm">
            {errorMessage}
          </AppText>
        ) : null}

        {!canManage ? (
          <AppText color="neutralSoft" variant="meta">
            Non puoi gestire questo invito.
          </AppText>
        ) : null}

        {canManage && invite.state === "expired" ? (
          <Button
            fullWidth
            label="Genera nuovo link"
            loading={regenerate.isPending}
            onPress={() => regenerate.mutate()}
            size="lg"
            testID="network-invite-regenerate"
            variant="primary"
          />
        ) : null}

        {canManage && invite.state === "valid" && !confirmRevoke ? (
          <Pressable
            accessibilityRole="button"
            disabled={isBusy}
            onPress={() => setConfirmRevoke(true)}
            style={styles.action}
            testID="network-invite-revoke"
          >
            <AppText color="neutral" variant="actionLabel">
              Revoca invito
            </AppText>
          </Pressable>
        ) : null}

        {canManage && confirmRevoke ? (
          <>
            <AppText color="neutral" variant="bodyLg">
              Revocare questo invito?
            </AppText>
            <AppText color="neutralMuted" variant="bodySm">
              Il link smetterà di funzionare. Potrai inviarne un altro.
            </AppText>

            {/* §3: conferma distruttiva sobria — bianca, bordo neutro, nera. */}
            <Button
              fullWidth
              label="Revoca invito"
              loading={revoke.isPending}
              onPress={() => revoke.mutate()}
              size="lg"
              testID="network-invite-revoke-confirm"
              variant="neutralOutline"
            />

            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={() => setConfirmRevoke(false)}
              style={styles.action}
              testID="network-invite-revoke-keep"
            >
              <AppText color="accent" variant="actionLabel">
                Mantieni invito
              </AppText>
            </Pressable>
          </>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    gap: spacing[12],
    paddingBottom: spacing[8],
  },
  action: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: sizes.touchTarget,
  },
});
