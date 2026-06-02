#!/usr/bin/env python3
"""
tools/build-governance.py

Converts MLC governance source documents to static HTML pages.
Run from repo root: python3 tools/build-governance.py

Outputs (idempotent — re-running replaces, never duplicates):
  governance/index.html          — index with grouped listing and search box
  governance/{slug}.html         — one page per document
  governance/pdf/{file}.pdf      — PDF originals (linked from pages)
  governance/search-index.json   — MiniSearch data
  governance/README.md           — regeneration instructions

Source:
  governance/_source/            — local copy of ~/gdrive/Claude (read-only)
"""

import os, sys, re, json, shutil, html, textwrap, subprocess, tempfile
from pathlib import Path
import mammoth
from bs4 import BeautifulSoup, NavigableString

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT   = Path(__file__).parent.parent
SOURCE_DIR  = REPO_ROOT / "governance" / "_source"
OUT_DIR     = REPO_ROOT / "governance"
PDF_DIR     = OUT_DIR / "pdf"

# ---------------------------------------------------------------------------
# Document catalog
# Each entry: (source_filename, slug, display_title, category, description)
# category: "governing" | "policy"
# description: None → auto-extract first sentence from content
# ---------------------------------------------------------------------------

DOCUMENTS = [
    # ── Governing Documents ─────────────────────────────────────────────
    ("ByLaws.pdf",
     "bylaws",
     "Bylaws",
     "governing",
     "The bylaws (constitution) of the Miccosukee Land Co-op, Inc., as amended May 2016."),

    ("Covenants-and-Restrictions.pdf",
     "covenants-and-restrictions",
     "Covenants and Restrictions",
     "governing",
     "Declaration of Covenants and Restrictions for the Miccosukee Land Cooperative, as amended June 2019."),

    ("MLC-Articles-of-Incorporation.pdf",
     "articles-of-incorporation",
     "Articles of Incorporation",
     "governing",
     "Articles of Incorporation of the Miccosukee Land Co-op, Inc. (OCR — proofread before relying on specific wording)."),

    ("Financial Plan 2023-2027.docx",
     "financial-plan-2023-2027",
     "Financial Plan 2023–2027",
     "governing",
     "MLC financial plan adopted by Town Council November 2022, covering investment management and assessment recommendations."),

    # ── Policies ────────────────────────────────────────────────────────
    ("10 member petition policy.docx",
     "10-member-petition-policy",
     "10-Member Petition Policy",
     "policy",
     None),

    ("Administrative items standard operating procedure.docx",
     "administrative-items-sop",
     "Administrative Items Standard Operating Procedure",
     "policy",
     None),

    ("Alternate Current Guidelines.docx",
     "alternate-current-guidelines",
     "Alternate Current Guidelines",
     "policy",
     None),

    ("Assessment Arrears Collection Policy.docx",
     "assessment-arrears-collection-policy",
     "Assessment Arrears Collection Policy",
     "policy",
     None),

    ("Assessment Policy re Multiple but Not Identical Ownership.docx",
     "assessment-policy-multiple-ownership",
     "Assessment Policy: Multiple but Not Identical Ownership",
     "policy",
     None),

    ("BB Guns and Similar Devices Policy.docx",
     "bb-guns-and-similar-devices-policy",
     "BB Guns and Similar Devices Policy",
     "policy",
     None),

    ("Bonfire Policy.docx",
     "bonfire-policy",
     "Bonfire Policy",
     "policy",
     None),

    ("Bulletin Board Guidelines.docx",
     "bulletin-board-guidelines",
     "Bulletin Board Guidelines",
     "policy",
     None),

    ("Community Center Borrowing of CC Tables and Chairs Policy.docx",
     "community-center-borrowing-policy",
     "Community Center: Borrowing Tables and Chairs",
     "policy",
     None),

    ("Community Center Use and Rental Policy.docx",
     "community-center-use-and-rental-policy",
     "Community Center Use and Rental Policy",
     "policy",
     None),

    ("Conflict Resolution Team.docx",
     "conflict-resolution-team",
     "Conflict Resolution Team",
     "policy",
     None),

    ("Heavy Equipment Policy.docx",
     "heavy-equipment-policy",
     "Heavy Equipment Policy",
     "policy",
     None),

    ("Land Transfer.docx",
     "land-transfer",
     "Land Transfer",
     "policy",
     None),

    ("Memory Pathway Guidelines for Art Installations.docx",
     "memory-pathway-guidelines",
     "Memory Pathway Guidelines for Art Installations",
     "policy",
     None),

    ("Motorized Vehicle Policies.docx",
     "motorized-vehicle-policies",
     "Motorized Vehicle Policies",
     "policy",
     None),

    ("Neighborhood Security Policy.docx",
     "neighborhood-security-policy",
     "Neighborhood Security Policy",
     "policy",
     None),

    ("Nonmember Voting Policy.docx",
     "nonmember-voting-policy",
     "Nonmember Voting Policy",
     "policy",
     None),

    ("Pets.docx",
     "pets-policy",
     "Pets Policy",
     "policy",
     None),

    ("Proposals Ballot Initiative Process.docx",
     "proposals-ballot-initiative-process",
     "Proposals: Ballot Initiative Process",
     "policy",
     None),

    ("Proposals for TC.docx",
     "proposals-for-tc",
     "Proposals for Town Council",
     "policy",
     None),

    ("Tractor Use Agreement.docx",
     "tractor-use-agreement",
     "Tractor Use Agreement",
     "policy",
     None),

    ("Tractor Use Policy.docx",
     "tractor-use-policy",
     "Tractor Use Policy",
     "policy",
     None),

    ("Voting Nonmember Voting Policy.docx",
     "voting-nonmember-voting-policy",
     "Voting: Nonmember Voting Policy",
     "policy",
     None),

    ("Voting Policy.docx",
     "voting-policy",
     "Voting Policy",
     "policy",
     None),

    ("Voting Procedures.docx",
     "voting-procedures",
     "Voting Procedures",
     "policy",
     None),
]

