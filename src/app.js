const express = require("express");
const { createApplicationsRouter } = require("./routes/applications");

function createApp(db) {
  const app = express();
  app.use(express.json());
  app.use("/applications", createApplicationsRouter(db));

  app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use((err, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    const invalidJson =
      err.type === "entity.parse.failed" ||
      (err instanceof SyntaxError && (err.status === 400 || err.statusCode === 400));

    if (invalidJson) {
      res.status(400).json({ error: "Request body must be valid JSON" });
      return;
    }

    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

module.exports = { createApp };
