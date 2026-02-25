import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sql from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(__dirname, "../../db/schema.sql");

async function migrate(): Promise<void> {
  console.log("Running migrations...");

  try {
    const schema = readFileSync(schemaPath, "utf-8");
    await sql.unsafe(schema);
    console.log("Migrations completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
