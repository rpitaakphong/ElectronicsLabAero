"""Generate the one-page, fillable Reflection and Peer Evaluation sheet."""
from io import BytesIO
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/pdf/reflection-and-peer-evaluation.pdf'
W, H = A4
INK = colors.HexColor('#26343a')
TEAL = colors.HexColor('#287b83')
LINE = colors.HexColor('#b8c9cc')


def generate():
    stream = BytesIO()
    c = canvas.Canvas(stream, pagesize=A4)
    c.setTitle('Reflection and Peer Evaluation')
    c.setAuthor('Electronics Lab For Aerospace Engineering')

    def text(x, top, value, size=10, font='Helvetica', color=INK):
        c.setFillColor(color)
        c.setFont(font, size)
        c.drawString(x, H - top - size, value)

    def rule(top):
        c.setStrokeColor(LINE)
        c.setLineWidth(.6)
        c.line(36, H - top, W - 36, H - top)

    c.drawImage(ImageReader(str(ROOT / 'public/chula-logo.webp')),
                36, H - 54, 70, 34, mask='auto')
    text(122, 25, 'ELECTRONICS LAB', 10, 'Helvetica-Bold', TEAL)
    text(122, 40, 'Aerospace Engineering', 9)
    text(36, 87, 'Reflection and Peer Evaluation', 20, 'Helvetica-Bold')
    rule(120)

    for number, label, name, heading_top, box_top in [
        (1, 'Lab Conclusion', 'lab_conclusion', 140, 169),
        (2, 'Confidential Peer Evaluation', 'confidential_peer_evaluation', 333, 362),
    ]:
        text(36, heading_top, f'{number}  {label}', 14, 'Helvetica-Bold', TEAL)
        c.acroForm.textfield(
            name=name, tooltip=label, x=36, y=H-box_top-140,
            width=W-72, height=140, fontName='Helvetica', fontSize=11,
            textColor=INK, borderColor=LINE, fillColor=colors.white,
            borderWidth=.65, borderStyle='solid', forceBorder=True,
            fieldFlags='multiline doNotScroll', annotationFlags='print', maxlen=900,
        )

    rule(798)
    text(36, 809, 'Electronics Lab | Reflection and peer evaluation', 8, color=TEAL)
    text(531, 809, '1 / 1', 8.5)
    c.showPage()
    c.save()
    writer = PdfWriter()
    writer.clone_document_from_reader(PdfReader(stream))
    writer.pages[0][NameObject('/Tabs')] = NameObject('/R')
    OUT.parent.mkdir(parents=True, exist_ok=True)
    writer.write(OUT)


def verify():
    reader = PdfReader(OUT)
    assert len(reader.pages) == 1
    names = ['lab_conclusion', 'confidential_peer_evaluation']
    assert list(reader.get_fields()) == names
    for annotation in reader.pages[0]['/Annots']:
        widget = annotation.get_object()
        assert widget['/F'] & 4 and widget['/Ff'] & 4096 and '/AP' in widget
    values = {name: 'Sample saved response.\nThis second line must remain visible when printed.'
              for name in names}
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    writer.update_page_form_field_values(writer.pages[0], values, auto_regenerate=False)
    sample = ROOT / 'tmp/pdfs/reflection-filled-sample.pdf'
    sample.parent.mkdir(parents=True, exist_ok=True)
    writer.write(sample)
    reopened = PdfReader(sample).get_fields()
    for name, value in values.items():
        assert reopened[name]['/V'] == value
    print(f'Created {OUT}: 1 A4 page, 2 printable multiline fields; save/reopen verified.')


if __name__ == '__main__':
    generate()
    verify()
