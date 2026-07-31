import { describe, expect, it } from "vitest";

import { activeFilterCount, criteriaToParams } from "./positions-criteria";
import type { PositionsSearchCriteria } from "./positions-search-types";

function makeCriteria(
  overrides: Partial<PositionsSearchCriteria> = {},
): PositionsSearchCriteria {
  return {
    target: "player",
    primaryPositions: ["striker"],
    compatiblePositions: ["right_winger", "left_winger"],
    useCompatible: false,
    coachStaffRole: null,
    geoMode: "italy",
    profileRegions: [],
    profileProvinces: [],
    regions: [],
    provinces: [],
    nearMe: null,
    categories: [],
    teamType: null,
    clubId: null,
    sort: "pertinenza",
    ...overrides,
  };
}

describe("criteriaToParams", () => {
  it("sends only the primary role when compatibles are off", () => {
    const params = criteriaToParams(makeCriteria({ useCompatible: false }), 0);
    expect(params.positions).toEqual(["striker"]);
    expect(params.primaryPositions).toEqual(["striker"]);
  });

  it("includes compatible roles when the toggle is on", () => {
    const params = criteriaToParams(makeCriteria({ useCompatible: true }), 0);
    expect(params.positions).toEqual(["striker", "right_winger", "left_winger"]);
    expect(params.primaryPositions).toEqual(["striker"]);
  });

  it("never sends positions for coach/staff", () => {
    const params = criteriaToParams(
      makeCriteria({ target: "coach", useCompatible: true }),
      0,
    );
    expect(params.positions).toBeUndefined();
    expect(params.primaryPositions).toBeUndefined();
    expect(params.target).toBe("coach");
  });

  it("maps the regions mode to region params only", () => {
    const params = criteriaToParams(
      makeCriteria({ geoMode: "regions", regions: ["Lombardia", "Piemonte"] }),
      0,
    );
    expect(params.regions).toEqual(["Lombardia", "Piemonte"]);
    expect(params.provinces).toBeUndefined();
    expect(params.lat).toBeUndefined();
  });

  it("maps the provinces mode to province params only", () => {
    const params = criteriaToParams(
      makeCriteria({ geoMode: "provinces", provinces: ["Milano", "Como"] }),
      0,
    );
    expect(params.provinces).toEqual(["Milano", "Como"]);
    expect(params.regions).toBeUndefined();
  });

  it("uses the profile baseline areas for the profile mode", () => {
    const params = criteriaToParams(
      makeCriteria({
        geoMode: "profile",
        profileRegions: ["Lombardia"],
        profileProvinces: [],
        regions: ["Lazio"],
      }),
      0,
    );
    expect(params.regions).toEqual(["Lombardia"]);
    expect(params.provinces).toEqual([]);
  });

  it("passes coordinates and radius for the near-me mode", () => {
    const params = criteriaToParams(
      makeCriteria({
        geoMode: "near_me",
        nearMe: { lat: 45.81, lng: 9.08, label: "Como", radiusKm: 50 },
      }),
      2,
    );
    expect(params.lat).toBe(45.81);
    expect(params.lng).toBe(9.08);
    expect(params.radiusKm).toBe(50);
    expect(params.page).toBe(2);
  });

  it("sends no geographic constraint for all-Italy", () => {
    const params = criteriaToParams(makeCriteria({ geoMode: "italy" }), 0);
    expect(params.regions).toBeUndefined();
    expect(params.provinces).toBeUndefined();
    expect(params.lat).toBeUndefined();
  });
});

describe("activeFilterCount", () => {
  it("counts only the advanced filters", () => {
    expect(activeFilterCount(makeCriteria())).toBe(0);
    expect(
      activeFilterCount(
        makeCriteria({ categories: ["Serie D"], teamType: "senior", clubId: "c1" }),
      ),
    ).toBe(3);
  });
});
