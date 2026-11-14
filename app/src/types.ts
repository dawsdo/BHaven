/** capacity is the total beds (or family units) the shelter reported to HUD, when known. */
export type Count = { category: string; openBeds: number; capacity?: number | null };

export type Shelter = {
  id: number;
  name: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  tags: string[];
  languages: string[];
  distanceMiles: number | null;
  updatedAt: string | null;
  minutesAgo: number | null;
  /** True when the last update is more than 24 hours old. The API withholds the counts. */
  expired: boolean;
  mostRecent: boolean;
  counts: Count[] | null;
  totalOpen: number | null;
};

export type ShelterListResponse = {
  locationLabel: string | null;
  shelters: Shelter[];
};

export type StaffShelter = {
  id: number;
  name: string;
  approved: boolean;
  counts: Count[];
  updatedAt: string | null;
};

/** Where the client is searching from. Held in memory only, never saved. */
export type SearchLocation =
  | { kind: "zip"; zip: string }
  | { kind: "gps"; lat: number; lng: number };

export const FILTERS: { tag: string; label: string }[] = [
  { tag: "women_only", label: "Women only" },
  { tag: "men_only", label: "Men only" },
  { tag: "co_ed", label: "Co-ed" },
  { tag: "family", label: "Families" },
  { tag: "dog_allowed", label: "Dogs allowed" },
  { tag: "wheelchair_access", label: "Wheelchair access" },
];

export const TAG_LABELS: Record<string, string> = {
  women_only: "Women only",
  men_only: "Men only",
  co_ed: "Co-ed",
  family: "Families",
  dog_allowed: "Dogs allowed",
  wheelchair_access: "Wheelchair access",
  medical_support: "Medical support",
};
