import { createElement } from "react";

function Ionicons(props: Record<string, unknown>) {
  return createElement("Ionicons", props);
}

Ionicons.glyphMap = {
  add: "add",
  chevronDown: "chevron-down",
  chevronForward: "chevron-forward",
  checkmark: "checkmark",
  close: "close",
  createOutline: "create-outline",
  search: "search",
};

export default Ionicons;
