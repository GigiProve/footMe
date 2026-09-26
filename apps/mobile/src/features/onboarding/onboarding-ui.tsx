/**
 * Adattatore verso il Master UI onboarding (REV-ONB-01).
 *
 * Questi nomi esistevano prima del Master ed erano usati da tutti gli step di
 * ruolo già scritti. Invece di tenere in vita due linguaggi visuali in
 * parallelo (§AW), ognuno di essi rendeva il componente condiviso: gli step
 * esistenti adottavano il nuovo aspetto senza essere riscritti, e le task
 * REV-ONB successive passavano direttamente ai componenti di `./ui` mentre
 * riportavano la logica di ruolo.
 *
 * Con REV-ONB-07 tutti i ruoli sono passati al Master e resta in piedi il solo
 * `OnboardingSectionCard`, usato dagli step residui della rotta di onboarding.
 * `OnboardingEyebrow`, `OnboardingCheckboxRow`, `OnboardingInfoCard` e
 * `OnboardingToggleRow` sono stati rimossi con i loro ultimi consumatori.
 *
 * Non aggiungere nuovi componenti qui: il posto giusto è `./ui`.
 */

import type { ReactNode } from "react";

import { OnboardingSection } from "./ui";

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
