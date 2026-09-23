"""Build the three-page Theoretical Understanding Task; requires reportlab, pypdf."""
from pathlib import Path
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DictionaryObject, NameObject, ArrayObject, TextStringObject

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'output/pdf/opamp-guided-learning.pdf'
W,H=A4
INK=colors.HexColor('#26343a'); TEAL=colors.HexColor('#287b83')
LINE=colors.HexColor('#b8c9cc'); PALE=colors.HexColor('#f0f7f7')
URL='https://electronics-lab-aero.vercel.app/'
buf=BytesIO(); c=canvas.Canvas(buf,pagesize=A4)
c.setTitle('Theoretical Understanding Task')
c.setAuthor('Electronics Lab For Aerospace Engineering')

def text(x,top,s,size=10,font='Helvetica',color=INK):
    c.setFillColor(color); c.setFont(font,size); c.drawString(x,H-top-size,s)

def para(s,top,size=10,maxh=70,x=36,width=523,color=INK):
    p=Paragraph(s,ParagraphStyle('p',fontName='Helvetica',fontSize=size,leading=size*1.35,textColor=color))
    _,h=p.wrap(width,maxh)
    assert h<=maxh,(s,h,maxh)
    p.drawOn(c,x,H-top-h)

def field(name,x,top,width,height,tip,multi=True):
    c.acroForm.textfield(name=name,tooltip=tip,x=x,y=H-top-height,width=width,height=height,
        fontName='Helvetica',fontSize=10,textColor=INK,borderColor=LINE,fillColor=colors.white,
        borderWidth=.65,borderStyle='solid',forceBorder=True,relative=True,
        fieldFlags='multiline doNotScroll' if multi else 'doNotScroll',annotationFlags='print',
        maxlen=max(20,int(width/5.5)*max(1,int((height-6)/12))) if multi else 70)

def header(page):
    c.drawImage(ImageReader(str(ROOT/'public/chula-logo.webp')),36,H-54,70,34,mask='auto')
    text(122,25,'ELECTRONICS LAB',10,'Helvetica-Bold',TEAL)
    text(122,40,'Aerospace Engineering',9)
    text(36,68,'Theoretical Understanding Task',22,'Helvetica-Bold')
    if page == 1:
        for student,top in [(1,105),(2,131)]:
            text(36,top+4,f'Student {student} name',9)
            field(f'student{student}_name_p{page}',111,top,256,22,f'Student {student} name',False)
            text(382,top+4,f'Student {student} ID',9)
            field(f'student{student}_id_p{page}',446,top,113,22,f'Student {student} ID',False)
    divider_top = 162 if page == 1 else 102
    c.setStrokeColor(LINE);c.setLineWidth(.6);c.line(36,H-divider_top,559,H-divider_top)

def footer(page):
    c.setStrokeColor(LINE);c.line(36,H-798,559,H-798)
    text(36,809,'Open interactive learning tool',8.5,color=TEAL)
    c.linkURL(URL,(36,H-823,156,H-807),relative=0)
    text(193,809,'Type and save a copy, or print and write.',8)
    text(531,809,f'{page} / 3',8.5)
    c.showPage()

def setup(s,top):
    para('<b>Start here:</b> '+s,top,9,maxh=42,color=TEAL)

def question(number,prompt,top,answer_top,height):
    para(f'<b>{number}</b> &nbsp; {prompt}',top,10,maxh=answer_top-top-5)
    field('task_'+number.replace('.','_'),36,answer_top,523,height,f'Task {number}: {prompt}')

header(1)
para('<b>Instruction</b><br/>Use the interactive learning tool to understand op-amp concepts and the theoretical relationships in its different configurations. An op-amp is a fundamental electronic component that can amplify signals. Its applications go beyond simple amplification; however, amplification is the focus of this lab.',175,10,maxh=69)
text(36,252,'Task 1: Op-amp as Comparator',16,'Helvetica-Bold',TEAL)
para('In its simplest form, an op-amp can be connected using only its inputs, power supply, and output. This configuration has no feedback loop or connected resistors. Your first task is to understand the output signal it produces compared with the input.',280,10,maxh=42)
setup('Click <b>Reset lab</b> and select <b>Comparator</b>. Defaults: sine, 0.5 V peak, 1 kHz, DC offset 0 V, phase 0°, reference 0 V, supply ±5 V. Use Auto fit.',330)
question('1.1','Under the default settings, observe the input and output waveforms. What differences do you see?',374,409,72)
question('1.2','Based on op-amp theory, why do you think the output looks this way?',496,521,77)
question('1.3','In Parameters → Circuit, try different <b>Supply preset</b> settings. Observe how the peak output voltage changes. Explain why the output behaves this way.',614,660,110)
footer(1)

