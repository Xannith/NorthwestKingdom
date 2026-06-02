# NWK Photo Uploads — Implementation Notes

## Current state (static site)

NorthwestKingdom.com is a **pure static HTML site** with no server-side runtime.
The photo submission form is fully built and uses **Netlify Forms** to capture
submissions (metadata + file attachment) in the Netlify dashboard.

**What works right now (on Netlify):**
- Resident fills out the submission form at `/public/photos/submit-photo.html`
- Netlify captures the form submission, including the photo as an attachment
- Admin receives an email notification
- Admin reviews the submission in the Netlify dashboard
- Admin manually approves, downloads the photo, adds it to the gallery, and commits

**What requires a backend to automate:**
- Auto-storing the uploaded file in a publicly-accessible location
- Auto-updating `data/photo-submissions.json` with new metadata
- Auto-publishing approved photos to the gallery without a commit

---

## Current manual workflow (no backend)

1. Resident submits photo via the form
2. Admin receives Netlify Forms notification email
3. Admin opens Netlify dashboard → Forms → photo-submission → download attachment
4. Admin saves file as: `assets/img/user-submissions/nwk-photo-YYYYMMDD-HHMMSS-[id].jpg`
5. Admin adds a metadata entry to `data/photo-submissions.json` (see schema below)
6. Admin sets `"status": "published"` and `"visibility": "public"` (or `"member-only"`)
7. Admin commits and pushes → Netlify deploys → photo appears in gallery

---

## Photo metadata schema

Add entries to `data/photo-submissions.json` under the `"photos"` array:

```json
{
  "id": "photo_20240615_abc123",
  "title": "Spring Wildflowers on North Trail",
  "filename": "nwk-photo-20240615-143022-abc123.jpg",
  "path": "/assets/img/user-submissions/nwk-photo-20240615-143022-abc123.jpg",
  "thumbnailPath": "",
  "category": "land-and-nature",
  "dateTaken": "2024-05-20",
  "location": "North trail",
  "photographer": "Jane Neighbor",
  "submitterName": "Jane Neighbor",
  "caption": "Wildflowers blooming along the north trail after spring rains.",
  "tags": ["wildflowers", "spring", "trail", "2024"],
  "relatedEvent": "",
  "peopleShown": "",
  "identifiablePeople": false,
  "permissionStatus": "confirmed",
  "visibility": "public",
  "submittedAt": "2024-06-15T14:30:22Z",
  "status": "published",
  "source": "user-submitted"
}
```

**IMPORTANT — privacy rules:**
- Do NOT include `contactEmail` in this file (it is private and captured in Netlify Forms only)
- Do NOT include `submitterEmail` or any private contact data
- Set `status: "pending-review"` for any submission with `identifiablePeople: true`
  and `permissionStatus: "unsure"` or `"needs-review"` until reviewed
- Only entries with `status: "published"` AND `visibility: "public"` appear in the public gallery

---

## Safe filename generation

When saving a submitted photo, always generate a new filename. Never use the submitter's
original filename. Suggested pattern:

```
nwk-photo-YYYYMMDD-HHMMSS-[6-char-random].jpg
```

Example: `nwk-photo-20240615-143022-a7f3c1.jpg`

Python example:
```python
import random, string, datetime

def safe_filename(ext='jpg'):
    ts = datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S')
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    return f'nwk-photo-{ts}-{rand}.{ext}'
```

---

## To enable auto-publishing: recommended backend options

In order of simplicity for this Netlify-hosted static site:

### Option 1: Netlify Function + Cloudinary (recommended)

