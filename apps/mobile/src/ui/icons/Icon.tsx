import { type ColorValue } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes } from "../../styles";
import { resolveIconName, type IconName } from "./icon-config";

const iconSizes = {
  md: 20,
  lg: 24,
  /** Misura della bottom nav nel design (§1b). */
  nav: sizes.navIcon,
} as const;

type IconProps = {
  active?: boolean;
  color?: ColorValue;
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
