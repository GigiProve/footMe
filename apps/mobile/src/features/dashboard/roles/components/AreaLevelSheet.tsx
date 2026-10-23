import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, BottomSheet, Button, Radio } from "../../../../ui";
import {
  AREA_LEVEL_DESCRIPTION,
  AREA_LEVEL_LABEL,
  areaLevel,
  bundleControls,
  levelIsGrantable,
} from "../permission-catalog";
import { ROLES_COPY } from "../roles-presentation";
import type { PermissionArea } from "../roles-types";

type QuickChoice = "none" | "view" | "manage";

type Props = {
  area: PermissionArea | null;
  onClose: () => void;
  onConfirm: (controlIds: string[]) => void;
  onCustomize: () => void;
  selectedControlIds: readonly string[];
  visible: boolean;
};

export function AreaLevelSheet({
  area,
  onClose,
  onConfirm,
  onCustomize,
  selectedControlIds,
  visible,
}: Props) {
  /**
   * Il livello corrente è lo stato iniziale, non una risincronizzazione.
   *
   * Il parent monta questa sheet con `key` sull'area aperta: cambiare area
   * la rimonta, e la scelta riparte dal livello giusto senza un effetto che
   * insegua le props. §11 chiede che chiudere senza confermare «conservi la
   * precedente configurazione del draft», e un componente che nasce e muore
   * con l'apertura lo garantisce per costruzione.
   *
   * Una configurazione custom non preseleziona nessuna radio (§11: «nessuna
   * delle tre radio deve risultare falsamente selezionata»).
   */
  const [choice, setChoice] = useState<QuickChoice | null>(() => {
    if (!area) {
      return null;
    }

    const current = areaLevel(area, selectedControlIds);

    return current === "custom" ? null : current;
  });

  if (!area) {
    return null;
  }

  const isCustom = areaLevel(area, selectedControlIds) === "custom";
  const showView = levelIsGrantable(area, "view");
  const showManage = levelIsGrantable(area, "manage");

  return (
    <BottomSheet onClose={onClose} title={area.label} visible={visible}>
      <View style={styles.content}>
        {isCustom ? (
          <AppText color="neutralMuted" variant="meta">
            {ROLES_COPY.customActive}
          </AppText>
        ) : null}

        <View style={styles.options}>
          <Radio
            checked={choice === "none"}
            label={AREA_LEVEL_LABEL.none}
            onPress={() => setChoice("none")}
            tone="neutral"
          />
          <AppText color="neutralMuted" style={styles.description} variant="bodySm">
            {AREA_LEVEL_DESCRIPTION.none}
          </AppText>

          {showView ? (
            <>
              <Radio
                checked={choice === "view"}
                label={AREA_LEVEL_LABEL.view}
                onPress={() => setChoice("view")}
                tone="neutral"
              />
              <AppText
                color="neutralMuted"
                style={styles.description}
                variant="bodySm"
              >
                {AREA_LEVEL_DESCRIPTION.view}
              </AppText>
            </>
          ) : null}

          {showManage ? (
            <>
              <Radio
                checked={choice === "manage"}
                label={AREA_LEVEL_LABEL.manage}
                onPress={() => setChoice("manage")}
                tone="neutral"
              />
              <AppText
                color="neutralMuted"
                style={styles.description}
                variant="bodySm"
              >
                {AREA_LEVEL_DESCRIPTION.manage}
              </AppText>
            </>
          ) : null}
        </View>

        <View style={styles.customizeDivider} />

        <Button
          label={ROLES_COPY.customizeLink}
          onPress={onCustomize}
          rightIcon={
            <Ionicons
              color={colors.textNeutralSoft}
              name="chevron-forward"
              size={16}
            />
          }
          variant="link"
        />

        <Button
          disabled={choice === null}
          fullWidth
          label={ROLES_COPY.confirmCta}
          onPress={() => {
            if (choice === null) {
              return;
            }

            onConfirm(bundleControls(area, choice));
          }}
          size="lg"
          variant="primary"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[16],
  },
  options: {
    gap: spacing[8],
  },
  description: {
    paddingLeft: spacing[32],
  },
  customizeDivider: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
