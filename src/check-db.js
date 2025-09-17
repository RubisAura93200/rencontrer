// src/check-db.js
const { db } = require("./utils/db");

function getTables() {
  return db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  ).all();
}

function getTableInfo(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all();
}

function getRowCount(table) {
  try {
    const r = db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get();
    return r ? r.cnt : 0;
  } catch {
    return 0;
  }
}

function getSampleRows(table, limit = 3) {
  try {
    return db.prepare(`SELECT * FROM ${table} LIMIT ${limit}`).all();
  } catch {
    return [];
  }
}

console.log("📋 Liste des tables dans la base de données :");

const tables = getTables();
for (const t of tables) {
  console.log(` - ${t.name}`);
}

console.log();

for (const t of tables) {
  const count = getRowCount(t.name);
  console.log(`📋 Structure de la table '${t.name}' (${count} lignes):`);

  const info = getTableInfo(t.name);
  for (const col of info) {
    console.log(
      ` - ${col.name} (${col.type})${col.pk ? " [PK]" : ""}`
    );
  }

  const sample = getSampleRows(t.name);
  if (sample.length > 0) {
    console.log("   🔎 Extrait:");
    for (const row of sample) {
      console.log("    ", row);
    }
  } else {
    console.log("   (aucune donnée)");
  }

  console.log();
}

console.log("✅ Vérification terminée.");
