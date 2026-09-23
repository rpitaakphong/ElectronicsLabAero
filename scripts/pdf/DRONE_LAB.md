# Drone Navigation Signal Amplifier Design

Student PDF: `output/pdf/drone-navigation-signal-amplifier-lab.pdf`.

Seven A4 pages: the five-page Exercise 1 followed by two pages for Exercise 2.
Student names and IDs appear only on page 1. Six multiline fields hold written
responses. Nine labeled image spaces are placement guides, not PDF form fields;
students add images with an image-capable PDF editor, preserve aspect ratio,
and cover/remove the placeholder instructions as needed. Exercise 2 has a full
page for the AI-assisted design and oscilloscope evidence, with a compact
fillable field for comparing measurements with predictions.

Regenerate with Python packages `reportlab` and `pypdf`:

```sh
python3 scripts/pdf/generate_drone_lab.py
```

Verify with `Pillow` also installed, plus Poppler for rendering:

```sh
python3 scripts/pdf/verify_drone_lab.py
pdftoppm -scale-to 1200 -png output/pdf/drone-navigation-signal-amplifier-lab.pdf tmp/pdfs/drone
pdftoppm -scale-to 1200 -png tmp/pdfs/drone-filled-sample.pdf tmp/pdfs/drone-filled
pdftocairo -pdf tmp/pdfs/drone-filled-sample.pdf tmp/pdfs/drone-print-check.pdf
```

The verifier uses a macOS Arial font to create clearly labeled synthetic image
fixtures for visual QA. These are only in the test copy; the student PDF remains
blank. Inspect every rendered page and the inserted-image test copy after edits.

The original theoretical worksheet, its generator, and the application are not
modified. Input selection is 100-200 mV peak and 1-5 kHz inclusive. All three
tests retain the selected input settings. Gains are +3, +6, and +9 V/V, with
in-phase output at the input frequency. Verification uses measured input
amplitude to compute target output and a signed percentage error, accepted
when its absolute value is at most 5 percent. No circuit design is supplied.

Exercise 2 retains the selected input and tests only -3 V/V: threefold amplitude
with 180-degree phase inversion, under the same tolerance and waveform requirements.
