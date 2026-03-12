import { Icon, type IconName } from "../icons";
import { Button, type ButtonProps, type ButtonSize } from "./Button";

type IconButtonProps = Omit<ButtonProps, "leftIcon" | "rightIcon" | "variant"> & {
  icon: IconName;
  size?: ButtonSize;
};

export function IconButton({
  accessibilityLabel,
  icon,
  label,
  size = "md",
  ...props
}: IconButtonProps) {
  return (
    <Button
      accessibilityLabel={accessibilityLabel ?? label}
      label={label}
      leftIcon={
        <Icon
          name={icon}
          size={size === "lg" ? "lg" : "md"}
        />
      }
      size={size}
      variant="icon"
      {...props}
    />
  );
}
