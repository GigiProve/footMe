import { supabase } from "../../lib/supabase";

type ClubSummary = {
  category: string | null;
  city: string;
  id: string;
  name: string;
  region: string;
};

export type RecruitingAdForm = {
  ageMax: string;
  ageMin: string;
  category: string;
  compensationSummary: string;
  description: string;
  region: string;
  roleRequired: "goalkeeper" | "defender" | "midfielder" | "forward";
  teamId?: string | null;
  title: string;
};

export type RecruitingAdSummary = {
  created_at: string;
  id: string;
  region: string | null;
  role_required: string;
  status: string;
  title: string;
};

export type DiscoverableRecruitingAd = RecruitingAdSummary & {
  age_max: number | null;
  age_min: number | null;
  application_status: string | null;
  club: ClubSummary | null;
  compensation_summary: string | null;
  description: string;
  is_saved: boolean;
  published_at: string | null;
};

export type ClubApplicationSummary = {
  ad: {
    id: string;
    role_required: string;
    status: string;
    title: string;
  };
  applicant: {
    full_name: string | null;
    id: string;
    region: string | null;
    role: string | null;
  } | null;
  cover_message: string | null;
  created_at: string;
  id: string;
  status: string;
};

export async function getOwnedClub(profileId: string) {
  const { data, error } = await supabase
    .from("clubs")
    .select("id, name, category, city, region")
    .eq("owner_profile_id", profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getClubAds(profileId: string) {
  const club = await getOwnedClub(profileId);

  if (!club) {
    return { ads: [] as RecruitingAdSummary[], club: null };
  }

  const { data, error } = await supabase
    .from("recruiting_ads")
    .select("id, title, role_required, region, status, created_at")
    .eq("club_id", club.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return { ads: (data ?? []) as RecruitingAdSummary[], club };
}

export async function getPublishedAds(profileId: string) {
  const { data: adsData, error: adsError } = await supabase
    .from("recruiting_ads")
    .select(
      "id, club_id, title, role_required, region, status, created_at, published_at, description, age_min, age_max, compensation_summary",
    )
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (adsError) {
    throw adsError;
  }

  const ads = (adsData ?? []) as {
    age_max: number | null;
    age_min: number | null;
    club_id: string;
    compensation_summary: string | null;
    created_at: string;
    description: string;
    id: string;
    published_at: string | null;
    region: string | null;
    role_required: string;
    status: string;
    title: string;
  }[];

  const clubIds = Array.from(new Set(ads.map((ad) => ad.club_id)));
  const clubsById = new Map<string, ClubSummary>();

  if (clubIds.length > 0) {
    const { data: clubsData, error: clubsError } = await supabase
      .from("clubs")
      .select("id, name, category, city, region")
      .in("id", clubIds);

    if (clubsError) {
      throw clubsError;
    }

    for (const club of (clubsData ?? []) as ClubSummary[]) {
      clubsById.set(club.id, club);
    }
  }

  const savedIds = new Set<string>();
  const applicationStatusByAdId = new Map<string, string>();

  const [
    { data: savedAdsData, error: savedAdsError },
    { data: applicationsData, error: applicationsError },
  ] = await Promise.all([
    supabase.from("saved_ads").select("ad_id").eq("profile_id", profileId),
    supabase
      .from("recruiting_applications")
      .select("ad_id, status")
      .eq("applicant_profile_id", profileId),
  ]);

  if (savedAdsError) {
    throw savedAdsError;
  }

  if (applicationsError) {
    throw applicationsError;
  }

  for (const row of (savedAdsData ?? []) as { ad_id: string }[]) {
    savedIds.add(row.ad_id);
  }

  for (const row of (applicationsData ?? []) as {
    ad_id: string;
    status: string;
  }[]) {
    applicationStatusByAdId.set(row.ad_id, row.status);
  }

  return ads.map((ad) => ({
    ...ad,
    application_status: applicationStatusByAdId.get(ad.id) ?? null,
    club: clubsById.get(ad.club_id) ?? null,
    is_saved: savedIds.has(ad.id),
  })) as DiscoverableRecruitingAd[];
}

export async function toggleSavedAd(
  profileId: string,
  adId: string,
  shouldSave: boolean,
) {
  if (shouldSave) {
    const { error } = await supabase.from("saved_ads").upsert(
      {
        ad_id: adId,
        profile_id: profileId,
      },
      { onConflict: "ad_id,profile_id" },
    );

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase
    .from("saved_ads")
    .delete()
    .eq("ad_id", adId)
    .eq("profile_id", profileId);

  if (error) {
    throw error;
  }
}

export async function applyToRecruitingAd(
  profileId: string,
  adId: string,
  coverMessage: string,
) {
  const { data: playerProfile, error: playerProfileError } = await supabase
    .from("player_profiles")
    .select("profile_id")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (playerProfileError) {
    throw playerProfileError;
  }

  if (!playerProfile) {
    throw new Error(
      "La candidatura e' disponibile solo per profili giocatore completati.",
    );
  }

  const { error } = await supabase.from("recruiting_applications").insert({
    ad_id: adId,
    applicant_profile_id: profileId,
    cover_message: coverMessage.trim() || null,
    player_profile_id: profileId,
    status: "submitted",
  });

  if (error) {
    throw error;
  }

  // Notify the club owner of the new application.
  const { data: ad } = await supabase
    .from("recruiting_ads")
    .select("title, club_id, clubs(owner_profile_id)")
    .eq("id", adId)
    .maybeSingle();

  const club = ad
    ? ((Array.isArray(ad.clubs) ? ad.clubs[0] : ad.clubs) as {
        owner_profile_id: string;
      } | null)
    : null;

  if (club?.owner_profile_id) {
    const { data: applicant } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", profileId)
      .maybeSingle();

    await supabase.from("notifications").insert({
      body: `${applicant?.full_name ?? "Un candidato"} si e' candidato per "${ad?.title ?? "un annuncio"}"`,
      data: { ad_id: adId, applicant_profile_id: profileId },
      recipient_profile_id: club.owner_profile_id,
      title: "Hai ricevuto una nuova candidatura",
      type: "application_received",
    });
  }
}

export type ApplicationStatus =
  | "submitted"
  | "reviewing"
  | "shortlisted"
  | "rejected"
  | "accepted"
  | "withdrawn";

/**
 * Club updates an application's status and notifies the applicant.
 * RLS already permits the club owner (and applicant) to update the row.
 */
export async function updateApplicationStatus(input: {
  adTitle: string;
  applicantProfileId: string;
  applicationId: string;
  status: ApplicationStatus;
}) {
  const { error } = await supabase
    .from("recruiting_applications")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("id", input.applicationId);

  if (error) {
    throw error;
  }

  const isRead = input.status === "reviewing";
  const statusBody = isRead
    ? `La tua candidatura per "${input.adTitle}" e' stata letta`
    : `La tua candidatura per "${input.adTitle}" e' ora: ${APPLICATION_STATUS_LABELS[input.status]}`;

  await supabase.from("notifications").insert({
    body: statusBody,
    data: { application_id: input.applicationId, status: input.status },
    recipient_profile_id: input.applicantProfileId,
    title: isRead
      ? "La tua candidatura e' stata letta"
      : "La tua candidatura ha cambiato stato",
    type: "application_status",
  });
}

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  accepted: "Accettata",
  rejected: "Rifiutata",
  reviewing: "In lettura",
  shortlisted: "Shortlist",
  submitted: "Inviata",
  withdrawn: "Ritirata",
};

export async function getClubApplications(profileId: string) {
  const club = await getOwnedClub(profileId);

  if (!club) {
    return [] as ClubApplicationSummary[];
  }

  const { data: adsData, error: adsError } = await supabase
    .from("recruiting_ads")
    .select("id, title, role_required, status")
    .eq("club_id", club.id)
    .order("created_at", { ascending: false });

  if (adsError) {
    throw adsError;
  }

  const ads = (adsData ?? []) as {
    id: string;
    role_required: string;
    status: string;
    title: string;
  }[];

  if (ads.length === 0) {
    return [] as ClubApplicationSummary[];
  }

  const adIds = ads.map((ad) => ad.id);
  const adById = new Map(ads.map((ad) => [ad.id, ad]));

  const { data: applicationsData, error: applicationsError } = await supabase
    .from("recruiting_applications")
    .select(
      "id, ad_id, applicant_profile_id, cover_message, status, created_at",
    )
    .in("ad_id", adIds)
    .order("created_at", { ascending: false });

  if (applicationsError) {
    throw applicationsError;
  }

  const applications = (applicationsData ?? []) as {
    ad_id: string;
    applicant_profile_id: string;
    cover_message: string | null;
    created_at: string;
    id: string;
    status: string;
  }[];

  const applicantIds = Array.from(
    new Set(
      applications.map((application) => application.applicant_profile_id),
    ),
  );
  const applicantsById = new Map<
    string,
    {
      full_name: string | null;
      id: string;
      region: string | null;
      role: string | null;
    }
  >();

  if (applicantIds.length > 0) {
    const { data: applicantsData, error: applicantsError } = await supabase
      .from("profiles")
      .select("id, full_name, region, role")
      .in("id", applicantIds);

    if (applicantsError) {
      throw applicantsError;
    }

    for (const applicant of (applicantsData ?? []) as {
      full_name: string | null;
      id: string;
      region: string | null;
      role: string | null;
    }[]) {
      applicantsById.set(applicant.id, applicant);
    }
  }

  return applications
    .map((application) => {
      const ad = adById.get(application.ad_id);

      if (!ad) {
        return null;
      }

      return {
        ad,
        applicant: applicantsById.get(application.applicant_profile_id) ?? null,
        cover_message: application.cover_message,
        created_at: application.created_at,
        id: application.id,
        status: application.status,
      };
    })
    .filter((application) => application !== null) as ClubApplicationSummary[];
}

export async function createRecruitingAd(
  profileId: string,
  input: RecruitingAdForm,
) {
  const club = await getOwnedClub(profileId);

  if (!club) {
    throw new Error("Nessuna societa' associata al profilo corrente.");
  }

  const { error } = await supabase.from("recruiting_ads").insert({
    age_max: input.ageMax ? Number(input.ageMax) : null,
    age_min: input.ageMin ? Number(input.ageMin) : null,
    category: input.category.trim() || club.category,
    club_id: club.id,
    compensation_summary: input.compensationSummary.trim() || null,
    created_by_profile_id: profileId,
    description: input.description.trim(),
    published_at: new Date().toISOString(),
    region: input.region.trim() || club.region,
    role_required: input.roleRequired,
    status: "published",
    team_id: input.teamId ?? null,
    title: input.title.trim(),
  });

  if (error) {
    throw error;
  }

  return club;
}
