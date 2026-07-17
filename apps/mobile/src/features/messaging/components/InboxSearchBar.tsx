import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { Input } from "../../../ui";

const SEARCH_DEBOUNCE_MS = 300;

type InboxSearchBarProps = {
  onQueryChange: (query: string) => void;
  placeholder: string;
};

export function InboxSearchBar({
  onQueryChange,
  placeholder,
}: InboxSearchBarProps) {
  const [query, setQuery] = useState("");
  const onQueryChangeRef = useRef(onQueryChange);
  onQueryChangeRef.current = onQueryChange;

  useEffect(() => {
    const timeout = setTimeout(() => {
      onQueryChangeRef.current(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <View style={styles.wrapper}>
      <Ionicons color={colors.textMuted} name="search-outline" size={18} />
      <View style={styles.inputSlot}>
        <Input
          onChangeText={setQuery}
          placeholder={placeholder}
          style={styles.input}
          value={query}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[12],
    flexDirection: "row",
    gap: spacing[8],
    paddingHorizontal: spacing[14],
  },
  inputSlot: {
    flex: 1,
  },
  input: {
    backgroundColor: "transparent",
    borderWidth: 0,
    minHeight: 44,
    paddingHorizontal: spacing[0],
  },
});
