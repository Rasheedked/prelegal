# Prelegal frontend

A Next.js app for creating a [Common Paper Mutual NDA](https://commonpaper.com/standards/mutual-nda/1.0).
The user fills in a form, sees the completed agreement update live, and downloads it as a PDF.

Everything runs in the browser: nothing the user types is sent to a server.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts: `npm test` (unit tests), `npm run lint`, `npm run typecheck`, `npm run build`.

## How it works

- The agreement text is not copied into this app. `src/lib/nda/load-template.ts` reads
  `Mutual-NDA-coverpage.md` and `Mutual-NDA.md` from the repository's `templates/` folder at
  build time, so the app must be built from inside the repository.
- `src/lib/nda/template.ts` parses those files and `src/lib/nda/document.ts` combines them with
  the form values into a list of blocks. The preview (`NdaPreview`) and the PDF (`NdaPdf`) are
  both rendered from that list.
- Only the Cover Page is filled in. The Standard Terms are reproduced word for word, because the
  Cover Page states they are identical to the published Common Paper terms.
- The PDF embeds Noto Serif (`public/fonts`, SIL Open Font License) so that Latin, Greek and
  Cyrillic text renders correctly. Text in other scripts is rejected before download.
