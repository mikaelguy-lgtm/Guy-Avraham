import "dotenv/config";
import { sql } from "drizzle-orm";
import { closeDatabase, db } from "./index.js";

const result = await db.execute(sql`select current_database() as database, now() as checked_at`);
console.log(result.rows[0]);
await closeDatabase();

