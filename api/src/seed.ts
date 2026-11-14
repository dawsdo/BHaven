// Creates the schema and loads demo data. Safe to run again: it rebuilds every table.
//
// What is real: shelter names and bed capacity come from HUD's 2025 Housing Inventory Count
// for CoC AL-500 (Birmingham/Jefferson, St. Clair, Shelby Counties). Addresses and phone
// numbers come from each organization's public listings, checked in November 2026.
//
// What is simulated: open-bed counts, update times, the dog and wheelchair tags, tax IDs,
// and staff accounts. These organizations have not reviewed or taken part in this demo.
//
// Left out on purpose: domestic violence shelters (their locations are confidential),
// housing voucher programs, and shelters whose address or phone could not be confirmed.
import bcrypt from "bcryptjs";
import { pool } from "./db.js";

const staffPassword = process.env.SEED_STAFF_PASSWORD;
if (!staffPassword) {
  throw new Error("SEED_STAFF_PASSWORD is not set. Add it to .env before seeding.");
}

const TAX_ID_FORMAT = /^\d{2}-\d{7}$/; // US EIN format. Format check only, no registry lookup.

type SeedShelter = {
  orgName: string;
  taxId: string;
  domain: string;
  name: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  tags: string[];
  languages: string[];
  /** capacity is the HUD 2025 count of beds (or family units). openBeds is simulated. */
  counts: { category: string; openBeds: number; capacity: number }[];
  updatedMinutesAgo: number;
};

const shelters: SeedShelter[] = [
  {
    orgName: "Firehouse Ministries",
    taxId: "00-0000001", // placeholder, not the organization's real ID
    domain: "firehouse-demo.example",
    name: "Firehouse Shelter",
    address: "626 2nd Ave N, Birmingham, AL 35203",
    phone: "205-252-9571",
    lat: 33.50646,
    lng: -86.82518,
    tags: ["men_only", "wheelchair_access"],
    languages: [],
    counts: [{ category: "Men's beds", openBeds: 14, capacity: 100 }],
    updatedMinutesAgo: 20,
  },
  {
    orgName: "Pathways",
    taxId: "00-0000002",
    domain: "pathways-demo.example",
    name: "Pathways Stepping Stones",
    address: "409 Richard Arrington Jr Blvd N, Birmingham, AL 35203",
    phone: "205-322-6854",
    lat: 33.51838,
    lng: -86.80641,
    tags: ["women_only", "family"],
    languages: [],
    counts: [
      { category: "Women's beds", openBeds: 3, capacity: 8 },
      { category: "Family rooms", openBeds: 1, capacity: 5 },
    ],
    updatedMinutesAgo: 90,
  },
  {
    orgName: "The Salvation Army of Greater Birmingham",
    taxId: "00-0000003",
    domain: "salvationarmy-demo.example",
    name: "Salvation Army Center of Hope",
    address: "2015 26th Ave N, Birmingham, AL 35234",
    phone: "205-328-2420",
    lat: 33.54496,
    lng: -86.82457,
    tags: ["co_ed", "family", "dog_allowed", "wheelchair_access"],
    languages: [],
    counts: [
      { category: "Men's beds", openBeds: 9, capacity: 85 },
      { category: "Women's beds", openBeds: 6, capacity: 40 },
      { category: "Family rooms", openBeds: 0, capacity: 8 },
    ],
    updatedMinutesAgo: 5 * 60,
  },
  {
    orgName: "First Light",
    taxId: "00-0000004",
    domain: "firstlight-demo.example",
    name: "First Light",
    address: "2230 4th Ave N, Birmingham, AL 35203",
    phone: "205-323-4277",
    lat: 33.51877,
    lng: -86.80436,
    tags: ["women_only"],
    languages: [],
    counts: [{ category: "Women's beds", openBeds: 4, capacity: 25 }],
    updatedMinutesAgo: 30 * 60, // past 24 hours, so clients see it as expired
  },
];