# ---------------------------------------------------------------------------
# HTML post-processing helpers
# ---------------------------------------------------------------------------

def is_all_bold(tag):
    """True if a <p> tag's entire text content is wrapped in <strong>/<b>/<em>."""
    if tag.name != 'p':
        return False
    children = [c for c in tag.children if not (isinstance(c, NavigableString) and c.strip() == '')]
    if not children:
        return False
    # All children must be bold wrappers or whitespace
    text_nodes = [c for c in children if isinstance(c, NavigableString) and c.strip()]
    bold_nodes  = [c for c in children if hasattr(c, 'name') and c.name in ('strong', 'b')]
    return len(text_nodes) == 0 and len(bold_nodes) > 0 and len(bold_nodes) == len(children)

def looks_like_subheading(text):
    """Heuristic: numbered/lettered section labels become h3."""
    t = text.strip()
    return bool(re.match(r'^(\d+\.|[A-Z]\.|Section\s+\d|[IVX]+\.)', t, re.I))

def promote_bold_headings(soup, title):
    """
    Convert fully-bold <p> tags to <h2> or <h3>.
    Remove leading title-duplicate paragraphs.
    """
    title_clean = title.strip().lower()
    removed_title = 0

    for p in list(soup.find_all('p')):
        text = p.get_text(strip=True)
        text_lower = text.lower()

        # Skip / remove title duplicates at the top (up to 2)
        if removed_title < 2 and text_lower == title_clean:
            p.decompose()
            removed_title += 1
            continue

        if is_all_bold(p):
            if not text:
                p.decompose()
                continue
            # Decide heading level
            level = 'h3' if looks_like_subheading(text) else 'h2'
            new_tag = soup.new_tag(level)
            # Move inner text without the <strong> wrapper
            for child in list(p.children):
                if hasattr(child, 'name') and child.name in ('strong', 'b'):
                    new_tag.append(child.get_text())
                elif isinstance(child, NavigableString):
                    new_tag.append(str(child))
                else:
                    new_tag.append(child.get_text())
            p.replace_with(new_tag)

    # Remove empty <p> tags
    for p in soup.find_all('p'):
        if not p.get_text(strip=True):
            p.decompose()

    return soup


