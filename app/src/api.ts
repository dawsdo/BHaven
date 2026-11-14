import Constants from "expo-constants";
import { Platform } from "react-native";
import type { Count, SearchLocation, ShelterListResponse, StaffShelter } from "./types";

const API_PORT = 4000;

/**
 * Where the API lives. Set EXPO_PUBLIC_API_URL in app/.env to point at a hosted API.
 * Without it:
 * - a built web app calls /api on the address it was loaded from (the API server serves both);
 * - in development, the app calls port 4000 on the machine running the Expo dev server.
 */
function resolveApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return __DEV__
      ? `http://${window.location.hostname}:${API_PORT}/api`
      : `${window.location.origin}/api`;
  }
  const devServerHost = Constants.expoConfig?.hostUri?.split(":")[0];
  return `http://${devServerHost ?? "localhost"}:${API_PORT}/api`;
}

export const API_URL = resolveApiUrl();

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(body?.error ?? "Something went wrong. Try again.", response.status);
  }
  return body as T;
}

export function fetchShelters(
  location: SearchLocation | null,
  filters: string[],
): Promise<ShelterListResponse> {
  const params = new URLSearchParams();
  if (location?.kind === "zip") params.set("zip", location.zip);
  if (location?.kind === "gps") {
    // Rounded to about 100 meters. Enough to sort by distance, and less precise than the device reading.
    params.set("lat", location.lat.toFixed(3));
    params.set("lng", location.lng.toFixed(3));
  }
  if (filters.length > 0) params.set("filters", filters.join(","));
  const query = params.toString();
  return request(`/shelters${query ? `?${query}` : ""}`);
}

export async function staffLogin(email: string, password: string): Promise<string> {
  const body = await request<{ token: string }>("/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return body.token;
}

export async function fetchStaffShelter(token: string): Promise<StaffShelter> {
  const body = await request<{ shelter: StaffShelter }>("/staff/shelter", {
    headers: { authorization: `Bearer ${token}` },
  });
  return body.shelter;
}

export async function saveCounts(
  token: string,
  shelterId: number,
  counts: Count[],
): Promise<StaffShelter> {
  const body = await request<{ shelter: StaffShelter }>(`/shelters/${shelterId}/counts`, {
    method: "PUT",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ counts }),
  });
  return body.shelter;
}
