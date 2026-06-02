# Northwest Kingdom

Neighborhood information hub for Northwest Kingdom residents within the Miccosukee Land Co-op.

**Site purpose:** This is a neighborhood-maintained information hub for records, events, projects, documents, and community continuity. It is not the official website of the Miccosukee Land Co-op.

---

## Contents

- [Site purpose and framing](#site-purpose-and-framing)
- [Public vs. member vs. admin areas](#public-vs-member-vs-admin-areas)
- [Directory structure](#directory-structure)
- [Authentication](#authentication)
- [Search index separation](#search-index-separation)
- [Alternate Current archive](#alternate-current-archive)
- [NWK governance development model](#nwk-governance-development-model)
- [How to add a new page](#how-to-add-a-new-page)
- [How to run locally](#how-to-run-locally)
- [How to deploy](#how-to-deploy)

---

## Site purpose and framing

Northwest Kingdom is a neighborhood within the Miccosukee Land Co-op (MLC) in Leon County, Florida. This site organizes NWK's own records, events, projects, and institutional knowledge — separate from the MLC's own channels but operating within the MLC framework.

**This site:**
- Is maintained by Northwest Kingdom residents
- References MLC documents as the current governance framework for NWK
- Is structured to grow into a full neighborhood records and continuity system
- Is not the MLC's official website and does not speak for the MLC as a whole

---

## Public vs. member vs. admin areas

### Public (`/` and `/public/`)
Open to anyone. Includes:
- Homepage
- Calendar (upcoming community events)
- Alternate Current newsletter and archive
- MLC Reference documents
- Photos
- About NWK
- Login / request access

### Member (`/member/`)
Requires authentication. Includes:
- Dashboard
- NWK Hub (notices, announcements, directory, history)
- Governance (MLC framework, TC representation, NWK governance development, records)
- Operations (roads, drainage, maintenance, work parties, land stewardship)
- Projects (active, proposed, completed, deferred)
- Calendar (internal planning details)
- Documents (NWK documents, MLC reference copies, templates, forms)
- Search (member-only search index)
- Profile (account, household info, notification and privacy settings)

**Authentication is not yet implemented.** Member pages are scaffolds. See [SECURITY_NOTES.md](./SECURITY_NOTES.md).

### Admin (`/admin/`)
Requires administrator authentication. Includes:
- User management and access roles
- Content review and approval
- Document management
- Photo review
- Calendar approvals
- Alternate Current manager
- MLC reference manager
- Search index manager
- Backups
- Audit log

**Authentication is not yet implemented.** Admin pages are scaffolds. See [SECURITY_NOTES.md](./SECURITY_NOTES.md).

---

## Directory structure

```
NorthwestKingdom/
├── index.html                   Root homepage
├── SECURITY_NOTES.md            Auth architecture and requirements
├── README.md                    This file
│
├── assets/
│   ├── css/main.css             Single stylesheet (all styling)
│   ├── js/
│   │   ├── components.js        Shared component loader (header/nav/footer)
│   │   └── main.js              General utilities
│   ├── components/              Shared HTML fragments loaded by components.js
│   │   ├── site-header.html
│   │   ├── nav-public.html
│   │   ├── nav-member.html
│   │   ├── nav-admin.html
│   │   └── site-footer.html
│   ├── images/                  Public images
│   ├── documents/               Public documents
│   ├── ac-archive/              Alternate Current PDFs and cover images
│   │   └── covers/              Issue cover thumbnails (YYYY-MM.jpg)
│   ├── protected/               Files requiring authentication (never serve publicly)
│   └── uploads/                 Pending submissions (never serve publicly)
│
├── login/                       Login, request access, forgot password, account help
├── public/                      All publicly accessible pages
│   ├── about-nwk.html
│   ├── contact.html
│   ├── faq.html
│   ├── calendar/
│   ├── alternate-current/       AC hub, latest, archive, issues, search, topics
│   ├── mlc-reference/           MLC governing docs, links, community resources
│   └── photos/
│
├── member/                      Member-only pages (auth required)
│   ├── dashboard/
│   ├── nwk-hub/
│   ├── governance/
│   │   ├── current-mlc-framework/
│   │   ├── representation/
│   │   ├── nwk-governance-development/
│   │   └── records/
│   ├── operations/
│   ├── projects/
│   ├── calendar/
│   ├── documents/
│   ├── search/
│   └── profile/
│
├── admin/                       Admin-only pages (auth required)
│   ├── users/
│   ├── access-roles/
│   ├── content-review/
│   ├── calendar-approvals/
│   ├── document-management/
│   ├── photo-review/
│   ├── alternate-current-manager/
│   ├── mlc-reference-manager/
│   ├── search-index-manager/
│   ├── backups/
│   └── audit-log/
│
└── tools/
    └── generate-pages.py        Stub page generator (run from repo root)
```

---

## Authentication

**Current status: Not implemented.**

Member and admin pages are HTML scaffolds. No sensitive data should be placed in these pages until a real authentication system is in place.

See [SECURITY_NOTES.md](./SECURITY_NOTES.md) for:
- Recommended authentication providers
- Server-side access control requirements
- Role definitions
- Search index separation requirements
- Sensitive asset directory requirements
- Technical administrator handoff checklist

---

## Search index separation

Three search indexes are planned:

| Index    | Scope                         | Access required     |
|----------|-------------------------------|---------------------|
| Public   | `/public/` + AC archive       | None (public)       |
| Member   | `/member/` content            | Member login        |
| Admin    | Full site                     | Admin login         |

Private content, contact information, and internal documents must never appear in the public index.

Implementation options: [Pagefind](https://pagefind.app/) (static, build-time), [Algolia](https://www.algolia.com/) (hosted, API-based), or a custom backend query.

---

## Alternate Current archive

The Alternate Current is the NWK neighborhood newsletter. The public archive (`/public/alternate-current/`) is structured to support:

- A latest issue page with cover image, volume/issue metadata, PDF download, and optional HTML text version
- An archive index browseable by decade, year, topic, people, and event
- An issue-by-issue card grid with cover thumbnails
- Full-text search (future implementation)
- Approximately 25 issues per year going back to 1973

**To add a new issue:**

1. Place the PDF in `assets/ac-archive/YYYY-MM.pdf`
2. Place a cover image in `assets/ac-archive/covers/YYYY-MM.jpg` (approx. 8.5:11 aspect ratio)
3. Update `public/alternate-current/latest.html` with the issue card
4. Add the issue card to `public/alternate-current/archive/index.html`
5. Add an entry to `public/alternate-current/issues/index.html`
6. Update the search index if implemented

Issue metadata to track: title, volume, issue number, date, PDF path, cover image path, topics, permission status (public or member-only).

---

## NWK governance development model

The NWK governance development section (`/member/governance/nwk-governance-development/`) documents Northwest Kingdom's effort to organize itself clearly without creating unnecessary bureaucracy.

**Philosophy:** Preserve practical neighbor culture. Document enough to support continuity. Make responsibilities clear.

**Five roles:**

| Role                    | Primary responsibility                              |
|-------------------------|-----------------------------------------------------|
| Coordinator             | Coordination, communication, continuity             |
| Treasurer               | Finances and financial records                      |
| Bookkeeper              | Day-to-day financial record keeping                 |
| Records Steward         | Meeting notes, decisions, document versions, archive|
| Technical Administrator | Website, storage, forms, backups, publication       |

Role definitions are in `/member/governance/nwk-governance-development/roles-and-responsibilities/`.

These are proposed roles. They are not official policy until the neighborhood formally adopts them.

---

## How to add a new page

1. **Identify the section** the page belongs to: public, member, or admin.
2. **Create the HTML file** at the correct path. Use an existing page as a template.
3. **Key elements every page needs:**
   - `data-section="public|member|admin"` on the `<body>` tag
   - `<div id="site-header"></div>` — loaded by components.js
   - `<nav id="site-nav" ...></nav>` — loaded by components.js
   - `<div id="site-footer" ...></div>` — loaded by components.js
   - `<script src="/assets/js/components.js"></script>` before `</body>`
   - Breadcrumb navigation
   - Auth gate notice (for member/admin pages)
4. **Update navigation** if the page should appear in a nav bar: edit the appropriate file in `assets/components/`.
5. **Test locally** by serving the site from a web server (see below).

**To regenerate stub pages** (or add new ones to the catalog):

```bash
python3 tools/generate-pages.py
# Add --force to overwrite existing stubs
```

---

## How to run locally

The site uses `fetch()` to load shared header/nav/footer components. This requires a web server — it will not work by simply opening HTML files directly in a browser (`file://` protocol).

**Option 1: Python (built-in, no install needed)**
```bash
cd /path/to/NorthwestKingdom
python3 -m http.server 8080
# Open http://localhost:8080 in your browser
```

**Option 2: VS Code Live Server extension**
- Install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension
- Right-click `index.html` → "Open with Live Server"

**Option 3: Node.js (if installed)**
```bash
npx serve .
```

---

## How to deploy

### GitHub Pages (current hosting)

The repository is at `Xannith/NorthwestKingdom` on GitHub.

**To deploy updates:**
1. Commit and push changes to the `main` branch
2. GitHub Pages serves from the `main` branch root
3. Enable GitHub Pages in repository Settings → Pages → Source: Deploy from branch → `main` / `/ (root)`

**Custom domain:**
To serve from `northwestkingdom.com`:
1. Create a file named `CNAME` in the repository root containing only: `northwestkingdom.com`
2. Configure your domain registrar's DNS: add a CNAME record pointing `www` to `xannith.github.io`, and an A record for the apex domain pointing to GitHub Pages' IP addresses (see [GitHub Pages documentation](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site))
3. Enable HTTPS in repository Settings → Pages → Enforce HTTPS

**Important:** GitHub Pages does not support server-side access control. Member and admin areas will require a separate authentication layer before real data can be added. See [SECURITY_NOTES.md](./SECURITY_NOTES.md).

### Alternative hosts

Any static host that can serve from a directory root will work: Netlify, Vercel, Cloudflare Pages, a VPS with nginx. Netlify and Vercel both support edge middleware for authentication, which is a viable path to protecting member/admin areas without a full backend.

---

*This site is maintained by Northwest Kingdom residents. Questions about the site: contact the Technical Administrator.*
