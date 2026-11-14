import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

export const pool = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 5000 });

// Without this handler, a dropped idle connection (for example Docker restarting) crashes the server.
pool.on("error", (err) => {
  console.error("Database connection dropped. It will reconnect on the next request.", err.message);
});

/** True when the error means the database cannot be reached, as opposed to a bad query. */
export function isDatabaseDown(err: unknown): boolean {
  const codes = new Set(["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "ETIMEDOUT", "57P01", "57P03"]);
  const check = (e: unknown): boolean => {
    if (!e || typeof e !== "object") return false;
    const { code, message, errors } = e as { code?: string; message?: string; errors?: unknown[] };
    if (code && codes.has(code)) return true;
    if (typeof message === "string" && /timeout exceeded when trying to connect|Connection terminated/i.test(message)) {
      return true;
    }
    return Array.isArray(errors) && errors.some(check);
  };
  return check(err);
}
