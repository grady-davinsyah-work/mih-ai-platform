# Rich Text Editor & HTML Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rich text editor (Quill) to the admin content form so admins can format content with bold, italic, headings, lists, and links — and render that HTML in the portal news and publication detail pages.

**Architecture:** Replace the plain `FTextarea` for "Isi" with `react-quill` which produces HTML. Change the `content` column from `text[]` to `text` (single HTML string). Update the backend to store/retrieve content as a single HTML string instead of an array. Update portal detail pages to render HTML via `dangerouslySetInnerHTML`. Convert existing static data in `portal.ts` from `string[]` to HTML strings.

**Tech Stack:** React, react-quill, @fluentui/react-components, PostgreSQL, Express

**Spec:** N/A (bounded change, no separate spec doc)

## Global Constraints

- PostgreSQL `content` column currently `text[] NOT NULL DEFAULT '{}'` — must migrate to `text NOT NULL DEFAULT ''`
- Frontend uses `@fluentui/react-components` for admin UI, Tailwind for portal pages
- Portal has fallback to static data in `portal.ts` — static data must also be converted to HTML strings
- Backend `toArray()` helper currently splits newline-separated strings into `string[]` — must be replaced for content field

---

### Task 1: Install react-quill dependency

**Files:**
- Modify: `frontend/package.json`

**Interfaces:**
- Produces: `react-quill` and `@types/react-quill` available for import

- [ ] **Step 1: Install react-quill**

```bash
cd frontend && npm install react-quill
```

- [ ] **Step 2: Install types**

```bash
cd frontend && npm install -D @types/react-quill
```

- [ ] **Step 3: Verify installation**

```bash
cd frontend && node -e "require('react-quill')" && echo "OK"
```

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json && git commit -m "chore: add react-quill dependency for rich text editing"
```

---

### Task 2: Create RichTextEditor component

**Files:**
- Create: `frontend/src/components/RichTextEditor.tsx`

**Interfaces:**
- Consumes: `react-quill` package
- Produces: `<RichTextEditor value={string} onChange={(html: string) => void} />` component

- [ ] **Step 1: Create the RichTextEditor component**

Create `frontend/src/components/RichTextEditor.tsx`:

```tsx
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link", "blockquote", "code-block"],
    ["clean"],
  ],
};

const QUILL_FORMATS = [
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "list",
  "bullet",
  "link",
  "blockquote",
  "code-block",
];

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  return (
    <ReactQuill
      theme="snow"
      value={value}
      onChange={onChange}
      modules={QUILL_MODULES}
      formats={QUILL_FORMATS}
      placeholder={placeholder}
      style={{ background: "white" }}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/RichTextEditor.tsx && git commit -m "feat: add RichTextEditor component wrapping react-quill"
```

---

### Task 3: Update ContentItem type and backend content handling

**Files:**
- Modify: `frontend/src/api.ts` — change `content: string[]` to `content: string` in `ContentItem`
- Modify: `backend/src/routes/admin.ts` — remove `toArray` usage for content, store as plain text
- Modify: `frontend/src/data/portal.ts` — change `content: string[]` to `content: string` in `News` and `Publication` interfaces, convert static data
- Modify: `frontend/src/pages/portal/usePortalContent.ts` — update `toNews`/`toPublication` to pass content as-is

**Interfaces:**
- Consumes: Current `ContentItem.content: string[]`
- Produces: `ContentItem.content: string` (HTML string)

- [ ] **Step 1: Update ContentItem type in api.ts**

In `frontend/src/api.ts`, change line 29:
```ts
// FROM:
  content: string[];
// TO:
  content: string;
```

- [ ] **Step 2: Update backend admin.ts — simplify content handling**

In `backend/src/routes/admin.ts`:

1. Remove the `toArray` function (or keep it only for `gallery`). Replace the `toArray` function with one that only handles gallery:

```ts
// Replace the existing toArray function with:
function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) return v.split("\n").map((s) => s.trim()).filter(Boolean);
  return [];
}
```

2. In the POST `/content` handler, change the content parameter from `toArray(body.content)` to `String(body.content ?? "")`:

```ts
// Line ~244, change:
        toArray(body.content),
