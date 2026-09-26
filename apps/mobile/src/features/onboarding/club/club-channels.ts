/**
 * Canali digitali della società (REV-ONB-05 §AK, §AL, §AM).
 *
 * In onboarding si parte da sito e Instagram: gli altri canali compaiono
 * solo quando l'utente dichiara di averli, così la schermata non si riempie
 * di campi vuoti per piattaforme che il club non usa.
 */
import type { OnboardingFormState } from "../onboarding-form";

export type ClubChannelKey =
  | "website"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "youtube";

type ClubChannelDefinition = {
  key: ClubChannelKey;
  label: string;
  placeholder: string;
  field: keyof OnboardingFormState;
  /** Mostrato da subito, senza passare da "Aggiungi altro canale" (§AK). */
  alwaysVisible: boolean;
};

export const CLUB_CHANNELS: ClubChannelDefinition[] = [
  {
    alwaysVisible: true,
    field: "clubWebsite",
    key: "website",
    label: "Sito web",
    placeholder: "www.societa.it",
  },
  {
    alwaysVisible: true,
    field: "clubInstagram",
    key: "instagram",
    label: "Instagram",
    placeholder: "@societa",
  },
  {
    alwaysVisible: false,
    field: "clubFacebook",
    key: "facebook",
    label: "Facebook",
    placeholder: "Nome della pagina",
  },
  {
    alwaysVisible: false,
    field: "clubTikTok",
    key: "tiktok",
    label: "TikTok",
    placeholder: "@societa",
  },
  {
    alwaysVisible: false,
    field: "clubYouTube",
    key: "youtube",
    label: "YouTube",
    placeholder: "Nome del canale",
  },
];

/**
 * I canali da rendere: i due di base più quelli aggiunti a mano o già
 * compilati in una sessione precedente.
 */
export function getVisibleClubChannels(
  form: OnboardingFormState,
  addedKeys: ClubChannelKey[],
) {
  return CLUB_CHANNELS.filter(
    (channel) =>
      channel.alwaysVisible ||
      addedKeys.includes(channel.key) ||
      String(form[channel.field] ?? "").trim().length > 0,
  );
}

export function getAvailableClubChannels(
  form: OnboardingFormState,
  addedKeys: ClubChannelKey[],
) {
  const visible = getVisibleClubChannels(form, addedKeys);

  return CLUB_CHANNELS.filter(
    (channel) => !visible.some((entry) => entry.key === channel.key),
  );
}

/**
 * §AM: l'utente scrive come gli viene — URL completo, handle con la chiocciola
 * o nome della pagina. La normalizzazione è nostra, non sua.
 */
export function normalizeClubChannelValue(
  key: ClubChannelKey,
  value: string,
): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (key === "website") {
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }

  if (key === "facebook" || key === "youtube") {
    return trimmed;
  }

  // Handle social: teniamo l'URL se è un URL, altrimenti la @username.
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}