header(2)
text(36,118,'Task 2: Op-amp as Buffer',16,'Helvetica-Bold',TEAL)
para('Adding a feedback connection changes how the op-amp responds. In this task, study an op-amp whose output connects directly to its negative input through a wire, with no feedback resistor. This configuration is called a voltage buffer.',147,10,maxh=54)
setup('Click <b>Reset lab</b>, then select <b>Buffer</b>. Defaults: sine, 0.5 V peak, 1 kHz, DC offset 0 V, phase 0°, supply ±5 V. Use Auto fit. Keep this supply for Task 2.3.',211)
question('2.1','Under the default settings, what do you observe about the input and output signals on the oscilloscope?',263,298,105)
question('2.2','Based on op-amp theory, explain why the input and output signals look the way they do.',419,454,105)
question('2.3','Set <b>Input 1 amplitude</b> to 1 V peak, then increase it towards 10 V peak. Observe and explain the change. <i>Hint: consider the power supply.</i>',575,620,90)
footer(2)

header(3)
c.saveState()
c.translate(0,60)
text(36,178,'Task 3: Non-inverting Amplifier',16,'Helvetica-Bold',TEAL)
para('In a buffer, negative feedback adjusts the output until the voltages at the op-amp’s + and - inputs are nearly equal. Because the output connects directly to the - input, it follows the input signal. In a non-inverting amplifier, two resistors form a voltage divider that feeds only part of the output back to the - input. Study the output-voltage and gain equations: they are foundations for op-amp design and calculation.',206,10,maxh=70)
setup('Click <b>Reset lab</b>, then select <b>Non-inverting</b>: sine, 0.5 V peak, 1 kHz, offset 0 V, phase 0°, reference 0 V, supply ±5 V; Rf = 20 kΩ, Rg = 10 kΩ. Use Auto fit.',283)
# Compose each equation using measured glyph widths and one shared baseline.
# This keeps operators, variables and the fraction together as a single expression.
baseline=H-345
def math_atom(x,y,letter,sub):
    c.setFillColor(INK);c.setFont('Times-Italic',14);c.drawString(x,y,letter)
    x+=c.stringWidth(letter,'Times-Italic',14)
    c.setFont('Times-Italic',9);c.drawString(x,y-3,sub)
    return x+c.stringWidth(sub,'Times-Italic',9)

def math_operator(x,y,s):
    c.setFillColor(INK);c.setFont('Times-Roman',14);c.drawString(x,y,s)
    return x+c.stringWidth(s,'Times-Roman',14)

x=math_atom(63,baseline,'A','v')
x=math_operator(x,baseline,' = 1 + ')
fraction_width=22
atom_width=c.stringWidth('R','Times-Italic',14)+c.stringWidth('f','Times-Italic',9)
math_atom(x+(fraction_width-atom_width)/2,baseline+11,'R','f')
atom_width=c.stringWidth('R','Times-Italic',14)+c.stringWidth('g','Times-Italic',9)
math_atom(x+(fraction_width-atom_width)/2,baseline-13,'R','g')
c.setStrokeColor(INK);c.setLineWidth(.7)
c.line(x,baseline+4,x+fraction_width,baseline+4)
x=math_atom(234,baseline,'V','out')
x=math_operator(x,baseline,' = ')
x=math_atom(x,baseline,'A','v')
math_atom(x+3,baseline,'V','in')
para('For reference = 0 V,<br/>before supply clipping.',333,8.5,x=406,width=150,maxh=30)
question('3.1','Increase <b>Feedback Rf</b> under Parameters → Circuit. Observe and record what changes in the output signal.',376,410,45)
question('3.2','Set <b>Feedback Rf</b> back to 20 kΩ, then increase <b>Divider Rg</b>. Observe and record what changes.',466,500,45)
para('<b>3.3</b> &nbsp; Find a combination of Rf and Rg that produces a gain of <b>+7 V/V</b>, amplifying the signal by seven times. Record both values.',556,10,maxh=29)
text(36,594,'Rf (kΩ)',10);field('task_3_3_rf',84,590,185,24,'Task 3.3: Rf in kilo-ohms',False)
text(303,594,'Rg (kΩ)',10);field('task_3_3_rg',353,590,206,24,'Task 3.3: Rg in kilo-ohms',False)
question('3.4','Keep your +7 V/V gain and set <b>Input 1 amplitude</b> to <b>1 V peak</b>, with the ±5 V supply. Observe the clipped output. How can you fix it? Suggest a change, try it in the tool, and describe the result.',628,678,57)
para('<b>Optional:</b> Now that you have completed all three tasks, explore the <b>Inverting</b> configuration to extend your understanding.',754,9,maxh=28)
c.restoreState()
footer(3)
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
OUT.parent.mkdir(parents=True,exist_ok=True)
w.write(OUT)
print(f'Created {OUT}: 3 pages, {len(PdfReader(OUT).get_fields())} named fields')