def clean_docx_html(raw_html, title):
    """Post-process mammoth HTML into clean semantic body HTML."""
    soup = BeautifulSoup(raw_html, 'lxml')
    # lxml wraps in <html><body>; extract body content
    body = soup.find('body')
    inner = BeautifulSoup(''.join(str(c) for c in body.children), 'html.parser')

    promote_bold_headings(inner, title)

    # Remove Word artifact: empty strong/em tags
    for tag in inner.find_all(['strong', 'em', 'b']):
        if not tag.get_text(strip=True):
            tag.decompose()

    return str(inner)


# ---------------------------------------------------------------------------
# PDF text → HTML
# ---------------------------------------------------------------------------

def text_to_html(text, title):
    """
    Convert plain text (from pdftotext or OCR) to semantic HTML.
    Processes line-by-line: detects ARTICLE/Section headings on their own lines,
    groups indented numbered items into lists, and coalesces everything else into paragraphs.
    """
    title_clean = title.strip().lower()
    lines = text.splitlines()
    html_parts = []
    para_buf = []   # accumulates lines for the current paragraph
    list_buf = []   # accumulates lines for the current list

    def flush_para():
        if para_buf:
            joined = ' '.join(para_buf).strip()
            if joined:
                html_parts.append(f'<p>{html.escape(joined)}</p>')
            para_buf.clear()

    def flush_list():
        if list_buf:
            li_tags = ''.join(f'<li>{html.escape(it)}</li>' for it in list_buf)
            html_parts.append(f'<ol>{li_tags}</ol>')
            list_buf.clear()

    IS_HEADING = re.compile(
        r'^(ARTICLE\s+[IVXLC\d]+[\s:–\-]'
        r'|PREAMBLE[\s:]'
        r'|RECITALS'
        r'|APPENDIX'
        r'|EXHIBIT\s)'
        , re.I)
    IS_SECTION = re.compile(r'^(Section\s+\d|Sec\.\s*\d)', re.I)
    IS_LIST_ITEM = re.compile(r'^\s{2,}\(?[\da-z]+[\.\)]\s+\S', re.I)
    IS_PAGE_BREAK = re.compile(r'^\s*\x0c')

    title_skipped = 0

    for raw_line in lines:
        # Strip page-break characters
        if IS_PAGE_BREAK.match(raw_line):
            continue

        line = raw_line.strip()
        if not line:
            flush_list()
            flush_para()
            continue

        # Skip title duplicate at the top
        if title_skipped < 2 and line.lower() == title_clean:
            title_skipped += 1
            continue

        # ARTICLE / PREAMBLE heading
        if IS_HEADING.match(line) and len(line) < 120:
            flush_list()
            flush_para()
            html_parts.append(f'<h2>{html.escape(line)}</h2>')
            continue

        # Section heading
        if IS_SECTION.match(line) and len(line) < 120:
            flush_list()
            flush_para()
            html_parts.append(f'<h3>{html.escape(line)}</h3>')
            continue

        # Indented numbered / lettered list item
        if IS_LIST_ITEM.match(raw_line) and len(line) < 400:
            flush_para()
            list_buf.append(line)
            continue

        # A list item that was broken across two physical lines — continuation
        # (indented more than a list item would be, or no number prefix)
        if list_buf and raw_line.startswith('       ') and not IS_LIST_ITEM.match(raw_line):
            list_buf[-1] = list_buf[-1] + ' ' + line
            continue

        flush_list()
        para_buf.append(line)

    flush_list()
    flush_para()

    return '\n'.join(html_parts)


# ---------------------------------------------------------------------------
# PDF extraction
# ---------------------------------------------------------------------------

def extract_pdf_text(pdf_path):
    """Extract text from a text-layer PDF using pdftotext."""
    result = subprocess.run(
        ['pdftotext', '-layout', str(pdf_path), '-'],
        capture_output=True, text=True
    )
    return result.stdout


def ocr_pdf(pdf_path):
    """OCR a scanned PDF using pdftoppm + tesseract. Returns extracted text."""
    from pdf2image import convert_from_path
    import pytesseract

    print(f"  OCR: converting {pdf_path.name} to images...")
    images = convert_from_path(str(pdf_path), dpi=300)
    pages = []
    for i, img in enumerate(images):
        print(f"  OCR: page {i+1}/{len(images)}...")
        text = pytesseract.image_to_string(img, lang='eng')
        pages.append(text)
    return '\n\n'.join(pages)


