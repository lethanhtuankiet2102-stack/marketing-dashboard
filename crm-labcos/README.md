# Labcos CRM on Vercel

This Next.js application contains the Marketing and Sale dashboard previously hosted in Sites. The original dashboard at the repository root is kept intact; set the Vercel project's Root Directory to `crm-labcos` when ready to switch the live domain.

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

Report data in `labcos/google-ads-summary.json`, `labcos/sale-performance.json`, `labcos/sale-lead-report.json`, and monthly `labcos/google-ads-YYYY-MM.json` must be imported into the private store before their panels show historical values. These files can contain customer and business data; keep them out of this public repository.

## Development

From this directory, run `pnpm install --ignore-workspace` and `pnpm build`. The Vercel project uses the same isolated install command. Never commit `.env` files or downloaded reports.
