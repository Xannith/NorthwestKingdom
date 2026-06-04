# Navigation Auth State — Northwest Kingdom

This document explains how the site determines which nav to display, how roles are detected, and how to diagnose nav issues.

---

## How it works

### Auth states

| State | Condition | Top nav | Left nav |
|---|---|---|---|
| `public` | Not logged in | Home, Public Documents, About NWK, Member Login | Public Reference |
| `member` | Logged in with a member role | Home, Dashboard, Profile, Log Out | Full member sections |
| `admin` | Logged in with an admin role | Home, Dashboard, Admin, Profile, Log Out | Member + Admin sections |
| `no-role` | Logged in but no valid role assigned | Home, Public Documents, About NWK, Log Out | Public content only |

### Valid member roles (`app_metadata.roles`)

`member`, `records-steward`, `content-maintainer`

### Valid admin roles (includes member access)

`admin`, `technical-admin`

---

## How nav is rendered — architecture

**`components.js` handles everything.** It is loaded on every page and is self-contained for nav rendering.

1. On `DOMContentLoaded`, loads the Netlify Identity Widget (or detects it if already in `<head>`)
2. Renders public nav immediately as default
3. Registers `on('init', ...)` — fires with the current user on every page; calls `updateNav(user)`
4. Registers `on('login', ...)` — calls `updateNav(user)` when user logs in
5. Registers `on('logout', ...)` — calls `updateNav(null)` and redirects to `/`
6. Registers `[data-logout]` click handler — calls `netlifyIdentity.logout()`

**`identity.js`** is only needed on pages with login-specific logic: auto-open modal, post-login redirect, loop detection. It is NOT responsible for nav updates.

**Left nav injection:** `components.js` calls `ensureLeftNav()` in every `updateNav()` call. It:
- Creates `<aside id="site-left-nav">` if not present
- Wraps `<main id="main-content">` in `<div class="site-body">` if needed
- Skips injection on pages with `data-no-sidenav="true"` on `<body>`

Pages with `data-no-sidenav="true"` (no left nav): all `/login/` pages and `/access-denied/`.

---

## Where roles must be assigned

**Netlify dashboard → Identity → Users → select user → App metadata**

```json
{"roles": ["admin"]}
```
or
```json
{"roles": ["member"]}
```

**`user_metadata` has NO effect.** Only `app_metadata.roles` is checked.

User must log out and log back in after a role change.

---

## CSS note

The left nav uses `id="site-left-nav"` and `.left-nav` CSS classes.
There is also a `.sidebar-nav` class in `styles.css` for an older in-page section nav pattern — these are different things. Use `#site-left-nav` and `.left-nav` to inspect the global left nav.

---

## Browser console checks

Enable debug logging first (optional but helpful):
```js
localStorage.setItem('nwk_debug', '1')
// then refresh the page
```

Then verify:
```js
// 1. components.js loaded
typeof NWK                          // "object"
typeof NWK.updateNav               // "function"

// 2. Identity widget loaded
typeof netlifyIdentity             // "object"

// 3. Current user
netlifyIdentity.currentUser()      // user object or null

// 4. User roles (must be in app_metadata)
var u = netlifyIdentity.currentUser()
u && u.app_metadata && u.app_metadata.roles   // ["admin"] etc.

// 5. Left nav container
document.getElementById('site-left-nav')      // <aside> element or null

// 6. Left nav content rendered
document.querySelector('.left-nav')            // <nav> element or null

// 7. Body auth class
document.body.className   // should include "auth-member" or "auth-admin"

// 8. Manually trigger nav update
NWK.updateNav(netlifyIdentity.currentUser())  // re-render nav for current user
```

Disable debug logging when done:
```js
localStorage.removeItem('nwk_debug')
```

---

## Testing nav state

### Expected UI by auth state

**Logged out (any page except login/access-denied):**
- Top nav: Home, Public Documents, About NWK, Member Login
- Left nav: Public Reference section (Public Documents, About NWK, Contact, Member Login)

**Logged in — member role:**
- Top nav: Home, Dashboard, Profile, Log Out
- Left nav: NWK, Governance, Operations, Projects, Archives sections
- No Admin section visible

**Logged in — admin role:**
- Top nav: Home, Dashboard, Admin, Profile, Log Out
- Left nav: All member sections + Admin section

**Logged in — no role assigned:**
- Top nav: Home, Public Documents, About NWK, Log Out
- Left nav: Public Reference section
- Member/admin sections NOT visible

### Test sequence on deployed site

1. Visit `/` logged out → public top nav + public left nav visible
2. Visit `/public-documents/` logged out → public top nav + public left nav visible
3. Log in at `/login/` → redirected to `/member/dashboard/`
4. On dashboard → member/admin top nav + member left nav visible
5. Click Home → still on homepage with member/admin nav (auth persists)
6. Navigate to `/admin/` → admin nav if role is admin
7. Log out → redirected to `/`, public nav returns
8. Visit `/member/dashboard/` while logged out → redirected to `/login/`
9. Visit `/admin/` while logged out → redirected to `/login/`

---

## Troubleshooting

### Left nav does not appear

1. `document.getElementById('site-left-nav')` — returns element?
2. If null: does the page have `data-no-sidenav="true"`? If yes, injection is suppressed intentionally.
3. `document.getElementById('main-content')` — returns element? Injection requires this.
4. Check console (enable debug logging) for `ensureLeftNav` messages.
5. Check Network tab for failed fetch to `/assets/components/nav-left-public.html`.

### Nav does not change after login

1. `typeof NWK` should be `"object"` — if not, `components.js` failed to load.
2. `typeof netlifyIdentity` should be `"object"` — if not, identity widget failed to load.
3. Enable debug logging and check console for `identity init event` message.
4. `netlifyIdentity.currentUser()` — returns user? If null, token may have expired.
5. `document.body.className` — includes `auth-member` or `auth-admin`? If not, `updateNav` may not have run.
6. Manually call `NWK.updateNav(netlifyIdentity.currentUser())` — does nav update?

### Roles seem correct but /member/* still redirects to login

1. Confirm role is in **App metadata**, not User metadata.
2. Log out and log back in (JWT must refresh to pick up new role).
3. In browser console: `netlifyIdentity.currentUser().app_metadata.roles` — shows `["admin"]`?
4. Check Netlify deploy logs for `netlify.toml` parse errors.
5. Confirm Identity is **enabled** in the dashboard.

### Old nav appears after a code update

Asset caching is the cause. `netlify.toml` now sets JS and component files to `must-revalidate` (not `immutable`). If you deployed the new config, users will get fresh JS on their next request.

For immediate fix: hard refresh (Ctrl+Shift+R / Cmd+Shift+R) in the browser.

---

## Security note

Body classes (`auth-member`, `auth-admin`, `nav-has-sidebar`) are **display state only**.
Route protection is handled by Netlify CDN redirect rules in `netlify.toml`. Never rely on nav visibility or body classes to protect content.
