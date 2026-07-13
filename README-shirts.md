# Updating the Community Shirts page

This explains how to update the **"I Gave" Community Shirts** page at
`northwestkingdom.com/shirts/` — specifically the **Order Status** section that
shows where each bulk ordering round stands. No coding required.

There are two things you might update:

1. **The order round status** (most common) — editing one small text file.
2. **The shirt photo / artwork** (rare) — replacing two image files.

---

## 1. Updating the order round status

All of the status information on the page comes from a single file:

```
data/shirt-order-rounds.json
```

You can edit it two ways:

- **Easiest:** open the file on GitHub in your web browser, click the pencil
  ✏️ icon ("Edit this file"), make your change, and click **Commit changes**.
  Netlify will redeploy the site automatically in about a minute.
- Or edit it on your computer and push, if you work that way.

### What the file looks like

```json
{
  "campaign": "I Gave 2026",
  "note": "Orders are batched roughly every 3 weeks over 12 weeks. Commit any time — your shirt goes into the next open round.",
  "rounds": [
    { "round": 1, "cutoffDate": "2026-07-27", "status": "collecting", "detail": "" },
    { "round": 2, "cutoffDate": "2026-08-17", "status": "upcoming", "detail": "" },
    { "round": 3, "cutoffDate": "2026-09-07", "status": "upcoming", "detail": "" },
    { "round": 4, "cutoffDate": "2026-09-28", "status": "upcoming", "detail": "" }
  ]
}
```

### The fields you can change

- **`cutoffDate`** — the commitment cutoff for that round, in `YYYY-MM-DD`
  format (year-month-day). Example: `"2026-08-17"`.
- **`status`** — one of the words below. This controls the label and color of
  the round on the page.
- **`detail`** — an optional short note shown under the round (for example,
  `"Shirts expected the week of Sept 15"`). Leave it as `""` for none.
- **`note`** — the sentence shown at the top of the Order Status section.
- **`campaign`** — the campaign name shown as a small heading.

### Allowed `status` values

Use one of these exact words (all lowercase):

| status        | What it means / how it shows on the page                    |
|---------------|-------------------------------------------------------------|
| `upcoming`    | Not open yet — a future round.                              |
| `collecting`  | **The active round.** Highlighted. Commitments are open.    |
| `ordered`     | Submitted to the print vendor.                              |
| `shipped`     | Vendor has shipped the batch.                               |
| `arrived`     | Shirts are here and ready for pickup.                       |
| `distributed` | Handed out / complete.                                      |

Typically exactly **one** round is `collecting` at a time. When a round closes,
change it to `ordered` and change the next round from `upcoming` to
`collecting`.

### Rules to avoid breaking the file

- Keep every `"` (double quote) and `,` (comma) exactly where they are.
- Every line inside `rounds` except the **last** one ends with a comma.
- `status` must be one of the words in the table above, spelled exactly.
- If something looks broken after you save, you can paste the file into a free
  "JSON validator" website to find the typo, or compare it to the example above.

If the file has an error, the page still loads — the Order Status section just
shows a short "status is being updated" message instead of the rounds.

---

## 2. Replacing the shirt photo or artwork

Two images are shown on the page:

- `img/i-gave-shirt-demo1.jpg` — the shirt mockup photo (the big hero image).
- `img/i_gave_2026_v8.png` — the design artwork (the corrected badge; the older
  `i_gave_2026_v7_3x_transparent.png` is retired but kept in `img/`).

To replace one, upload a new file with the **exact same name** to the `img/`
folder (on GitHub: open the `img` folder, click **Add file → Upload files**,
and give it the same name to overwrite). Keep the mockup as a `.jpg` and the
artwork as a transparent `.png`.

---

## Who to contact

If you get stuck, contact the site maintainer before force-saving a broken
file — a bad `.json` file is the only thing that can visibly affect the page.
