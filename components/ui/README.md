# UI primitives

Small, opinionated wrappers around the most-used button + form-field class strings in the app. Goal: stop pasting the same Tailwind soup on every page.

These primitives live in `components/ui/` and are imported via `@/components/ui/...`.

## Components

### `<Button />` — `components/ui/button.tsx`

Variants:

| variant     | Use for                                  | Class shape                                                                                |
| ----------- | ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| `primary`   | main CTAs (Save, Add, Submit)            | `bg-primary text-primary-foreground hover:bg-primary/90`                                   |
| `secondary` | non-destructive secondary actions        | `border border-border bg-secondary/40 hover:bg-secondary/70 text-foreground`               |
| `ghost`     | low-emphasis (Cancel, close, toolbar)    | `hover:bg-secondary/40 text-muted-foreground hover:text-foreground`                        |
| `danger`    | destructive (Delete confirm, Logout)     | `bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20`                  |
| `success`   | confirmations / accent (Import, Confirm) | `bg-emerald/15 text-emerald border border-emerald/30 hover:bg-emerald/25`                  |

Sizes: `sm` (h-7), `md` (h-9, default), `lg` (h-10).

Props: standard `<button>` props + `variant`, `size`, `loading` (disables and shows spinner), `icon` (left-side icon node).

```tsx
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={save}>
  Ajouter
</Button>

<Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
```

### `<Input />` / `<Textarea />` / `<Select />` — `components/ui/input.tsx`

Single shared base class:
`w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none transition focus:border-primary`.

Pass `invalid` to switch the border to red. All other native props pass through; `className` merges via `cn()`.

```tsx
import { Input, Textarea, Select } from "@/components/ui/input";

<Input placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />
<Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
<Select value={cat} onChange={(e) => setCat(e.target.value)}>
  <option value="a">A</option>
</Select>
```

## Migration map (inline class string -> primitive)

Use this as the codemod cheat-sheet when migrating other pages. Match the inline string, replace with the primitive.

### Buttons

| Inline classes (excerpt)                                                               | Replace with                  |
| -------------------------------------------------------------------------------------- | ----------------------------- |
| `bg-primary text-primary-foreground hover:bg-primary/90`                               | `<Button variant="primary">` |
| `bg-secondary/40 border border-border ... hover:bg-secondary` (or /70)                 | `<Button variant="secondary">` |
| `hover:bg-secondary/40 text-muted-foreground hover:text-foreground`                    | `<Button variant="ghost">`   |
| `hover:bg-red-500/10 ... text-red-400` (delete buttons in lists)                       | `<Button variant="danger" size="sm">` |
| `bg-emerald/15 hover:bg-emerald/25 border border-emerald/30 text-emerald`              | `<Button variant="success">` |

### Inputs

| Inline classes                                                                                                       | Replace with        |
| -------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary`         | `<Input />`         |
| same + `<textarea>` + `resize-none`                                                                                  | `<Textarea />`      |
| same + `<select>`                                                                                                    | `<Select />`        |

## Migration status

Done as proof-of-concept (this commit):

- `app/(app)/supplements/page.tsx` — modal Cancel/Save/Add/Import buttons + delete row buttons + form fields (name, brand, dose, unit, timing, frequency, duration, notes, URL).
- `app/(app)/reminders/page.tsx` — Add submit button + delete buttons + title/description/datetime/category fields.
- `app/(app)/symptoms/page.tsx` — daily-note input + HRV input.

NOT migrated yet (intentional, keep as follow-up):

- `/biomarkers`, `/dna`, `/action-plan`, `/profile`, `/timeline`, `/chat` — out of scope this pass.
- Suggestion-row "+ Ajouter" buttons in supplements page (visually distinct, sm + primary). Safe to migrate next.
- Pill / filter buttons in supplements (rounded-full custom). Different visual contract; not a Button variant target.
- Toggle pills (URL/manual mode in supplement modal). Tab-style; consider a separate `<Tabs />` primitive.

## Rules of thumb

1. **Never replace pill/filter buttons** with `<Button />` — they have their own contract (rounded-full, dynamic active styling).
2. **Keep icon-only delete buttons** as `<Button variant="danger" size="sm" className="h-auto w-auto p-1.5">` only if you need consistent disabled states; otherwise leaving them inline is fine.
3. **Form fields with bespoke styling** (e.g. transparent borderless inputs inside the URL-import preview card) should NOT be migrated to `<Input />` — keep them inline.
4. **Run `npm run build`** after every page migration. The classes are identical, so visual regressions should be zero, but TS prop mismatches will show up in build.
