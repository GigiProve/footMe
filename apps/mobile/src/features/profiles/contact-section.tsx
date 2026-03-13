import { type ComponentProps } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import type { UserContactsRecord } from "./profile-service";
import {
  getSocialDisplayValue,
  normalizeContactEmail,
  normalizeFacebookInput,
  normalizeInstagramInput,
} from "./profile-form-utils";
import { ProfileSectionCard } from "./profile-screen-components";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Input } from "../../ui";

type SocialInputProps = {
  iconName: ComponentProps<typeof Ionicons>["name"];
  keyboardType?: ComponentProps<typeof Input>["keyboardType"];
  onChangeText?: (value: string) => void;
  placeholder?: string;
  value: string;
};

type ContactFieldProps = {
  editable?: boolean;
  helperText?: string;
  iconName: ComponentProps<typeof Ionicons>["name"];
  keyboardType?: ComponentProps<typeof Input>["keyboardType"];
  label: string;
  linkUrl?: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  value: string;
};

type VisibilityToggleProps = {
  description?: string;
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
};

type ContactSectionProps = {
  contacts: UserContactsRecord;
  editable?: boolean;
  onEmailChange?: (value: string) => void;
  onFacebookChange?: (value: string) => void;
  onInstagramChange?: (value: string) => void;
  onPhoneChange?: (value: string) => void;
  onShowEmailChange?: (value: boolean) => void;
  onShowFacebookChange?: (value: boolean) => void;
  onShowInstagramChange?: (value: boolean) => void;
};

type PublicContactRow = {
  iconName: ComponentProps<typeof Ionicons>["name"];
  label: string;
  linkUrl: string;
  value: string;
};

export function SocialInput({
  iconName,
  keyboardType,
  onChangeText,
  placeholder = "Da completare",
  value,
}: SocialInputProps) {
  return (
    <View style={styles.inputRow}>
      <View style={styles.iconBadge}>
        <Ionicons color={colors.textSecondary} name={iconName} size={18} />
      </View>
      <Input
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        style={styles.socialInput}
        value={value}
      />
    </View>
  );
}

export function ContactField({
  editable = false,
  helperText,
  iconName,
  keyboardType,
  label,
  linkUrl,
  onChangeText,
  placeholder,
  value,
}: ContactFieldProps) {
  const trimmedValue = value.trim();

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {editable ? (
        <SocialInput
          iconName={iconName}
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          placeholder={placeholder}
          value={value}
        />
      ) : (
        <Pressable
          accessibilityRole={linkUrl ? "button" : undefined}
          disabled={!linkUrl}
          onPress={() => {
            if (linkUrl) {
              void Linking.openURL(linkUrl);
            }
          }}
          style={({ pressed }) => [
            styles.readonlyField,
            pressed && linkUrl ? styles.pressed : null,
          ]}
        >
          <View style={styles.iconBadge}>
            <Ionicons color={colors.textSecondary} name={iconName} size={18} />
          </View>
          <Text style={styles.readonlyValue}>{trimmedValue || "Da completare"}</Text>
        </Pressable>
      )}
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
}

