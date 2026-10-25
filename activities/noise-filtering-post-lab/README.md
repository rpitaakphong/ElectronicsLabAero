# Noise and Filtering individual post-lab

Standalone student workbook: `/worksheets/noise-filtering-post-lab.html`.

The new record and backup are version 1. The browser stores an atomic snapshot of the individual answers and source ZIP Blobs under `electronics-noise-filtering-post-lab-v1` in the separate `electronics-noise-filtering-post-lab-files-v1` IndexedDB database. Existing main-lab, pre-lab and 555 storage is never read or changed automatically.

Source imports accept original main-lab v4 ZIPs (up to 96 MiB) and Noise pre-lab ZIPs (up to 2 MiB, including compatible R4). They use the existing source validators. The pre-lab answers and workspace must agree. Valid unfinished records are accepted. Sources are read-only; replacing a source keeps individual writing and requests a review. No grades or calculated answers are supplied.

The individual JSON backup embeds original ZIP bytes. The individual ZIP contains `post_lab_backup.json` and the same original files in `sources/`. Filenames are retained in the record. Source ZIPs already include their original screenshots and code. Post-lab JSON is limited to 140 MiB and ZIP to 256 MiB. The bounded ZIP reader accepts stored entries emitted by these worksheets, checks CRCs and paths, and rejects compression/encryption; it never extracts files to disk.

Package with `npm run package:noise-post-lab`. Application dev/build/test packaging includes this command. Run `npm run test:noise-post-lab` and `npm run typecheck:noise-post-lab`. Browser tests use the existing repository Playwright installation and `APP_URL` (default `http://127.0.0.1:4184`); run `npm run test:noise-post-lab:browser` with that installation on `NODE_PATH` when needed. Synthetic images are explicitly fixtures, not hardware measurements.

The workbook is self-contained, uses native MathML for screen/print equations, and sends no files to a server. Local browser tests cover import previews/cancellation, source replacement, long literal code, file-byte integrity, fresh-browser restore, printing, mobile/keyboard access and unavailable/corrupt storage. Hardware validation remains a main-lab responsibility; the post-lab does not verify the physical measurements.

Current group ZIPs contain labelled MA and EMA comparison figures and CSV-processing
answers/formulas or code from the chosen program. CSV files remain local and are
not submitted. Earlier v4 combined digital-filter figures and Arduino answers/sketches still import and display as
earlier work; the post-lab does not require an Arduino filter sketch for new work.
