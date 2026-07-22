import { ScrollView, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { spacing } from "../../styles";
import { AppText, Avatar, Button } from "../../ui";
import {
  fetchFollowedProfiles,
  fetchFollowingCount,
} from "./following-service";

const PREVIEW_AVATARS = 10;

export function FollowingSection() {
  const router = useRouter();

  const { data: count } = useQuery({
    queryKey: ["following-count"],
    queryFn: fetchFollowingCount,
  });

  const { data: previewItems } = useQuery({
    queryKey: ["followed", "all", "preview"],
    queryFn: () => fetchFollowedProfiles("all", 0, PREVIEW_AVATARS),
  });

  const total = count ?? 0;

  return (
    <View style={styles.section}>
      <AppText variant="titleMd">Seguiti</AppText>
      <AppText color="muted" style={styles.subtitle} variant="bodySm">
        {total > 0
          ? `Segui ${total} ${total === 1 ? "profilo" : "profili"} per restare aggiornato.`
          : "Profili che segui per restare aggiornato."}
      </AppText>

      {previewItems && previewItems.length > 0 ? (
        <ScrollView
          contentContainerStyle={styles.avatarRow}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {previewItems.map((item) => (
            <View key={`${item.kind}-${item.entity_id}`} style={styles.avatarItem}>
              <Avatar name={item.name} size="lg" uri={item.avatar_url} />
              <AppText
                align="center"
                numberOfLines={1}
                style={styles.avatarName}
                variant="caption"
              >
                {item.name}
              </AppText>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <Button
        label="Vedi tutti i Seguiti"
        onPress={() => router.push("/following" as never)}
        variant="outline"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing[12],
    paddingTop: spacing[24],
  },
  subtitle: {
    marginTop: -spacing[8],
  },
  avatarRow: {
    gap: spacing[16],
    paddingVertical: spacing[4],
  },
  avatarItem: {
    width: 64,
    alignItems: "center",
    gap: spacing[6],
  },
  avatarName: {
    width: 64,
  },
});
