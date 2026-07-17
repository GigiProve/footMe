import { useSession } from "../../src/features/auth/use-session";
import { ClubDashboard } from "../../src/features/clubs/components/ClubDashboard";
import { PersonalDashboard } from "../../src/features/home/components/PersonalDashboard";

export default function DashboardScreen() {
  const { profile } = useSession();

  return profile?.role === "club_admin" ? (
    <ClubDashboard />
  ) : (
    <PersonalDashboard />
  );
}
