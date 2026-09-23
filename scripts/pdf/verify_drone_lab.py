"""Validate the lab form and build a separate sample-image/filled print-check copy."""
from pathlib import Path
from io import BytesIO
import json, math
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
ROOT=Path(__file__).resolve().parents[2]
TMP=ROOT/'tmp/pdfs'; TMP.mkdir(parents=True,exist_ok=True)
r=PdfReader(ROOT/'output/pdf/drone-navigation-signal-amplifier-lab.pdf')
assert len(r.pages)==7
fields=r.get_fields(); assert len(fields)==10
for name in ['exercise2_prediction','exercise2_judgment','exercise2_verification']:
    assert name in fields
exercise2=r.pages[5].extract_text()
for term in ['Lab Exercise 2','180°','-3 V/V','Test only this gain']:
    assert term in exercise2,term
assert 'ai_review' not in fields
for name in ['student1_name','student1_id','student2_name','student2_id']:
    assert len(fields[name]['/Kids'])==1
for index,page in enumerate(r.pages):
    for ref in page.get('/Annots',[]):
        a=ref.get_object()
        if a.get('/Subtype')!='/Widget':continue
        assert a['/F'] & 4 and '/AP' in a
        x0,y0,x1,y1=map(float,a['/Rect'])
        assert 0<=x0<x1<=595.3 and 0<=y0<y1<=841.9
    s=page.extract_text()
    for label in ['Student 1 name','Student 1 ID','Student 2 name','Student 2 ID']:assert (label in s)==(index==0)
text='\n'.join(p.extract_text() for p in r.pages)
for term in ['SFG-1013','GDS-1202B','UA741','100-200','1-5','±5%','in phase']:
    assert term in text,term
assert '100 mV, 1 kHz' not in text
values={name:('Sample Student '+name[7] if name.endswith('_name') else '1234567890' if name.endswith('_id') else 'Sample saved response.\nThis second line must remain visible when printed.') for name in fields}
w=PdfWriter();w.clone_document_from_reader(r)
for page in w.pages:
    if page.get('/Annots'):w.update_page_form_field_values(page,values,auto_regenerate=False)
areas=json.loads((TMP/'drone-image-areas.json').read_text());assert len(areas)==9
# Synthetic test artwork is only used in the test copy, never in the student PDF.
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',32)
for pn in [4,5,7]:
    stream=BytesIO();cv=canvas.Canvas(stream,pagesize=A4)
    for i,a in enumerate(areas):
        if a['page']!=pn:continue
        iw,ih=(1000,460) if pn==4 else (900,480)
        im=Image.new('RGB',(iw,ih),'white');d=ImageDraw.Draw(im)
        d.rectangle((3,3,iw-4,ih-4),outline='#287b83',width=4)
        d.text((24,20),f'IMAGE TEST {i+1} - NOT LAB EVIDENCE',font=font,fill='#26343a')
        d.text((24,65),'Check label readability and roundness of circle',font=font,fill='#26343a')
        d.ellipse((iw-160,130,iw-60,230),outline='#287b83',width=5)
        for y in range(140,ih-55,50):d.line((30,y,iw-180,y),fill='#ccd8db',width=2)
        for x in range(30,iw-180,80):d.line((x,140,x,ih-65),fill='#ccd8db',width=2)
        pts=[(x,int(ih*.62+50*math.sin((x-30)/70))) for x in range(30,iw-180)]
        d.line(pts,fill='#287b83',width=4)
        d.text((24,ih-48),'INPUT / OUTPUT     VOLTAGE SCALE     TIME SCALE',font=font,fill='#26343a')
        scale=min((a['width']-8)/iw,(a['height']-8)/ih)
        dw,dh=iw*scale,ih*scale
        assert abs(dw/dh-iw/ih)<1e-9
        x=a['x']+(a['width']-dw)/2
        y=A4[1]-a['top']-a['height']+(a['height']-dh)/2
        cv.setFillColorRGB(1,1,1);cv.rect(a['x']+1,A4[1]-a['top']-a['height']+1,a['width']-2,a['height']-2,fill=1,stroke=0)
        cv.drawImage(ImageReader(im),x,y,dw,dh)
    cv.showPage();cv.save();w.pages[pn-1].merge_page(PdfReader(stream).pages[0])
sample=TMP/'drone-filled-sample.pdf';w.write(sample)
rr=PdfReader(sample)
for name,value in values.items():assert rr.get_fields()[name]['/V']==value
for pn,count in [(4,2),(5,4),(7,3)]:
    assert len(rr.pages[pn-1].images)>=count
print('PASS: 7 pages; 10 fields saved and reopened; first-page-only identity widgets; 9 proportional images inserted.')
