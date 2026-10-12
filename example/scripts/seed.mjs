import { DatabaseSync } from "node:sqlite";

const path = process.env.SQLITE_DATABASE;
if (!path) {
  throw new Error("SQLITE_DATABASE is not set");
}

const database = new DatabaseSync(path);
database.exec("CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, text TEXT NOT NULL)");
database.exec("DELETE FROM notes");
const insert = database.prepare("INSERT INTO notes (text) VALUES (?)");
for (const text of ["hello from the seed", `variant: ${process.env.VARIANT_SLUG ?? "main"}`]) {
  insert.run(text);
}
database.close();
