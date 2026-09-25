/**
 * Adattatori verso il Master UI onboarding (REV-ONB-01).
 *
 * Questi nomi esistevano prima del Master e sono usati da tutti gli step di
 * ruolo già scritti. Invece di tenere in vita due linguaggi visuali in
 * parallelo (§AW), ognuno di essi ora rende il componente condiviso: gli step
 * esistenti adottano il nuovo aspetto senza essere riscritti, e le task
 * REV-ONB successive possono passare direttamente ai componenti di
 * `./ui` mentre riportano la logica di ruolo.
 *
 * Non aggiungere nuovi componenti qui: il posto giusto è `./ui`.
 */

import type { ReactNode } from "react";

import { AppText } from "../../ui";
import {
  InfoMessage,
  OnboardingSection,
  SelectionRow,
  ToggleRow,
} from "./ui";

type OnboardingSectionCardProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
};

/** @deprecated Usa `OnboardingSection` da `./ui`. */
export function OnboardingSectionCard({
  children,
  subtitle,
  title,
}: OnboardingSectionCardProps) {
  return (
    <OnboardingSection description={subtitle} title={title}>
      {children}
    </OnboardingSection>
  );
}

/** @deprecated Usa `InfoMessage` da `./ui`. */
export function OnboardingInfoCard({ message }: { message: string }) {
  return <InfoMessage message={message} />;
}

/** @deprecated Usa `AppText variant="eyebrow"`. */
export function OnboardingEyebrow({ children }: { children: string }) {
  return (
    <AppText color="accent" variant="eyebrow">
      {children}
    </AppText>
  );
}

/** @deprecated Usa `SelectionRow` da `./ui`. */
export function OnboardingCheckboxRow({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return <SelectionRow label={label} onPress={onPress} selected={active} />;
}

/** @deprecated Usa `ToggleRow` da `./ui`. */
export function OnboardingToggleRow({
  label,
  onValueChange,
  value,
}: {
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <ToggleRow label={label} onValueChange={onValueChange} value={value} />
  );
}
