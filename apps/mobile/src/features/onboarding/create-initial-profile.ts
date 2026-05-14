import { isPhoneNumberValid, normalizePhoneInput } from "../profiles/profile-form-utils";
import { slugify } from "../../lib/slugify";
import { supabase } from "../../lib/supabase";
import type { PlayerPosition } from "../profiles/player-sports";
import {
  mapStaffRoleToSpecialization,
  type AppRole,
  type ProfileGender,
  type StaffRole,
  type StaffSpecialization,
} from "./onboarding-types";

export type { PlayerPosition } from "../profiles/player-sports";
export type { AppRole, ProfileGender, StaffSpecialization } from "./onboarding-types";

type CreateInitialProfileInput = {
  authEmail: string;
  avatarUrl: string;
  birthDate: string;
  clubCategory: string;
  clubCity: string;
  clubColors: string;
  clubCountry: string;
  clubDescription: string;
  clubEmail: string;
  clubFacebook: string;
  clubFieldAddress: string;
  clubFoundingYear: string;
  clubHasYouthSector: boolean;
  clubHeadquartersAddress: string;
  clubInstagram: string;
  clubLogoUrl: string;
  clubName: string;
  clubPhone: string;
  clubRegion: string;
  clubStadium: string;
  clubTotalMembers: string;
  clubWebsite: string;
  clubYouthCategories: string[];

  currentLocationCity: string;
  currentLocationCountry: string;
  domicile: string;
  fullName: string;
  gender: ProfileGender;
  legalStatus: string;
  nationality: string;
  phoneNumber: string;
  primaryPosition: PlayerPosition;
  repEmail: string;
  repPhone: string;
  residence: string;
  residenceCountry: string;
  role: AppRole;
  staffAvailableFrom: string;
  staffPrimaryRole: string;
  staffRoles: StaffRole[];
  staffSpecialization: StaffSpecialization;
  userId: string;
};

