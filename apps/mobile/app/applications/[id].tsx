import { Redirect, useLocalSearchParams } from "expo-router";

/** Reindirizzamento del dettaglio personale (DAS-REV-23 §28). */
export default function MyApplicationDetailRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Redirect
      href={
        `/(tabs)/dashboard/my-applications/${encodeURIComponent(
          typeof id === "string" ? id : "",
        )}` as never
      }
    />
  );
}
