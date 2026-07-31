import { Screen } from "../../src/components/ui/screen";
import { PositionsDiscoveryScreen } from "../../src/features/search/positions/PositionsDiscoveryScreen";
import { PositionsSearchProvider } from "../../src/features/search/positions/positions-search-context";

export default function SearchPositionsRoute() {
  return (
    <Screen>
      <PositionsSearchProvider>
        <PositionsDiscoveryScreen />
      </PositionsSearchProvider>
    </Screen>
  );
}
