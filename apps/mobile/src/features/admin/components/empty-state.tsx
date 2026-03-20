import { AppEmptyState } from "../../../ui";

export function EmptyState({ message }: { message: string }) {
  return <AppEmptyState title={message} />;
}
