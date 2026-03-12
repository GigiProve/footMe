import { type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { colors } from "../../styles";
import {
  buttonContentGap,
  buttonHeights,
  buttonHorizontalPadding,
  buttonIconSizes,
  buttonRadius,
  buttonStateOpacity,
  buttonTypography,
  buttonVariants,
  chipSelectedPalette,
  destructiveOverrides,
} from "./button-tokens";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "danger"
  | "link"
  | "icon"
  | "chipAction";

export type ButtonSize = keyof typeof buttonHeights;

type ButtonPalette = {
  backgroundColor: string;
  borderColor: string;
  borderWidth?: number;
  textColor: string;
};

export type ButtonProps = {
  accessibilityLabel?: string;
  contentStyle?: StyleProp<ViewStyle>;
  destructive?: boolean;
  fullWidth?: boolean;
  label: string;
  leftIcon?: ReactNode;
  loading?: boolean;
  rightIcon?: ReactNode;
  selected?: boolean;
  size?: ButtonSize;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  variant?: ButtonVariant;
} & Omit<ComponentProps<typeof Pressable>, "accessibilityLabel" | "children" | "style">;

function resolvePalette(variant: ButtonVariant, destructive: boolean, selected: boolean): ButtonPalette {
  if (variant === "chipAction") {
    const palette = destructive
      ? destructiveOverrides.chipAction
      : {
          ...buttonVariants.chipAction,
          activeBackgroundColor: chipSelectedPalette.backgroundColor,
          activeBorderColor: chipSelectedPalette.borderColor,
          activeTextColor: chipSelectedPalette.textColor,
        };

    if (selected) {
      return {
        backgroundColor: palette.activeBackgroundColor,
        borderColor: palette.activeBorderColor,
        borderWidth: buttonVariants.chipAction.borderWidth,
        textColor: palette.activeTextColor,
      };
    }

    return {
      backgroundColor: palette.backgroundColor,
      borderColor: palette.borderColor,
      borderWidth: buttonVariants.chipAction.borderWidth,
      textColor: palette.textColor,
    };
  }

  return destructive ? destructiveOverrides[variant] : buttonVariants[variant];
}

function resolveContainerSize(size: ButtonSize, variant: ButtonVariant): ViewStyle {
  const height = buttonHeights[size];

  return {
    borderRadius: variant === "chipAction" ? buttonRadius.chip : variant === "icon" ? buttonRadius.icon : buttonRadius.default,
    minHeight: height,
    paddingHorizontal: variant === "icon" ? 0 : buttonHorizontalPadding[size],
    width: variant === "icon" ? height : undefined,
  };
}

function resolveLabelSize(size: ButtonSize): TextStyle {
  return buttonTypography[size];
}

export function Button({
  accessibilityLabel,
  contentStyle,
  destructive = false,
  disabled,
  fullWidth = false,
  label,
  leftIcon,
  loading = false,
  rightIcon,
  selected = false,
  size = "md",
  style,
  testID,
  textStyle,
  variant = "primary",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const palette = resolvePalette(variant, destructive, selected);
  const showLabel = variant !== "icon";

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled, selected }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        resolveContainerSize(size, variant),
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
          borderWidth: palette.borderWidth ?? 0,
        },
        fullWidth ? styles.fullWidth : null,
        variant === "link" ? styles.linkButton : null,
        variant === "icon" ? styles.iconButton : null,
        "focused" in state && state.focused ? styles.focused : null,
        state.pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        loading ? styles.loading : null,
        style,
      ]}
      testID={testID}
      {...props}
    >
      <View style={[styles.content, contentStyle]}>
        {loading ? (
          <ActivityIndicator
            color={palette.textColor}
            size={buttonIconSizes[size]}
            testID={testID ? `${testID}-spinner` : undefined}
          />
        ) : null}
        {leftIcon}
        {showLabel ? (
          <Text
            style={[
              styles.label,
              resolveLabelSize(size),
              { color: palette.textColor },
              variant === "link" ? styles.linkLabel : null,
              variant === "tertiary" ? styles.tertiaryLabel : null,
              variant === "chipAction" ? styles.chipLabel : null,
              textStyle,
            ]}
          >
            {label}
          </Text>
        ) : null}
        {rightIcon}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  chipLabel: {
    fontWeight: buttonTypography.sm.fontWeight,
  },
  content: {
    alignItems: "center",
    flexDirection: "row",
    gap: buttonContentGap,
    justifyContent: "center",
  },
  disabled: {
    opacity: buttonStateOpacity.disabled,
  },
  focused: {
    shadowColor: colors.accentStrong,
    shadowOpacity: 0.16,
    shadowRadius: 0,
  },
  fullWidth: {
    width: "100%",
  },
  iconButton: {
    paddingHorizontal: 0,
  },
  label: {
    textAlign: "center",
  },
  linkButton: {
    alignSelf: "flex-start",
  },
  linkLabel: {
    fontWeight: buttonTypography.sm.fontWeight,
  },
  loading: {
    opacity: buttonStateOpacity.loading,
  },
  pressed: {
    opacity: buttonStateOpacity.pressed,
  },
  tertiaryLabel: {
    fontWeight: buttonTypography.sm.fontWeight,
  },
});
