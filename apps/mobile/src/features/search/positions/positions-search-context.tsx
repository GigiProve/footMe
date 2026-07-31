import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "../../auth/use-session";
import { POSITIONS_QK } from "./positions-criteria";
import { fetchPositionsSeed } from "./positions-service";
import type { PositionsSearchCriteria } from "./positions-search-types";

const DEFAULT_CRITERIA: PositionsSearchCriteria = {
  target: "player",
  primaryPositions: [],
  compatiblePositions: [],
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
};

type PositionsSearchContextValue = {
  criteria: PositionsSearchCriteria;
  /** True once the profile-derived seed has been applied. */
  isSeeded: boolean;
  patch: (partial: Partial<PositionsSearchCriteria>) => void;
  setCriteria: (
    updater: (prev: PositionsSearchCriteria) => PositionsSearchCriteria,
  ) => void;
};

const PositionsSearchContext = createContext<PositionsSearchContextValue | undefined>(
  undefined,
);

export function PositionsSearchProvider({ children }: { children: ReactNode }) {
  const { profile } = useSession();
  const profileId = profile?.id ?? null;

  const [criteria, setCriteriaState] = useState<PositionsSearchCriteria>(DEFAULT_CRITERIA);
  const [isSeeded, setIsSeeded] = useState(false);

  const seedQuery = useQuery({
    enabled: !!profileId,
    queryFn: () => fetchPositionsSeed(profileId as string, profile?.role ?? null),
    queryKey: [POSITIONS_QK, "seed", profileId],
  });

  useEffect(() => {
    if (seedQuery.data && !isSeeded) {
      setCriteriaState(seedQuery.data);
      setIsSeeded(true);
    }
  }, [seedQuery.data, isSeeded]);

  const setCriteria = useCallback(
    (updater: (prev: PositionsSearchCriteria) => PositionsSearchCriteria) => {
      setCriteriaState((prev) => updater(prev));
    },
    [],
  );

  const patch = useCallback((partial: Partial<PositionsSearchCriteria>) => {
    setCriteriaState((prev) => ({ ...prev, ...partial }));
  }, []);

  const value = useMemo<PositionsSearchContextValue>(
    () => ({ criteria, isSeeded, patch, setCriteria }),
    [criteria, isSeeded, patch, setCriteria],
  );

  return (
    <PositionsSearchContext.Provider value={value}>
      {children}
    </PositionsSearchContext.Provider>
  );
}

export function usePositionsSearch(): PositionsSearchContextValue {
  const context = useContext(PositionsSearchContext);
  if (!context) {
    throw new Error("usePositionsSearch must be used within PositionsSearchProvider");
  }
  return context;
}
