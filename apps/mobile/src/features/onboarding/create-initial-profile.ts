import { supabase } from "../../lib/supabase";

export type AppRole = "player" | "coach" | "staff" | "club_admin";
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
  clubCity: string;
  clubName: string;
  clubRegion: string;
  fullName: string;
  primaryPosition: PlayerPosition;
  role: AppRole;
  staffSpecialization: StaffSpecialization;
  userId: string;
};

function slugify(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createInitialProfile(input: CreateInitialProfileInput) {
  const fullName = input.fullName.trim();

  if (!fullName) {
    throw new Error("Inserisci nome e cognome prima di continuare.");
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
    id: input.userId,
    role: input.role,
    full_name: fullName,
  });

  if (profileError) {
    throw profileError;
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
