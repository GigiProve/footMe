import type { TargetType } from "./content-tag-service";

/**
 * A profile / club / internal-team selected as a content tag target.
 * Shaped to interoperate with `TagSearchResult` from the search RPC, but with
 * `role_label`/`subtitle` optional so composers can construct partial targets.
 */
export type TaggableTarget = {
  avatar_url: string | null;
  display_name: string;
  role_label?: string | null;
  subtitle?: string | null;
  target_id: string;
  target_type: TargetType;
};

/** Stable identity key for a target (target_type + target_id). */
export function targetKey(target: {
  target_id: string;
  target_type: TargetType;
}): string {
  return `${target.target_type}:${target.target_id}`;
}
