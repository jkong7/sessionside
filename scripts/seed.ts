import { rmSync } from "node:fs";
import { dbPath, openDb } from "../src/lib/db";
import { seed } from "../src/lib/seed";

const file = dbPath();
for (const suffix of ["", "-wal", "-shm"]) rmSync(file + suffix, { force: true });
const database = openDb(file);
seed(database);
const n = database.prepare("SELECT COUNT(*) AS n FROM encounters").get() as { n: number };
console.log(`Seeded ${file} with ${n.n} encounters`);
