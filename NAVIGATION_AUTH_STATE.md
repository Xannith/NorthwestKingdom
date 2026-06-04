# Navigation Auth State — Northwest Kingdom

---

## Why nav wasn't persisting across pages (root cause)

The identity widget was loaded **asynchronously** on pages that didn't have it in `<head>`. The widget fires its `init` event immediately upon initialization (reading the user from localStorage — no network call needed for a valid token). The previous implementation registered `on('init', ...)` via a 50ms polling loop. By the time the poll tick ran and registered the handler, `init` had already fired. The handler was registered but never called. The nav stayed public forever on page navigation.

**The fix:** When the widget is detected (via polling OR immediately), call `netlifyIdentity.currentUser()` right away and render the nav based on that result — without waiting for the `init` event. `currentUser()` returns the same user that `init` would have provided, because `init` already completed and set the internal state. The `on('init', ...)` handler still runs as a verification pass in case the token was expired.

**Secondary fix:** Nav is now rendered from **inline JavaScript data arrays**, not fetched HTML fragments. `updateNav()` is fully synchronous — no async fetch, no timing races, no ordering dependencies.

---

## Boot sequence (every page)

```
1. DOMContentLoaded fires
2. components.js init() runs
3. updateNav(null) → public nav rendered immediately (no blank state)
4. loadHTML('#site-header', ...) → async, independent
5. loadHTML('#site-footer', ...) → async, independent
6. loadIdentityWidget() → adds async <script> if not already present
7. pollForIdentity() → detects widget (immediately if in <head>, or via 50ms poll)
8. onWidgetReady():
   a. registerIdentityHandlers() → registers on('init'), on('login'), on('logout')
   b. currentUser() → get user from widget internal state
   c. updateNav(user) → SYNCHRONOUSLY renders correct member/admin nav
9. on('init', user) → fires when Netlify verifies token → updateNav(user) again
   (corrects nav if localStorage was stale; no-op if already correct)
```

On the **homepage** and **login page**, the identity widget is in `<head>` as a blocking script. Step 7 happens immediately (no polling needed). `currentUser()` is available right away.

On **all other pages**, the widget is loaded dynamically (step 6). The poll detects it typically within 50–300ms. There is a brief flash of public nav (steps 3→8c) but the final state is always correct.

---

## Script responsibilities

| Script | Owns |
|---|---|
| `components.js` | All nav rendering, all identity event handlers (init/login/logout), left nav injection, logout button click handler, header/footer loading |
| `identity.js` | Login-page modal auto-open, post-login redirect, loop detection for role-blocked users |

`identity.js` does NOT call `NWK.updateNav()`. `components.js` handles all nav updates.

`identity.js` is only needed on pages with login-specific logic:
- `index.html` (invite flow lands here)
- `login/index.html`
- `member/dashboard/index.html`
- `admin/index.html`
- `access-denied/index.html`

All other pages only need `components.js`.

---

## Auth states and nav content

| State | Trigger | Top nav | Left nav |
|---|---|---|---|
| `public` | No user | Home, Public Documents, About NWK, Member Login | Public Reference section |
| `member` | `app_metadata.roles` includes `member`, `records-steward`, or `content-maintainer` | Home, Dashboard, Profile, Log Out | Full member sections |
| `admin` | Roles include `admin` or `technical-admin` | Home, Dashboard, Admin, Profile, Log Out | Member sections + Admin section |
| `no-role` | User exists, roles empty or missing | Home, Public Documents, About NWK, Log Out | Access info + public reference |

---

## Role assignment (Netlify dashboard)

**Identity → Users → select user → App metadata** (NOT User metadata):

```json
{"roles": ["admin"]}
```
or
```json
{"roles": ["member"]}
```

User must log out and back in for the new JWT to reflect the updated role.

---

## Pages that suppress left nav

Pages with `data-no-sidenav="true"` on `<body>` do not receive the left nav injection:
- All `/login/` pages
- `/access-denied/`

All other pages get the left nav automatically.

---

## Browser console verification

```js
// components.js loaded
typeof NWK                      // "object"
typeof NWK.updateNav            // "function"

// Identity widget loaded
typeof netlifyIdentity          // "object"

// Current user (when logged in)
netlifyIdentity.currentUser()   // user object or null

// Roles
var u = netlifyIdentity.currentUser()
u?.app_metadata?.roles          // ["admin"] or ["member"] etc.

// Left nav present
document.getElementById('site-left-nav')   // <aside> or null

// Auth state on body
document.body.className  // includes "auth-member" or "auth-admin"

// Manually re-render (force nav update)
NWK.updateNav(netlifyIdentity.currentUser())

// Enable debug logging
localStorage.setItem('nwk_debug', '1')   // then refresh
localStorage.removeItem('nwk_debug')     // to disable
```

---

## Troubleshooting

### Nav stays public after login

1. `NWK.updateNav(netlifyIdentity.currentUser())` in console — does nav change?
2. If yes: timing issue — the init event may have fired and corrected. Try page refresh.
3. If no: check `netlifyIdentity.currentUser()?.app_metadata?.roles` — is the role set correctly?
4. Role must be in **App metadata** (not User metadata).
5. User must log out and back in after role assignment.

### Left nav does not appear

1. `document.getElementById('site-left-nav')` — is it null?
2. If null: does the page have `data-no-sidenav="true"`? That suppresses injection.
3. `document.getElementById('main-content')` — must exist for injection.
4. Enable debug: `localStorage.setItem('nwk_debug','1')` then refresh. Check console.

### Login works but nav briefly shows public then switches

This is expected on pages without the identity widget in `<head>`. The widget takes ~50–300ms to load. During that time, the public nav is shown as the default. Once the widget is ready, `currentUser()` is called and the nav updates. The flash is brief.

To eliminate the flash on a specific page, add the identity widget to its `<head>`:
```html
<script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>
```

### Role-based redirects fail (/member/* accessible without login)

1. Confirm Identity is **enabled** in Netlify dashboard.
2. Confirm `netlify.toml` redirect rules are in the deployed version (Deploys → latest).
3. Role-based redirects only work on the **deployed Netlify site**, not locally.
4. Use `netlify dev` for local testing with Identity.

---

## Security note

`auth-member`, `auth-admin`, and `nav-has-sidebar` body classes are **UI state only**.
Actual route protection is enforced by Netlify CDN redirect rules in `netlify.toml`.
Do not rely on nav visibility to protect content.
