"""Build the seven-page amplification and phase-inversion labs. Requires reportlab and pypdf."""
from pathlib import Path
from io import BytesIO
import json
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DictionaryObject, NameObject, ArrayObject, TextStringObject

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/pdf/drone-navigation-signal-amplifier-lab.pdf'
W,H=A4
INK=colors.HexColor('#26343a');TEAL=colors.HexColor('#287b83')
LINE=colors.HexColor('#b8c9cc');PALE=colors.HexColor('#f0f7f7')
buf=BytesIO();c=canvas.Canvas(buf,pagesize=A4)
c.setTitle('Lab Exercises 1 and 2 - Signal Amplification and Phase Inversion')
c.setAuthor('Electronics Lab For Aerospace Engineering')
image_areas=[]

def text(x,top,s,size=10,font='Helvetica',color=INK):
    c.setFillColor(color);c.setFont(font,size);c.drawString(x,H-top-size,s)

def para(s,top,size=10,maxh=80,x=36,width=523,color=INK):
    p=Paragraph(s,ParagraphStyle('p',fontName='Helvetica',fontSize=size,leading=size*1.35,textColor=color))
    _,h=p.wrap(width,maxh)
    assert h<=maxh,(s,h,maxh)
    p.drawOn(c,x,H-top-h)
    return h

def rule(top):
    c.setStrokeColor(LINE);c.setLineWidth(.6);c.line(36,H-top,559,H-top)

def field(name,x,top,width,height,tip,multi=True):
    _,actual_bottom=c.absolutePosition(x,H-top-height)
    assert actual_bottom>=H-790
    c.acroForm.textfield(name=name,tooltip=tip,x=x,y=H-top-height,width=width,height=height,
        fontName='Helvetica',fontSize=10,textColor=INK,borderColor=LINE,fillColor=colors.white,
        borderWidth=.65,borderStyle='solid',forceBorder=True,relative=True,
        fieldFlags='multiline doNotScroll' if multi else 'doNotScroll',annotationFlags='print',
        maxlen=max(20,int(width/5.5)*max(1,int((height-6)/12))) if multi else 70)

def header(page):
    c.drawImage(ImageReader(str(ROOT/'public/chula-logo.webp')),36,H-54,70,34,mask='auto')
    text(122,25,'ELECTRONICS LAB',10,'Helvetica-Bold',TEAL)
    text(122,40,'Aerospace Engineering',9)
    text(36,68,'Lab Exercise 2' if page>=6 else 'Lab Exercise 1',11,'Helvetica-Bold',TEAL)
    text(36,87,'Signal Phase Inversion' if page>=6 else 'Drone Navigation Signal Amplifier Design',20,'Helvetica-Bold')
    if page==1:
        for student,top in [(1,123),(2,149)]:
            text(36,top+4,f'Student {student} name',9)
            field(f'student{student}_name_p{page}',111,top,256,22,f'Student {student} name',False)
            text(382,top+4,f'Student {student} ID',9)
            field(f'student{student}_id_p{page}',446,top,113,22,f'Student {student} ID',False)
    rule(184 if page==1 else 120)
    c.saveState()
    if page>1:c.translate(0,64)

def footer(page):
    c.restoreState()
    rule(798)
    text(36,809,f'Lab Exercise {2 if page>=6 else 1} | Design, construct, verify',8,color=TEAL)
    text(531,809,f'{page} / 7',8.5)
    c.showPage()

def section(top,s):text(36,top,s,14,'Helvetica-Bold',TEAL)

class TextFlow:
    """Use measured paragraph height rather than fixed vertical positions."""
    def __init__(self, top=201):
        self.top=top
    def heading(self,s,first=False):
        if not first:self.top+=8
        section(self.top,s)
        self.top+=26
    def paragraph(self,s,size=10,maxh=100,color=INK):
        self.top+=para(s,self.top,size,maxh=maxh,color=color)+10

def table(top,headers,widths,rows,heights):
    x=36;hh=29
    c.setFillColor(PALE);c.rect(36,H-top-hh,sum(widths),hh,fill=1,stroke=0)
    for s,w in zip(headers,widths):
        para('<b>'+s+'</b>',top+7,9,maxh=20,x=x+8,width=w-16);x+=w
    y=top+hh
    for row,h in zip(rows,heights):
        x=36
        for s,w in zip(row,widths):
            para(s,y+8,9.5,maxh=h-12,x=x+8,width=w-16);x+=w
        rule(y+h);y+=h
    return y

def image_area(page,label,x,top,width,height):
    text(x,top-21,label,10,'Helvetica-Bold')
    c.setFillColor(colors.white);c.setStrokeColor(LINE);c.setLineWidth(.7)
    c.rect(x,H-top-height,width,height,fill=1,stroke=1)
    para('Insert image here using a PDF editor.<br/>Keep its proportions and fit inside the border.',top+height/2-14,
         8.5,maxh=30,x=x+16,width=width-32,color=TEAL)
    image_areas.append(dict(page=page,label=label,x=x,top=top-(64 if page>1 else 0),width=width,height=height))

