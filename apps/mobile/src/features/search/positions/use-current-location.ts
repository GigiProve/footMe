import { useCallback, useState } from "react";

export type CurrentLocation = {
  lat: number;
  lng: number;
  /** Reverse-geocoded city name for the "Posizione rilevata" label. */
  label: string | null;
};

export type LocationStatus =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unavailable";

// expo-location is declared in package.json (~19.0.8) + app.json, so Metro
// resolves it once dependencies are installed and a dev client is built. This
// guarded require is a RUNTIME safety net (e.g. the native module isn't linked
// yet): it degrades to "unavailable" so the UI shows the manual region/province
// fallback, and keeps Node/vitest happy without the package present.
// (It does NOT shield Metro from a missing package — the declared dependency does.)
let ExpoLocation: {
  requestForegroundPermissionsAsync: () => Promise<{ status: string }>;
  getCurrentPositionAsync: (
    options?: unknown,
  ) => Promise<{ coords: { latitude: number; longitude: number } }>;
  reverseGeocodeAsync: (coords: {
    latitude: number;
    longitude: number;
  }) => Promise<{ city?: string | null; subregion?: string | null; region?: string | null }[]>;
} | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  ExpoLocation = require("expo-location");
} catch {
  ExpoLocation = null;
}

export function useCurrentLocation() {
  const [status, setStatus] = useState<LocationStatus>("idle");

  const request = useCallback(async (): Promise<CurrentLocation | null> => {
    if (!ExpoLocation) {
      setStatus("unavailable");
      return null;
    }

    setStatus("requesting");
    try {
      const permission = await ExpoLocation.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setStatus("denied");
        return null;
      }

      const position = await ExpoLocation.getCurrentPositionAsync();
      const { latitude, longitude } = position.coords;

      let label: string | null = null;
      try {
        const places = await ExpoLocation.reverseGeocodeAsync({ latitude, longitude });
        const place = places?.[0];
        label = place?.city ?? place?.subregion ?? place?.region ?? null;
      } catch {
        label = null;
      }

      setStatus("granted");
      return { lat: latitude, lng: longitude, label };
    } catch {
      setStatus("denied");
      return null;
    }
  }, []);

  return { request, status };
}
