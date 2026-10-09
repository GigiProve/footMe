import { useContext } from "react";

import { DashboardContext } from "./DashboardIdentityProvider";

export function useDashboardIdentity() {
  const context = useContext(DashboardContext);

  if (!context) {
    throw new Error(
      "useDashboardIdentity must be used within DashboardIdentityProvider",
    );
  }

  return context;
}
