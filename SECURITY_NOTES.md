# Security Notes — Northwest Kingdom Site

**Authentication status: Not yet implemented.**

This document describes the access model, known limitations, and requirements that must be in place before any real member or private data is added to this site.

---

## Public access model

The following content is designed for public access:

- `/` — Homepage
- `/public-documents/` — Public Documents landing page
- `/public/mlc-reference/governing-documents/articles-of-incorporation.html` — Articles of Incorporation (reference)
- `/public/mlc-reference/governing-documents/covenants-and-restrictions.html` — Covenants and Restrictions (reference)
- `/public/mlc-reference/governing-documents/bylaws.html` — Bylaws (reference)
- `/governance/articles-of-incorporation.html` — HTML version (OCR)
- `/governance/covenants-and-restrictions.html` — HTML version (OCR)
- `/governance/bylaws.html` — HTML version (OCR)
- `/governance/pdf/` — PDFs of the three core documents
- `/public/about-nwk.html` — About NWK
- `/public/contact.html` — Contact
- `/public/faq.html` — FAQ
- `/login/` — Login forms (the forms themselves, not submitted data)
- `CNAME`, `README.md`, and other repo metadata

**Only the three core documents (Articles of Incorporation, Covenants and Restrictions, Bylaws) are intentionally public by default.** All other MLC documents, policies, and records are member-only or admin-only unless specifically approved for public access.

---

## Member and admin areas — current state

All `/member/` and `/admin/` pages are **scaffolds** with no real data. They display an explicit `auth-gate` notice that authentication is not yet implemented.

**Critical requirements before any real member data is added:**

1. **Real authentication** — Do not add private member data, contact information, household records, governance working documents, or internal records until a real authentication provider is in place (e.g., Netlify Identity, Supabase Auth, Firebase Authentication, or Auth0).

2. **Server-side access control** — Static HTML files cannot enforce access control on their own. A serverless function, edge middleware, or backend must intercept requests to `/member/` and `/admin/` paths before real data is added.

3. **No private files in public static folders** — Do not upload private PDFs, contact lists, household data, or restricted documents to any publicly accessible path. Private materials belong in a protected storage location only accessible through authenticated requests.

4. **Separate search indexes** — The public search index must not include member or admin content. The member search index must require authentication to query. These must be built and maintained as separate indexes.

5. **No secrets in client-side code** — API keys, tokens, and credentials must never appear in HTML, JavaScript, or any file committed to the repository. Use environment variables (e.g., Netlify environment variables) for secrets.

---

## Navigation security model

The navigation system uses `data-section="public|member|admin"` on `<body>` to load the appropriate nav component. This is a **display-only** separation — it does not enforce access control.

- Anyone who knows a URL can access any page in the current scaffold.
- The `auth-gate` notice on member and admin pages is informational only.
- Do not rely on hidden links or nav structure as security.

---

## What is safe to deploy publicly right now

- The three core governing documents (HTML + PDF)
- Public information pages (About NWK, Contact, FAQ)
- Login form scaffolds
- Navigation and layout scaffolding
- Photo submission form (Netlify Forms — submissions go to Netlify dashboard only)

---

## What must not be deployed publicly

- Private contact information or email addresses
- Household directories or residency records
- Internal governance working documents, draft policies, or discussion records
- Member-only financial records
- Private photos not cleared for public display
- Any document not explicitly approved for public access

---

## Recommended authentication providers

- **Netlify Identity** — Works well with static sites on Netlify. Supports role-based redirect rules.
- **Supabase Auth** — Open source, PostgreSQL backend, generous free tier.
- **Firebase Authentication** — Google-managed, 5GB storage free tier.
- **Auth0** — Flexible, well-documented, has a free tier.

---

## Access roles defined in site architecture

| Role | Scope |
|---|---|
| Public Visitor | All `/` and `/public/` pages, public documents |
| NWK Member | All `/member/` pages plus public |
| Content Maintainer | Can submit and edit content for review |
| Records Steward | Full access to governance records and archive |
| Technical Administrator | Full member + admin access |
| Admin | Full site access including `/admin/` |

---

## Handoff checklist

When handing off technical administration:

- [ ] Document hosting provider and account credentials (secure offline location)
- [ ] Document domain registrar and DNS settings
- [ ] Document GitHub repository access and deployment model
- [ ] Document authentication provider configuration (when implemented)
- [ ] Document search index configuration and rebuild process (when implemented)
- [ ] Document backup schedule, storage, and restoration steps
- [ ] Test that the new Technical Administrator can deploy before completing handoff

---

*This file is part of the site repository and is publicly readable. It does not contain secrets. Keep credentials, API keys, and passwords out of this file and out of the repository.*
