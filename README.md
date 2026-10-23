# DRAGON-X 120 Pattern Analysis API

Deploy on Vercel by importing this project from GitHub. It includes the existing 120-pattern historical analysis engine and routes.

## Endpoints
- `GET /api/patterns` - pattern catalog
- `GET /api/analyze?type=1M` - fetch and analyze WinGo 1-minute history
- `GET /api/analyze?type=30S` - fetch and analyze WinGo 30-second history

The history handler tries GET then POST on each configured upstream host, checks HTTP/content type, rejects HTML responses, and reports per-attempt diagnostics. If the upstream blocks the deployment host, code cannot guarantee access; use an authorized data source.

Analysis is descriptive historical statistics, not a reliable forecast of random future draws. `nextPeriod.issue` is a sequence estimate only, not a winning-result prediction.

Run tests: `npm test`
