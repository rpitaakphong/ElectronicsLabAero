"""Validate fields, save sample responses, and prepare a print-check copy."""
from pathlib import Path
from pypdf import PdfReader, PdfWriter
ROOT=Path(__file__).resolve().parents[2]
r=PdfReader(ROOT/'output/pdf/opamp-guided-learning.pdf')
assert len(r.pages)==3
assert r.metadata.title=='Theoretical Understanding Task'
fields=r.get_fields();assert len(fields)==15
for name in ['student1_name','student1_id','student2_name','student2_id']:
    assert len(fields[name]['/Kids'])==1
for index,page in enumerate(r.pages):
    assert '/Link' in [a.get_object().get('/Subtype') for a in page['/Annots']]
    for ref in page['/Annots']:
        a=ref.get_object()
        if a.get('/Subtype')!='/Widget':continue
        assert a['/F'] & 4
        x0,y0,x1,y1=map(float,a['/Rect'])
        assert 0<=x0<x1<=595.3 and 0<=y0<y1<=841.9
        assert '/AP' in a
    s=page.extract_text()
    for label in ['Student 1 name','Student 1 ID','Student 2 name','Student 2 ID']:
        assert (label in s) == (index == 0)
    assert 'predict' not in s.lower()
values={name:('Sample Student '+name[7] if name.endswith('_name') else '1234567890' if name.endswith('_id') else '60' if name.endswith('_rf') else '10' if name.endswith('_rg') else 'This is a sample saved response.\nThe second line should remain visible when printed.') for name in fields}
w=PdfWriter();w.clone_document_from_reader(r)
for page in w.pages:w.update_page_form_field_values(page,values,auto_regenerate=False)
sample=ROOT/'tmp/pdfs/filled-sample.pdf';sample.parent.mkdir(parents=True,exist_ok=True);w.write(sample)
reopened=PdfReader(sample)
for name,value in values.items():assert reopened.get_fields()[name]['/V']==value,name
print('PASS: 3 pages; 15 saved/reopened fields; linked student details; printable appearances.')
