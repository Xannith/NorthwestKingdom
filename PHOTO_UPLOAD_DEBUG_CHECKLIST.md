# Photo Upload Debug Checklist

## What changed and why

**Root cause of the original failure:** The form was submitted via JavaScript `fetch()`.
Netlify Forms only supports file attachments submitted as a native browser form POST.
AJAX/fetch submissions with file inputs are rejected by Netlify (typically returns 422).

**Fix applied:** The JavaScript submit handler now only runs client-side validation.
If validation passes, it sets a loading state and lets the native browser POST proceed.
Netlify receives the full multipart upload and redirects to `/public/photos/photo-submitted.html`.

---

## How to test on the deployed site

1. Visit `https://northwestkingdom.com/public/photos/submit-photo.html`
2. Select a JPEG or PNG photo (237 KB or any size under 8 MB)
3. Fill in Title, Category, and Your Name (required fields)
4. Check the permission confirmation checkbox
5. Click Submit Photo
6. **Expected:** Browser navigates to the success page at `/public/photos/photo-submitted.html`
7. **Expected:** The submission appears in the Netlify dashboard under Forms → photo-submission

---

## What to check in the browser console

- Open DevTools → Console before submitting
- There should be no JavaScript errors on page load
- On submit with a valid file: no errors, page navigates away
- On submit with an invalid file (wrong type, too large): validation error shown inline, no navigation

---

## What to check in the Network tab

Open DevTools → Network before submitting, then submit the form.

- You should see a POST request to `/public/photos/submit-photo.html` (the current page)
  or to whatever URL the form posts to (the browser shows this in the request)
- Netlify intercepts the POST at the CDN level before it reaches any origin server
- **Expected response:** 302 redirect → browser follows to `/public/photos/photo-submitted.html`
- If you see 422: Netlify did not recognize the form (see "If Netlify Forms does not list the form" below)
- If you see 404: The action URL is wrong or the page wasn't deployed
- If you see 405: Method not allowed — check the form method is POST
- If you see 500: Netlify server error — check deploy logs

---

## What to check in the Netlify dashboard

1. Go to **Site → Forms**
2. Look for a form named **`photo-submission`**
3. Submit a test submission, then check **Forms → photo-submission → Verified submissions**
4. If the submission appears there, the form is working end-to-end

---

## Where submissions appear in Netlify

- **Netlify dashboard → Your site → Forms → photo-submission**
- Each submission includes all text fields plus the uploaded photo as an attachment
- Click a submission to view details and download the attached file
- Email notifications can be configured at Forms → photo-submission → Form notifications

---

## Status code meanings

| Status | Meaning | What to do |
|--------|---------|------------|
| 302 (redirect) | Netlify accepted the submission and redirected to the action URL — success | Nothing |
| 200 | Netlify processed the POST — success (less common than 302 for native form POST) | Nothing |
| 404 | Wrong action URL, or the page was not deployed | Check the `action` attribute and deploy |
| 405 | Method not allowed — form is not POSTing correctly | Check `method="POST"` on the form |
| 422 | Netlify did not recognize the form, or submission was rejected as spam | See below |
| 500 | Netlify server error | Check deploy logs in the Netlify dashboard |

---

## If Netlify Forms does not list the form

If `photo-submission` does not appear under Forms in the Netlify dashboard:

1. **Check the deploy logs** — look for a line like `"Detected form photo-submission"` during the deploy
2. **Trigger a new deploy** — go to Deploys → Trigger deploy → Deploy site
3. **Verify the form attributes** in the deployed HTML:
   - View source at `/public/photos/submit-photo.html` on the live site
   - Confirm `data-netlify="true"` is present in the `<form>` tag
   - Confirm `name="photo-submission"` is present
   - Confirm `<input type="hidden" name="form-name" value="photo-submission">` is inside the form
4. **Confirm form detection is enabled** — Netlify dashboard → Site configuration → Forms → check that form detection is on
5. If the form still does not appear after a fresh deploy, open a support ticket with Netlify

---

## Stage 2: Auto-publish pipeline (not yet implemented)

Submissions captured by Netlify Forms are stored in the dashboard only.
Photos do **not** automatically appear in the gallery. The current manual workflow is:

1. Admin receives email notification (configure under Forms → photo-submission → Form notifications)
2. Admin opens Netlify dashboard → Forms → photo-submission → downloads the attachment
3. Admin renames the file following the safe filename pattern in `PHOTO_UPLOADS_IMPLEMENTATION.md`
4. Admin saves the file to `assets/img/user-submissions/`
5. Admin adds a metadata entry to `data/photo-submissions.json`
6. Admin commits and pushes — Netlify redeploys — photo appears in gallery

See `PHOTO_UPLOADS_IMPLEMENTATION.md` for backend automation options (Netlify Function + Cloudinary, Supabase, or GitHub API).

---

## Security notes

- The `contact-email` field is captured by Netlify Forms but is **never written to `data/photo-submissions.json`**
- Submitted photos are stored only in Netlify's form attachments until manually approved and committed
- File type is validated client-side (JPEG/PNG only, 8 MB max) and should also be validated server-side before any future auto-publish pipeline is built
- See `SECURITY_NOTES.md` for broader site security notes
