import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../styles";

const iconNames = {
  announcements: "megaphone-outline",
  home: "home-outline",
  messages: "chatbubble-ellipses-outline",
  network: "people-outline",
  profile: "person-circle-outline",
} as const;

const iconSizes = {
  md: 20,
  lg: 24,
} as const;

export type IconName = keyof typeof iconNames;

type IconProps = {
  color?: string;
  name: IconName;
  size?: keyof typeof iconSizes;
};

export function Icon({ color, name, size = "md" }: IconProps) {
  return (
    <Ionicons
      color={color ?? colors.textPrimary}
      name={iconNames[name]}
      size={iconSizes[size]}
    />
  );
}
