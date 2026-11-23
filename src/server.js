const path = require("path");
const { createApp } = require("./app");
const { openDatabase } = require("./db");

const parsedPort = Number.parseInt(process.env.PORT || "3000", 10);
const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 3000;
const databasePath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(__dirname, "..", "data", "applications.db");

const db = openDatabase(databasePath);
const app = createApp(db);

app.listen(port, () => {
  console.log(`Job Application Tracker API listening on http://localhost:${port}`);
  console.log(`SQLite database: ${databasePath}`);
});