// Approximate centers of Birmingham, AL ZIP codes. Demo lookup only, no geocoding service.
const zipCodes: [string, string, number, number][] = [
  ["35203", "Birmingham", 33.5186, -86.8104],
  ["35204", "Birmingham", 33.522, -86.837],
  ["35205", "Birmingham", 33.495, -86.808],
  ["35206", "Birmingham", 33.57, -86.715],
  ["35209", "Birmingham", 33.465, -86.808],
  ["35211", "Birmingham", 33.481, -86.859],
  ["35212", "Birmingham", 33.542, -86.752],
  ["35222", "Birmingham", 33.524, -86.77],
  ["35233", "Birmingham", 33.508, -86.801],
  ["35234", "Birmingham", 33.541, -86.803],
];

const schema = `
  drop table if exists staff_users, vacancy_counts, shelters, organizations, zip_codes cascade;

  create table organizations (
    id serial primary key,
    legal_name text not null,
    tax_id text not null unique,
    admin_email_domain text not null,
    approved boolean not null default false
  );

  create table shelters (
    id serial primary key,
    organization_id integer not null references organizations(id),
    name text not null,
    address text not null,
    phone text not null,
    lat double precision not null,
    lng double precision not null,
    tags text[] not null default '{}',
    languages text[] not null default '{}'
  );

  create table vacancy_counts (
    id serial primary key,
    shelter_id integer not null references shelters(id),
    category text not null,
    open_beds integer not null check (open_beds >= 0),
    capacity integer check (capacity is null or open_beds <= capacity),
    updated_at timestamptz not null default now(),
    unique (shelter_id, category)
  );

  create table staff_users (
    id serial primary key,
    shelter_id integer not null references shelters(id),
    email text not null unique,
    password_hash text not null
  );

  create table zip_codes (
    zip text primary key,
    city text not null,
    lat double precision not null,
    lng double precision not null
  );
`;

async function main() {
  const passwordHash = await bcrypt.hash(staffPassword!, 10);
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(schema);

    for (const s of shelters) {
      if (!TAX_ID_FORMAT.test(s.taxId)) {
        throw new Error(`Tax ID "${s.taxId}" for ${s.orgName} is not in NN-NNNNNNN format.`);
      }
      const staffEmail = `staff@${s.domain}`;
      if (!staffEmail.endsWith(`@${s.domain}`)) {
        throw new Error(`Staff email ${staffEmail} does not match the organization domain.`);
      }

      const org = await client.query(
        `insert into organizations (legal_name, tax_id, admin_email_domain, approved)
         values ($1, $2, $3, true) returning id`,
        [s.orgName, s.taxId, s.domain],
      );
      const shelter = await client.query(
        `insert into shelters (organization_id, name, address, phone, lat, lng, tags, languages)
         values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
        [org.rows[0].id, s.name, s.address, s.phone, s.lat, s.lng, s.tags, s.languages],
      );
      const shelterId = shelter.rows[0].id;

      for (const c of s.counts) {
        await client.query(
          `insert into vacancy_counts (shelter_id, category, open_beds, capacity, updated_at)
           values ($1, $2, $3, $4, now() - make_interval(mins => $5))`,
          [shelterId, c.category, c.openBeds, c.capacity, s.updatedMinutesAgo],
        );
      }
      await client.query(
        `insert into staff_users (shelter_id, email, password_hash) values ($1, $2, $3)`,
        [shelterId, staffEmail, passwordHash],
      );
    }

    for (const [zip, city, lat, lng] of zipCodes) {
      await client.query(`insert into zip_codes (zip, city, lat, lng) values ($1, $2, $3, $4)`, [
        zip,
        city,
        lat,
        lng,
      ]);
    }

    await client.query("commit");
    console.log(`Seeded ${shelters.length} demo shelters and ${zipCodes.length} ZIP codes.`);
    console.log("Staff logins: staff@<organization domain>, password from SEED_STAFF_PASSWORD.");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
