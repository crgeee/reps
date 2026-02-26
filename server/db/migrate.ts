import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sql from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbDir = resolve(__dirname, "../../db");

async function migrate(): Promise<void> {
  console.log("Running migrations...");

  try {
    const files = readdirSync(dbDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      console.log(`  Running ${file}...`);
      const content = readFileSync(resolve(dbDir, file), "utf-8");
      await sql.unsafe(content);
    }

    console.log("Migrations completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
