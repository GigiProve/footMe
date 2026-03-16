import { useMemo, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import type { SelectOption } from "../../features/profiles/profile-form-utils";
import { colors, radius, spacing, typography } from "../../theme/tokens";

function getFlagEmoji(countryCode: string): string {
  if (countryCode === "GB-SCT") return "🏴󠁧󠁢󠁳󠁣󠁴󠁿";
  const upper = countryCode.toUpperCase().slice(0, 2);
  const codePoints = upper
    .split("")
    .map((char) => 0x1f1e6 + char.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
}

export function NationalityAutocompleteInput({
  error,
  label,
  onChange,
  options,
  placeholder = "Cerca nazionalità...",
  value,
}: {
  error?: string;
  label: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  value: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<TextInput>(null);

  const selectedOption = options.find((o) => o.value === value);

  const normalizedQuery = useMemo(
    () => query.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    [query],
  );

  const filtered = useMemo(
    () =>
      normalizedQuery
        ? options.filter((o) =>
            o.label
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .includes(normalizedQuery),
          )
        : options,
    [options, normalizedQuery],
  );

  function handleOpen() {
    setQuery("");
    setIsOpen(true);
    setTimeout(() => searchRef.current?.focus(), 100);
  }

  function handleSelect(option: SelectOption) {
    onChange(option.value);
    setIsOpen(false);
    setQuery("");
  }

  function handleClear() {
    onChange("");
    setIsOpen(false);
    setQuery("");
  }

  return (
    <View style={{ gap: spacing[8] }}>
      <Text
        style={{
          color: colors.textPrimary,
          fontWeight: typography.fontWeight.bold,
        }}
      >
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={handleOpen}
        style={{
          minHeight: 52,
          justifyContent: "center",
          paddingHorizontal: spacing[16],
          paddingVertical: spacing[14],
          borderWidth: 1,
          borderColor: error ? colors.danger : selectedOption ? colors.accentStrong : colors.border,
          borderRadius: radius[16],
          backgroundColor: selectedOption ? colors.accentSoft : colors.background,
        }}
      >
        <Text
          style={{
            color: selectedOption ? colors.textPrimary : colors.textMuted,
            fontWeight: selectedOption
              ? typography.fontWeight.bold
              : typography.fontWeight.regular,
          }}
        >
          {selectedOption
            ? `${getFlagEmoji(selectedOption.value)} ${selectedOption.label}`
            : placeholder}
        </Text>
      </Pressable>
      {error ? (
        <Text
          style={{
            color: colors.danger,
            fontSize: typography.fontSize[12],
          }}
        >
          {error}
        </Text>
      ) : null}

      <Modal
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
        transparent
        visible={isOpen}
      >
        <Pressable
          onPress={() => setIsOpen(false)}
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(15, 23, 42, 0.45)",
            padding: spacing[16],
          }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              maxHeight: "80%",
              gap: spacing[12],
              borderRadius: radius[24],
              backgroundColor: colors.surface,
              padding: spacing[18],
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: spacing[12],
              }}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: typography.fontSize[18],
                  fontWeight: typography.fontWeight.heavy,
                }}
              >
                {label}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => setIsOpen(false)}>
                <Text
                  style={{
                    color: colors.accentStrong,
                    fontWeight: typography.fontWeight.bold,
                  }}
                >
                  Chiudi
                </Text>
              </Pressable>
            </View>

            <TextInput
              ref={searchRef}
              onChangeText={setQuery}
              placeholder="Cerca nazionalità..."
              placeholderTextColor={colors.textMuted}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius[14],
                paddingHorizontal: spacing[14],
                paddingVertical: spacing[10],
                color: colors.textPrimary,
                fontSize: typography.fontSize[16],
                backgroundColor: colors.background,
              }}
              value={query}
            />

            {value ? (
              <Pressable
                accessibilityRole="button"
                onPress={handleClear}
                style={{
                  borderRadius: radius[14],
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceMuted,
                  paddingHorizontal: spacing[14],
                  paddingVertical: spacing[10],
                }}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontWeight: typography.fontWeight.bold,
                  }}
                >
                  Rimuovi selezione
                </Text>
              </Pressable>
            ) : null}

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: spacing[8] }}
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleSelect(item)}
                    style={{
                      borderRadius: radius[14],
                      borderWidth: 1,
                      borderColor: isSelected ? colors.accentStrong : colors.border,
                      backgroundColor: isSelected
                        ? colors.accentSoft
                        : colors.background,
                      paddingHorizontal: spacing[14],
                      paddingVertical: spacing[12],
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontWeight: isSelected
                          ? typography.fontWeight.heavy
                          : typography.fontWeight.regular,
                      }}
                    >
                      {getFlagEmoji(item.value)} {item.label}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
