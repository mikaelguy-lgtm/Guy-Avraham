import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDatabase, db } from "./index.js";

await migrate(db, {migrationsFolder: "drizzle"});
await closeDatabase();

