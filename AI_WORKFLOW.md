# AI-Assisted Workflow

This note describes how I directed and checked the Job Application Tracker API. It records the tools I used, the decisions I approved, and the tests I confirmed. It does not claim that I personally inspected particular source files.

## 1. AI tools used

I used two tools for different parts of the work.

**ChatGPT** was used for requirements analysis, prompt preparation, architecture review, testing guidance, and documentation review. It did not edit the repository or run the test suite.

**Cursor with Grok 4.7** was used for code generation, implementation, testing, debugging, and documentation. It also prepared the architecture plan, which I approved before any application code was written. I required it to run `npm test` before reporting that the tests passed.

## 2. Initial requirements and objectives

I asked for a small backend that I could finish and explain in a graduate application. The required submission was a working repository, run instructions, this workflow note, and an architecture diagram.

The product had to be a Job Application Tracker API with:

- Node.js, Express, SQLite, and REST endpoints
- Linux-compatible code, with no frontend, authentication, or extra services
- Create, list, retrieve, update, and delete operations
- Filtering by status and a list of upcoming interviews
- Validation, suitable HTTP status codes, and SQLite persistence
- A rule that `interview_date` is required when the status is `interview_scheduled`
- Automated API tests, with no claim that tests passed unless they had been run

I asked for a plan first and did not allow file changes until I approved it.

## 3. Planning and architecture

Cursor with Grok 4.7 proposed one Node.js process divided into routes, validation, service logic, and database access. It recommended the built-in `node:sqlite` module, Express as the only dependency, and `node:test` calling the real routes.

I approved that design before implementation. The approved decisions were:

- Statuses are `applied`, `interview_scheduled`, `offer`, `rejected`, and `withdrawn`.
- `interview_date` is required only when the resulting status is `interview_scheduled`. Other statuses may keep a date.
- Dates use `YYYY-MM-DD`. An upcoming interview is dated today or later in UTC.
- `applied_date` may be in the future.
- Unknown fields are rejected. A malformed id returns 400. A missing row returns 404.
- Deletes are permanent.
- Persistence uses `node:sqlite`.
- The API lives in its own repository.

I also required CommonJS, a check of the installed Node.js version, temporary databases for tests, no extra dependencies, and no automatic commit or push.

## 4. Implementation approach

I told Cursor with Grok 4.7 to implement only the approved API. Before editing application code, it checked this machine and found Node.js v24.18.0 and npm 11.16.0. A short `node:sqlite` script created a table, inserted a row with a prepared statement, read it back, and closed the database.

The implementation was split into server startup, the Express app, routes, validation, service logic, and database setup. The first README covered setup, running the server, and the endpoints. I postponed this workflow note until the behavior and tests could be checked.

## 5. Human verification

I approved the architecture before any project files were written, and I did not change the planning decisions above.

After implementation, I tested the running API myself with PowerShell:

- POST successfully created an application.
- GET retrieved the created application.
- PATCH updated the status to `interview_scheduled` and set `interview_date`.
- Removing `interview_date` returned HTTP 400.
- The upcoming-interviews endpoint returned the scheduled application.
- GET for a nonexistent id returned HTTP 404.
- The rejected PATCH did not modify the stored record.

I also ran the automated suite at that stage: 17 passed, 0 failed, in about 867 ms.

## 6. Automated testing

`npm test` runs `node --test`. Each test uses its own temporary SQLite file, then closes the database and deletes the file. The tests do not use the manual `data/applications.db` file.

The suite initially covered the 17 cases I had requested. After the HTTP 413 fix below, the latest reported run was 18 passed and 0 failed.

## 7. Code review and debugging

During AI-assisted code review, an oversized JSON request returned HTTP 500 and printed a parser stack trace. The original 17 tests did not cover that path.

Cursor with Grok 4.7 changed the error handler so this case returns HTTP 413 with `{"error":"Request body is too large"}`, and added a regression test. The latest reported automated result after that change was 18 passed, 0 failed.

I have not recorded a separate manual retest of the oversized request.

## 8. Approximate development time

My estimated total development time was approximately 3 hours. This included planning and defining requirements, reviewing the proposed architecture, AI-assisted implementation using Cursor and Grok 4.7, manual API testing using PowerShell, automated testing and code review, debugging, and documentation.

## 9. Draft reflection for personal review

This draft is for my review. It is not my final reflection.

AI shortened the path from an approved design to a running API and a test suite. My judgment was still needed to set the requirements, approve the architecture before coding, and check the real API responses. The HTTP 413 result is a useful reminder that a passing test run does not prove every error path. I would rely on AI to draft and execute, and I would keep the decisions about scope, correctness, and what is ready to submit.
