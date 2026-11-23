const express = require("express");
const {
  validateCreate,
  validateUpdate,
  validateStatusFilter,
  parseId,
} = require("../validators/application");
const {
  createApplication,
  listApplications,
  getApplication,
  updateApplication,
  deleteApplication,
  listUpcomingInterviews,
} = require("../services/applications");

function sendValidation(res, result) {
  return res.status(result.status).json(result.body);
}

function createApplicationsRouter(db) {
  const router = express.Router();

  router.get("/upcoming-interviews", (req, res) => {
    res.json(listUpcomingInterviews(db));
  });

  router.get("/", (req, res) => {
    if (Array.isArray(req.query.status)) {
      return sendValidation(res, {
        ok: false,
        status: 400,
        body: {
          error: "Validation failed",
          details: [{ field: "status", message: "status must be a single value" }],
        },
      });
    }

    const parsed = validateStatusFilter(req.query.status);
    if (!parsed.ok) {
      return sendValidation(res, parsed);
    }

    res.json(listApplications(db, parsed.status));
  });

  router.post("/", (req, res) => {
    const parsed = validateCreate(req.body);
    if (!parsed.ok) {
      return sendValidation(res, parsed);
    }

    res.status(201).json(createApplication(db, parsed.value));
  });

  router.get("/:id", (req, res) => {
    const parsed = parseId(req.params.id);
    if (!parsed.ok) {
      return sendValidation(res, parsed);
    }

    const application = getApplication(db, parsed.id);
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    res.json(application);
  });

  router.patch("/:id", (req, res) => {
    const parsedId = parseId(req.params.id);
    if (!parsedId.ok) {
      return sendValidation(res, parsedId);
    }

    const existing = getApplication(db, parsedId.id);
    if (!existing) {
      return res.status(404).json({ error: "Application not found" });
    }

    const parsed = validateUpdate(req.body, existing);
    if (!parsed.ok) {
      return sendValidation(res, parsed);
    }

    res.json(updateApplication(db, parsedId.id, parsed.value));
  });

  router.delete("/:id", (req, res) => {
    const parsed = parseId(req.params.id);
    if (!parsed.ok) {
      return sendValidation(res, parsed);
    }

    const deleted = deleteApplication(db, parsed.id);
    if (!deleted) {
      return res.status(404).json({ error: "Application not found" });
    }

    res.status(204).end();
  });

  return router;
}

module.exports = { createApplicationsRouter };
