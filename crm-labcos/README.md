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

## Designer workspace

The **Designer** tab displays tasks imported from the supplied `BRIEF DESIGN` sheet. The private dataset `labcos/designer.json` includes the level definitions and task defaults extracted from `KPI CONFIG 2026`. Workload points are derived from the dashboard override, then the workbook level, then the configured task-type default. Unknown mappings remain unscored. Periods follow source month headings; groups without a heading are marked unknown, and source dates are preserved.

Owners can grant existing or new users the **Designer** role under **Người dùng**. Designers may select/reset Complexity Level; other CRM writes remain owner-only. Role revocation and changes are checked against private user storage on every authenticated request. Level updates use conditional Blob writes and record timestamps to reject stale edits. Designer edits persist in dashboard storage; the original workbook is a source snapshot.

Owners can use **List Lead → Cập nhật từ Excel** to upload an `.xlsx` workbook under 4 MB. The `LEAD LIST` / `LIST LEAD` tab is parsed from July 2026 onward, and the complete lead list is replaced only after validation succeeds. Uploaded data and its update time are saved in private Blob storage. Manual upload mode reads this saved dataset rather than overwriting it with the Google download on the next poll. Viewers cannot upload. Invalid or empty workbooks leave existing data intact.

From this directory, run `pnpm install --ignore-workspace` and `pnpm build`. The Vercel project uses the same isolated install command. Never commit `.env` files or downloaded reports.

### Designer performance

Designer navigation contains Danh sách task and Hiệu suất. Task source is inferred from the existing platform column: values containing PHÁT SINH (case/accent/whitespace insensitive) are emergent; other nonempty values are planned; empty values remain unknown. There are no manual Designer or task-source columns. Any legacy assignment/source fields are ignored. Only complexity levels are editable.

Performance uses the same private task dataset and KPI level mapping. Completion = DONE task count / filtered task count; advanced workload = L3–L5 points / all scored points. Average points = scored points / all filtered tasks, with an explicit notice for unscored tasks. Monthly trends use the selected month plus the two preceding calendar months and apply classification and inferred source filters. Unknown months are excluded from the calendar trend.

### Automatic private Google sync

Owner accounts can connect Google in Designer or List Lead. The app uses the existing `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` server environment variables. The OAuth client must be a Web application with the exact authorized redirect URI `https://marketing-dashboard-labcos.vercel.app/api/google-sync/callback`; enable Google Drive API and Google Sheets API. For a testing consent screen, allow the owner's Google account as a test user. Google testing grants can expire after seven days; use an appropriate production/internal consent configuration for a lasting connection.

The owner grants read-only Drive access once. The refresh token stays in private Blob and is never returned to the browser or committed. Only the two configured source files are fetched. `DESIGNER_SHEET_ID` and `LIST_LEAD_SHEET_ID` can override the known source IDs. Designer uses formatted cell values and hyperlinks from Sheets API, including KPI CONFIG 2026. List Lead downloads the existing Excel source stored on Drive; it does not require changing that file into a native Sheet or making it public.

Visible Designer and List Lead panels poll every minute and refresh on window focus. Server reads use at most a one-minute saved snapshot, so a new visitor also obtains current source data. This is pull sync while the CRM is in use; no background schedule runs when nobody is using it. Uploaded List Lead snapshots no longer block Google refresh. Source failures retain the prior data and display a warning. Designer levels are merged inside a conditional Blob update, preserving dashboard overrides only for a unique period/platform/task-name match, never by moving row position. Renamed or ambiguous tasks require review of their levels. Level selections are stored on CRM, not written back to the Google file.
