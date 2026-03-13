import { slugify } from "../../lib/slugify";
import { supabase } from "../../lib/supabase";
import { withDefaultProfileAvatar } from "../profiles/profile-avatar";

export type AppRole = "player" | "coach" | "staff" | "club_admin";
export type ProfileGender =
  | "male"
  | "female"
  | "non_binary"
  | "prefer_not_to_say";
export type PlayerPosition =
  | "goalkeeper"
  | "defender"
  | "midfielder"
  | "forward";
export type StaffSpecialization =
  | "fitness_coach"
  | "goalkeeper_coach"
  | "physiotherapist"
  | "match_analyst"
  | "team_manager"
  | "other";

type CreateInitialProfileInput = {
  avatarUrl: string;
  birthDate: string;
  clubCity: string;
  clubName: string;
  clubRegion: string;
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

export async function createInitialProfile(input: CreateInitialProfileInput) {
  const avatarUrl = withDefaultProfileAvatar(input.avatarUrl);
  const birthDate = input.birthDate.trim();
  const domicile = input.domicile.trim();
  const fullName = input.fullName.trim();
  const gender = input.gender;
  const nationality = input.nationality.trim();
  const phoneNumber = input.phoneNumber.trim();
  const residence = input.residence.trim();

  if (!fullName) {
    throw new Error("Inserisci nome e cognome prima di continuare.");
  }

  if (
    !birthDate ||
    !gender ||
    !nationality ||
    !residence ||
    !domicile
  ) {
    throw new Error(
      "Completa sesso, data di nascita, nazionalita', residenza e domicilio.",
    );
  }

  if (input.role === "club_admin") {
    if (
      !input.clubName.trim() ||
      !input.clubCity.trim() ||
      !input.clubRegion.trim()
    ) {
      throw new Error("Per una societa' servono nome, citta' e regione.");
    }
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    avatar_url: avatarUrl,
    birth_date: birthDate,
    domicile,
    id: input.userId,
    gender,
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
      phone: phoneNumber || null,
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
    const { error } = await supabase.from("clubs").upsert({
      owner_profile_id: input.userId,
      name: input.clubName.trim(),
      slug: slugify(input.clubName),
      city: input.clubCity.trim(),
      region: input.clubRegion.trim(),
    });

    if (error) {
      throw error;
    }
  }
}
