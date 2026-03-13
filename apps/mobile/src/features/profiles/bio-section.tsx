import { type ReactNode, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  type TextLayoutEventData,
  View,
} from "react-native";
import type { NativeSyntheticEvent } from "react-native";

import {
  PROFILE_BIO_MAX_LENGTH,
  PROFILE_BIO_WARNING_THRESHOLD,
  formatOptionalSummary,
  normalizeProfileBioInput,
} from "./profile-form-utils";
import { ProfileSectionCard } from "./profile-screen-components";
import { colors, radius, sizes, spacing, typography } from "../../theme/tokens";
import { Input } from "../../ui";

const BIO_PLACEHOLDER =
  "Racconta brevemente il tuo percorso calcistico, le tue caratteristiche e cosa cerchi per la prossima stagione.";

type CharacterCounterProps = {
  currentLength: number;
  hasError?: boolean;
};

type BioInputProps = {
  errorMessage?: string | null;
  onChangeText: (value: string) => void;
  value: string;
};

type BioSectionProps = {
  bio: string | null | undefined;
  children?: ReactNode;
  editable?: boolean;
  errorMessage?: string | null;
  onChangeText?: (value: string) => void;
};

type PublicBioBlockProps = {
  bio: string | null | undefined;
  collapsedLines?: number;
};

export function CharacterCounter({
  currentLength,
  hasError = false,
}: CharacterCounterProps) {
  const isNearLimit = currentLength >= PROFILE_BIO_WARNING_THRESHOLD;

  return (
    <Text
      style={[
        styles.counterText,
        isNearLimit ? styles.counterWarningText : null,
        hasError ? styles.counterErrorText : null,
      ]}
    >
      {currentLength} / {PROFILE_BIO_MAX_LENGTH} caratteri
    </Text>
  );
}

export function BioInput({ errorMessage, onChangeText, value }: BioInputProps) {
  const normalizedValue = useMemo(() => normalizeProfileBioInput(value), [value]);

  return (
    <View style={styles.fieldContainer}>
      <Input
        accessibilityLabel="Bio del profilo"
        autoCapitalize="sentences"
        autoCorrect
        maxLength={PROFILE_BIO_MAX_LENGTH}
        multiline
        onChangeText={(nextValue) => onChangeText(normalizeProfileBioInput(nextValue))}
        placeholder={BIO_PLACEHOLDER}
        returnKeyType="default"
        scrollEnabled={false}
        spellCheck
        style={[
          styles.bioInput,
          errorMessage ? styles.bioInputError : null,
        ]}
        value={normalizedValue}
      />
      <CharacterCounter
        currentLength={normalizedValue.length}
        hasError={Boolean(errorMessage)}
      />
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </View>
  );
}

export function PublicBioBlock({
  bio,
  collapsedLines = 3,
}: PublicBioBlockProps) {
  const normalizedBio = bio?.trim() ?? "";
  const [isExpanded, setIsExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const hasValue = normalizedBio.length > 0;

  function handleTextLayout(
    event: NativeSyntheticEvent<TextLayoutEventData>,
  ) {
    if (canExpand) {
      return;
    }

    setCanExpand(event.nativeEvent.lines.length > collapsedLines);
  }

  return (
    <View
      style={[
        styles.readonlySurface,
        hasValue ? styles.completedReadonlySurface : styles.emptyReadonlySurface,
      ]}
    >
      <Text
        numberOfLines={hasValue && !isExpanded ? collapsedLines : undefined}
        onTextLayout={hasValue ? handleTextLayout : undefined}
        style={[styles.readonlyValue, hasValue ? null : styles.readonlyPlaceholder]}
      >
        {formatOptionalSummary(normalizedBio)}
      </Text>
      {hasValue && canExpand ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setIsExpanded((current) => !current)}
          style={({ pressed }) => [styles.toggleButton, pressed ? styles.pressed : null]}
        >
          <Text style={styles.toggleButtonText}>
            {isExpanded ? "Mostra meno" : "Mostra di più"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function BioSection({
  bio,
  children,
  editable = false,
  errorMessage,
  onChangeText,
}: BioSectionProps) {
  const normalizedBio = bio ?? "";

  return (
    <ProfileSectionCard
      description="Disponibilità e descrizione pubblica del profilo"
      title="Presentazione"
    >
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>Bio</Text>
        {editable && onChangeText ? (
          <BioInput errorMessage={errorMessage} onChangeText={onChangeText} value={normalizedBio} />
        ) : (
          <PublicBioBlock bio={normalizedBio} />
        )}
      </View>
      {children ? <View style={styles.extraContent}>{children}</View> : null}
    </ProfileSectionCard>
  );
}

const styles = StyleSheet.create({
  bioInput: {
    minHeight: sizes.multilineFieldMinHeight + spacing[24],
    lineHeight: typography.lineHeight[24],
    color: colors.textPrimary,
  },
  bioInputError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  completedReadonlySurface: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoft,
  },
  counterErrorText: {
    color: colors.danger,
  },
  counterText: {
    alignSelf: "flex-end",
    color: colors.textSecondary,
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
  },
  counterWarningText: {
    color: colors.accentStrong,
  },
  emptyReadonlySurface: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  errorText: {
    color: colors.danger,
    lineHeight: typography.lineHeight[22],
  },
  extraContent: {
    gap: spacing[14],
  },
  fieldContainer: {
    gap: spacing[8],
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: typography.letterSpacing.md,
  },
  pressed: {
    opacity: 0.82,
  },
  readonlyPlaceholder: {
    color: colors.textMuted,
  },
  readonlySurface: {
    gap: spacing[10],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
    borderRadius: radius[18],
    borderWidth: 1,
  },
  readonlyValue: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[16],
    lineHeight: typography.lineHeight[24],
  },
  toggleButton: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  toggleButtonText: {
    color: colors.accentStrong,
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
  },
});
