# Navigation Auth State — Northwest Kingdom

This document explains how the site determines which nav to display, how roles are detected, and how to diagnose nav issues.

---

## How it works

### Auth states

| State | Condition | Top nav | Left nav |
|---|---|---|---|
| `public` | Not logged in | Home, Public Documents, About NWK, Member Login | Public Reference section |
| `member` | Logged in with a member role | Home, Dashboard, Profile, Log Out | Full member section nav |
| `admin` | Logged in with an admin role | Home, Dashboard, Admin, Profile, Log Out | Member nav + Admin section |
| `no-role` | Logged in but no valid role assigned | Home, Public Documents, About NWK, Log Out | Public content only |

The state `no-role` means the account was created and confirmed but a role has not been assigned in the Netlify Identity dashboard yet.

### Valid member roles

Any of the following `app_metadata.roles` values grant member nav access:
- `member`
- `records-steward`
- `content-maintainer`

### Valid admin roles

Any of the following grant admin nav access (which includes member access):
- `admin`
- `technical-admin`

---

## Where roles must be assigned

**Netlify dashboard → Identity → Users → select user → App metadata**

Set to one of:
```json
{"roles": ["member"]}
```
```json
{"roles": ["admin"]}
```

**Important:** Setting a value in "User metadata" has NO effect on nav rendering or route access control. It must be in "App metadata."

The user must log out and log back in after a role change for the new JWT to take effect.

---

## How nav is rendered

`components.js` exposes `window.NWK.updateNav(user)`. It is called:

1. **On page load** by `components.js` immediately with `null` (shows public nav while identity initialises)
2. **On `init` event** by `identity.js` with the verified current user — this is what makes returning authenticated users see the correct nav on any page
3. **On `login` event** by `identity.js` with the new user
4. **On `logout` event** by `identity.js` with `null`

`updateNav(user)` does:
1. Determines auth section (`getAuthSection(user)`)
2. Sets body classes: `auth-public`, `auth-member`, `auth-admin`, or `auth-no-role`
3. Injects `<aside id="site-left-nav">` inside a `.site-body` wrapper if not already present
4. Loads the correct top nav component into `#site-nav`
5. Loads the correct left nav component into `#site-left-nav`
6. Applies nav bar colour (`nav--member`, `nav--admin`)
7. Marks active links (`aria-current="page"`)
8. Wires up mobile toggle buttons

### Pages that suppress left nav injection

Pages with `data-no-sidenav="true"` on `<body>` do not get the left nav injected.
Currently: all `/login/` pages and `/access-denied/`.

---

## Nav component files

| File | Used for |
|---|---|
| `assets/components/nav-public.html` | Unauthenticated top nav |
| `assets/components/nav-member.html` | Member top nav |
| `assets/components/nav-admin.html` | Admin top nav |
| `assets/components/nav-no-role.html` | Logged-in but no role — top nav |
| `assets/components/nav-left-public.html` | Public left nav |
| `assets/components/nav-left-member.html` | Member left nav |
| `assets/components/nav-left-admin.html` | Admin left nav |

---

## Testing nav state

### On the deployed site

Open the browser console on any page and run:

```js
// Check if identity widget loaded
typeof netlifyIdentity           // should be "object"

// Check current user
netlifyIdentity.currentUser()    // returns user object or null

// Check roles
var u = netlifyIdentity.currentUser();
u && u.app_metadata && u.app_metadata.roles   // ["member"] or ["admin"] etc.

// Check which auth section the site calculated
document.body.className          // should include auth-member or auth-admin
```

### Manual test sequence

1. **Logged out:** visit `/` → top nav shows "Member Login", left nav shows public links
2. **Log in** at `/login/` → modal opens, modal closes, redirect to `/member/dashboard/`
3. **On dashboard:** top nav shows "Dashboard / Profile / Log Out", left nav shows member sections
4. **Navigate to homepage** (`/`) → top nav should still show member nav (auth-aware update)
5. **Navigate to `/admin/`** → admin nav should show if role is `admin`
6. **Log out** → top nav returns to public nav on the next page
7. **Direct visit to `/member/dashboard/` while logged out** → redirected to `/login/`
8. **Log in as `member` role user, visit `/admin/`** → redirected to `/access-denied/`

---

## Troubleshooting

### Nav does not change after login

1. Open console: `typeof netlifyIdentity` — should be `"object"`
2. Check: `netlifyIdentity.currentUser()` — returns user?
3. Check: `window.NWK && window.NWK.updateNav` — should be a function
4. Check body class: `document.body.className` — does it include `auth-member` or `auth-admin`?
5. If body class is wrong: role may not be in `app_metadata.roles`
6. Check the Network tab for failed fetch requests to nav component URLs

### Left nav does not appear

1. Check: `document.getElementById('site-left-nav')` — returns element?
2. If null: check that the page does not have `data-no-sidenav="true"` on `<body>`
3. Check: `document.getElementById('main-content')` — does it exist? (required for injection)
4. Check console for errors from `components.js`

### Member nav shows on admin page but admin nav does not

Role is `member` not `admin`. Check `app_metadata.roles` in the Netlify dashboard and update to `["admin"]`.

### Login works but all pages still show public nav

The `identity.js` `init` event handler updates nav on every page. If this is not happening:
1. Check that `identity.js` is loaded on the page (Network tab)
2. Check console for JS errors in `identity.js`
3. Check that `window.NWK.updateNav` is defined (set by `components.js`)
4. Check load order: `components.js` must load before `identity.js`

---

## Security note

Body classes (`auth-member`, `auth-admin`, `nav-has-sidebar`) are **UI state only**.
They do not grant or restrict access. Route protection is handled by `netlify.toml`
redirect rules that check JWT roles at the CDN level.

Never rely on nav visibility or body classes to protect content.
