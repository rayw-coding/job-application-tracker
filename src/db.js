const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  status TEXT NOT NULL,
  applied_date TEXT NOT NULL,
  interview_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

function openDatabase(databasePath) {
  if (databasePath !== ":memory:") {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  const db = new DatabaseSync(databasePath);
  db.exec(SCHEMA);
  return db;
}

module.exports = { openDatabase };