// TO:
        String(body.content ?? ""),
```

3. In the PUT `/content/:id` handler, change the content patch:

```ts
// Line ~277, change:
    content: body.content !== undefined ? toArray(body.content) : prev.content,
// TO:
    content: body.content !== undefined ? String(body.content) : prev.content,
```

- [ ] **Step 3: Update portal.ts interfaces and static data**

In `frontend/src/data/portal.ts`:

1. Change `News` interface `content: string[]` to `content: string`
2. Change `Publication` interface `content: string[]` to `content: string`
3. Convert each news item's `content` array to a single HTML string by joining paragraphs with `</p><p>` and wrapping in `<p>...</p>`. For example:
```ts
content: "<p>First paragraph text.</p><p>Second paragraph text.</p>",
```

4. Convert each publication item's `content` array similarly.

- [ ] **Step 4: Update usePortalContent.ts**

In `frontend/src/pages/portal/usePortalContent.ts`, the `toNews` and `toPublication` functions already pass `c.content` directly. Since the type changed from `string[]` to `string`, no logic change is needed — TypeScript will enforce the new type.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api.ts backend/src/routes/admin.ts frontend/src/data/portal.ts frontend/src/pages/portal/usePortalContent.ts && git commit -m "feat: change content from string[] to HTML string across stack"
```

---

### Task 4: Add Quill rich text editor to admin content form

**Files:**
- Modify: `frontend/src/pages/Admin.tsx` — replace `FTextarea` for content with `RichTextEditor`, update form state

**Interfaces:**
- Consumes: `RichTextEditor` component from Task 2, `ContentItem.content: string` from Task 3
- Produces: Admin form that edits content as HTML

- [ ] **Step 1: Update Admin.tsx — imports and form state**

1. Add import at top:
```tsx
import { RichTextEditor } from "../components/RichTextEditor";
```

2. In `ContentForm` interface, change `contentText: string` stays as-is (it now holds HTML).

3. In `openEdit`, change:
```tsx
// FROM:
      contentText: (c.content ?? []).join("\n"),
// TO:
      contentText: c.content ?? "",
```

4. In `EMPTY_CONTENT_FORM`, `contentText: ""` stays as-is.

- [ ] **Step 2: Replace FTextarea for content with RichTextEditor**

In the content form dialog, replace the "Isi" field:

```tsx
// FROM:
<FField label="Isi" className="sm:col-span-2">
  <FTextarea rows={4} placeholder="Satu blok per baris (paragraf / HTML)" value={contentForm.contentText}
    onChange={(_, d) => setContentForm({ ...contentForm, contentText: d.value })} />
</FField>

// TO:
<FField label="Isi" className="sm:col-span-2">
  <RichTextEditor
    value={contentForm.contentText}
    onChange={(html) => setContentForm({ ...contentForm, contentText: html })}
    placeholder="Tulis isi konten di sini..."
  />
</FField>
```

- [ ] **Step 3: Update saveContent to send content as string**

In `saveContent`, change the payload:

```tsx
// FROM:
        content: splitLines(contentForm.contentText),
// TO:
        content: contentForm.contentText,
```

Also remove the `splitLines` function if it's no longer used (check if `galleryText` still uses it — if so, keep it for gallery only).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Admin.tsx && git commit -m "feat: replace content textarea with Quill rich text editor in admin form"
```

---

### Task 5: Render HTML content in portal detail pages

**Files:**
- Modify: `frontend/src/pages/portal/PortalNews.tsx` — render `item.content` as HTML
- Modify: `frontend/src/pages/portal/PortalPublication.tsx` — render `item.content` as HTML

**Interfaces:**
- Consumes: `item.content` as HTML string from Task 3

- [ ] **Step 1: Update PortalNewsDetail to render HTML**

In `frontend/src/pages/portal/PortalNews.tsx`, in the `PortalNewsDetail` component, replace:

```tsx
// FROM:
            {item.content.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}

// TO:
            <div
              className="article-content"
              dangerouslySetInnerHTML={{ __html: item.content }}
            />
