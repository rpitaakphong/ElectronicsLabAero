/* Deliberate physical placements; holes are the source of electrical nodes. */
(function(root) {
  const common = [
    ['wire','VPLUS:15','A:15','#d34d4d'],
    ['wire','G:17','VMINUS:28','#3f73c9'],
    ['wire','D:16','D:22'],
    ['wire','E:22','F:22'],
    ['wire','G:15','G:10'],
  ];
  function layout(name) {
    const parts=common.map(p=>p.slice());
    const leads={generator:'G:4',ch1tip:'H:4',ch2tip:'B:22',gengnd:'GND_BOTTOM:2',ch1gnd:'GND_BOTTOM:3',ch2gnd:'GND_TOP:28'};
    if(name==='inverting'||name==='integrator') {
      parts.push(['resistor','F:4','F:10',10000,'rin'],['wire','I:16','GND_BOTTOM:16']);
      parts.push(['resistor','J:10','J:22',name==='integrator'?100000:47000,'rf']);
      if(name==='integrator')parts.push(['capacitor','H:10','H:22',100e-9,'cf']);
    } else if(name==='noninverting') {
      parts.push(['wire','I:4','I:16'],['resistor','H:10','H:22',47000,'rf'],['resistor','J:6','J:10',10000,'rg'],['wire','I:6','GND_BOTTOM:6']);
    } else if(name==='follower') {
      parts.push(['wire','I:4','I:16'],['wire','H:10','H:22']);
    } else if(name==='lowpass') {
      parts.push(['resistor','F:4','F:9',10000,'r'],['capacitor','H:9','H:5',100e-9,'c'],['wire','I:5','GND_BOTTOM:5'],['wire','I:9','I:16'],['wire','H:10','H:22']);
    }
    return {startCol:14,parts,leads};
  }
  // Reference metadata is independent of user circuits and is never saved.
  const references={
    follower:{title:'Voltage follower',description:'The output follows the input through negative feedback.',pins:{2:'output',3:'input'},connections:{}},
    inverting:{title:'Inverting amplifier',description:'The feedback and input resistors set a nominal gain of −4.7.',pins:{2:'summing',3:'ground'},connections:{rin:['input','summing'],rf:['output','summing']}},
    noninverting:{title:'Non-inverting amplifier',description:'The feedback divider sets a nominal gain of +5.7.',pins:{2:'divider',3:'input'},connections:{rf:['output','divider'],rg:['divider','ground']}},
    lowpass:{title:'RC low-pass + buffer',description:'The RC network filters the input; the voltage follower buffers it.',pins:{2:'output',3:'filtered'},connections:{r:['input','filtered'],c:['filtered','ground']}},
    integrator:{title:'Practical op-amp integrator',description:'The feedback capacitor integrates the input; the parallel resistor limits DC gain.',pins:{2:'summing',3:'ground'},connections:{rin:['input','summing'],rf:['output','summing'],cf:['output','summing']}}
  };
  function reference(name){
    const definition=references[name];if(!definition)throw new Error('Unknown reference circuit');
    return {id:name,title:definition.title,description:definition.description,
      pins:{...definition.pins,4:'negative',6:'output',7:'positive'},
      supplies:{positive:12,negative:-12},source:{main:'input',return:'ground'},
      probes:{ch1:{tip:'input',gnd:'ground'},ch2:{tip:'output',gnd:'ground'}},
      components:layout(name).parts.filter(p=>p[4]).map(([type,, ,value,role])=>({role,type,value,nets:[...definition.connections[role]]}))};
  }
  root.PresetLayouts={layout,reference,names:Object.keys(references)};
  if(typeof module!=='undefined')module.exports=root.PresetLayouts;
})(globalThis);
