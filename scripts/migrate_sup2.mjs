import Database from "better-sqlite3";
const db = new Database("data/vitals.db");
for (const c of [
  ["ingredients", "TEXT"],
  ["serving_size", "TEXT"],
  ["suggested_use", "TEXT"],
  ["price", "TEXT"],
]) {
  try { db.exec(`ALTER TABLE supplement ADD COLUMN ${c[0]} ${c[1]}`); console.log("added", c[0]); }
  catch (e) { console.log(c[0], "exists"); }
}
db.close();
