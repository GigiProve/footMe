import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const PROFILE_KEY = "@footme/last-account";
const PASSWORD_KEY = "footme_last_password";

export type LastAccount = {
  avatarUrl: string | null;
  email: string;
  fullName: string | null;
};

/** Save profile info (called at logout, when we have profile data). */
export async function saveLastAccountProfile(
  account: LastAccount,
): Promise<void> {
  await AsyncStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({
      ...account,
      email: account.email.trim().toLowerCase(),
    } satisfies LastAccount),
  );
}

/** Save credentials (called at sign-in, when we have the password). */
export async function saveLastAccountCredentials(
  email: string,
  password: string,
): Promise<void> {
  await SecureStore.setItemAsync(
    PASSWORD_KEY,
    JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
    }),
  );
}

export async function loadLastAccount(): Promise<LastAccount | null> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as LastAccount;
    return {
      ...parsed,
      email: parsed.email.trim().toLowerCase(),
    };
  } catch {
    return null;
  }
}

export async function loadLastCredentials(): Promise<{
  email: string;
  password: string;
} | null> {
  const raw = await SecureStore.getItemAsync(PASSWORD_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { email: string; password: string };
    return {
      ...parsed,
      email: parsed.email.trim().toLowerCase(),
    };
  } catch {
    return null;
  }
}

export async function clearLastAccount(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(PROFILE_KEY),
    SecureStore.deleteItemAsync(PASSWORD_KEY),
  ]);
}
