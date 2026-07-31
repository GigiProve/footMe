import { SortSheet } from "../components/SortSheet";
import { sortOptionsFor } from "./positions-labels";
import { usePositionsSearch } from "./positions-search-context";

type PositionsSortSheetProps = {
  visible: boolean;
  onClose: () => void;
};

export function PositionsSortSheet({ visible, onClose }: PositionsSortSheetProps) {
  const { criteria, patch } = usePositionsSearch();

  return (
    <SortSheet
      onApply={(value) => patch({ sort: value })}
      onClose={onClose}
      options={sortOptionsFor(criteria.geoMode)}
      value={criteria.sort}
      visible={visible}
    />
  );
}
