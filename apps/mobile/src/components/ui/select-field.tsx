import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "../../theme/tokens";

type SelectOption<T extends string = string> = {
  label: string;
  value: T;
};

export function SelectField<T extends string>({
  clearLabel = "Svuota selezione",
  clearable = false,
  label,
  onChange,
  options,
  placeholder,
  searchable = false,
  searchPlaceholder = "Cerca...",
  value,
}: {
  clearLabel?: string;
  clearable?: boolean;
  label?: string;
  onChange: (value: T | "") => void;
  options: SelectOption<T>[];
  placeholder: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  value: T | "";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("it");

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      option.label.toLocaleLowerCase("it").includes(normalizedQuery),
    );
  }, [options, query]);

  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;

  return (
    <View style={{ gap: 8 }}>
      {label ? (
        <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{label}</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setIsOpen((current) => !current);
          if (isOpen) {
            setQuery("");
          }
        }}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
        }}
      >
        <Text
          style={{
            color: selectedLabel ? colors.textPrimary : colors.textMuted,
            fontWeight: selectedLabel ? "600" : "500",
          }}
        >
          {selectedLabel || placeholder}
        </Text>
      </Pressable>

      {isOpen ? (
        <View
          style={{
            gap: 10,
            padding: 12,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          {searchable ? (
            <TextInput
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.textMuted}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.background,
              }}
              value={query}
            />
          ) : null}

          <ScrollView
            nestedScrollEnabled
            style={{ maxHeight: 220 }}
            contentContainerStyle={{ gap: 8 }}
          >
            {clearable && value ? (
              <Pressable
                onPress={() => {
                  onChange("");
                  setIsOpen(false);
                  setQuery("");
                }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                }}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>
                  {clearLabel}
                </Text>
              </Pressable>
            ) : null}

            {filteredOptions.map((option) => {
              const isSelected = option.value === value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setQuery("");
                  }}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.accentStrong : colors.border,
                    backgroundColor: isSelected ? colors.accentSoft : colors.background,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontWeight: isSelected ? "800" : "600",
                    }}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}

            {filteredOptions.length === 0 ? (
              <Text style={{ color: colors.textSecondary }}>
                Nessun risultato per la ricerca corrente.
              </Text>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
