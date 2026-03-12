const DEFAULT_PROFILE_AVATAR_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" fill="none">
  <rect width="256" height="256" rx="64" fill="#EEF3F8"/>
  <circle cx="128" cy="96" r="44" fill="#C4D2E0"/>
  <path d="M56 214C56 176.444 86.444 146 124 146H132C169.556 146 200 176.444 200 214V224H56V214Z" fill="#C4D2E0"/>
</svg>
`.trim();

function encodeSvgToBase64(value: string) {
  const binaryValue = Array.from(
    new TextEncoder().encode(value),
    (byte) => String.fromCharCode(byte),
  ).join("");

  return globalThis.btoa(binaryValue);
}

const defaultAvatarPayload = encodeSvgToBase64(DEFAULT_PROFILE_AVATAR_SVG);
export const DEFAULT_PROFILE_AVATAR_URI = `data:image/svg+xml;base64,${defaultAvatarPayload}`;

export function withDefaultProfileAvatar(value: string | null | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : DEFAULT_PROFILE_AVATAR_URI;
}
