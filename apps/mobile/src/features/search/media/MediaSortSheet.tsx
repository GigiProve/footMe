import { SortSheet } from "../components/SortSheet";
import { mediaSortOptions } from "./media-filter-helpers";
import type { MediaSearchSort } from "./media-search-types";

/**
 * Bottom sheet compatto di ordinamento (CER-05 §19). Adapter sottile sul
 * `SortSheet` condiviso, come `PositionsSortSheet` per le posizioni.
 */

type MediaSortSheetProps = {
  onApply: (value: MediaSearchSort) => void;
  onClose: () => void;
  value: MediaSearchSort;
  visible: boolean;
};

export function MediaSortSheet({ onApply, onClose, value, visible }: MediaSortSheetProps) {
  return (
    <SortSheet
      onApply={onApply}
      onClose={onClose}
      options={mediaSortOptions()}
      value={value}
      visible={visible}
    />
  );
}