export function VisibilityToggle({
  description,
  label,
  onValueChange,
  value,
}: VisibilityToggleProps) {
  return (
    <View style={styles.visibilityRow}>
      <View style={styles.visibilityCopy}>
        <Text style={styles.visibilityLabel}>{label}</Text>
        <Text style={styles.visibilityDescription}>
          {description ?? "Mostra nel profilo pubblico"}
        </Text>
      </View>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        onPress={() => onValueChange(!value)}
        testID={`visibility-toggle-${label}`}
        style={({ pressed }) => [
          styles.toggleButton,
          value ? styles.toggleButtonActive : null,
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={[styles.toggleLabel, value ? styles.toggleLabelActive : null]}>
          {value ? "ON" : "OFF"}
        </Text>
      </Pressable>
    </View>
  );
}

export function ContactSection({
  contacts,
  editable = false,
  onEmailChange,
  onFacebookChange,
  onInstagramChange,
  onPhoneChange,
  onShowEmailChange,
  onShowFacebookChange,
  onShowInstagramChange,
}: ContactSectionProps) {
  const instagramUrl = normalizeInstagramInput(contacts.instagram);
  const facebookUrl = normalizeFacebookInput(contacts.facebook);
  const emailValue = normalizeContactEmail(contacts.email);

  const publicContactRows: PublicContactRow[] = [
    contacts.showInstagram && instagramUrl
      ? {
          iconName: "logo-instagram" as const,
          label: "Instagram",
          linkUrl: instagramUrl,
          value: getSocialDisplayValue("instagram", instagramUrl),
        }
      : null,
    contacts.showFacebook && facebookUrl
      ? {
          iconName: "logo-facebook" as const,
          label: "Facebook",
          linkUrl: facebookUrl,
          value: getSocialDisplayValue("facebook", facebookUrl),
        }
      : null,
    contacts.showEmail && emailValue
      ? {
          iconName: "mail-outline" as const,
          label: "Email",
          linkUrl: `mailto:${emailValue}`,
          value: emailValue,
        }
      : null,
  ].filter(Boolean) as PublicContactRow[];

  return (
    <ProfileSectionCard
      description={
        editable
          ? "La chat interna resta il canale principale. I contatti esterni sono sempre facoltativi."
          : "Mostra solo i contatti pubblici che vuoi rendere visibili nel profilo."
      }
      title="Contatti"
    >
      {editable ? (
        <>
          <ContactField
            editable
            helperText="Username o link completo. Esempio: @nomeutente o https://instagram.com/nomeutente"
            iconName="logo-instagram"
            label="Instagram"
            onChangeText={onInstagramChange}
            placeholder="Da completare"
            value={contacts.instagram}
          />
          <VisibilityToggle
            label="Mostra Instagram nel profilo pubblico"
            onValueChange={(value) => onShowInstagramChange?.(value)}
            value={contacts.showInstagram}
          />
          <ContactField
            editable
            helperText="Username o link completo. Esempio: nomeutente o https://facebook.com/nomeutente"
            iconName="logo-facebook"
            label="Facebook"
            onChangeText={onFacebookChange}
            placeholder="Da completare"
            value={contacts.facebook}
          />
          <VisibilityToggle
            label="Mostra Facebook nel profilo pubblico"
            onValueChange={(value) => onShowFacebookChange?.(value)}
            value={contacts.showFacebook}
          />
          <ContactField
            editable
            helperText="Usa un'email valida. Verrà aperta con mailto: solo se resa pubblica."
            iconName="mail-outline"
            keyboardType="email-address"
            label="Email"
            onChangeText={onEmailChange}
            placeholder="Da completare"
            value={contacts.email}
          />
          <VisibilityToggle
            label="Mostra Email nel profilo pubblico"
            onValueChange={(value) => onShowEmailChange?.(value)}
            value={contacts.showEmail}
          />
          <ContactField
            editable
            helperText="Formato internazionale preferito E.164. Non sarà mai visibile pubblicamente e potrai condividerlo solo dalla chat."
            iconName="call-outline"
            keyboardType="phone-pad"
            label="Numero di cellulare"
            onChangeText={onPhoneChange}
            placeholder="Da completare"
            value={contacts.phone}
          />
        </>
      ) : publicContactRows.length > 0 ? (
        publicContactRows.map((item) => (
          <ContactField
            iconName={item.iconName}
            key={item.label}
            label={item.label}
            linkUrl={item.linkUrl}
            value={item.value}
          />
        ))
      ) : (
        <View style={styles.emptyState}>
          <Ionicons color={colors.textSecondary} name="chatbubble-ellipses-outline" size={20} />
          <Text style={styles.emptyStateText}>
            Nessun contatto pubblico condiviso. Usa la chat interna footMe per iniziare la conversazione.
          </Text>
        </View>
      )}
    </ProfileSectionCard>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[10],
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[14],
    borderRadius: radius[18],
    backgroundColor: colors.surfaceMuted,
  },
  emptyStateText: {
    flex: 1,
    color: colors.textSecondary,
    lineHeight: typography.lineHeight[22],
  },
  fieldContainer: {
    gap: spacing[8],
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: typography.letterSpacing.md,
  },
  helperText: {
    color: colors.textSecondary,
    lineHeight: typography.lineHeight[22],
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[10],
  },
  pressed: {
    opacity: 0.82,
  },
  readonlyField: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    minHeight: 58,
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[10],
    borderRadius: radius[18],
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentSoft,
  },
  readonlyValue: {
    flex: 1,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.bold,
  },
  socialInput: {
    flex: 1,
  },
  toggleButton: {
    minWidth: 64,
    minHeight: 40,
    paddingHorizontal: spacing[12],
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleButtonActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  toggleLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.heavy,
    letterSpacing: typography.letterSpacing.md,
  },
  toggleLabelActive: {
    color: colors.accentStrong,
  },
  visibilityCopy: {
    flex: 1,
    gap: spacing[4],
  },
  visibilityDescription: {
    color: colors.textSecondary,
    lineHeight: typography.lineHeight[22],
  },
  visibilityLabel: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.bold,
  },
  visibilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
    borderRadius: radius[18],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