type ValidatedBaseProfileStep = {
  avatarUrl: string | null;
  birthDate: string;
  currentLocationCity: string | null;
  currentLocationCountry: string | null;
  domicile: string | null;
  fullName: string;
  legalStatus: string | null;
  nationality: string | null;
  phoneNumber: string | null;
  residence: string | null;
  residenceCountry: string | null;
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
  const currentLocationCity = parseOptionalText(input.currentLocationCity);
  const currentLocationCountry = parseOptionalText(input.currentLocationCountry);
  const domicile = parseOptionalText(input.domicile);
  const fullName = input.fullName.trim();
  const legalStatus = parseOptionalText(input.legalStatus);
  const nationality = parseOptionalText(input.nationality);
  const phoneNumber = parseOptionalText(normalizePhoneInput(input.phoneNumber));
  const residence = parseOptionalText(input.residence);
  const residenceCountry = parseOptionalText(input.residenceCountry);

  if (!fullName) {
    throw new BaseProfileValidationError("Inserisci nome e cognome prima di continuare.", [
      "nome e cognome",
    ]);
  }

  // Some Banani-aligned onboarding flows do not expose gender.
  if (input.role !== "club_admin") {
    const missingFields = [
      input.role !== "agent" &&
      input.role !== "director" &&
      input.role !== "fan" &&
      input.role !== "media" &&
      !input.gender
        ? "sesso"
        : null,
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

  return {
    avatarUrl,
    birthDate,
    currentLocationCity,
    currentLocationCountry,
    domicile,
    fullName,
    legalStatus,
    nationality,
    phoneNumber,
    residence,
    residenceCountry,
  };
}

export async function createInitialProfile(input: CreateInitialProfileInput) {
  const {
    avatarUrl,
    birthDate,
    currentLocationCity,
    currentLocationCountry,
    domicile,
    fullName,
    legalStatus,
    nationality,
    phoneNumber,
    residence,
    residenceCountry,
  } =
    validateBaseProfileStep(input);

  const { error: profileError } = await supabase.from("profiles").upsert({
    avatar_url: avatarUrl,
    birth_date: birthDate || null,
    current_location_city: currentLocationCity,
    current_location_country: currentLocationCountry,
    domicile,
    id: input.userId,
    gender: input.gender || null,
    legal_status: legalStatus,
    role: input.role,
    full_name: fullName,
    nationality,
    phone_number: null,
    residence,
    residence_country: residenceCountry,
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

  if (input.authEmail) {
    const { error: contactError } = await supabase
      .from("profile_contacts")
      .upsert({
        email: input.authEmail.trim().toLowerCase(),
        profile_id: input.userId,
      });

    if (contactError) {
      throw contactError;
    }
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
      available_from: input.staffAvailableFrom || null,
      primary_staff_role: input.staffPrimaryRole || null,
      profile_id: input.userId,
      specialization: mapStaffRoleToSpecialization(
        input.staffPrimaryRole || input.staffSpecialization,
      ),
      staff_roles: input.staffRoles,
    });

    if (error) {
      throw error;
    }
  }

  if (input.role === "agent") {
    const { error } = await supabase.from("agent_profiles").upsert({
      profile_id: input.userId,
    });

    if (error) {
      throw error;
    }
  }

  if (input.role === "director") {
    const { error } = await supabase.from("director_profiles").upsert({
      profile_id: input.userId,
    });

    if (error) {
      throw error;
    }
  }

  if (input.role === "fan") {
    const { error } = await supabase.from("fan_profiles").upsert({
      profile_id: input.userId,
    });

    if (error) {
      throw error;
    }
  }

  if (input.role === "media") {
    const { error } = await supabase.from("media_profiles").upsert({
      profile_id: input.userId,
    });

    if (error) {
      throw error;
    }
  }

  if (input.role === "club_admin") {
    const { data: clubData, error: clubError } = await supabase
      .from("clubs")
      .upsert(
        {
          owner_profile_id: input.userId,
          name: input.clubName.trim(),
          slug: slugify(input.clubName),
          category: parseOptionalText(input.clubCategory),
          city: input.clubCity.trim(),
          region: input.clubRegion.trim(),
          club_colors: parseOptionalText(input.clubColors),
          club_email: parseOptionalText(input.clubEmail),
          club_phone: parseOptionalText(input.clubPhone),
          country: input.clubCountry || "IT",
          description: parseOptionalText(input.clubDescription),
          facebook: parseOptionalText(input.clubFacebook),
          field_address: parseOptionalText(input.clubFieldAddress),
          founding_year: parseOptionalInteger(input.clubFoundingYear),
          headquarters_address: parseOptionalText(input.clubHeadquartersAddress),
          instagram: parseOptionalText(input.clubInstagram),
          logo_url: parseOptionalText(input.clubLogoUrl),
          representative_email: parseOptionalText(input.repEmail),
          representative_phone: parseOptionalText(input.repPhone),
          stadium: parseOptionalText(input.clubStadium),
          total_members: parseOptionalInteger(input.clubTotalMembers),
          verification_status: "pending_review",
          website_url: parseOptionalText(input.clubWebsite),

        },
        { onConflict: "owner_profile_id" },
      )
      .select("id")
      .single();

    if (clubError) {
      throw clubError;
    }

    if (clubData && input.clubCategory.trim()) {
      const clubName = input.clubName.trim();
      const logoUrl = parseOptionalText(input.clubLogoUrl);
      const city = input.clubCity.trim();
      const region = input.clubRegion.trim();

      const { data: seniorTeam, error: seniorError } = await supabase
        .from("club_teams")
        .insert({
          club_id: clubData.id,
          name: clubName,
          category: input.clubCategory.trim(),
          team_type: "senior",
          inherited: false,
          logo_url: logoUrl,
          city,
          region,
          sort_order: 0,
        })
        .select("id")
        .single();

      if (seniorError) {
        throw seniorError;
      }

      if (input.clubHasYouthSector && input.clubYouthCategories.length > 0 && seniorTeam) {
        const youthTeams = input.clubYouthCategories.map((category, index) => ({
          club_id: clubData.id,
          name: clubName,
          category,
          team_type: "youth" as const,
          parent_team_id: seniorTeam.id,
          inherited: true,
          logo_url: logoUrl,
          city,
          region,
          sort_order: index + 1,
        }));

        const { error: youthError } = await supabase
          .from("club_teams")
          .insert(youthTeams);

        if (youthError) {
          throw youthError;
        }
      }
    }
  }
}
