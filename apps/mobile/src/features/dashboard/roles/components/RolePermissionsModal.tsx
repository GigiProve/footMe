import { useState } from "react";
import { Modal, ScrollView, StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Button, Checkbox } from "../../../../ui";
import { NetworkNavBar } from "../../../network/components/NetworkNavBar";
import { SocietyIdentityHeader } from "../../components/SocietyIdentityHeader";
import { expandControls, lockedControls } from "../permission-catalog";
import { ROLES_COPY } from "../roles-presentation";
import type { PermissionArea } from "../roles-types";

type Props = {
  area: PermissionArea | null;
  clubLogoUrl: string | null;
  clubName: string;
  clubIsVerified: boolean;
  onClose: () => void;
  onConfirm: (controlIds: string[]) => void;
  selectedControlIds: readonly string[];
  visible: boolean;
};

export function RolePermissionsModal({
  area,
  clubLogoUrl,
  clubName,
  clubIsVerified,
  onClose,
  onConfirm,
  selectedControlIds,
  visible,
}: Props) {
  /* Il parent monta con `key` sull'area: la selezione nasce già corretta e
     non va inseguita con un effetto. §12: back senza conferma «scarta solo
     le modifiche granulari non applicate». */
  const [selection, setSelection] = useState<string[]>(() => [
    ...selectedControlIds,
  ]);

  if (!area) {
    return null;
  }

  const locked = lockedControls(area, selection);

  function toggle(controlId: string, next: boolean) {
    if (!area) {
      return;
    }

    if (next) {
      setSelection(expandControls(area, [...selection, controlId]));
      return;
    }

    let current = selection.filter((id) => id !== controlId);
    const byId = new Map(area.controls.map((control) => [control.id, control]));
    let changed = true;

    while (changed) {
      changed = false;

      for (const id of current) {
        const control = byId.get(id);

        if (!control) {
          continue;
        }

        const stillSatisfied = control.requires.every((req) =>
          current.includes(req),
        );

        if (!stillSatisfied) {
          current = current.filter((value) => value !== id);
          changed = true;
          break;
        }
      }
    }

    setSelection(current);
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      visible={visible}
    >
      <View style={styles.root}>
        <NetworkNavBar onBack={onClose} title={ROLES_COPY.customizeTitle} />
        <ScrollView contentContainerStyle={styles.content}>
          <SocietyIdentityHeader
            isVerified={clubIsVerified}
            logoUrl={clubLogoUrl}
            name={clubName}
          />
          <AppText color="neutral" variant="titleMd">
            {area.label}
          </AppText>
          <View style={styles.rows}>
            {area.controls.map((control) => {
              const isLocked = locked.includes(control.id);

              return (
                <View key={control.id} style={styles.rowWrapper}>
                  <Checkbox
                    checked={selection.includes(control.id)}
                    description={
                      isLocked ? control.helper ?? undefined : undefined
                    }
                    disabled={isLocked || !control.isGrantable}
                    label={control.label}
                    onValueChange={(next) => toggle(control.id, next)}
                  />
                  {isLocked && control.helper ? (
                    <AppText color="neutralMuted" variant="meta">
                      {control.helper}
                    </AppText>
                  ) : null}
                </View>
              );
            })}
          </View>
          <AppText color="neutralMuted" variant="meta">
            {ROLES_COPY.customizeHelper}
          </AppText>
          <Button
            fullWidth
            label={ROLES_COPY.confirmPermissionsCta}
            onPress={() => onConfirm(selection)}
            size="lg"
            variant="primary"
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  content: {
    gap: spacing[16],
    padding: spacing[16],
  },
  rows: {
    gap: spacing[12],
  },
  rowWrapper: {
    gap: spacing[4],
  },
});
