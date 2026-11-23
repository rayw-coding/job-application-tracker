# AI-Assisted Workflow

This note records how the Job Application Tracker API was directed and checked in Cursor. It includes only steps that are visible in the project files or in the working session. Items that were not recorded are marked TODO.

## 1. AI tools used

- Cursor, with the Grok 4.7 coding assistant.
- The assistant could read and edit the project files and run commands, including `node`, `npm install`, and `npm test`.
- No other AI tool is recorded for this project.

TODO: Add any other tool I used myself, such as a browser, REST client, or GitHub website, and what I used it for.

## 2. Initial requirements and objectives

I asked for a one-day backend submission for a Software Engineer graduate application. The required result was a working repository, run instructions, an account of the AI workflow, and an architecture or demonstration.

The agreed product was a Job Application Tracker API:

- Node.js, Express, SQLite, and a REST API
- Linux-compatible, with no frontend, authentication, or extra services
- Create, list, retrieve, update, and delete applications
- Filter by status and list upcoming interviews by date
- Validate input and return suitable HTTP status codes
- Persist records in SQLite
- Require `interview_date` when the status is `interview_scheduled`
- Include automated API tests
- Do not claim that tests passed unless they had actually been run

The first instruction was to plan only and not to create or edit files until I approved the plan.

## 3. Planning and architecture

The assistant proposed one Node.js process with four layers: routes, validation, service logic, and SQLite access. It recommended the built-in `node:sqlite` module, Express as the only dependency, and `node:test` with `fetch` so the tests would call the real routes.

I approved that design. The plan also fixed eight decisions before coding:

- Statuses are `applied`, `interview_scheduled`, `offer`, `rejected`, and `withdrawn`.
- `interview_date` is required only for the resulting `interview_scheduled` record. Other statuses may keep a date.
- Dates are `YYYY-MM-DD`. Upcoming means an interview status dated today or later in UTC.
- `applied_date` may be in the future.
- Unknown fields are rejected. A malformed id is 400. A missing row is 404.
- Deletes are permanent.
- The database API is `node:sqlite`.
- The project lives in its own repository.

I added implementation constraints: verify the installed Node.js version, use CommonJS, keep the stated endpoint behavior, use temporary databases in tests, avoid extra dependencies, and do not commit or push.

## 4. Implementation approach

Before writing application code, the assistant checked this machine: Node.js v24.18.0, npm 11.16.0, and a small `node:sqlite` script. That script created an in-memory table, inserted a row with a prepared statement, read it back, and closed the database.

The implementation was then split into `src/server.js`, `src/app.js`, `src/routes/applications.js`, `src/validators/application.js`, `src/services/applications.js`, and `src/db.js`, with `tests/applications.test.js` covering the requested cases. The first README was limited to setup, running the server, and the endpoints. The workflow note was deliberately postponed until the code and tests could be reviewed.

The files were first created in `D:\job-application-tracker`. The repository that already existed was `D:\COMP4021\job-application-tracker`, which contained an initial commit, a placeholder README, and a Node.js `.gitignore`. The project files were copied into that repository, the extra directory was removed, and `npm test` was run again in the final location.

## 5. Human review and validation decisions

I reviewed the proposed architecture before allowing any files to be written. I did not ask for the eight planning decisions to be changed.

After implementation, I tested the running API myself. I reported these results:

- POST creates an application.
- GET retrieves it.
- PATCH updates its status and interview date.
- An invalid PATCH returns HTTP 400.
- Upcoming interviews can be retrieved.
- A missing application returns HTTP 404.
- Failed validation does not modify stored data.

I also reported an automated run of 17 tests, 17 passed, 0 failed, in about 867 ms. That duration is my reported result. It is not the same measurement as the assistant's earlier run, which took about 1.5 seconds in the final folder.

The local Git history contains two commits made outside the assistant's file-writing steps: `Initial commit` and `feat: implement job application API`. The assistant was instructed not to commit or push.

TODO: Add what I personally checked in the code, any change I rejected, and whether I agree with the UTC-date and status-list decisions after using the API.

## 6. Automated and manual testing

The test script is `npm test`, which runs `node --test`. The suite uses a temporary SQLite file per test, closes the server and database, and deletes the temporary directory.

The assistant's rerun in the final project folder, before this documentation pass, reported 17 passed and 0 failed. My later run reported the same counts in about 867 ms.

A separate manual check started `src/server.js` on port 3010, created one application, stopped the process, started it again, and read the same row back. Those temporary server processes were then stopped, and that smoke-test database was removed. A `data/applications.db` file is present again from later manual use. It is ignored by Git.

TODO: Add the exact manual requests I sent and anything I tested that is not listed above.

## 7. Issues encountered and how they were resolved

- `node:sqlite` was verified before implementation. `lastInsertRowid` was a number in Node.js v24.18.0, and the code still converts it with `Number()` before sending JSON.
- The test helper closes idle HTTP connections after `fetch`. This was added before the first test run so a temporary server would not stay open. The first run passed; there was no recorded test failure to repair at that point.
- The project directory mistake described in section 4 was corrected by moving the files into the existing repository and rerunning the tests.
- During the final review, an oversized JSON body was sent to the running app. Express returned HTTP 500 and printed a `PayloadTooLargeError` stack. The error handler now recognizes that parser error and returns HTTP 413 with `{"error":"Request body is too large"}`. A test covers this case.

No failed `npm test` run is recorded. I am not treating the 413 response as something that was discovered by the original 17 tests.

TODO: Add any defect I found myself during manual testing, including the request and the result.

## 8. Approximate development time

The recorded session timestamps on 23 November 2026, UTC+8, are:

- 2:00 PM: planning request, with no file changes allowed
- 2:04 PM: implementation approved
- 2:19 PM: the port 3010 smoke-test servers had been stopped
- 3:08 PM: I requested the final review and documentation after manual testing

These timestamps do not measure how long I spent reading, testing, or deciding.

TODO: Replace this section with my own estimate of time spent prompting, reviewing, testing, and correcting the result.

## 9. Lessons learned and final reflection

The useful control points were the ones set before coding: a written architecture, a fixed status list, the interview-date rule, a required test list, and a ban on claiming tests had passed before `npm test` had run.

Using `node:sqlite` avoided a native database dependency, at the cost of requiring Node.js 22.13 or newer. That tradeoff was explicit in the plan and is repeated in the README.

The final review also showed that a passing test suite did not cover every error path. The oversized-body response was wrong until it was tried separately.

TODO: Add my own reflection on what I would change in the way I directed the assistant, and what I checked carefully enough to defend in an interview.
