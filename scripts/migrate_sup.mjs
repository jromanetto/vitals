import Database from "better-sqlite3";
const db = new Database("data/vitals.db");
for (const c of ["url", "brand", "image_url"]) {
  try { db.exec(`ALTER TABLE supplement ADD COLUMN ${c} TEXT`); console.log("added", c); }
  catch (e) { console.log(c, "exists"); }
}
db.close();
