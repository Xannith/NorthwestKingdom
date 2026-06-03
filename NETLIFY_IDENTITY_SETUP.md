# Netlify Identity Setup — Northwest Kingdom

This document covers the complete setup, role assignment, and troubleshooting process
for Netlify Identity on NorthwestKingdom.com.

---

## One-time dashboard setup

### Step 1 — Enable Identity

1. Netlify dashboard → Your site → **Site configuration** → **Identity**
2. Click **Enable Identity**

### Step 2 — Set registration to invite-only

1. Identity → **Registration preferences**
2. Set to **Invite only**
   This prevents anyone from self-registering. Accounts are created by invitation only.

### Step 3 — Configure the invite confirmation URL

By default, Netlify sends invite links to the site root (`https://northwestkingdom.com/#invite_token=...`).
The site handles tokens on the homepage, but for a better user experience, configure invites to go
directly to the login page:

1. Identity → **Email templates** → **Invite user**
2. Change the confirmation URL to:
   `https://northwestkingdom.com/login/#invite_token={{ .Token }}`

This ensures invite tokens land on `/login/` where the Identity Widget is loaded
as a blocking script and can process the token immediately.

---

## Inviting a member

1. Identity → **Invite users**
2. Enter the person's email address and click **Send invite**
3. The person receives an email with a confirmation link
4. They click the link, set a password, and their account is created

**After they accept the invite, you must assign them a role (see below).**
Without a role, they cannot access `/member/*` or `/admin/*`.

---

## Assigning roles — CRITICAL

### Important distinction

Netlify Identity has two separate metadata fields:

| Field | Who can edit | Used for access control? |
|---|---|---|
| **User metadata** | The user themselves | **No** |
| **App metadata** | Admins only | **Yes — this is what netlify.toml checks** |

The `netlify.toml` redirect conditions (`conditions = {Role = ["member", "admin"]}`)
check **`app_metadata.roles`** — not `user_metadata`.

**Setting a role in "User metadata" has no effect on access control.**

### How to assign a role correctly

1. Netlify dashboard → Identity → **Users**
2. Click on the user's name to open their record
3. Find the **App metadata** field (separate from User metadata)
4. Set it to one of the following:

   For a regular member:
   ```json
   {"roles": ["member"]}
   ```

   For an admin:
   ```json
   {"roles": ["admin"]}
   ```

   Admins automatically get member access too (the redirect rule allows `member` OR `admin`).

5. Click **Save**

The user must log out and log back in for the new role to take effect (the JWT must be refreshed).

---

## Verifying the widget loads

### In the browser console

Open the browser developer tools on the deployed site and type:

```js
typeof netlifyIdentity
```

Expected result: `"object"`

If you get `"undefined"`, the widget failed to load. Check:
- Network tab for errors loading `netlify-identity-widget.js`
- Whether the site is deployed on Netlify (Identity only works on Netlify-hosted sites, not locally)
- Whether Identity is enabled in the dashboard

### On the login page

1. Open `/login/`
2. Open DevTools → Console
3. The Netlify Identity modal should appear automatically
4. If it does not: type `netlifyIdentity.open('login')` in the console
5. If the modal opens from the console but not automatically, there may be a script loading issue

---

## Accepting an invite

1. Check your email for the invitation from Netlify
2. Click the confirmation link
3. You should land on `/login/` (if the email template is configured) or the homepage
4. A modal appears asking you to set a password
5. Set your password and click the button to confirm
6. You are now logged in
7. You will be redirected to `/member/dashboard/`

**If the invite link lands on the homepage and the modal does not appear:**
- The homepage loads the Identity Widget to handle invite tokens
- If the modal still doesn't appear, open the browser console and check for errors
- Try clearing browser cache and retrying

**If login succeeds but you get "Access Denied":**
- Your account was created but the coordinator has not yet assigned you a role
- Contact the coordinator to set your `app_metadata.roles` (see role assignment above)

---

## Testing access control

After setting up a user with the `admin` role:

1. Log in at `/login/`
2. Confirm you are redirected to `/member/dashboard/`
3. Confirm `/admin/` loads
4. Log out (Log Out link in the nav)
5. Confirm you are redirected to the homepage
6. Directly visit `https://northwestkingdom.com/member/dashboard/`
7. Confirm you are redirected to `/login/?redirect=/member/dashboard/`
8. Log in again
9. Confirm you are redirected back to `/member/dashboard/`

For a user with only the `member` role:
1. Log in at `/login/`
2. Confirm `/member/dashboard/` loads
3. Directly visit `https://northwestkingdom.com/admin/`
4. Confirm you are redirected to `/login/?redirect=/admin/`
5. After logging in, confirm you are redirected to `/access-denied/` (not `/admin/`)

---

## Troubleshooting

### Modal does not open automatically

1. Open browser console on `/login/`
2. Check: `typeof netlifyIdentity` — should be `"object"`
3. If undefined: widget did not load (see "Verifying the widget loads" above)
4. If object: type `netlifyIdentity.open('login')` — if modal opens, the issue is the auto-open
5. Check console for JavaScript errors from `identity.js`

### Invite link redirects to homepage and no modal appears

1. Check the email template configuration (see "Configure the invite confirmation URL" above)
2. Try clicking the "Open Login Form" button on `/login/` after landing
3. If the modal appears there, the invite token may have been lost in the redirect
4. Resend the invite after updating the email template

### Redirect loops after login

This happens when a user is logged in but lacks the required role.
The site detects the loop and redirects to `/access-denied/`.

Fix: Assign the correct role in App metadata (see role assignment above).

### Role-based redirect not working (can access /member/ without login)

1. Confirm Identity is **enabled** in the dashboard
2. Confirm the deploy includes the latest `netlify.toml`
3. Confirm the redirect rules are in the deployed `netlify.toml` (check Deploys → latest deploy)
4. Note: role-based redirects only work on the **deployed Netlify site** — they do not work locally
5. Check the deploy logs for any `netlify.toml` parse errors

### User can log in but lands on homepage instead of dashboard

The `login` event handler should redirect to `/member/dashboard/`.
Check:
1. `identity.js` is loaded on the page (check Network tab)
2. Console for any errors in `identity.js`
3. That `window.location.href` assignment is not blocked by a pop-up blocker

---

## Local development

Netlify Identity role-based access control only works on the deployed Netlify site.
When developing locally:
- All `/member/*` and `/admin/*` pages are accessible without login
- The Identity Widget will not connect (no `/.netlify/identity` endpoint locally)
- The `auth-gate` notices on member/admin pages serve as a reminder of this

To test Identity locally, use Netlify Dev:
```bash
npm install -g netlify-cli
netlify dev
```
This proxies `/.netlify/identity` to the live Netlify Identity service.
