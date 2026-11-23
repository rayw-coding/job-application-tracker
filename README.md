# Job Application Tracker API

A small REST API for recording job applications. Data is stored in a SQLite file and kept after the server restarts. There is no authentication or frontend.

Requires Node.js 22.13 or newer. The app uses the built-in `node:sqlite` module. The only external dependency is Express.

## Setup

```bash
npm install
```

## Run

```bash
npm start
```

The API listens on `http://localhost:3000`. The database file is created at `data/applications.db`.

Optional environment variables:

- `PORT` — port number, default `3000`
- `DATABASE_PATH` — path to the SQLite file. The parent directory is created if needed.

## Test

```bash
npm test
```

Tests use temporary SQLite files and delete them afterwards.

## Status values

`applied`, `interview_scheduled`, `offer`, `rejected`, `withdrawn`

`interview_date` is required when `status` is `interview_scheduled`. Dates use `YYYY-MM-DD`.

## Endpoints

| Method | Path | Success |
|---|---|---|
| `POST` | `/applications` | 201 |
| `GET` | `/applications` | 200 |
| `GET` | `/applications?status=applied` | 200 |
| `GET` | `/applications/upcoming-interviews` | 200 |
| `GET` | `/applications/:id` | 200 |
| `PATCH` | `/applications/:id` | 200 |
| `DELETE` | `/applications/:id` | 204 |

`GET /applications` returns every application, newest id first. The status filter accepts one of the status values above.

`GET /applications/upcoming-interviews` returns applications whose status is `interview_scheduled` and whose `interview_date` is today or later. "Today" is the UTC calendar date. Results are sorted by `interview_date` ascending, then id. Past interviews and other statuses are omitted.

Validation errors return `400`:

```json
{
  "error": "Validation failed",
  "details": [
    { "field": "interview_date", "message": "interview_date is required when status is interview_scheduled" }
  ]
}
```

A missing application returns `404` with `{ "error": "Application not found" }`. A malformed id returns `400`.

### Create example

```bash
curl -X POST http://localhost:3000/applications \
  -H "Content-Type: application/json" \
  -d "{\"company_name\":\"Example Ltd\",\"job_title\":\"Graduate Software Engineer\",\"status\":\"applied\",\"applied_date\":\"2026-11-20\"}"
```

Accepted fields are `company_name`, `job_title`, `status`, `applied_date`, `interview_date`, and `notes`. Any other field is rejected. `id`, `created_at`, and `updated_at` are set by the server.
