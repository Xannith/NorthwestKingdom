# Document Conversion Plan — Northwest Kingdom

This document explains how to add PDFs and searchable HTML versions of documents to the NWK site.
Follow this plan to ensure documents land in the right place, with the right access level, and are not accidentally exposed publicly.

---

## Access levels

Every document must be assigned one of three access levels:

| Level | Where to store | Who can access |
|---|---|---|
| Public | `/governance/pdf/` or `/assets/documents/` | Anyone |
| Member | Protected member storage (not in public static folders) | Authenticated members only |
| Admin | Admin-only storage | Admins only |

**Critical:** Do not upload private documents to any public folder. The entire repository is publicly accessible on the deployed site unless Netlify access controls are configured.

---

## Documents to upload first (public)

These three documents are publicly accessible and already have PDF and HTML versions in the repo:

| Document | PDF | HTML | Status |
|---|---|---|---|
| Articles of Incorporation | `/governance/pdf/MLC-Articles-of-Incorporation.pdf` | `/governance/articles-of-incorporation.html` | HTML Available (OCR) |
| Covenants and Restrictions | `/governance/pdf/Covenants-and-Restrictions.pdf` | `/governance/covenants-and-restrictions.html` | HTML Available (OCR) |
| Bylaws | `/governance/pdf/ByLaws.pdf` | `/governance/bylaws.html` | HTML Available (OCR) |

**Next steps for public documents:**
- Proofread HTML versions (OCR — may contain errors)
- Update status from "Needs Review" to "Available" on document pages after proofreading
- Update "Last reviewed" date on document cards

---

## Documents to upload later (member-only)

These categories of documents should go in the member archives. **Do not upload them to public static folders until real authentication is in place.**

### Council Business
- TC meeting agendas
- TC approved minutes
- TC action/decision summaries
- Monthly packets

**Naming pattern:** `mlc-tc-YYYYMM-[type].pdf`
- Examples: `mlc-tc-202403-agenda.pdf`, `mlc-tc-202403-minutes.pdf`
- Store in: `/member/archives/council-business/` (with auth protection)
- Search index: Member-only

### Alternate Current
- Newsletter issues going back to 1973
- New issues as they are published

**Naming pattern:** `alternate-current-YYYY-MM.pdf` or `alternate-current-YYYY-NN.pdf` (issue number)
- Examples: `alternate-current-2024-03.pdf`, `alternate-current-1973-01.pdf`
- Store in: `/member/archives/alternate-current/` (with auth protection)
- Search index: Member-only

### NWK Internal Documents
- Meeting notes
- Proposals
- Decision logs
- Operating documents

**Naming pattern:** `nwk-[type]-YYYYMMDD.pdf`
- Examples: `nwk-meeting-notes-20240315.pdf`, `nwk-proposal-20240401.pdf`
- Store in: `/member/documents/` (with auth protection)
- Search index: Member-only

---

## Document status labels

Use these labels on document pages and in the admin PDF Conversion Queue:

| Label | Meaning |
|---|---|
| `Available` | PDF and HTML both reviewed and ready |
| `HTML Available` | HTML version exists (may still need proofreading) |
| `PDF Only` | PDF exists but no HTML conversion yet |
| `Needs Upload` | Document not yet in the system |
| `Needs Conversion` | PDF uploaded, HTML conversion needed |
| `Needs Review` | Conversion done, needs human proofreading |
| `Coming Soon` | Planned but not yet started |
| `Member Only` | Accessible to members only |
| `Admin Only` | Accessible to admins only |

---

## How to convert a PDF to searchable HTML

For scanned PDFs (most historical documents):

1. Use an OCR tool: Adobe Acrobat, Tesseract, or an online OCR service
2. Export to plain text or HTML
3. Clean up the output — OCR often introduces errors, especially with older scans
4. Format as a clean HTML document following the site's page template
5. Add the OCR caveat notice: "This is an OCR conversion — proofread before relying on specific wording."
6. Link to both the HTML version and the original PDF from the document page
7. Set status to `Needs Review`
8. After proofreading, update status to `HTML Available` or `Available`

For text-based PDFs (newer documents):

1. Copy text directly from the PDF
2. Format as clean HTML following the site's page template
3. Review against the PDF to confirm accuracy
4. Set status to `HTML Available`

---

## How to capture document metadata

For each document, record:

```
Title:
Document type: [agenda / minutes / policy / newsletter / historical / other]
Date:
Access level: [public / member / admin]
PDF filename:
HTML filename:
Source:
OCR: [yes / no]
Last reviewed: [date or "not yet reviewed"]
Status: [see labels above]
Notes:
```

---

## How to keep public and member indexes separate

**Public search index** — Must only include:
- The three core public documents
- Public pages (About NWK, Contact, FAQ, homepage)
- Do NOT include member documents, council business, Alternate Current, or internal records

**Member search index** — Will eventually include:
- Council business archive
- Alternate Current archive
- Member governance documents
- Operations records
- Projects

**Rule:** Before adding any document to a search index, confirm its access level. A document in the member search index must only be queryable through an authenticated session.

---

## PDF storage and naming conventions

| Category | Folder | Naming pattern | Example |
|---|---|---|---|
| Public core documents | `/governance/pdf/` | Descriptive name | `MLC-Articles-of-Incorporation.pdf` |
| Council business | Member-protected storage | `mlc-tc-YYYYMM-type.pdf` | `mlc-tc-202403-minutes.pdf` |
| Alternate Current | Member-protected storage | `alternate-current-YYYY-MM.pdf` | `alternate-current-2024-03.pdf` |
| NWK internal | Member-protected storage | `nwk-type-YYYYMMDD.pdf` | `nwk-meeting-notes-20240315.pdf` |

---

## What to do next

Priority order for document work:

1. **Proofread the three public HTML documents** (Articles, C&R, Bylaws) — they are OCR conversions with potential errors
2. **Gather Alternate Current issues** — start with recent years, work backward
3. **Gather TC agendas and minutes** — start with recent years
4. **Set up authentication** before uploading any member-only materials to the live site
5. **Upload member materials** only after authentication is in place
6. **Build member search index** after materials are uploaded and HTML versions are ready
