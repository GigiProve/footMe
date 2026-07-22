import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { formatMessageTime } from "../chat-helpers";
import { ContactCardMessage } from "../contact-card-message";
import type { ConversationMessage } from "../messaging-service";
import { useChatMediaUrl } from "../use-chat-media-url";

type MessageBubbleProps = {
  isOwnMessage: boolean;
  message: ConversationMessage;
  onCopyContactPhone: (phone: string) => void;
};

export function MessageBubble({ isOwnMessage, message, onCopyContactPhone }: MessageBubbleProps) {
  if (
    message.message_kind === "contact_card" &&
    message.shared_contact_name &&
    message.shared_contact_phone
  ) {
    return (
      <View style={[styles.wrapper, isOwnMessage ? styles.alignEnd : styles.alignStart]}>
        <ContactCardMessage
          isOwnMessage={isOwnMessage}
          name={message.shared_contact_name}
          onLongPress={() => onCopyContactPhone(message.shared_contact_phone ?? "")}
          onPress={() => void Linking.openURL(`tel:${message.shared_contact_phone}`)}
          phone={message.shared_contact_phone}
          timestamp={formatMessageTime(message.sent_at)}
        />
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, isOwnMessage ? styles.alignEnd : styles.alignStart]}>
      <View
        style={[
          styles.bubble,
          isOwnMessage ? styles.bubbleOwn : styles.bubbleOther,
        ]}
      >
        <MessageBubbleContent isOwnMessage={isOwnMessage} message={message} />
      </View>
      <AppText color="muted" style={styles.timestamp} variant="caption">
        {formatMessageTime(message.sent_at)}
      </AppText>
    </View>
  );
}

function MessageBubbleContent({
  isOwnMessage,
  message,
}: {
  isOwnMessage: boolean;
  message: ConversationMessage;
}) {
  const textColor = isOwnMessage ? "chatBubbleSentText" : "chatBubbleReceivedText";

  if (message.message_kind === "image") {
    return <MediaImageBubble path={message.media_url} />;
  }

  if (message.message_kind === "video") {
    return <MediaVideoBubble path={message.media_url} />;
  }

  if (message.message_kind === "document") {
    return (
      <MediaDocumentBubble
        fileName={message.body}
        isOwnMessage={isOwnMessage}
        path={message.media_url}
      />
    );
  }

  return (
    <AppText
      style={[styles.text, { color: colors[textColor] }]}
      variant="bodySm"
    >
      {message.body}
    </AppText>
  );
}

function MediaImageBubble({ path }: { path: string | null }) {
  const { data: signedUrl, isLoading } = useChatMediaUrl(path);

  if (isLoading || !signedUrl) {
    return (
      <View style={styles.mediaPlaceholder}>
        <ActivityIndicator color={colors.textMuted} size="small" />
      </View>
    );
  }

  return (
    <Image resizeMode="cover" source={{ uri: signedUrl }} style={styles.mediaImage} />
  );
}

function MediaVideoBubble({ path }: { path: string | null }) {
  const { data: signedUrl } = useChatMediaUrl(path);

  return (
    <Pressable
      accessibilityLabel="Riproduci video"
      disabled={!signedUrl}
      onPress={() => signedUrl && void Linking.openURL(signedUrl)}
      style={styles.videoPlaceholder}
    >
      <Ionicons color={colors.inkInvert} name="play-circle-outline" size={36} />
    </Pressable>
  );
}

function MediaDocumentBubble({
  fileName,
  isOwnMessage,
  path,
}: {
  fileName: string;
  isOwnMessage: boolean;
  path: string | null;
}) {
  const { data: signedUrl } = useChatMediaUrl(path);
  const textColor = isOwnMessage ? "chatBubbleSentText" : "chatBubbleReceivedText";

  return (
    <Pressable
      accessibilityLabel={`Apri documento ${fileName}`}
      disabled={!signedUrl}
      onPress={() => signedUrl && void Linking.openURL(signedUrl)}
      style={styles.documentRow}
    >
      <Ionicons color={colors[textColor]} name="document-text-outline" size={20} />
      <AppText style={[styles.text, { color: colors[textColor] }]} variant="bodySm">
        {fileName}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  alignEnd: {
    alignItems: "flex-end",
  },
  alignStart: {
    alignItems: "flex-start",
  },
  bubble: {
    borderRadius: radius[12],
    maxWidth: "75%",
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[10],
  },
  bubbleOther: {
    backgroundColor: colors.chatBubbleReceived,
    borderBottomLeftRadius: 4,
  },
  bubbleOwn: {
    backgroundColor: colors.chatBubbleSent,
    borderBottomRightRadius: 4,
  },
  documentRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
  mediaImage: {
    borderRadius: radius[8],
    height: 200,
    width: 200,
  },
  mediaPlaceholder: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    height: 200,
    justifyContent: "center",
    width: 200,
  },
  text: {
    fontWeight: "400",
  },
  timestamp: {
    fontSize: 10,
    fontWeight: "400",
    marginTop: spacing[4],
  },
  videoPlaceholder: {
    alignItems: "center",
    backgroundColor: colors.surfaceInverse,
    borderRadius: radius[8],
    height: 200,
    justifyContent: "center",
    width: 200,
  },
  wrapper: {
    marginBottom: spacing[12],
  },
});
