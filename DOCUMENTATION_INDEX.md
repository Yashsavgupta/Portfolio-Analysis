# Documentation Index

This repository had several overlapping docs over time. The files below are the current source of truth.

## Read These First

1. [README.md](README.md)
   Project overview, quick start, routes, and production notes.

2. [SETUP_GUIDE.md](SETUP_GUIDE.md)
   Full local setup, environment variables, run commands, import flow, and troubleshooting.

3. [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
   Commands, URLs, smoke tests, and reset tasks.

4. [VERIFICATION_CHECKLIST.md](VERIFICATION_CHECKLIST.md)
   The practical checklist to confirm the repo is healthy before shipping or handing off.

## Focused Docs

5. [backend/README.md](backend/README.md)
   Backend-only runbook, migrations, and endpoint overview.

6. [DASHBOARD_METRICS_REFERENCE.md](DASHBOARD_METRICS_REFERENCE.md)
   Financial attributes shown in the dashboard and the formulas or sources behind each one.

7. [HOLDINGS_UPLOAD_FEATURE.md](HOLDINGS_UPLOAD_FEATURE.md)
   Import pipeline, parser assumptions, analytics endpoints, and upload caveats.

## Architecture and Status

8. [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
   Current architecture, routes, services, and data flow.

9. [PROJECT_COMPLETION_REPORT.md](PROJECT_COMPLETION_REPORT.md)
   Delivery status, verified checks, and remaining follow-ups.

## How to Use This Doc Set

### If you want to run the app locally

- Start with [README.md](README.md)
- Follow [SETUP_GUIDE.md](SETUP_GUIDE.md)
- Use [QUICK_REFERENCE.md](QUICK_REFERENCE.md) while working

### If you want to verify the repo before release

- Use [VERIFICATION_CHECKLIST.md](VERIFICATION_CHECKLIST.md)
- Check the build and lint commands in [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
- Review metric formulas in [DASHBOARD_METRICS_REFERENCE.md](DASHBOARD_METRICS_REFERENCE.md)
- Review current caveats in [PROJECT_COMPLETION_REPORT.md](PROJECT_COMPLETION_REPORT.md)

### If you want to work on the backend

- Read [backend/README.md](backend/README.md)
- Review [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)

### If you want to touch the import flow

- Read [HOLDINGS_UPLOAD_FEATURE.md](HOLDINGS_UPLOAD_FEATURE.md)
- Then review `backend/app/services/excel_parser.py` and `frontend/components/holdings/HoldingsUpload.tsx`

## Notes on Older Files

- `SESSION_COMPLETION_GUIDE.md` and similar long-form handoff docs are kept for history, but they are not the primary operating docs anymore.
- When documentation conflicts, prefer the files listed in the "Read These First" section.
