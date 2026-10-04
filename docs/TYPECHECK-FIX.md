# TypeScript Typecheck Fix

Fixed the following TypeScript errors:

- React Query `data` possibly `undefined` in Students, Lesson Times, and Teachers pages.
- `ImportMeta.env` missing because Vite client typings were not referenced.

Changes:

1. Normalize query results before rendering:
   - `const students = query.data ?? []`
   - `const lessonTimes = query.data ?? []`
   - `const teacherRows = teachers.data ?? []`
2. Add `frontend/src/vite-env.d.ts`:
   - `/// <reference types="vite/client" />`

Run locally:

```bash
cd frontend
npm install
npm run typecheck
npm run build
```
