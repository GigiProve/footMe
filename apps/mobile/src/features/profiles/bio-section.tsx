import { type ReactNode, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
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
import { AppText, Button, Input } from "../../ui";

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
    <AppText
      variant="caption"
      color={hasError ? "danger" : isNearLimit ? "accentStrong" : "secondary"}
      style={styles.counterText}
    >
      {currentLength} / {PROFILE_BIO_MAX_LENGTH} caratteri
    </AppText>
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
        error={Boolean(errorMessage)}
        helperText={errorMessage ?? undefined}
        maxLength={PROFILE_BIO_MAX_LENGTH}
        multiline
        onChangeText={(nextValue) => onChangeText(normalizeProfileBioInput(nextValue))}
        placeholder={BIO_PLACEHOLDER}
        returnKeyType="default"
        scrollEnabled={false}
        spellCheck
        style={styles.bioInput}
        value={normalizedValue}
      />
      <CharacterCounter
        currentLength={normalizedValue.length}
        hasError={Boolean(errorMessage)}
      />
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
      <AppText
        variant="bodyLg"
        color={hasValue ? "primary" : "muted"}
        numberOfLines={hasValue && !isExpanded ? collapsedLines : undefined}
        onTextLayout={hasValue ? handleTextLayout : undefined}
      >
        {formatOptionalSummary(normalizedBio)}
      </AppText>
      {hasValue && canExpand ? (
        <Button
          label={isExpanded ? "Mostra meno" : "Mostra di più"}
          onPress={() => setIsExpanded((current) => !current)}
          size="sm"
          variant="link"
        />
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
        <AppText variant="overline" color="secondary">
          Bio
        </AppText>
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
  },
  completedReadonlySurface: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoft,
  },
  counterText: {
    alignSelf: "flex-end",
  },
  emptyReadonlySurface: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  extraContent: {
    gap: spacing[14],
  },
  fieldContainer: {
    gap: spacing[8],
  },
  readonlySurface: {
    gap: spacing[10],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
    borderRadius: radius[8],
    borderWidth: 1,
  },
});