# ---------------------------------------------------------------------------
# Snippet extraction for search index
# ---------------------------------------------------------------------------

def strip_html(h):
    """Strip HTML tags, return plain text."""
    return BeautifulSoup(h, 'html.parser').get_text(' ', strip=True)


def first_sentence(text, max_chars=200):
    """Extract first meaningful sentence from plain text."""
    # Skip very short lines (headers)
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    for s in sentences:
        s = s.strip()
        if len(s) > 40:
            return s[:max_chars] + ('…' if len(s) > max_chars else '')
    return text[:max_chars].strip()


# ---------------------------------------------------------------------------
# HTML page template
# ---------------------------------------------------------------------------

PAGE_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} — MLC Governance — Northwest Kingdom</title>
  <meta name="description" content="{description}">
  <link rel="stylesheet" href="/assets/css/styles.css">
</head>
<body data-section="public">
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <div id="site-header"></div>
  <nav id="site-nav" aria-label="Public navigation"></nav>

  <main id="main-content">
    <div class="container page-wrapper">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li><a href="/">Home</a></li>
          <li><a href="/governance/">Governance</a></li>
          <li><span aria-current="page">{title}</span></li>
        </ol>
      </nav>

{pdf_notice}
      <article class="doc-content">
        <h1>{title}</h1>
{content}
      </article>
    </div>
  </main>

  <div id="site-footer" role="contentinfo"></div>
  <script src="/assets/js/components.js"></script>
  <script src="/assets/js/main.js"></script>
</body>
</html>
"""

PDF_NOTICE = """\
      <div class="doc-pdf-notice">
        <strong>Authoritative source:</strong>
        <a href="/governance/pdf/{pdf_name}" download="{pdf_name}">Download original PDF</a>
        — This page was converted from the PDF for on-screen reading.
        The PDF is the authoritative version.
      </div>
"""

OCR_NOTICE = """\
      <div class="doc-pdf-notice doc-pdf-notice--ocr" role="alert">
        <strong>&#9888; OCR conversion:</strong>
        This page was generated by optical character recognition (OCR) from a scanned PDF.
        <a href="/governance/pdf/{pdf_name}" download="{pdf_name}">View the original scanned PDF</a>
        — please proofread this page against that source before relying on specific wording.
      </div>
"""


def build_page(slug, title, body_html, pdf_name=None, is_ocr=False, description=''):
    notice = ''
    if pdf_name and is_ocr:
        notice = OCR_NOTICE.format(pdf_name=pdf_name)
    elif pdf_name:
        notice = PDF_NOTICE.format(pdf_name=pdf_name)

    escaped_desc = html.escape(description or '')
    # Indent body content
    indented = textwrap.indent(body_html.strip(), '        ')

    return PAGE_TEMPLATE.format(
        title=html.escape(title),
        description=escaped_desc,
        pdf_notice=notice,
        content=indented,
    )


# ---------------------------------------------------------------------------
# Index page template
# ---------------------------------------------------------------------------

INDEX_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Governance Documents — Northwest Kingdom</title>
  <meta name="description" content="MLC governing documents and policies: Bylaws, Covenants and Restrictions, Articles of Incorporation, and all adopted policies.">
  <link rel="stylesheet" href="/assets/css/styles.css">
</head>
<body data-section="public">
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <div id="site-header"></div>
  <nav id="site-nav" aria-label="Public navigation"></nav>

  <main id="main-content">
    <div class="container page-wrapper">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li><a href="/">Home</a></li>
          <li><span aria-current="page">Governance</span></li>
        </ol>
      </nav>

      <div class="page-header">
        <span class="section-badge section-badge--public">MLC Reference</span>
        <h1>Governance Documents</h1>
        <p>Miccosukee Land Co-op governing documents and adopted policies.
           These are reference copies. Consult the
           <a href="/public/mlc-reference/official-mlc-links.html">official MLC sources</a>
           for authoritative versions.</p>
      </div>

      <!-- Search box -->
      <div class="gov-search" id="gov-search-box">
        <label for="gov-search-input" class="sr-only">Search governance documents</label>
        <input
          type="search"
          id="gov-search-input"
          class="form-input gov-search__input"
          placeholder="Search governance documents…"
          autocomplete="off"
          spellcheck="false"
          aria-label="Search governance documents"
          aria-controls="gov-search-results"
          aria-expanded="false"
        >
        <div id="gov-search-results" class="gov-search__results" role="listbox" aria-label="Search results" hidden></div>
      </div>

      <div id="gov-doc-listing">

        <h2 id="governing-documents">Governing Documents</h2>
        <p class="text-muted" class="heading-desc">
          Foundational documents that establish the legal and operating framework for the Miccosukee Land Co-op.
        </p>
        <div class="gov-doc-list" aria-labelledby="governing-documents">
{governing_items}
        </div>

        <hr class="divider">

        <h2 id="policies">Policies</h2>
        <p class="text-muted" class="heading-desc">
          Adopted MLC policies, procedures, and guidelines, listed alphabetically.
        </p>
        <div class="gov-doc-list" aria-labelledby="policies">
{policy_items}
        </div>

      </div><!-- #gov-doc-listing -->
    </div>
  </main>

  <div id="site-footer" role="contentinfo"></div>
  <script src="/assets/js/components.js"></script>
  <script src="/assets/js/main.js"></script>
  <script src="/assets/js/vendor/minisearch.min.js"></script>
  <script src="/assets/js/governance-search.js"></script>
</body>
</html>
"""