header(1)
flow=TextFlow()
flow.heading('Engineering Context',first=True)
flow.paragraph('A drone navigation (GPS) system may contain low-level electrical signals that need conditioning before use by downstream electronics, data-acquisition systems, or control hardware. In this exercise, a laboratory function generator represents a low-level navigation/sensor signal with a sinusoidal voltage.')
flow.paragraph('Choose an input amplitude from <b>100 to 200 mV peak</b> and a frequency from <b>1 to 5 kHz</b>, inclusive. Determine the function-generator settings yourself. Keep the selected amplitude and frequency for all three gain tests.')
flow.paragraph('<b>Engineering note:</b> This low-frequency laboratory signal represents a navigation/sensor signal. It does not represent the actual GHz-frequency RF signal received directly by a GPS antenna.',9,color=TEAL)
flow.heading('Problem Statement')
flow.paragraph('Design, construct, and experimentally verify an op-amp amplifier with voltage gains of <b>+3, +6, and +9 V/V</b>. Its output must remain sinusoidal and in phase with the input, without significant clipping or visible distortion.')
flow.paragraph('You must determine the topology, resistor network, power supply, DC bias/reference, breadboard wiring, function-generator settings, and oscilloscope settings.',9.5)
flow.heading('Design Requirements')
table(flow.top,['Parameter','Requirement'],[166,357],[
    ['Input waveform','Sine wave'],
    ['Input amplitude','Choose 100-200 mV peak, inclusive; retain for all tests.'],
    ['Input peak-to-peak voltage','Twice the selected peak amplitude (200-400 mV pp).'],
    ['Input frequency','Choose 1-5 kHz, inclusive; retain for all tests.'],
    ['Target voltage gains','+3, +6, and +9 V/V'],
    ['Output frequency / phase','Same frequency as input; in phase with input.'],
    ['Output amplitude tolerance','Within ±5% of target gain × measured input amplitude.'],
    ['Waveform quality','No significant clipping or visible distortion.'],
],[25]*8)
footer(1)

header(2)
flow=TextFlow()
flow.heading('Available Laboratory Hardware',first=True)
flow.paragraph('• UA741 operational amplifier<br/>• Breadboard and jumper wires<br/>• Various resistors, including 1 kΩ, 10 kΩ, and 20 kΩ<br/>• Two separate programmable DC power supplies<br/>• GW Instek SFG-1013 function generator<br/>• GW Instek GDS-1202B two-channel oscilloscope')
flow.paragraph('The two DC power supplies may be used to establish suitable positive and negative supply rails for the UA741.',9.5)
flow.heading('Your Engineering Task')
flow.paragraph('No circuit schematic or breadboard diagram is provided. Turn the engineering problem into an executable laboratory plan using the AI-assisted engineering workflow below.')
workflow=ImageReader(str(ROOT/'scripts/pdf/assets/ai-assisted-engineering-workflow.png'))
image_width,image_height=workflow.getSize()
figure_height=523*image_height/image_width
c.drawImage(workflow,36,H-flow.top-figure_height,523,figure_height,mask='auto')
flow.top+=figure_height+10
flow.paragraph('The problem interpretation is provided on page 1; you do not need to rewrite it.',9.5)
flow.paragraph('<b>Completing this PDF:</b> Type into the answer fields and save a copy. On pages 4-5, use a PDF editor that supports inserting images. The labeled image areas are placement guides, not text fields or image-import buttons. Fit images without stretching; keep labels and scales readable. Enter student details on page 1 only.',9)
footer(2)

header(3)
section(201,'1  Prediction')
para('Prediction uses a theoretical model to establish how the circuit should behave before it is built. It connects the input signal, component values, and expected output, showing which combinations can achieve the required amplification. These calculated expectations provide a basis for design decisions and later comparison with measurements.',228,10,maxh=55)
field('prediction',36,290,523,181,'Prediction: chosen input, calculations and expected outputs for all three gains')
section(494,'2  Engineering Judgment')
para('The Engineering Judgment section explains how you move from theoretical predictions to a practical design approach. You should include the decisions you consider important and the reasoning behind them. This may involve alternatives, assumptions, or trade-offs that influenced your choices. Focus on showing why your approach is suitable for the task.',521,10,maxh=55)
field('engineering_judgment',36,582,523,197,'Engineering judgment: reasoning behind your design decisions')
footer(3)

