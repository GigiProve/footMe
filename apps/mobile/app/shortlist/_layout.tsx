import { Stack } from "expo-router";

export default function ShortlistLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[listId]" />
      <Stack.Screen name="entry/[entryId]" />
    </Stack>
  );
}
