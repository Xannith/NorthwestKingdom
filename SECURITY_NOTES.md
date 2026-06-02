# Security Notes — Northwest Kingdom Site

**Status: Authentication not yet implemented.**

This document describes the authentication and access control architecture that must be in place before the member and admin areas of this site contain real data.

---

## Current state

All member and admin pages are currently **scaffolds** — placeholder HTML files with no real data. They display an explicit notice that authentication is not implemented.

No actual member records, contact information, household data, governance documents, or sensitive content has been placed in these pages or in any public-facing asset directory.

---

## Required before adding real member content

Before any real member data, contact information, private documents, or governance records are added to the site, the following must be in place:

### 1. Real authentication provider

Do not implement authentication with a custom username/password system unless you have a qualified developer and a security review process. Instead, use a trusted provider:

- **Recommended options:**
  - [Netlify Identity](https://docs.netlify.com/visitor-access/identity/) (works well with static sites hosted on Netlify)
  - [Supabase Auth](https://supabase.com/docs/guides/auth) (open source, PostgreSQL backend)
  - [Firebase Authentication](https://firebase.google.com/docs/auth) (Google-managed, generous free tier)
  - [Auth0](https://auth0.com) (flexible, well-documented, has a free tier)
  - A custom backend with a server-side session system if a developer is available

- The login form at `/login/index.html` is already scaffolded. The `form` element's `action` attribute must be wired to the authentication provider.

### 2. Server-side access control

Static HTML files **cannot enforce access control on their own.** If the site is hosted as a static site, a serverless function, edge middleware, or a backend must intercept requests to `/member/` and `/admin/` paths and verify authentication before serving the page.

- **GitHub Pages** does not support server-side access control. If using GitHub Pages for production, a separate backend or edge function layer is required.
- **Netlify** supports [role-based redirect rules](https://docs.netlify.com/visitor-access/identity/role-based-access-control/) with Netlify Identity.
- **Vercel** supports [middleware](https://vercel.com/docs/edge-network/middleware) that can check session tokens before serving pages.
- A custom server (VPS with nginx/Apache + a backend) has full control.

### 3. Access roles

The following roles are defined in the site architecture:

| Role                  | Scope                                             |
|-----------------------|---------------------------------------------------|
| Public Visitor        | All `/` and `/public/` pages                     |
| NWK Member            | All `/member/` pages plus public                 |
| TC Representative     | Member area plus TC representation tools         |
| Content Maintainer    | Can submit and edit content for review           |
| Records Steward       | Full access to governance records and archive    |
| Technical Administrator | Full member + admin access                    |
| Admin                 | Full site access including `/admin/`             |

Role assignments are managed in `/admin/access-roles/`.

### 4. Separate search indexes

The site architecture defines three search indexes:

- **Public search** — indexes only public-facing pages and the Alternate Current archive
- **Member search** — indexes member-area content, only accessible to authenticated members
- **Admin search** — indexes all site content, only accessible to admins

**Critical requirement:** Private content, contact information, household records, and internal documents must never appear in the public search index.

When a real search system is implemented (e.g., Algolia, Pagefind, a custom index), each index must be built from only the appropriate content subset, and the member/admin indexes must require authentication to query.

### 5. Sensitive content in assets

The following directories must **never** contain files that are publicly accessible without authentication:

- `assets/protected/` — reserved for files that require auth
- `assets/uploads/` — user-submitted files pending review
- Any member-only documents, household directories, contact lists, or private governance records

If the site is hosted as a static site, these directories must be blocked from public access at the server/CDN level, or documents must be stored behind a separate authenticated file service.

---

## What is safe to publish publicly right now

The following content is designed for public access and does not require authentication:

- Everything in `/` (homepage, public nav)
- Everything in `/public/` (calendar, Alternate Current, MLC reference, photos, about, contact, FAQ)
- Everything in `/login/` (login forms, request access — the forms themselves, not submitted data)
- The `CNAME` file, `README.md`, and other repo metadata

---

## Handoff checklist for Technical Administrator

When handing off technical administration:

- [ ] Document the hosting provider and account credentials in a secure, offline location
- [ ] Document the domain registrar and DNS settings
- [ ] Document the GitHub repository access and branch/deployment model
- [ ] Document the authentication provider configuration
- [ ] Document the search index configuration and rebuild process
- [ ] Document the backup schedule, storage location, and restoration steps
- [ ] Test that the new Technical Administrator can deploy a change before completing the handoff

---

*This file is part of the site repository and is publicly readable in the repo. It does not contain secrets. Keep credentials, API keys, and passwords out of this file and out of the repository.*