```

- [ ] **Step 2: Update PortalPublicationDetail to render HTML**

In `frontend/src/pages/portal/PortalPublication.tsx`, in the `PortalPublicationDetail` component, replace:

```tsx
// FROM:
            {item.content.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}

// TO:
            <div
              className="article-content"
              dangerouslySetInnerHTML={{ __html: item.content }}
            />
```

- [ ] **Step 3: Add article-content CSS for rendered HTML**

Add styles for `.article-content` to ensure Quill-generated HTML renders well. Check if there's a global CSS file and add:

```css
.article-content p { margin-bottom: 1rem; line-height: 1.75; }
.article-content h2 { font-size: 1.5rem; font-weight: 700; margin: 1.5rem 0 0.75rem; }
.article-content h3 { font-size: 1.25rem; font-weight: 600; margin: 1.25rem 0 0.5rem; }
.article-content ul, .article-content ol { margin: 0.75rem 0; padding-left: 1.5rem; }
.article-content li { margin-bottom: 0.25rem; }
.article-content blockquote { border-left: 4px solid #3b82f6; padding: 0.75rem 1rem; margin: 1rem 0; background: #eff6ff; }
.article-content a { color: #1d4ed8; text-decoration: underline; }
.article-content img { max-width: 100%; height: auto; border-radius: 0.5rem; }
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/portal/PortalNews.tsx frontend/src/pages/portal/PortalPublication.tsx && git commit -m "feat: render HTML content in portal news and publication detail pages"
```

---

### Task 6: Database migration for content column type change

**Files:**
- Create: `db/migrations/001_content_text_to_html.sql`

**Interfaces:**
- Consumes: Current `content TEXT[]` column
- Produces: `content TEXT` column with HTML strings

- [ ] **Step 1: Create migration file**

Create `db/migrations/001_content_text_to_html.sql`:

```sql
-- Migrate content column from text[] to text (HTML string)
-- Existing array data is joined into HTML paragraphs.

ALTER TABLE content ALTER COLUMN content TYPE text
  USING CASE
    WHEN content = '{}' THEN ''
    ELSE string_to_string(content, '</p><p>', '<p>', '</p>')
  END;

ALTER TABLE content ALTER COLUMN content SET DEFAULT '';
```

Wait — PostgreSQL doesn't have a `string_to_string` function. Use this instead:

```sql
-- Migrate content column from text[] to text (HTML string)
-- Existing array data: each element becomes a <p> paragraph.

ALTER TABLE content ALTER COLUMN content TYPE text
  USING CASE
    WHEN content = '{}' THEN ''
    ELSE '<p>' || array_to_string(content, '</p><p>') || '</p>'
  END;

ALTER TABLE content ALTER COLUMN content SET DEFAULT '';
```

- [ ] **Step 2: Add migration runner or document manual migration**

Check if there's an existing migration system. If not, add a note to `db/README.md` or apply manually. The migration SQL above can be run directly against the database.

- [ ] **Step 3: Update init.sql for fresh installs**

In `db/init.sql`, change line 81:

```sql
-- FROM:
  content       TEXT[] NOT NULL DEFAULT '{}',
-- TO:
  content       TEXT NOT NULL DEFAULT '',
```

- [ ] **Step 4: Commit**

```bash
git add db/migrations/001_content_text_to_html.sql db/init.sql && git commit -m "feat: migrate content column from text[] to text (HTML)"
```

---

### Task 7: Verify end-to-end and fix any remaining type issues

**Files:**
- Possibly modify: any files with TypeScript errors after the type change

**Interfaces:**
- Consumes: All changes from Tasks 1–6

- [ ] **Step 1: Run TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -50
```

- [ ] **Step 2: Fix any remaining type errors**

Look for any remaining `string[]` references to `content` that should be `string`. Common places:
- `Admin.tsx` — `splitLines(contentForm.contentText)` should already be removed
- `portal.ts` — static data should already be converted
- Any other component that maps over `content` as an array

- [ ] **Step 3: Run the dev server and manually verify**

```bash
cd frontend && npm run dev
```

Open the admin, create/edit a content item with rich text formatting, then view it on the portal detail page.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix: resolve remaining type errors after content string[] → string migration"
```