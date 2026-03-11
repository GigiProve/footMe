import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../styles";
import { resolveIconName, type IconName } from "./icon-config";

const iconSizes = {
  md: 20,
  lg: 24,
} as const;

type IconProps = {
  active?: boolean;
  color?: string;
  name: IconName;
  size?: keyof typeof iconSizes;
};

export function Icon({ active = false, color, name, size = "md" }: IconProps) {
  return (
    <Ionicons
      color={color ?? colors.textPrimary}
      name={resolveIconName(name, active)}
      size={iconSizes[size]}
    />
  );
}
