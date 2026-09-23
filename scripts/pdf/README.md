# Theoretical Understanding Task

The student deliverable is `output/pdf/opamp-guided-learning.pdf`: three A4 pages,
one each for Comparator, Buffer, and Non-inverting Amplifier. Inverting is an
optional closing activity. The revised worksheet follows Tasks 1.1-3.4 and has
15 named AcroForm fields. Four student identity fields are linked across pages.
All response fields are printable; multiline fields have scrolling disabled.

## Regenerate and verify

Install Python packages `reportlab` and `pypdf`, then run:

```sh
python3 scripts/pdf/generate_worksheet.py
python3 scripts/pdf/verify_worksheet.py
pdftoppm -scale-to 1200 -png output/pdf/opamp-guided-learning.pdf tmp/pdfs/revised
pdftoppm -scale-to 1200 -png tmp/pdfs/filled-sample.pdf tmp/pdfs/filled
```

Inspect each rendered page after editing. The verifier creates a separate filled
sample and does not change the blank student PDF. The generator uses the existing
Chula logo. It makes no website changes.

Each task starts with Reset lab and circuit selection, making defaults reproducible.
Task 3.4 explicitly sets the source to 1 V peak so gain +7 clips under the default
±5 V supply. The feedback explanation refers to the op-amp's two input terminals.
The simulator models exact rail clipping; equations describe the unclipped output.

Students can type into the form and save a copy, or print and write. Use a PDF
viewer with form support if an embedded preview does not expose the fields.
