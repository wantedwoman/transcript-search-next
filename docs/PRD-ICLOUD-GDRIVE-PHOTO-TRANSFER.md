# PRD: iCloud Shared Albums → Google Drive Photo Transfer

**Date:** May 4, 2026
**Status:** Active
**Operator:** Rashida (AI Agent)

## Objective
Transfer photos/videos from iCloud Shared Albums to matching numbered Google Drive folders with zero manual steps from Cass.

## Source: iCloud Shared Albums
Account: inspiremany@gmail.com
Access: Web browser (www.icloud.com/photos/#/sharedalbums/)
Albums to process:

| Album Name | → GDrive Folder | GDrive Folder ID |
|---|---|---|
| 1-UCR 2026 | Day 1 (April 29) | 1TzhVGK1Xq6WZoRw-AvwGknEml8Nv4QTq |
| 2- UCR 2026 | Day 2 (April 30) | 1vzq1wmPoC_Pl444n9xdYz88h-PKWMft9 |
| Broll Day 2 Ultimate couples retreat | Day 2 (April 30) | 1vzq1wmPoC_Pl444n9xdYz88h-PKWMft9 |
| Broll day 3 Ultimate couples retreat | Day 3 (May 1) | 1oSVWyL3K0mkABV4QOMbIdgun4_sO5LPD |
| Broll Ucr day 4 boat | Day 4 (May 2) | 1jQ1kgR10-CZhX0F79U2suzsAekD-x5IP |
| Day 4 shopping on cruise | Day 4 (May 2) | 1jQ1kgR10-CZhX0F79U2suzsAekD-x5IP |
| Day 4 exploring komombo temple | Day 4 (May 2) | 1jQ1kgR10-CZhX0F79U2suzsAekD-x5IP |
| 5- Ucr island tour | Day 5 (May 3) | 1iqEtQu09kC8HYC_lsZOW8DOA9czabR3i |
| Day 5 part 2 | Day 5 (May 3) | 1iqEtQu09kC8HYC_lsZOW8DOA9czabR3i |
| Broll day 5 Ucr beach | Day 5 (May 3) | 1iqEtQu09kC8HYC_lsZOW8DOA9czabR3i |
| 2026 Ucr Top photos | UCR misc | TBD |
| 2026 UCR Testimonials | UCR misc | TBD |
| Talking head | UCR misc | TBD |
| Ocean sounds | UCR misc | TBD |

## Destination: Google Drive
Account: inspiremany@gmail.com
Tool: `gog -a inspiremany@gmail.com drive upload [FILE] --parent [FOLDER_ID]`
Auth method: OAuth (already re-authorized)

## Process for Each Album

### Per-Photo Download Steps (via browser)
1. Navigate to album in iCloud Photos
2. **Click the photo/video thumbnail** to select/open it
3. Wait for the preview to load
4. **Click the 3 dots (⋯) menu** — typically appears in the top-right or bottom of the preview
5. **Click Download** from the menu
6. Wait for download to complete in ~/Downloads/
7. Note the filename

### Per-Photo Upload Steps
8. `gog -a inspiremany@gmail.com drive upload ~/Downloads/[FILENAME] --parent [FOLDER_ID]`
9. Verify upload completed

### Album Navigation
- To go to next album: Navigate back to shared albums list, click next album
- Continue until all albums processed

## Success Criteria
- All photos/videos from all listed albums uploaded to matching GDrive folders
- Files organized by day/date in GDrive
- No duplicate uploads within a folder

## Edge Cases
| Edge Case | Handling |
|---|---|
| Download fails | Retry once. If still fails, skip and log. |
| Upload fails | Log the filename and folder ID, skip, continue |
| File already exists in GDrive | Skip (don't overwrite) |
| Browser session expires | Re-navigate to icloud.com — Cass may need to re-login |
| Album has 0 items | Skip silently |
