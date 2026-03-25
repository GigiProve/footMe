import { type ComponentProps } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
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
import { colors, radius, spacing } from "../../theme/tokens";
import { AppText, Input, Toggle } from "../../ui";

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
      <AppText variant="overline" color="secondary">
        {label}
      </AppText>
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
          <AppText variant="titleSm" style={styles.readonlyValue}>
            {trimmedValue || "Da completare"}
          </AppText>
        </Pressable>
      )}
      {helperText ? (
        <AppText variant="bodySm" color="secondary">
          {helperText}
        </AppText>
      ) : null}
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
          <Toggle
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
          <Toggle
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
          <Toggle
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
          <AppText variant="bodySm" color="secondary" style={styles.emptyStateText}>
            Nessun contatto pubblico condiviso. Usa la chat interna footMe per iniziare la conversazione.
          </AppText>
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
    borderRadius: radius[8],
    backgroundColor: colors.surfaceMuted,
  },
  emptyStateText: {
    flex: 1,
  },
  fieldContainer: {
    gap: spacing[8],
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
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
    minHeight: 56,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[10],
    borderRadius: radius[6],
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  readonlyValue: {
    flex: 1,
  },
  socialInput: {
    flex: 1,
  },
});
