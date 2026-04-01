export type AppRole =
  | "admin"
  | "player"
  | "coach"
  | "staff"
  | "club_admin"
  | "agent"
  | "director";

export type ProfileGender =
  | "male"
  | "female"
  | "non_binary"
  | "prefer_not_to_say";

export type StaffSpecialization =
  | "fitness_coach"
  | "goalkeeper_coach"
  | "physiotherapist"
  | "match_analyst"
  | "team_manager"
  | "other";

export type StaffRole =
  | "Preparatore atletico"
  | "Match analyst"
  | "Collaboratore tecnico"
  | "Preparatore dei portieri"
  | "Fisioterapista"
  | "Team manager";

export const STAFF_ROLE_OPTIONS: { label: string; value: StaffRole }[] = [
  { label: "Preparatore atletico", value: "Preparatore atletico" },
  { label: "Match analyst", value: "Match analyst" },
  { label: "Collaboratore tecnico", value: "Collaboratore tecnico" },
  { label: "Preparatore dei portieri", value: "Preparatore dei portieri" },
  { label: "Fisioterapista", value: "Fisioterapista" },
  { label: "Team manager", value: "Team manager" },
];

export function mapStaffRoleToSpecialization(
  role: StaffRole | string | null | undefined,
): StaffSpecialization {
  switch (role) {
    case "Preparatore atletico":
      return "fitness_coach";
    case "Preparatore dei portieri":
      return "goalkeeper_coach";
    case "Fisioterapista":
      return "physiotherapist";
    case "Match analyst":
      return "match_analyst";
    case "Team manager":
      return "team_manager";
    default:
      return "other";
  }
}
