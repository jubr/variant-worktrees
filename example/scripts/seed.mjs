import { Database } from "bun:sqlite";

const path = process.env.SQLITE_DATABASE;
if (!path) {
  throw new Error("SQLITE_DATABASE is not set");
}

const database = new Database(path);
database.run("CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, text TEXT NOT NULL)");
database.run("DELETE FROM notes");
const insert = database.prepare("INSERT INTO notes (text) VALUES (?)");
for (const text of ["hello from the seed", `variant: ${process.env.VARIANT_SLUG ?? "main"}`]) {
  insert.run(text);
}
database.close();
