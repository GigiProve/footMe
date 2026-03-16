import { useCallback, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  searchItalianCities,
  type ItalianCityOption,
} from "../../features/profiles/profile-form-utils";
import { colors, radius, spacing, typography } from "../../theme/tokens";

export function ResidenceCityInput({
  error,
  label,
  onChange,
  placeholder = "Inizia a digitare la città...",
  value,
}: {
  error?: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const [inputText, setInputText] = useState(value);
  const [suggestions, setSuggestions] = useState<ItalianCityOption[]>([]);
  const [isSelected, setIsSelected] = useState(Boolean(value));
  const inputRef = useRef<TextInput>(null);

  const handleTextChange = useCallback(
    (text: string) => {
      setInputText(text);
      setIsSelected(false);
      onChange("");
      if (text.trim().length >= 2) {
        setSuggestions(searchItalianCities(text, 8));
      } else {
        setSuggestions([]);
      }
    },
    [onChange],
  );

  function handleSelect(city: ItalianCityOption) {
    const formatted = `${city.name} (${city.region})`;
    setInputText(formatted);
    setIsSelected(true);
    setSuggestions([]);
    onChange(formatted);
    inputRef.current?.blur();
  }

  function handleClear() {
    setInputText("");
    setIsSelected(false);
    setSuggestions([]);
    onChange("");
    inputRef.current?.focus();
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
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1,
          borderColor: error
            ? colors.danger
            : isSelected
              ? colors.accentStrong
              : colors.border,
          borderRadius: radius[16],
          backgroundColor: isSelected ? colors.accentSoft : colors.background,
          paddingHorizontal: spacing[16],
          minHeight: 52,
        }}
      >
        <TextInput
          ref={inputRef}
          autoCorrect={false}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          style={{
            flex: 1,
            color: colors.textPrimary,
            fontSize: typography.fontSize[16],
            paddingVertical: spacing[14],
            fontWeight: isSelected ? typography.fontWeight.bold : typography.fontWeight.regular,
          }}
          value={inputText}
        />
        {isSelected ? (
          <Pressable
            accessibilityRole="button"
            onPress={handleClear}
            style={{ paddingLeft: spacing[8] }}
          >
            <Text
              style={{
                color: colors.accentStrong,
                fontWeight: typography.fontWeight.bold,
                fontSize: typography.fontSize[12],
              }}
            >
              ✕
            </Text>
          </Pressable>
        ) : null}
      </View>

      {suggestions.length > 0 ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius[16],
            backgroundColor: colors.surface,
            overflow: "hidden",
          }}
        >
          <FlatList
            data={suggestions}
            keyExtractor={(item) => `${item.name}-${item.region}`}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={false}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => handleSelect(item)}
                style={{
                  paddingHorizontal: spacing[16],
                  paddingVertical: spacing[12],
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: typography.fontSize[16],
                  }}
                >
                  {item.name}{" "}
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: typography.fontSize[14],
                    }}
                  >
                    ({item.region})
                  </Text>
                </Text>
              </Pressable>
            )}
          />
        </View>
      ) : null}

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
    </View>
  );
}
