import { StyleProp, ViewStyle } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";

type VideoPreviewProps = {
  nativeControls?: boolean;
  style?: StyleProp<ViewStyle>;
  url: string;
};

/**
 * Muted, paused inline video preview.
 *
 * `expo-video` replaced `expo-av` in SDK 57 and takes its player from a hook,
 * so an inline preview cannot be a bare element inside a conditional branch
 * the way `<Video>` was. This wraps that hook once for every call site.
 */
export function VideoPreview({
  nativeControls = false,
  style,
  url,
}: VideoPreviewProps) {
  const player = useVideoPlayer(url, (instance) => {
    instance.muted = true;
  });

  return (
    <VideoView
      contentFit="cover"
      nativeControls={nativeControls}
      player={player}
      style={style}
    />
  );
}
