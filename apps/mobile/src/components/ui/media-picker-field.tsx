import { Image, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Button, Card } from "../../ui";

type MediaPickerFieldProps = {
  buttonLabel: string;
  helperText?: string;
  isUploading?: boolean;
  label: string;
  onPick: () => void;
  previewUrl?: string | null;
  selectedCount?: number;
  selectedLabel?: string;
};

export function MediaPickerField({
  buttonLabel,
  helperText,
  isUploading = false,
  label,
  onPick,
  previewUrl,
  selectedCount,
  selectedLabel,
}: MediaPickerFieldProps) {
  return (
    <View style={{ gap: spacing[8] }}>
      <Text style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.bold }}>
        {label}
      </Text>
      <Card style={{ gap: spacing[12] }}>
        {previewUrl ? (
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: radius[20],
              overflow: "hidden",
              backgroundColor: colors.surfaceMuted,
            }}
            testID="media-picker-preview-frame"
          >
            <Image
              source={{ uri: previewUrl }}
              style={{
                width: "100%",
                height: "100%",
                backgroundColor: colors.surfaceMuted,
              }}
            />
          </View>
        ) : null}

        <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>
          {selectedLabel ??
            (selectedCount && selectedCount > 0
              ? `${selectedCount} file selezionati`
              : helperText ?? "Nessun file selezionato")}
        </Text>
        <Button
          disabled={isUploading}
          label={isUploading ? "Caricamento..." : buttonLabel}
          onPress={onPick}
          variant="secondary"
        />
      </Card>
    </View>
  );
}
