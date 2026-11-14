import { pool } from "./db.js";

export const FILTER_TAGS = [
  "women_only",
  "men_only",
  "co_ed",
  "family",
  "dog_allowed",
  "wheelchair_access",
] as const;

const EXPIRY_MINUTES = 24 * 60;

/** capacity is the total beds (or family units) the shelter reported to HUD, when known. */
export type Count = { category: string; openBeds: number; capacity?: number | null };

export type ShelterView = {
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
  /** True when the last update is more than 24 hours old. Counts are withheld. */
  expired: boolean;
  mostRecent: boolean;
  counts: Count[] | null;
  totalOpen: number | null;
};

export type Point = { lat: number; lng: number };

function haversineMiles(a: Point, b: Point): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

type Row = {
  id: number;
  name: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  tags: string[];
  languages: string[];
  counts: Count[];
  updated_at: Date | null;
};

const BASE_QUERY = `
  select s.id, s.name, s.address, s.phone, s.lat, s.lng, s.tags, s.languages,
         coalesce(
           json_agg(json_build_object('category', v.category, 'openBeds', v.open_beds, 'capacity', v.capacity) order by v.id)
             filter (where v.id is not null),
           '[]'
         ) as counts,
         max(v.updated_at) as updated_at
  from shelters s
  join organizations o on o.id = s.organization_id
  left join vacancy_counts v on v.shelter_id = s.id
`;

/** Public list. Expired counts are removed here so no client can show them. */
export async function listShelters(origin: Point | null, filters: string[]): Promise<ShelterView[]> {
  const { rows } = await pool.query<Row>(
    `${BASE_QUERY} where o.approved and s.tags @> $1::text[] group by s.id`,
    [filters],
  );
  const now = Date.now();

  const views: ShelterView[] = rows.map((r) => {
    const minutesAgo =
      r.updated_at === null ? null : Math.max(0, Math.floor((now - r.updated_at.getTime()) / 60000));
    const expired = minutesAgo === null || minutesAgo > EXPIRY_MINUTES;
    return {
      id: r.id,
      name: r.name,
      address: r.address,
      phone: r.phone,
      lat: r.lat,
      lng: r.lng,
      tags: r.tags,
      languages: r.languages,
      distanceMiles: origin ? Math.round(haversineMiles(origin, r) * 10) / 10 : null,
      updatedAt: r.updated_at ? r.updated_at.toISOString() : null,
      minutesAgo,
      expired,
      mostRecent: false,
      counts: expired ? null : r.counts,
      totalOpen: expired ? null : r.counts.reduce((sum, c) => sum + c.openBeds, 0),
    };
  });

  const fresh = views.filter((v) => !v.expired);
  if (fresh.length > 0) {
    const newest = fresh.reduce((a, b) => (a.minutesAgo! <= b.minutesAgo! ? a : b));
    newest.mostRecent = true;
  }

  // Shelters with open beds first, then full ones, then expired ones.
  // Inside each group: nearest first when a location is set, otherwise newest update first.
  const rank = (v: ShelterView) => (v.expired ? 2 : v.totalOpen! > 0 ? 0 : 1);
  views.sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (origin) return a.distanceMiles! - b.distanceMiles!;
    return (a.minutesAgo ?? Infinity) - (b.minutesAgo ?? Infinity);
  });
  return views;
}

export type StaffShelter = {
  id: number;
  name: string;
  approved: boolean;
  counts: Count[];
  updatedAt: string | null;
};

/** Staff view of one shelter. Shows the stored counts even when they have expired. */
export async function getStaffShelter(shelterId: number): Promise<StaffShelter | null> {
  const { rows } = await pool.query(
    `select s.id, s.name, o.approved,
            coalesce(
              json_agg(json_build_object('category', v.category, 'openBeds', v.open_beds, 'capacity', v.capacity) order by v.id)
                filter (where v.id is not null),
              '[]'
            ) as counts,
            max(v.updated_at) as updated_at
     from shelters s
     join organizations o on o.id = s.organization_id
     left join vacancy_counts v on v.shelter_id = s.id
     where s.id = $1
     group by s.id, o.approved`,
    [shelterId],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    approved: r.approved,
    counts: r.counts,
    updatedAt: r.updated_at ? r.updated_at.toISOString() : null,
  };
}

export class CountError extends Error {}

/**
 * Saves new counts for one shelter. Every category gets a new timestamp, because saving
 * means the staff member has confirmed the whole shelter's numbers.
 */
export async function updateCounts(shelterId: number, counts: Count[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const c of counts) {
      const current = await client.query(
        `select capacity from vacancy_counts where shelter_id = $1 and category = $2`,
        [shelterId, c.category],
      );
      if (current.rowCount === 0) {
        throw new CountError(`This shelter has no category named "${c.category}".`);
      }
      const capacity: number | null = current.rows[0].capacity;
      if (capacity !== null && c.openBeds > capacity) {
        throw new CountError(`${c.category} can't be more than ${capacity}, the total for this shelter.`);
      }
      await client.query(
        `update vacancy_counts set open_beds = $1 where shelter_id = $2 and category = $3`,
        [c.openBeds, shelterId, c.category],
      );
    }
    await client.query(`update vacancy_counts set updated_at = now() where shelter_id = $1`, [
      shelterId,
    ]);
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export async function lookupZip(zip: string): Promise<(Point & { label: string }) | null> {
  const { rows } = await pool.query(`select zip, city, lat, lng from zip_codes where zip = $1`, [
    zip,
  ]);
  if (rows.length === 0) return null;
  return { lat: rows[0].lat, lng: rows[0].lng, label: `${rows[0].city} ${rows[0].zip}` };
}
