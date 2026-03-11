import { supabase } from "../../lib/supabase";

type ProfileRow = {
  city: string | null;
  full_name: string | null;
  id: string;
  is_available: boolean;
  is_open_to_transfer: boolean;
  region: string | null;
  role: string | null;
};

type ClubRow = {
  category: string | null;
  id: string;
  name: string;
  region: string;
};

type DashboardHighlight = {
  label: string;
  tone: "accent" | "hero" | "neutral";
  value: string;
};

export type HomeDashboardData = {
  highlights: DashboardHighlight[];
  profile: {
    city: string | null;
    clubCategory: string | null;
    clubName: string | null;
    email: string | null;
    fullName: string;
    isAvailable: boolean;
    isOpenToTransfer: boolean;
    primaryPosition: string | null;
    region: string | null;
    role: string;
  };
  summary: {
    body: string;
    kicker: string;
    title: string;
  };
};

async function getAcceptedConnectionsCount(profileId: string) {
  const { count, error } = await supabase
    .from("connections")
    .select("id", { count: "exact", head: true })
    .eq("status", "accepted")
    .or(
      `requester_profile_id.eq.${profileId},addressee_profile_id.eq.${profileId}`,
    );

  if (error) {
    throw error;
  }

  return count ?? 0;
}

function formatRoleLabel(role: string) {
  switch (role) {
    case "player":
      return "Calciatore";
    case "coach":
      return "Allenatore";
    case "staff":
      return "Staff";
    case "club_admin":
      return "Societa'";
    default:
      return role;
  }
}

function formatPositionLabel(position: string | null) {
  switch (position) {
    case "goalkeeper":
      return "Portiere";
    case "defender":
      return "Difensore";
    case "midfielder":
      return "Centrocampista";
    case "forward":
      return "Attaccante";
    default:
      return null;
  }
}

export async function getHomeDashboard(
  profileId: string,
  email: string | null,
) {
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id, full_name, role, region, city, is_available, is_open_to_transfer",
    )
    .eq("id", profileId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profileData) {
    throw new Error(
      "Profilo non trovato. Completa prima l'onboarding iniziale.",
    );
  }

  const profile = profileData as ProfileRow;
  const role = profile.role ?? "player";
  const acceptedConnections = await getAcceptedConnectionsCount(profileId);

  if (role === "club_admin") {
    const { data: clubData, error: clubError } = await supabase
      .from("clubs")
      .select("id, name, category, region")
      .eq("owner_profile_id", profileId)
      .maybeSingle();

    if (clubError) {
      throw clubError;
    }

    const club = (clubData ?? null) as ClubRow | null;

    const {
      data: adsData,
      error: adsError,
      count: publishedAdsCount,
    } = await supabase
      .from("recruiting_ads")
      .select("id", { count: "exact", head: false })
      .eq("club_id", club?.id ?? "00000000-0000-0000-0000-000000000000")
      .eq("status", "published");

    if (adsError) {
      throw adsError;
    }

    const adIds = (adsData ?? []).map((ad) => ad.id as string);
    let applicationsCount = 0;

    if (adIds.length > 0) {
      const { count, error } = await supabase
        .from("recruiting_applications")
        .select("id", { count: "exact", head: true })
        .in("ad_id", adIds);

      if (error) {
        throw error;
      }

      applicationsCount = count ?? 0;
    }

    return {
      highlights: [
        {
          label: "Annunci attivi",
          tone: "accent",
          value: String(publishedAdsCount ?? 0),
        },
        {
          label: "Candidature ricevute",
          tone: "hero",
          value: String(applicationsCount),
        },
        {
          label: "Connessioni attive",
          tone: "neutral",
          value: String(acceptedConnections),
        },
      ],
      profile: {
        city: profile.city,
        clubCategory: club?.category ?? null,
        clubName: club?.name ?? null,
        email,
        fullName: profile.full_name ?? club?.name ?? "Societa' footMe",
        isAvailable: profile.is_available,
        isOpenToTransfer: profile.is_open_to_transfer,
        primaryPosition: null,
        region: club?.region ?? profile.region,
        role,
      },
      summary: {
        body: club?.name
          ? `La homepage ora usa il club reale ${club.name} e i suoi annunci pubblicati su Supabase.`
          : "Collega una societa' reale al profilo per vedere annunci e candidature persistenti.",
        kicker: "Club dashboard",
        title: club?.name ?? "Societa' da completare",
      },
    } satisfies HomeDashboardData;
  }

  const [
    { data: playerData, error: playerError },
    { count: savedAdsCount, error: savedAdsError },
    { count: applicationsCount, error: applicationsError },
  ] = await Promise.all([
    supabase
      .from("player_profiles")
      .select("primary_position")
      .eq("profile_id", profileId)
      .maybeSingle(),
    supabase
      .from("saved_ads")
      .select("ad_id", { count: "exact", head: true })
      .eq("profile_id", profileId),
    supabase
      .from("recruiting_applications")
      .select("id", { count: "exact", head: true })
      .eq("applicant_profile_id", profileId),
  ]);

  if (playerError) {
    throw playerError;
  }

  if (savedAdsError) {
    throw savedAdsError;
  }

  if (applicationsError) {
    throw applicationsError;
  }

  const primaryPosition =
    (playerData?.primary_position as string | null) ?? null;

  let matchingAdsCount = 0;

  if (primaryPosition) {
    const { count, error } = await supabase
      .from("recruiting_ads")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .eq("role_required", primaryPosition);

    if (error) {
      throw error;
    }

    matchingAdsCount = count ?? 0;
  }

  return {
    highlights: [
      {
        label: "Opportunita' in linea",
        tone: "accent",
        value: String(matchingAdsCount),
      },
      {
        label: "Annunci salvati",
        tone: "hero",
        value: String(savedAdsCount ?? 0),
      },
      {
        label: "Candidature inviate",
        tone: "neutral",
        value: String(applicationsCount ?? 0),
      },
    ],
    profile: {
      city: profile.city,
      clubCategory: null,
      clubName: null,
      email,
      fullName: profile.full_name ?? "Utente footMe",
      isAvailable: profile.is_available,
      isOpenToTransfer: profile.is_open_to_transfer,
      primaryPosition,
      region: profile.region,
      role,
    },
    summary: {
      body:
        role === "player"
          ? "La tua home usa il profilo reale, le candidature inviate e gli annunci coerenti con la tua posizione principale."
          : "La tua home usa il profilo reale salvato su Supabase e mostra i dati essenziali per il tuo ruolo.",
      kicker: "Profilo live",
      title: `${formatRoleLabel(role)}${
        formatPositionLabel(primaryPosition)
          ? ` · ${formatPositionLabel(primaryPosition)}`
          : ""
      }`,
    },
  } satisfies HomeDashboardData;
}
