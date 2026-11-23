const UPDATABLE_FIELDS = [
  "company_name",
  "job_title",
  "status",
  "applied_date",
  "interview_date",
  "notes",
];

function utcToday(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function mapRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    company_name: row.company_name,
    job_title: row.job_title,
    status: row.status,
    applied_date: row.applied_date,
    interview_date: row.interview_date,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function createApplication(db, input) {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO applications (
        company_name,
        job_title,
        status,
        applied_date,
        interview_date,
        notes,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.company_name,
      input.job_title,
      input.status,
      input.applied_date,
      input.interview_date,
      input.notes,
      now,
      now
    );

  return getApplication(db, Number(result.lastInsertRowid));
}

function listApplications(db, status) {
  if (status) {
    return db
      .prepare("SELECT * FROM applications WHERE status = ? ORDER BY id DESC")
      .all(status)
      .map(mapRow);
  }

  return db
    .prepare("SELECT * FROM applications ORDER BY id DESC")
    .all()
    .map(mapRow);
}

function getApplication(db, id) {
  return mapRow(db.prepare("SELECT * FROM applications WHERE id = ?").get(id));
}

function updateApplication(db, id, changes) {
  // Column names come from this fixed list, not from raw request keys.
  const fields = UPDATABLE_FIELDS.filter((field) => Object.hasOwn(changes, field));
  const assignments = fields.map((field) => `${field} = ?`).join(", ");
  const values = fields.map((field) => changes[field]);
  const now = new Date().toISOString();

  db.prepare(`UPDATE applications SET ${assignments}, updated_at = ? WHERE id = ?`).run(
    ...values,
    now,
    id
  );

  return getApplication(db, id);
}

function deleteApplication(db, id) {
  const result = db.prepare("DELETE FROM applications WHERE id = ?").run(id);
  return result.changes > 0;
}

function listUpcomingInterviews(db, today = utcToday()) {
  // interview_date is a YYYY-MM-DD calendar date. Compare it with today's UTC date.
  return db
    .prepare(
      `SELECT * FROM applications
       WHERE status = ?
         AND interview_date IS NOT NULL
         AND interview_date >= ?
       ORDER BY interview_date ASC, id ASC`
    )
    .all("interview_scheduled", today)
    .map(mapRow);
}

module.exports = {
  utcToday,
  createApplication,
  listApplications,
  getApplication,
  updateApplication,
  deleteApplication,
  listUpcomingInterviews,
};