DOC_ITEM_TEMPLATE = """\
          <div class="gov-doc-item">
            <a href="/governance/{slug}.html" class="gov-doc-item__title">{title}</a>
            <p class="gov-doc-item__desc">{description}</p>
          </div>"""


# ---------------------------------------------------------------------------
# Main build logic
# ---------------------------------------------------------------------------

def process_document(src_filename, slug, title, category, description_override):
    src_path = SOURCE_DIR / src_filename
    if not src_path.exists():
        print(f"  MISSING: {src_filename}")
        return None

    ext = src_path.suffix.lower()
    is_ocr = False
    pdf_name = None
    body_html = ''
    mammoth_messages = []

    if ext == '.docx':
        # ── DOCX via mammoth ──────────────────────────────────────────
        style_map = (
            "p[style-name='Heading 1'] => h2:fresh\n"
            "p[style-name='Heading 2'] => h3:fresh\n"
            "p[style-name='Heading 3'] => h3:fresh\n"
        )
        with open(src_path, 'rb') as fh:
            result = mammoth.convert_to_html(fh, style_map=style_map)
        raw_html = result.value
        mammoth_messages = [str(m) for m in result.messages if 'ignored' not in str(m).lower()]
        body_html = clean_docx_html(raw_html, title)

    elif ext == '.pdf':
        # ── PDF: check if text layer exists ──────────────────────────
        pdf_name = src_filename
        PDF_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src_path, PDF_DIR / src_filename)

        test_text = extract_pdf_text(src_path).strip()
        if len(test_text) < 50:
            # Scanned — needs OCR
            is_ocr = True
            print(f"  OCR required: {src_filename}")
            raw_text = ocr_pdf(src_path)
        else:
            raw_text = extract_pdf_text(src_path)

        body_html = text_to_html(raw_text, title)

    else:
        print(f"  SKIPPED (unknown type): {src_filename}")
        return None

    # Auto-extract description if not provided
    plain = strip_html(body_html)
    auto_desc = first_sentence(plain)
    description = description_override or auto_desc

    # Build page HTML
    page_html = build_page(
        slug=slug,
        title=title,
        body_html=body_html,
        pdf_name=pdf_name,
        is_ocr=is_ocr,
        description=description,
    )

    return {
        'slug': slug,
        'title': title,
        'category': category,
        'description': description,
        'body_plain': plain,
        'page_html': page_html,
        'is_ocr': is_ocr,
        'mammoth_messages': mammoth_messages,
        'pdf_name': pdf_name,
    }


def build_doc_item(doc):
    return DOC_ITEM_TEMPLATE.format(
        slug=doc['slug'],
        title=html.escape(doc['title']),
        description=html.escape(doc['description']),
    )


def build_index(docs):
    governing = sorted([d for d in docs if d['category'] == 'governing'],
                       key=lambda d: d['title'])
    policies  = sorted([d for d in docs if d['category'] == 'policy'],
                       key=lambda d: d['title'])

    governing_items = '\n'.join(build_doc_item(d) for d in governing)
    policy_items    = '\n'.join(build_doc_item(d) for d in policies)

    return INDEX_TEMPLATE.format(
        governing_items=governing_items,
        policy_items=policy_items,
    )


