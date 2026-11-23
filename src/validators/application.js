const STATUSES = [
  "applied",
  "interview_scheduled",
  "offer",
  "rejected",
  "withdrawn",
];

const STATUS_SET = new Set(STATUSES);
const ALLOWED_FIELDS = new Set([
  "company_name",
  "job_title",
  "status",
  "applied_date",
  "interview_date",
  "notes",
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isRealCalendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validationError(details) {
  return {
    ok: false,
    status: 400,
    body: {
      error: "Validation failed",
      details,
    },
  };
}

function unknownFieldError(body) {
  const unknown = Object.keys(body).filter((field) => !ALLOWED_FIELDS.has(field));
  if (unknown.length === 0) {
    return null;
  }

  return validationError(
    unknown.map((field) => ({
      field,
      message: `${field} is not a recognized field`,
    }))
  );
}

function addText(details, source, target, field, required) {
  if (!Object.hasOwn(source, field)) {
    if (required) {
      details.push({ field, message: `${field} is required` });
    }
    return;
  }

  const value = source[field];
  if (typeof value !== "string") {
    details.push({ field, message: `${field} must be a string` });
    return;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    details.push({ field, message: `${field} is required` });
    return;
  }

  if (trimmed.length > 120) {
    details.push({ field, message: `${field} must be at most 120 characters` });
    return;
  }

  target[field] = trimmed;
}

function addStatus(details, source, target, required) {
  if (!Object.hasOwn(source, "status")) {
    if (required) {
      details.push({ field: "status", message: "status is required" });
    }
    return;
  }

  if (typeof source.status !== "string" || !STATUS_SET.has(source.status)) {
    details.push({
      field: "status",
      message:
        "status must be one of applied, interview_scheduled, offer, rejected, withdrawn",
    });
    return;
  }

  target.status = source.status;
}

function addDate(details, source, target, field, required) {
  if (!Object.hasOwn(source, field)) {
    if (required) {
      details.push({ field, message: `${field} is required` });
    }
    return;
  }

  const value = source[field];
  if (value === null) {
    if (required) {
      details.push({ field, message: `${field} is required` });
    } else {
      target[field] = null;
    }
    return;
  }

  if (!isRealCalendarDate(value)) {
    details.push({
      field,
      message: `${field} must be a real calendar date in YYYY-MM-DD format`,
    });
    return;
  }

  target[field] = value;
}

function addNotes(details, source, target) {
  if (!Object.hasOwn(source, "notes")) {
    return;
  }

  const value = source.notes;
  if (value === null) {
    target.notes = null;
    return;
  }

  if (typeof value !== "string") {
    details.push({ field: "notes", message: "notes must be a string" });
    return;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    target.notes = null;
    return;
  }

  if (trimmed.length > 2000) {
    details.push({ field: "notes", message: "notes must be at most 2000 characters" });
    return;
  }

  target.notes = trimmed;
}

function interviewRuleError(record) {
  if (record.status === "interview_scheduled" && !record.interview_date) {
    return validationError([
      {
        field: "interview_date",
        message: "interview_date is required when status is interview_scheduled",
      },
    ]);
  }

  return null;
}

function validateCreate(body) {
  if (!isPlainObject(body)) {
    return validationError([
      { field: "body", message: "Request body must be a JSON object" },
    ]);
  }

  const unknown = unknownFieldError(body);
  if (unknown) {
    return unknown;
  }

  const details = [];
  const value = {};
  addText(details, body, value, "company_name", true);
  addText(details, body, value, "job_title", true);
  addStatus(details, body, value, true);
  addDate(details, body, value, "applied_date", true);
  addDate(details, body, value, "interview_date", false);
  addNotes(details, body, value);

  if (details.length > 0) {
    return validationError(details);
  }

  if (!Object.hasOwn(value, "interview_date")) {
    value.interview_date = null;
  }
  if (!Object.hasOwn(value, "notes")) {
    value.notes = null;
  }

  const ruleError = interviewRuleError(value);
  if (ruleError) {
    return ruleError;
  }

  return { ok: true, value };
}

function validateUpdate(body, existing) {
  if (!isPlainObject(body)) {
    return validationError([
      { field: "body", message: "Request body must be a JSON object" },
    ]);
  }

  const unknown = unknownFieldError(body);
  if (unknown) {
    return unknown;
  }

  if (Object.keys(body).length === 0) {
    return validationError([
      { field: "body", message: "At least one field is required" },
    ]);
  }

  const details = [];
  const value = {};
  addText(details, body, value, "company_name", false);
  addText(details, body, value, "job_title", false);
  addStatus(details, body, value, false);
  addDate(details, body, value, "applied_date", false);
  addDate(details, body, value, "interview_date", false);
  addNotes(details, body, value);

  if (details.length > 0) {
    return validationError(details);
  }

  const resulting = {
    status: Object.hasOwn(value, "status") ? value.status : existing.status,
    interview_date: Object.hasOwn(value, "interview_date")
      ? value.interview_date
      : existing.interview_date,
  };
  const ruleError = interviewRuleError(resulting);
  if (ruleError) {
    return ruleError;
  }

  return { ok: true, value };
}

function validateStatusFilter(status) {
  if (status === undefined) {
    return { ok: true, status: undefined };
  }

  if (typeof status !== "string" || !STATUS_SET.has(status)) {
    return validationError([
      {
        field: "status",
        message:
          "status must be one of applied, interview_scheduled, offer, rejected, withdrawn",
      },
    ]);
  }

  return { ok: true, status };
}

function parseId(raw) {
  if (typeof raw !== "string" || !/^[1-9]\d*$/.test(raw)) {
    return validationError([
      { field: "id", message: "id must be a positive integer" },
    ]);
  }

  const id = Number(raw);
  if (!Number.isSafeInteger(id)) {
    return validationError([
      { field: "id", message: "id must be a positive integer" },
    ]);
  }

  return { ok: true, id };
}

module.exports = {
  STATUSES,
  validateCreate,
  validateUpdate,
  validateStatusFilter,
  parseId,
};
