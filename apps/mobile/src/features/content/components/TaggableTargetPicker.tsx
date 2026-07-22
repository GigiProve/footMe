import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../styles";
import { AppText, Avatar, Input } from "../../../ui";
import {
  formatTargetRoleLabel,
  searchTagTargets,
  type TargetType,
} from "../content-tag-service";
import { type TaggableTarget, targetKey } from "../tag-types";

const SEARCH_DEBOUNCE_MS = 250;

type TaggableTargetPickerProps = {
  allowedTypes?: TargetType[];
  label?: string;
  /** Maximum number of targets selectable. When the cap is reached a neutral
   *  hint is shown in place of the search input. Default: unlimited. */
  max?: number;
  onChange: (next: TaggableTarget[]) => void;
  placeholder?: string;
  required?: boolean;
  value: TaggableTarget[];
};

function isSquare(type: TargetType) {
  return type !== "profile";
}

export function TaggableTargetPicker({
  allowedTypes,
  label,
  max,
  onChange,
  placeholder = "Cerca un profilo, una società o una squadra",
  required = false,
  value,
}: TaggableTargetPickerProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<TaggableTarget[]>([]);

  const atMax = max !== undefined && value.length >= max;

  useEffect(() => {
    if (atMax) {
      setSuggestions([]);
      return;
    }

    let isMounted = true;
    const timeout = setTimeout(() => {
      async function loadSuggestions() {
        if (query.trim().length < 2) {
          setSuggestions([]);
          return;
        }

        try {
          const results = await searchTagTargets(query.trim());
          if (!isMounted) {
            return;
          }
          setSuggestions(
            allowedTypes
              ? results.filter((result) =>
                  allowedTypes.includes(result.target_type),
                )
              : results,
          );
        } catch {
          if (isMounted) {
            setSuggestions([]);
          }
        }
      }

      void loadSuggestions();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [query, allowedTypes, atMax]);

  const selectedKeys = useMemo(
    () => new Set(value.map((target) => targetKey(target))),
    [value],
  );

  function handleSelect(target: TaggableTarget) {
    if (selectedKeys.has(targetKey(target))) {
      return;
    }
    if (max !== undefined && value.length >= max) {
      return;
    }
    onChange([...value, target]);
    setQuery("");
    setSuggestions([]);
  }

  function handleRemove(target: TaggableTarget) {
    onChange(value.filter((item) => targetKey(item) !== targetKey(target)));
  }

  return (
    <View style={styles.container}>
      {atMax ? (
        <AppText color="secondary" variant="bodySm">
          Puoi taggare fino a {max} profili.
        </AppText>
      ) : (
        <Input
          label={label ?? (required ? "Profili taggati (obbligatorio)" : "Profili taggati")}
          onChangeText={setQuery}
          placeholder={placeholder}
          value={query}
        />
      )}

      {value.length > 0 ? (
        <View style={styles.selectedTags}>
          {value.map((target) => (
            <View key={targetKey(target)} style={styles.selectedTagChip}>
              <Avatar
                name={target.display_name}
                size="sm"
                square={isSquare(target.target_type)}
                uri={target.avatar_url}
              />
              <AppText
                numberOfLines={1}
                style={styles.selectedTagText}
                variant="bodySm"
              >
                {target.display_name}
              </AppText>
              <Pressable
                accessibilityLabel={`Rimuovi ${target.display_name}`}
                hitSlop={8}
                onPress={() => handleRemove(target)}
              >
                <Ionicons color={colors.accent} name="close" size={16} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {suggestions.length > 0 && !atMax ? (
        <View style={styles.suggestions}>
          {suggestions.map((suggestion) => {
            const disabled = selectedKeys.has(targetKey(suggestion));
            const roleText = formatTargetRoleLabel(
              suggestion.role_label,
              suggestion.target_type,
            );
            const meta = [roleText, suggestion.subtitle]
              .filter(Boolean)
              .join(" · ");

            return (
              <Pressable
                accessibilityRole="button"
                disabled={disabled}
                key={targetKey(suggestion)}
                onPress={() => handleSelect(suggestion)}
                style={[styles.suggestionRow, disabled ? styles.suggestionDisabled : null]}
              >
                <Avatar
                  name={suggestion.display_name}
                  size="sm"
                  square={isSquare(suggestion.target_type)}
                  uri={suggestion.avatar_url}
                />
                <View style={styles.suggestionInfo}>
                  <AppText numberOfLines={1} variant="bodySm">
                    {suggestion.display_name}
                  </AppText>
                  {meta ? (
                    <AppText color="secondary" numberOfLines={1} variant="caption">
                      {meta}
                    </AppText>
                  ) : null}
                </View>
                {disabled ? (
                  <Ionicons color={colors.accent} name="checkmark" size={16} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[12],
  },
  selectedTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  selectedTagChip: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    flexDirection: "row",
    gap: spacing[6],
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[6],
  },
  selectedTagText: {
    maxWidth: 160,
  },
  suggestions: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    overflow: "hidden",
  },
  suggestionRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
  },
  suggestionDisabled: {
    opacity: 0.5,
  },
  suggestionInfo: {
    flex: 1,
    gap: spacing[4],
  },
});
