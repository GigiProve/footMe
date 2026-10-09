import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchPersonalDashboard,
  fetchPersonalSavedPositions,
  isPersonalDashboardData,
} from "./personal-adapter";

/**
 * Mapping del provider personale (DAS-REV-03 §21, §29).
 *
 * L'adapter non calcola eligibility né confronta scadenze: quelle vivono
 * nella fonte autorevole (§15). Qui si verifica solo che il payload arrivi
 * intero e che una risposta parziale non diventi silenziosamente uno zero.
 */

const mocks = vi.hoisted(() => {
  const rpc = vi.fn();
  return { rpc };
});

vi.mock("../../../lib/supabase", () => ({
  supabase: { rpc: mocks.rpc },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function overviewResponse(row: Record<string, unknown>) {
  mocks.rpc.mockReturnValue({
    maybeSingle: () => Promise.resolve({ data: row, error: null }),
  });
}

describe("fetchPersonalDashboard", () => {
  it("maps counts, previews, updates and signals", async () => {
    overviewResponse({
      active_applications_count: 3,
      applications_preview: [
        {
          ad_id: "ad1",
          category: "Eccellenza",
          club_logo_url: "logo.png",
          club_name: "Varese Calcio",
          created_at: "2026-09-01T10:00:00Z",
          id: "app1",
          last_event_at: "2026-09-05T10:00:00Z",
          last_event_to: "reviewing",
          role: "forward",
          status: "reviewing",
          team_name: "Prima squadra",
        },
      ],
      deadlines_total_count: 5,
      optional_suggestion: {
        href: "/profile/edit/opportunities",
        key: "availability_areas",
      },
      policy: {
        application_update_recency_days: 7,
        deadline_promotion_window_days: 7,
      },
      priority_signals: [
        {
          ad_title: "Provino AC Como Under 19",
          aggregation_key: "saved_deadline:p1:ad9",
          club_name: "AC Como",
          count: 1,
          deadline_at: "2026-09-15T10:00:00Z",
          deadline_timezone: "Europe/Rome",
          occurred_at: "2026-09-02T10:00:00Z",
          role: "forward",
          target_id: "ad9",
          target_kind: "position",
          team_name: "Under 19",
          type_id: "saved_deadline",
        },
      ],
      priority_total_count: 6,
      profile_requirements: [],
      recent_updates: [
        {
          ad_id: "ad1",
          application_id: "app1",
          club_logo_url: "logo.png",
          club_name: "AC Como",
          event_status: "reviewing",
          occurred_at: "2026-09-05T10:00:00Z",
          role: "forward",
          status: "reviewing",
          team_name: "Prima squadra",
        },
      ],
      saved_positions_count: 6,
    });

    const data = await fetchPersonalDashboard();

    expect(data.activeApplicationsCount).toBe(3);
    expect(data.savedPositionsCount).toBe(6);
    expect(data.applications[0]).toMatchObject({
      category: "Eccellenza",
      id: "app1",
      lastEventTo: "reviewing",
      teamName: "Prima squadra",
    });
    expect(data.recentUpdates[0].applicationId).toBe("app1");
    expect(data.deadlinesTotalCount).toBe(5);
    expect(data.optionalSuggestion?.href).toBe("/profile/edit/opportunities");
    expect(data.policy).toEqual({ promotionWindowDays: 7, recencyDays: 7 });

    // I metadati del segnale restano pezzi: il testo lo compone il client.
    expect(data.prioritySignals[0]).toMatchObject({
      aggregationKey: "saved_deadline:p1:ad9",
      deadlineAt: "2026-09-15T10:00:00Z",
      typeId: "saved_deadline",
    });
    expect(data.prioritySignals[0].payload).toMatchObject({
      adTitle: "Provino AC Como Under 19",
      deadlineTimezone: "Europe/Rome",
      teamName: "Under 19",
    });
  });

  it("does not invent rows when the source returns nothing", async () => {
    overviewResponse({});

    const data = await fetchPersonalDashboard();

    expect(data.applications).toEqual([]);
    expect(data.recentUpdates).toEqual([]);
    expect(data.prioritySignals).toEqual([]);
    expect(data.requirements).toEqual([]);
    expect(data.optionalSuggestion).toBeNull();
  });

  it("propagates the source error instead of showing an empty dashboard", async () => {
    mocks.rpc.mockReturnValue({
      maybeSingle: () =>
        Promise.resolve({ data: null, error: new Error("boom") }),
    });

    await expect(fetchPersonalDashboard()).rejects.toThrow("boom");
  });
});

describe("fetchPersonalSavedPositions", () => {
  it("maps the saved preview, availability included", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          ad_id: "ad1",
          category: "Under 17",
          club_id: "c1",
          club_logo_url: "logo.png",
          club_name: "AC Como",
          is_available: false,
          location: "Como, Lombardia",
          role: "forward",
          saved_at: "2026-09-01T10:00:00Z",
          team_name: "Under 17",
        },
      ],
      error: null,
    });

    const [item] = await fetchPersonalSavedPositions();

    expect(item).toMatchObject({
      adId: "ad1",
      // §10: una posizione non più disponibile resta nei Salvati e lo dice.
      isAvailable: false,
      location: "Como, Lombardia",
    });
  });
});

describe("isPersonalDashboardData", () => {
  it("rejects a cache record written by an older schema", () => {
    expect(isPersonalDashboardData({ applications: [] })).toBe(false);
    expect(isPersonalDashboardData(null)).toBe(false);
    expect(
      isPersonalDashboardData({
        applications: [],
        prioritySignals: [],
        recentUpdates: [],
        requirements: [],
      }),
    ).toBe(true);
  });
});