1. Create a Cloudinary account (free tier: 25GB storage, 25GB bandwidth/month)
2. Create a Netlify Function at `netlify/functions/submit-photo.js`
3. Function receives the multipart form, validates file server-side, uploads to Cloudinary
4. Function updates `data/photo-submissions.json` via the GitHub API or a database
5. Netlify redeploys (or use Cloudinary's webhook + a GitHub Actions workflow)

Required environment variables (set in Netlify dashboard, never in code):
```
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
GITHUB_TOKEN=...         (if updating JSON via GitHub API)
GITHUB_REPO=Xannith/NorthwestKingdom
```

### Option 2: Netlify Function + Supabase Storage

1. Create a Supabase project (free tier includes 1GB storage)
2. Create a storage bucket `nwk-photos` (set to public for approved photos)
3. Create a `photo_submissions` table for metadata
4. Netlify Function handles upload + metadata insert
5. Gallery reads from Supabase API instead of static JSON

Required environment variables:
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=...    (public, safe for client reads)
SUPABASE_SERVICE_KEY=... (private, server-side only for writes)
```

### Option 3: Netlify Function + Firebase Storage

Similar to Supabase. Firebase free tier includes 5GB storage.

### Option 4: GitHub API workflow (simplest, no external storage cost)

1. Netlify Function receives the upload
2. Function commits the image file to the GitHub repo via the GitHub API
3. Function updates `data/photo-submissions.json` in the same commit
4. Netlify automatically redeploys

This keeps everything in the repo but has limitations:
- GitHub repo size limits apply (images can be large)
- GitHub API rate limits apply
- Every submission triggers a full Netlify deploy

Required environment variables:
```
GITHUB_TOKEN=...    (private, fine-grained token with Contents: write permission)
GITHUB_REPO=Xannith/NorthwestKingdom
```

**Security note:** Never expose `GITHUB_TOKEN` in client-side JavaScript.
It must only be used inside a Netlify Function (server-side).

---

## File storage structure

```
assets/
  img/
    user-submissions/     <- approved, published photos
      nwk-photo-YYYYMMDD-HHMMSS-xxxxxx.jpg
      ...

data/
  photo-submissions.json  <- public metadata (no private contact info)
```

---

## How to test locally

The submission form requires Netlify to process form data. It will not work
from `file://` or a plain local server.

**To test the form UI and validation:**
```bash
python3 -m http.server 8080
# Open http://localhost:8080/public/photos/submit-photo.html
# Fill out the form -- validation works, but submission will fail (expected)
```

**To test gallery rendering with sample data:**

Add a test entry to `data/photo-submissions.json` with an image path that
points to an existing file, then serve locally. Remove test entries before pushing.

Example test entry (requires an actual image file at the path):
```json
{
  "id": "test_001",
  "title": "Test Photo",
  "filename": "test.jpg",
  "path": "/assets/img/user-submissions/test.jpg",
  "thumbnailPath": "",
  "category": "general",
  "dateTaken": "2024-01-01",
  "location": "NWK",
  "photographer": "Test",
  "submitterName": "Test User",
  "caption": "A test photo entry for gallery development.",
  "tags": ["test"],
  "relatedEvent": "",
  "peopleShown": "",
  "identifiablePeople": false,
  "permissionStatus": "confirmed",
  "visibility": "public",
  "submittedAt": "2024-01-01T00:00:00Z",
  "status": "published",
  "source": "user-submitted"
}
```

---

## Security checklist (for when a backend is added)

- [ ] Server-side file type validation (MIME + magic bytes, not just extension)
- [ ] Server-side file size limit (8 MB)
- [ ] Filename is generated server-side (never trust client-supplied names)
- [ ] No path traversal possible in storage paths
- [ ] Uploaded files stored outside web root until approved, OR in a CDN bucket
- [ ] No executable files can be uploaded (validate content type strictly)
- [ ] Contact emails never written to public metadata JSON
- [ ] Pending submissions flagged with `status: "pending-review"` not `"published"`
- [ ] API secrets only in environment variables, never in committed code
- [ ] Duplicate filenames prevented (generated names with random component)
- [ ] Upload logs minimal -- no PII beyond what is needed for review

---

## Configured form notifications

To receive email when a photo is submitted:
1. Go to Netlify dashboard → Your site → Forms
2. Click on "photo-submission"
3. Go to "Form notifications" → Add notification → Email
4. Enter the coordinator's email address
