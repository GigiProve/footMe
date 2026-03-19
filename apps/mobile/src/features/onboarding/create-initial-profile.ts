import { isPhoneNumberValid, normalizePhoneInput } from "../profiles/profile-form-utils";
import { slugify } from "../../lib/slugify";
import { supabase } from "../../lib/supabase";
import type { PlayerPosition } from "../profiles/player-sports";
import type { AppRole, ProfileGender, StaffSpecialization } from "./onboarding-types";

export type { PlayerPosition } from "../profiles/player-sports";
export type { AppRole, ProfileGender, StaffSpecialization } from "./onboarding-types";

type CreateInitialProfileInput = {
  avatarUrl: string;
  birthDate: string;
  clubCategory: string;
  clubCity: string;
  clubColors: string;
  clubCountry: string;
  clubEmail: string;
  clubFieldAddress: string;
  clubFoundingYear: string;
  clubHeadquartersAddress: string;
  clubLogoUrl: string;
  clubName: string;
  clubPhone: string;
  clubRegion: string;
  clubWebsite: string;
  domicile: string;
  fullName: string;
  gender: ProfileGender;
  nationality: string;
  phoneNumber: string;
  primaryPosition: PlayerPosition;
  residence: string;
  role: AppRole;
  staffSpecialization: StaffSpecialization;
  userId: string;
};

type ValidatedBaseProfileStep = {
  avatarUrl: string | null;
  birthDate: string;
  domicile: string | null;
  fullName: string;
  nationality: string | null;
  phoneNumber: string | null;
  residence: string | null;
};

export class BaseProfileValidationError extends Error {
  missingFields: string[];

  constructor(message: string, missingFields: string[] = []) {
    super(message);
    this.name = "BaseProfileValidationError";
    this.missingFields = missingFields;
  }
}

function parseOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseOptionalInteger(value: string): number | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = parseInt(trimmed, 10);
  return isNaN(parsed) ? null : parsed;
}

export function validateBaseProfileStep(input: CreateInitialProfileInput): ValidatedBaseProfileStep {
  const avatarUrl = parseOptionalText(input.avatarUrl);
  const birthDate = input.birthDate.trim();
  const domicile = parseOptionalText(input.domicile);
  const fullName = input.fullName.trim();
  const nationality = parseOptionalText(input.nationality);
  const phoneNumber = parseOptionalText(normalizePhoneInput(input.phoneNumber));
  const residence = parseOptionalText(input.residence);

  if (!fullName) {
    throw new BaseProfileValidationError("Inserisci nome e cognome prima di continuare.", [
      "nome e cognome",
    ]);
  }

  // Club admins skip gender and birth date during onboarding — these are
  // personal fields that can be filled later from the profile settings.
  if (input.role !== "club_admin") {
    const missingFields = [
      !input.gender ? "sesso" : null,
      !birthDate ? "data di nascita" : null,
    ].filter(Boolean) as string[];

    if (missingFields.length > 0) {
      throw new BaseProfileValidationError(
        `Completa i campi obbligatori: ${missingFields.join(", ")}.`,
        missingFields,
      );
    }
  }

  if (phoneNumber && !isPhoneNumberValid(phoneNumber)) {
    throw new BaseProfileValidationError("Inserisci un numero di cellulare valido.", [
      "numero di cellulare",
    ]);
  }

  if (input.role === "club_admin") {
    const missingClubFields = [
      !input.clubName.trim() ? "nome società" : null,
      !input.clubCity.trim() ? "città società" : null,
      !input.clubRegion.trim() ? "regione società" : null,
      !input.clubEmail.trim() ? "email società" : null,
    ].filter(Boolean) as string[];

    if (missingClubFields.length > 0) {
      throw new BaseProfileValidationError(
        `Completa i dati obbligatori della società: ${missingClubFields.join(", ")}.`,
        missingClubFields,
      );
    }
  }

  return {
    avatarUrl,
    birthDate,
    domicile,
    fullName,
    nationality,
    phoneNumber,
    residence,
  };
}

export async function createInitialProfile(input: CreateInitialProfileInput) {
  const { avatarUrl, birthDate, domicile, fullName, nationality, phoneNumber, residence } =
    validateBaseProfileStep(input);

  const { error: profileError } = await supabase.from("profiles").upsert({
    avatar_url: avatarUrl,
    birth_date: birthDate || null,
    domicile,
    id: input.userId,
    gender: input.gender || null,
    role: input.role,
    full_name: fullName,
    nationality,
    phone_number: null,
    residence,
  });

  if (profileError) {
    throw profileError;
  }

  const { error: privateContactError } = await supabase
    .from("profile_private_contacts")
    .upsert({
      phone: phoneNumber,
      profile_id: input.userId,
    });

  if (privateContactError) {
    throw privateContactError;
  }

  if (input.role === "player") {
    const { error } = await supabase.from("player_profiles").upsert({
      profile_id: input.userId,
      primary_position: input.primaryPosition,
    });

    if (error) {
      throw error;
    }
  }

  if (input.role === "coach") {
    const { error } = await supabase.from("coach_profiles").upsert({
      profile_id: input.userId,
    });

    if (error) {
      throw error;
    }
  }

  if (input.role === "staff") {
    const { error } = await supabase.from("staff_profiles").upsert({
      profile_id: input.userId,
      specialization: input.staffSpecialization,
    });

    if (error) {
      throw error;
    }
  }

  if (input.role === "club_admin") {
    const { error } = await supabase.from("clubs").upsert(
      {
        owner_profile_id: input.userId,
        name: input.clubName.trim(),
        slug: slugify(input.clubName),
        category: parseOptionalText(input.clubCategory),
        city: input.clubCity.trim(),
        region: input.clubRegion.trim(),
        club_colors: parseOptionalText(input.clubColors),
        club_email: input.clubEmail.trim().toLowerCase(),
        club_phone: parseOptionalText(input.clubPhone),
        country: input.clubCountry || "IT",
        field_address: parseOptionalText(input.clubFieldAddress),
        founding_year: parseOptionalInteger(input.clubFoundingYear),
        headquarters_address: parseOptionalText(input.clubHeadquartersAddress),
        logo_url: parseOptionalText(input.clubLogoUrl),
        verification_status: "pending_review",
        website_url: parseOptionalText(input.clubWebsite),
      },
      { onConflict: "owner_profile_id" },
    );

    if (error) {
      throw error;
    }
  }
}
