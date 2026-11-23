const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createApp } = require("../src/app");
const { openDatabase } = require("../src/db");

function utcToday() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function application(overrides = {}) {
  return {
    company_name: "Example Ltd",
    job_title: "Graduate Software Engineer",
    status: "applied",
    applied_date: "2026-11-20",
    ...overrides,
  };
}

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1");
    server.once("listening", () => resolve(server));
    server.once("error", reject);
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
    // Drop idle keep-alive sockets so close can finish after fetch.
    server.closeAllConnections();
  });
}

async function request(base, method, urlPath, body) {
  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers["content-type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${base}${urlPath}`, options);
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

async function withApi(fn) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "job-tracker-"));
  const databasePath = path.join(directory, "applications.db");
  let db;
  let server;

  try {
    db = openDatabase(databasePath);
    server = await listen(createApp(db));
    const { port } = server.address();
    await fn({ base: `http://127.0.0.1:${port}`, db, databasePath });
  } finally {
    if (server) {
      await closeServer(server);
    }
    if (db) {
      db.close();
    }
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test("creates an application", async () => {
  await withApi(async ({ base }) => {
    const response = await request(base, "POST", "/applications", application({
      company_name: "  Example Ltd  ",
      notes: "  Ask about the team  ",
    }));

    assert.equal(response.status, 201);
    assert.equal(typeof response.body.id, "number");
    assert.equal(response.body.company_name, "Example Ltd");
    assert.equal(response.body.job_title, "Graduate Software Engineer");
    assert.equal(response.body.status, "applied");
    assert.equal(response.body.applied_date, "2026-11-20");
    assert.equal(response.body.interview_date, null);
    assert.equal(response.body.notes, "Ask about the team");
    assert.match(response.body.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.equal(response.body.updated_at, response.body.created_at);
  });
});

test("rejects a create request with missing required fields", async () => {
  await withApi(async ({ base }) => {
    const response = await request(base, "POST", "/applications", {
      company_name: "Example Ltd",
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "Validation failed");
    const fields = response.body.details.map((detail) => detail.field);
    assert.deepEqual(fields.sort(), ["applied_date", "job_title", "status"]);

    const listed = await request(base, "GET", "/applications");
    assert.deepEqual(listed.body, []);
  });
});

test("rejects an invalid status", async () => {
  await withApi(async ({ base }) => {
    const response = await request(
      base,
      "POST",
      "/applications",
      application({ status: "hired" })
    );

    assert.equal(response.status, 400);
    assert.equal(response.body.details[0].field, "status");
    assert.match(response.body.details[0].message, /hired|one of/);
  });
});

test("rejects impossible calendar dates", async () => {
  await withApi(async ({ base }) => {
    const impossibleDay = await request(
      base,
      "POST",
      "/applications",
      application({ applied_date: "2026-02-31" })
    );
    const impossibleMonth = await request(
      base,
      "POST",
      "/applications",
      application({ applied_date: "2026-13-01" })
    );

    assert.equal(impossibleDay.status, 400);
    assert.equal(impossibleDay.body.details[0].field, "applied_date");
    assert.equal(impossibleMonth.status, 400);
    assert.equal(impossibleMonth.body.details[0].field, "applied_date");

    const listed = await request(base, "GET", "/applications");
    assert.deepEqual(listed.body, []);
  });
});

test("rejects interview_scheduled without interview_date", async () => {
  await withApi(async ({ base }) => {
    const omitted = await request(
      base,
      "POST",
      "/applications",
      application({ status: "interview_scheduled" })
    );
    const explicitNull = await request(
      base,
      "POST",
      "/applications",
      application({ status: "interview_scheduled", interview_date: null })
    );

    assert.equal(omitted.status, 400);
    assert.equal(
      omitted.body.details[0].message,
      "interview_date is required when status is interview_scheduled"
    );
    assert.equal(explicitNull.status, 400);
    assert.equal(explicitNull.body.details[0].field, "interview_date");
  });
});

test("retrieves all applications", async () => {
  await withApi(async ({ base }) => {
    const first = await request(base, "POST", "/applications", application({
      company_name: "Alpha",
    }));
    const second = await request(base, "POST", "/applications", application({
      company_name: "Beta",
    }));

    const response = await request(base, "GET", "/applications");
    assert.equal(response.status, 200);
    assert.deepEqual(
      response.body.map((item) => item.id),
      [second.body.id, first.body.id]
    );
  });
});

test("retrieves one application by id", async () => {
  await withApi(async ({ base }) => {
    const created = await request(base, "POST", "/applications", application());
    const response = await request(base, "GET", `/applications/${created.body.id}`);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, created.body);
  });
});

test("filters applications by status", async () => {
  await withApi(async ({ base }) => {
    await request(base, "POST", "/applications", application({ company_name: "Applied Co" }));
    const interview = await request(base, "POST", "/applications", application({
      company_name: "Interview Co",
      status: "interview_scheduled",
      interview_date: "2026-12-02",
    }));
    await request(base, "POST", "/applications", application({
      company_name: "Offer Co",
      status: "offer",
    }));

    const response = await request(
      base,
      "GET",
      "/applications?status=interview_scheduled"
    );
    const invalid = await request(base, "GET", "/applications?status=hired");

    assert.equal(response.status, 200);
    assert.deepEqual(
      response.body.map((item) => item.id),
      [interview.body.id]
    );
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.details[0].field, "status");
  });
});

test("updates an existing application", async () => {
  await withApi(async ({ base }) => {
    const created = await request(base, "POST", "/applications", application());
    const response = await request(base, "PATCH", `/applications/${created.body.id}`, {
      status: "interview_scheduled",
      interview_date: "2026-12-02",
      notes: "  Panel interview  ",
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.id, created.body.id);
    assert.equal(response.body.status, "interview_scheduled");
    assert.equal(response.body.interview_date, "2026-12-02");
    assert.equal(response.body.notes, "Panel interview");
    assert.equal(response.body.company_name, created.body.company_name);
    assert.equal(response.body.created_at, created.body.created_at);
    assert.ok(response.body.updated_at >= created.body.updated_at);
  });
});

test("rejects an invalid status and date combination on update", async () => {
  await withApi(async ({ base }) => {
    const created = await request(base, "POST", "/applications", application({
      status: "interview_scheduled",
      interview_date: "2026-12-02",
    }));
    const response = await request(base, "PATCH", `/applications/${created.body.id}`, {
      interview_date: null,
    });

    assert.equal(response.status, 400);
    assert.equal(
      response.body.details[0].message,
      "interview_date is required when status is interview_scheduled"
    );
  });
});

test("rejects an empty update", async () => {
  await withApi(async ({ base }) => {
    const created = await request(base, "POST", "/applications", application());
    const response = await request(base, "PATCH", `/applications/${created.body.id}`, {});
    const stored = await request(base, "GET", `/applications/${created.body.id}`);

    assert.equal(response.status, 400);
    assert.equal(response.body.details[0].message, "At least one field is required");
    assert.deepEqual(stored.body, created.body);
  });
});

test("deletes an application", async () => {
  await withApi(async ({ base }) => {
    const created = await request(base, "POST", "/applications", application());
    const deleted = await request(base, "DELETE", `/applications/${created.body.id}`);
    const fetched = await request(base, "GET", `/applications/${created.body.id}`);

    assert.equal(deleted.status, 204);
    assert.equal(deleted.body, null);
    assert.equal(fetched.status, 404);
  });
});

test("returns 404 when an application does not exist", async () => {
  await withApi(async ({ base }) => {
    const fetched = await request(base, "GET", "/applications/42");
    const updated = await request(base, "PATCH", "/applications/42", {
      notes: "Missing",
    });
    const deleted = await request(base, "DELETE", "/applications/42");

    assert.equal(fetched.status, 404);
    assert.equal(fetched.body.error, "Application not found");
    assert.equal(updated.status, 404);
    assert.equal(deleted.status, 404);
  });
});

test("returns 400 for malformed ids", async () => {
  await withApi(async ({ base }) => {
    const created = await request(base, "POST", "/applications", application());
    const paths = ["/applications/abc", "/applications/0", "/applications/1.5"];

    for (const urlPath of paths) {
      const fetched = await request(base, "GET", urlPath);
      const updated = await request(base, "PATCH", urlPath, { notes: "Nope" });
      const deleted = await request(base, "DELETE", urlPath);
      assert.equal(fetched.status, 400);
      assert.equal(fetched.body.details[0].field, "id");
      assert.equal(updated.status, 400);
      assert.equal(deleted.status, 400);
    }

    const stored = await request(base, "GET", `/applications/${created.body.id}`);
    assert.deepEqual(stored.body, created.body);
  });
});

test("returns upcoming interviews in ascending date order and excludes past or other statuses", async () => {
  await withApi(async ({ base }) => {
    const today = utcToday();
    const created = {};

    async function create(name, status, interviewDate) {
      const response = await request(base, "POST", "/applications", application({
        company_name: name,
        status,
        interview_date: interviewDate,
      }));
      assert.equal(response.status, 201, JSON.stringify(response.body));
      created[name] = response.body;
    }

    await create("Later", "interview_scheduled", shiftDate(today, 4));
    await create("Today", "interview_scheduled", today);
    await create("Soon", "interview_scheduled", shiftDate(today, 1));
    await create("Past", "interview_scheduled", shiftDate(today, -1));
    await create("Offer", "offer", shiftDate(today, 2));
    await create("Applied", "applied", shiftDate(today, 3));

    const response = await request(base, "GET", "/applications/upcoming-interviews");
    assert.equal(response.status, 200);
    assert.deepEqual(
      response.body.map((item) => item.company_name),
      ["Today", "Soon", "Later"]
    );
    assert.deepEqual(
      response.body.map((item) => item.interview_date),
      [today, shiftDate(today, 1), shiftDate(today, 4)]
    );

    const all = await request(base, "GET", "/applications");
    const names = all.body.map((item) => item.company_name);
    assert.ok(names.includes("Past"));
    assert.ok(names.includes("Offer"));
    assert.ok(names.includes("Applied"));
  });
});

test("does not modify stored data when an update is rejected", async () => {
  await withApi(async ({ base }) => {
    const created = await request(base, "POST", "/applications", application({
      notes: "Original note",
    }));

    const invalidStatus = await request(base, "PATCH", `/applications/${created.body.id}`, {
      status: "interview_scheduled",
    });
    const impossibleDate = await request(base, "PATCH", `/applications/${created.body.id}`, {
      applied_date: "2026-02-31",
    });
    const unknownField = await request(base, "PATCH", `/applications/${created.body.id}`, {
      recruiter: "Sam",
    });
    const stored = await request(base, "GET", `/applications/${created.body.id}`);

    assert.equal(invalidStatus.status, 400);
    assert.equal(impossibleDate.status, 400);
    assert.equal(unknownField.status, 400);
    assert.equal(unknownField.body.details[0].field, "recruiter");
    assert.deepEqual(stored.body, created.body);
  });
});

test("persists applications after the database is closed and reopened", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "job-tracker-"));
  const databasePath = path.join(directory, "nested", "applications.db");
  let db;
  let server;

  try {
    assert.equal(fs.existsSync(path.dirname(databasePath)), false);
    db = openDatabase(databasePath);
    assert.equal(fs.existsSync(databasePath), true);

    server = await listen(createApp(db));
    const base = `http://127.0.0.1:${server.address().port}`;
    const created = await request(base, "POST", "/applications", application({
      company_name: "Persisted Co",
    }));
    assert.equal(created.status, 201);

    await closeServer(server);
    server = null;
    db.close();
    db = null;

    db = openDatabase(databasePath);
    server = await listen(createApp(db));
    const reopened = `http://127.0.0.1:${server.address().port}`;
    const listed = await request(reopened, "GET", "/applications");
    const fetched = await request(reopened, "GET", `/applications/${created.body.id}`);

    assert.equal(listed.status, 200);
    assert.equal(listed.body.length, 1);
    assert.equal(listed.body[0].company_name, "Persisted Co");
    assert.deepEqual(fetched.body, created.body);
  } finally {
    if (server) {
      await closeServer(server);
    }
    if (db) {
      db.close();
    }
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