def build_search_index(docs):
    index = []
    for doc in docs:
        index.append({
            'id':       doc['slug'],
            'title':    doc['title'],
            'category': doc['category'],
            'url':      f"/governance/{doc['slug']}.html",
            'body':     doc['body_plain'],
        })
    return json.dumps(index, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# Governance-search JS (written alongside search-index.json)
# ---------------------------------------------------------------------------

GOVERNANCE_SEARCH_JS = r"""\
/**
 * governance-search.js
 * Client-side search for governance documents using MiniSearch.
 * Loaded only on the governance index page.
 */
(function () {
  'use strict';

  var searchInput   = document.getElementById('gov-search-input');
  var resultsBox    = document.getElementById('gov-search-results');
  var docListing    = document.getElementById('gov-doc-listing');
  if (!searchInput || !resultsBox) return;

  var miniSearch = new MiniSearch({
    fields:       ['title', 'body'],
    storeFields:  ['title', 'url', 'category', 'body'],
    searchOptions: {
      boost:  { title: 3 },
      prefix: true,
      fuzzy:  0.15,
    },
  });

  var INDEX_URL = '/governance/search-index.json';
  var loaded = false;

  function loadIndex() {
    if (loaded) return Promise.resolve();
    return fetch(INDEX_URL)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        miniSearch.addAll(data);
        loaded = true;
      });
  }

  function snippet(body, query, maxLen) {
    maxLen = maxLen || 160;
    var words = query.toLowerCase().split(/\s+/).filter(Boolean);
    var lbody = body.toLowerCase();
    var best  = -1;
    words.forEach(function (w) {
      var idx = lbody.indexOf(w);
      if (idx !== -1 && (best === -1 || idx < best)) best = idx;
    });
    if (best === -1) return body.slice(0, maxLen) + '…';
    var start = Math.max(0, best - 60);
    var end   = Math.min(body.length, start + maxLen);
    var s     = (start > 0 ? '…' : '') + body.slice(start, end) + (end < body.length ? '…' : '');
    words.forEach(function (w) {
      var re = new RegExp('(' + w.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + ')', 'gi');
      s = s.replace(re, '<mark>$1</mark>');
    });
    return s;
  }

  function renderResults(results, query) {
    if (results.length === 0) {
      resultsBox.innerHTML = '<p class="gov-search__no-results">No documents matched <em>' +
        escHtml(query) + '</em>.</p>';
    } else {
      resultsBox.innerHTML = results.map(function (r) {
        var catLabel = r.category === 'governing' ? 'Governing Document' : 'Policy';
        return '<a href="' + r.url + '" class="gov-search__result" role="option">' +
          '<span class="gov-search__result-title">' + escHtml(r.title) + '</span>' +
          '<span class="gov-search__result-cat">' + catLabel + '</span>' +
          '<span class="gov-search__result-snippet">' + snippet(r.body, query) + '</span>' +
          '</a>';
      }).join('');
    }
    resultsBox.hidden = false;
    searchInput.setAttribute('aria-expanded', 'true');
    docListing.hidden = true;
  }

  function showListing() {
    resultsBox.hidden = true;
    resultsBox.innerHTML = '';
    searchInput.setAttribute('aria-expanded', 'false');
    docListing.hidden = false;
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  var debounceTimer;
  searchInput.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    var q = searchInput.value.trim();
    if (!q) { showListing(); return; }
    debounceTimer = setTimeout(function () {
      loadIndex().then(function () {
        var results = miniSearch.search(q, { combineWith: 'OR' });
        renderResults(results.slice(0, 12), q);
      }).catch(function (err) {
        console.warn('Governance search index load failed:', err);
      });
    }, 150);
  });

  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { searchInput.value = ''; showListing(); }
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('#gov-search-box')) showListing();
  });
})();
"""


# ---------------------------------------------------------------------------
# Governance README
# ---------------------------------------------------------------------------

GOVERNANCE_README = """\
# Governance Documents

This directory contains HTML pages converted from MLC governance source documents.

## Source

Source files are stored in Google Drive at `~/gdrive/Claude` (rclone mount) and
copied locally to `governance/_source/` before conversion.
`governance/_source/` is listed in `.gitignore` — it is a working directory only.

## Regenerate after adding or updating a document

```bash
# 1. Copy updated file(s) from Google Drive
cp -v ~/gdrive/Claude/*.docx governance/_source/
cp -v ~/gdrive/Claude/*.pdf  governance/_source/

# 2. Rebuild (from repo root)
python3 tools/build-governance.py

# 3. Review the output, then commit
git add governance/
git commit -m "Regenerate governance docs from source"
```

Regeneration is **idempotent** — re-running replaces all output files rather than
duplicating them.

## Adding a new document

1. Add the file to Google Drive and copy it to `governance/_source/`.
2. Add an entry to the `DOCUMENTS` catalog in `tools/build-governance.py`.
3. Run the build script.

## How search works

- `governance/search-index.json` is a JSON array generated at build time. It
  contains title, category, URL, and full body text for every document.
- `assets/js/governance-search.js` loads the index via `fetch()` and queries it
  using [MiniSearch](https://lucaong.github.io/minisearch/) (vendored at
  `assets/js/vendor/minisearch.min.js`).
- Search is scoped to governance documents only.
- The index rebuilds every time `build-governance.py` runs.

## Notes on specific documents

- **Articles of Incorporation** — converted via OCR from a scanned PDF. Flag for
  human proofreading before relying on specific wording.
- **Nonmember Voting Policy** and **Voting: Nonmember Voting Policy** — two files
  covering overlapping content. Both are retained as distinct pages. Review whether
  one supersedes the other.
"""


# ---------------------------------------------------------------------------
# CSS additions for governance doc pages
# ---------------------------------------------------------------------------

GOVERNANCE_CSS = """
/* ============================================================
   Governance document pages
   ============================================================ */

.doc-pdf-notice {
  background: var(--color-accent-bg);
  border: 1px solid var(--color-accent-light);
  border-radius: var(--radius);
  padding: var(--spacing-md) var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
  font-size: 0.88rem;
}

.doc-pdf-notice--ocr {
  background: var(--color-warning-bg);
  border-color: var(--color-warning-border);
  color: var(--color-warning);
}

.doc-content {
  max-width: var(--content-width);
}

.doc-content h1 {
  font-size: clamp(1.5rem, 3.5vw, 2rem);
  border-bottom: 2px solid var(--color-border);
  padding-bottom: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
}

.doc-content h2 {
  font-size: 1.2rem;
  color: var(--color-primary-dark);
  margin-top: var(--spacing-xl);
  margin-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--color-border-light);
  padding-bottom: 0.25rem;
}

.doc-content h3 {
  font-size: 1rem;
  color: var(--color-text);
  margin-top: var(--spacing-lg);
  margin-bottom: var(--spacing-xs);
  font-family: var(--font-body);
  font-weight: 600;
}

.doc-content p { line-height: 1.7; }

.doc-content ol,
.doc-content ul {
  padding-left: 1.6em;
  margin-bottom: var(--spacing-md);
}

.doc-content li { margin-bottom: 0.35em; line-height: 1.65; }

.doc-content table { font-size: 0.88rem; }

/* ── Governance index ─────────────────────────────────────── */

.gov-doc-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
}

.gov-doc-item {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--spacing-md) var(--spacing-lg);
  transition: box-shadow 0.15s;
}

.gov-doc-item:hover { box-shadow: var(--shadow-sm); }

.gov-doc-item__title {
  font-family: var(--font-heading);
  font-size: 1.05rem;
  text-decoration: none;
  display: block;
  margin-bottom: 0.2rem;
}

.gov-doc-item__title:hover { text-decoration: underline; }

.gov-doc-item__desc {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin: 0;
}

/* ── Search box ───────────────────────────────────────────── */

.gov-search {
  position: relative;
  margin-bottom: var(--spacing-xl);
  max-width: 540px;
}

.gov-search__input {
  font-size: 1rem;
  padding: 0.6em 1em;
}

.gov-search__results {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  z-index: 200;
  max-height: 420px;
  overflow-y: auto;
}

.gov-search__result {
  display: block;
  padding: var(--spacing-md) var(--spacing-lg);
  text-decoration: none;
  color: inherit;
  border-bottom: 1px solid var(--color-border-light);
  transition: background 0.1s;
}

.gov-search__result:last-child { border-bottom: none; }
.gov-search__result:hover      { background: var(--color-primary-bg); }

.gov-search__result-title {
  display: block;
  font-weight: 600;
  color: var(--color-link);
  margin-bottom: 0.15rem;
}

.gov-search__result-cat {
  display: inline-block;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  background: var(--color-surface-alt);
  border-radius: 20px;
  padding: 1px 7px;
  margin-bottom: 0.3rem;
}

.gov-search__result-snippet {
  display: block;
  font-size: 0.82rem;
  color: var(--color-text-muted);
  line-height: 1.5;
}

.gov-search__result-snippet mark {
  background: #fff3cd;
  color: var(--color-text);
  border-radius: 2px;
  padding: 0 1px;
}

.gov-search__no-results {
  padding: var(--spacing-lg);
  color: var(--color-text-muted);
  font-size: 0.9rem;
  margin: 0;
}
"""


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    print("=== NWK Governance Build ===")

    if not SOURCE_DIR.exists():
        print(f"ERROR: Source directory not found: {SOURCE_DIR}")
        print("Run: cp ~/gdrive/Claude/* governance/_source/")
        sys.exit(1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    PDF_DIR.mkdir(parents=True, exist_ok=True)

    docs = []
    ocr_pages = []
    failed = []

    for src_filename, slug, title, category, description_override in DOCUMENTS:
        print(f"  Processing: {src_filename}")
        result = process_document(src_filename, slug, title, category, description_override)
        if result is None:
            failed.append(src_filename)
            continue
        docs.append(result)
        if result['is_ocr']:
            ocr_pages.append(slug)
        # Write page
        out_path = OUT_DIR / f"{slug}.html"
        out_path.write_text(result['page_html'], encoding='utf-8')
        print(f"    -> governance/{slug}.html")
        if result['mammoth_messages']:
            for msg in result['mammoth_messages'][:3]:
                print(f"       mammoth: {msg}")

    # Write index
    index_html = build_index(docs)
    (OUT_DIR / "index.html").write_text(index_html, encoding='utf-8')
    print(f"  -> governance/index.html")

    # Write search index
    search_json = build_search_index(docs)
    (OUT_DIR / "search-index.json").write_text(search_json, encoding='utf-8')
    print(f"  -> governance/search-index.json")

    # Write governance-search.js
    js_path = REPO_ROOT / "assets" / "js" / "governance-search.js"
    js_path.write_text(GOVERNANCE_SEARCH_JS, encoding='utf-8')
    print(f"  -> assets/js/governance-search.js")

    # Write governance README
    (OUT_DIR / "README.md").write_text(GOVERNANCE_README, encoding='utf-8')
    print(f"  -> governance/README.md")

    # Append governance CSS to styles.css (only if not already present)
    css_path = REPO_ROOT / "assets" / "css" / "styles.css"
    css_text = css_path.read_text(encoding='utf-8')
    marker = "/* Governance document pages */"
    if marker not in css_text and "gov-search" not in css_text:
        with open(css_path, 'a', encoding='utf-8') as f:
            f.write("\n" + GOVERNANCE_CSS)
        print(f"  -> assets/css/styles.css (appended governance styles)")
    else:
        print(f"  -> assets/css/styles.css (governance styles already present, skipped)")

    # Summary
    print()
    print(f"=== Build complete ===")
    print(f"  Documents processed : {len(docs)}")
    print(f"  Pages written       : {len(docs) + 1} (+ index)")
    print(f"  OCR pages           : {', '.join(ocr_pages) or 'none'}")
    if failed:
        print(f"  FAILED              : {', '.join(failed)}")

    # Warn about potential duplicates
    print()
    print("  NOTE: 'nonmember-voting-policy' and 'voting-nonmember-voting-policy'")
    print("        may cover the same content. Review and remove one if appropriate.")
    if ocr_pages:
        print()
        print(f"  ⚠ OCR FLAG: '{', '.join(ocr_pages)}' was generated by OCR.")
        print("    Proofread against the original scanned PDF before publishing.")


if __name__ == "__main__":
    main()