header(4)
section(201,'3  AI-Assisted Execution')
para('Insert the circuit schematic produced with AI assistance. Use the second area for supporting output such as a breadboard layout, equipment settings, wiring sequence, or test procedure. Review the output before using it.',228,10,maxh=44)
image_area(4,'AI-assisted circuit schematic',36,297,523,184)
image_area(4,'Supporting AI-assisted output (optional)',36,515,523,186)
footer(4)

header(5)
section(201,'4  Results and Verification')
para('Insert a photo of your constructed circuit and an oscilloscope image for each target gain. Show both input and output channels, with readable voltage/time scales and measurements. Keep the selected input settings for all three tests.',228,10,maxh=44)
image_area(5,'1. Constructed circuit',36,305,254,145)
image_area(5,'2. Oscilloscope: gain +3 V/V',305,305,254,145)
image_area(5,'3. Oscilloscope: gain +6 V/V',36,486,254,145)
image_area(5,'4. Oscilloscope: gain +9 V/V',305,486,254,145)
section(646,'5. Verification Results')
para('Please present your verification results in this section. Verification means using measured evidence to check whether the circuit behaves as expected and meets the design requirements. Compare the actual outputs with your predictions for all three gains, and discuss any differences and what they suggest about your design.',673,9.5,maxh=42)
field('verification',36,722,523,122,'Verification results: measured evidence, comparison with predictions, and interpretation of differences')
footer(5)

header(6)
section(201,'Engineering Task')
para('Use the +3 V/V case from Exercise 1 as your starting point. We now want to invert the signal while keeping the same amplification level. Modify your design so that the output is <b>180° out of phase</b> with the input and has <b>three times its amplitude</b>: a voltage gain of <b>-3 V/V</b>. Keep your selected input amplitude and frequency. The ±5% amplitude tolerance and waveform-quality requirements still apply. Test only this gain.',228,10,maxh=70)
section(310,'1  Prediction')
para('Prediction establishes the expected relationship between input and output. It provides a theoretical basis for the phase inversion and unchanged amplification level.',336,9.5,maxh=29)
field('exercise2_prediction',36,370,523,180,'Exercise 2 prediction: expected output behavior and theoretical relationships')
section(570,'2  Engineering Judgment')
para('This section explains the reasoning behind your revised design. Include the decisions you consider important and why they suit the new requirement.',596,9.5,maxh=29)
field('exercise2_judgment',36,634,523,210,'Exercise 2 engineering judgment: reasoning behind the revised design')
footer(6)

header(7)
section(201,'3  AI-Assisted Execution')
para('Present your AI-assisted schematic or supporting design output. Insert images using a PDF editor; keep component labels and connections readable.',228,9.5,maxh=29)
image_area(7,'AI-assisted circuit design',36,278,523,190)
section(486,'4  Results and Verification')
para('Present evidence of threefold amplification and 180° phase inversion. Show both oscilloscope channels with readable voltage/time scales and measurements. Include a photo of the revised circuit in the separate circuit-evidence box.',513,9.5,maxh=40)
image_area(7,'Circuit evidence',36,579,254,185)
image_area(7,'Oscilloscope: gain -3 V/V',305,579,254,185)
text(36,776,'Comparison with prediction',9.5,'Helvetica-Bold')
field('exercise2_verification',36,793,523,51,'Exercise 2 results and verification: compare measured gain and phase with predictions and explain differences')
footer(7)
c.save()

r=PdfReader(buf);w=PdfWriter();w.clone_document_from_reader(r)
form=w._root_object['/AcroForm'].get_object()
for label in ['student1_name','student1_id','student2_name','student2_id']:
    refs=[ref for ref in form['/Fields'] if str(ref.get_object().get('/T','')).startswith(label+'_p')]
    first=refs[0].get_object()
    parent=DictionaryObject({NameObject('/FT'):NameObject('/Tx'),NameObject('/T'):TextStringObject(label),
        NameObject('/TU'):first['/TU'],NameObject('/DA'):first['/DA'],NameObject('/Kids'):ArrayObject(refs)})
    parentref=w._add_object(parent)
    for ref in refs:
        obj=ref.get_object();obj[NameObject('/Parent')]=parentref
        for k in ['/T','/TU','/FT','/V','/DV','/DA','/Ff','/MaxLen']:
            if k in obj:del obj[k]
    form[NameObject('/Fields')]=ArrayObject([ref for ref in form['/Fields'] if ref not in refs]+[parentref])
for page in w.pages:page[NameObject('/Tabs')]=NameObject('/R')
OUT.parent.mkdir(parents=True,exist_ok=True);w.write(OUT)
manifest=ROOT/'tmp/pdfs/drone-image-areas.json'
manifest.parent.mkdir(parents=True,exist_ok=True);manifest.write_text(json.dumps(image_areas,indent=2))
print(f'Created {OUT}: 7 pages, {len(PdfReader(OUT).get_fields())} named fields, {len(image_areas)} image areas')
