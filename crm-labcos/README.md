# Labcos CRM on Vercel

This Next.js application contains the Marketing and Sale dashboard previously hosted in Sites. The Vercel project `marketing-dashboard-labcos` builds from `crm-labcos` and serves it at https://marketing-dashboard-labcos.vercel.app/. The previous dashboard's source remains at the repository root.

## Configuration

Set the following variables in Vercel project settings (Production, and Preview if needed):

| Variable | Purpose |
| --- | --- |
| `AUTH_USER` | Owner login email |
| `AUTH_PASS` | Owner login password |
| `AUTH_SESSION_SECRET` | Random signing secret, at least 24 characters |
| `BLOB_READ_WRITE_TOKEN` | Private Vercel Blob store linked to the project |
| `LIST_LEAD_SHEET_ID` | Source spreadsheet ID for live List Lead sync |
| `META_AD_ACCOUNT_ID` | Meta ad account ID, if using the Meta Ads panel |

Owner accounts can grant and revoke viewer accounts under **Phân quyền**. Viewer passwords are hashed before storage in the private Blob store. CRM edits, the List Lead cache, Meta access token, and report data are stored there instead of the Vercel function filesystem.

The private store has the July–August 2026 Google Ads reports, their overview, Sale Performance, Sale Lead Report, and a List Lead cache. The September Google Ads report is pending the source file. The live List Lead endpoint refreshes from the configured spreadsheet and falls back to its cache if the source is temporarily unavailable. The Meta Ads panel requires a fresh token connection by the owner because the previous Site's encrypted token cannot be exported. Report files can contain customer and business data; keep them out of this public repository.

## Development

From this directory, run `pnpm install --ignore-workspace` and `pnpm build`. The Vercel project uses the same isolated install command. Never commit `.env` files or downloaded reports.
