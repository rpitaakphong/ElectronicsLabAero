/* GW Instek SFG-1013 front panel. Electrical output is consumed by app.js. */
(() => {
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  let bridge=null;
  const ui={shift:false,entry:'',unit:'kHz',step:1,error:null};
  let errorTimer;
  function normalize(g){
    const defaults={powered:true,output:true,ttl:false,attenuated:false,duty:50,dutyEnabled:false,offsetEnabled:g.offset!==0,voltageDisplay:false,groundNode:'GND',ttlNode:null,termination:false};
    for(const [key,value] of Object.entries(defaults))if(g[key]===undefined)g[key]=value;
    g.duty=clamp(Number.isFinite(g.duty)?g.duty:50,25,75);
    return g;
  }
  function active(g,port='main') { return g.powered&&g.output&&g.groundNode!==null&&(port!=='ttl'||g.ttl)&&(port!=='main'||g.waveform!=='triangle'||g.frequency<=1e6); }
  function duty(g){return g.dutyEnabled&&g.frequency<=1e6?g.duty/100:.5;}
  function voltage(g,t,port='main'){
    normalize(g);if(!active(g,port))return 0;
    const phase=((g.frequency*t)%1+1)%1;
    if(port==='ttl')return phase<duty(g)?5:0;
    const wave=g.waveform==='sine'?Math.sin(2*Math.PI*phase):g.waveform==='square'?(phase<duty(g)?1:-1):4*Math.abs(phase-.5)-1;
    // Open-circuit voltage; app.js supplies the actual 50-ohm series resistance.
    const offset=g.offsetEnabled?g.offset:0;
    return clamp(offset+g.amplitude*wave,-10,10)*(g.attenuated?.01:1);
  }
  const g=()=>normalize(bridge.getGenerator());
  function announce(text){document.getElementById('sfgHint').textContent=text;}
  function changed(text){if(text)announce(text);bridge.onChange();render();}
  function limitFrequency(value){
    if(bridge?.isLocked?.())return null;
    const state=g(),max=state.ttl?3e6:state.waveform==='triangle'?1e6:3e6;
    let error=value<.1?'Err-4':value>max?(max===1e6?'Err-2':'Err-1'):null;
    state.frequency=Math.round(clamp(value,.1,max)*10)/10;
    if(error){ui.error=error;clearTimeout(errorTimer);errorTimer=setTimeout(()=>{ui.error=null;render();},2500);announce(`${error}: frequency set to ${state.frequency} Hz. Range is 0.1 Hz to ${max/1e6} MHz.`);}
    return error;
  }
  function press(key){
    if(bridge?.isLocked?.())return;
    const state=g();
    if(key==='POWER'){
      state.powered=!state.powered;ui.entry='';ui.shift=false;ui.error=null;
      if(state.powered){state.waveform='sine';state.frequency=1000;state.output=false;state.ttl=false;state.voltageDisplay=false;ui.unit='kHz';}
      changed(state.powered?'Power on: sine, 1 kHz. Press OUTPUT ON to enable the signal.':'Power off. Outputs are disconnected.');return;
    }
    if(!state.powered)return;
    if(key==='SHIFT'){ui.shift=!ui.shift;render();return;}
    if(key==='OUTPUT'){state.output=!state.output;if(!state.output)state.ttl=false;changed(state.output?'Output enabled.':'Output disabled.');return;}
    if(key==='ESC'){ui.entry='';ui.shift=false;ui.error=null;render();return;}
    if(key==='BACKSPACE'){ui.entry=ui.entry.slice(0,-1);render();return;}
    if(ui.shift){
      ui.shift=false;
      if(key==='WAVE'){
        if(!state.output){announce('TTL requires OUTPUT ON first, then SHIFT → WAVE.');render();return;}
        state.ttl=!state.ttl;changed(state.ttl?'TTL enabled at the TTL connector; connect its lead to the board.':'TTL disabled. MAIN retains its selected waveform.');return;
      }
      if(key==='3'){state.attenuated=!state.attenuated;changed(state.attenuated?'MAIN attenuated by −40 dB (voltage × 0.01). TTL is unchanged.':'MAIN attenuation off.');return;}
      if(key==='.'){state.voltageDisplay=!state.voltageDisplay;ui.entry='';render();announce(state.voltageDisplay?'Display shows nominal MAIN amplitude in Vpp into 50 Ω.':'Display shows frequency.');return;}
      if(key==='4'||key==='5'){ui.step=clamp(ui.step*(key==='4'?10:.1),.1,1e6);render();announce(`Frequency knob step: ${ui.step} Hz.`);return;}
      if(['8','9','0'].includes(key)){
        ui.unit={'8':'MHz','9':'kHz','0':'Hz'}[key];state.voltageDisplay=false;
        if(ui.entry){const entered=Number(ui.entry)*{MHz:1e6,kHz:1e3,Hz:1}[ui.unit];ui.entry='';if(!Number.isFinite(entered)){announce('Enter a valid frequency.');render();return;}const error=limitFrequency(entered);changed(error?null:`Frequency set to ${state.frequency} Hz.`);}else render();return;
      }
      announce('SHIFT shortcuts: WAVE TTL, 3 −40 dB, 4/5 digit, 8/9/0 units, decimal V/F.');render();return;
    }
    if(key==='WAVE'){state.waveform={sine:'square',square:'triangle',triangle:'sine'}[state.waveform];ui.entry='';const error=limitFrequency(state.frequency);changed(error?null:`MAIN waveform: ${state.waveform}.`);return;}
    if(/^[0-9.]$/.test(key)){
      state.voltageDisplay=false;ui.error=null;
      if(key==='.'&&ui.entry.includes('.'))return;
      if(ui.entry.replace('.','').length>=6&&key!=='.'){announce('Frequency entry allows six digits. Use SHIFT and a unit key to finish.');return;}
      ui.entry+=key;announce('Finish frequency entry with SHIFT → 8 (MHz), 9 (kHz), or 0 (Hz).');render();
    }
  }
  function adjust(name,direction){
    if(bridge?.isLocked?.())return;
    const state=g();if(!state.powered)return;
    if(name==='frequency'){ui.entry='';state.voltageDisplay=false;limitFrequency(state.frequency+direction*ui.step);changed();}
    if(name==='amplitude'){state.amplitude=clamp(Math.round((state.amplitude+direction*.1)*1000)/1000,.2,10);changed('AMPL changes MAIN only. Use SHIFT → decimal to view amplitude.');}
    if(name==='offset'){
      if(!state.offsetEnabled){announce('Pull OFFSET to ADJ before changing offset.');return;}
      state.offset=clamp(Math.round((state.offset+direction*.2)*1000)/1000,-10,10);changed('OFFSET adjusts MAIN only; TTL has no DC-offset adjustment.');
    }
    if(name==='duty'){
      if(!state.dutyEnabled){announce('Pull DUTY to ADJ first.');return;}
      if((state.waveform!=='square'&&!state.ttl)||state.frequency>1e6){announce('Duty adjustment applies to square / TTL at up to 1 MHz.');return;}
      state.duty=clamp(state.duty+direction,25,75);changed();
    }
  }
  function togglePull(name){if(bridge?.isLocked?.())return;const state=g();if(!state.powered)return;state[name+'Enabled']=!state[name+'Enabled'];if(name==='duty'&&!state.dutyEnabled)state.duty=50;changed(`${name.toUpperCase()} ${state[name+'Enabled']?'pulled to ADJ':'pushed to DEFAULT'}.`);}
  function formatDisplay(value){if(value===0)return '0.0000';return value.toFixed(Math.max(0,Math.min(4,5-Math.floor(Math.log10(Math.abs(value))))));}
  function render(){
    if(!bridge)return;const state=g(),display=document.getElementById('sfgDigits');
    const locked=!!bridge.isLocked?.();
    document.querySelectorAll('[data-sfg-key],[data-sfg-pull]').forEach(button=>button.disabled=locked);
    document.querySelectorAll('[data-sfg-knob]').forEach(knob=>{knob.setAttribute('aria-disabled',String(locked));knob.tabIndex=locked?-1:0;});
    document.getElementById('sfgTtlConnector').disabled=locked;
    document.getElementById('sfgPanel').classList.toggle('sfg-off',!state.powered);
    const nominal=state.amplitude*(state.attenuated?.01:1),unit=state.voltageDisplay?(nominal<1?'mVpp':'Vpp'):ui.unit;
    const number=state.voltageDisplay?(nominal<1?nominal*1000:nominal):state.frequency/{MHz:1e6,kHz:1e3,Hz:1}[ui.unit];
    const displayText=!state.powered?'':ui.error||ui.entry||formatDisplay(number);
    display.replaceChildren();
    for(const char of displayText){const span=document.createElement('span');span.textContent=char;display.append(span);}
    if(state.powered&&!state.voltageDisplay&&!ui.entry&&!ui.error){const scale={MHz:1e6,kHz:1e3,Hz:1}[ui.unit],decimal=displayText.indexOf('.'),integerCount=decimal<0?displayText.length:decimal;let index=0;for(const span of display.children){if(span.textContent==='.')continue;const exponent=integerCount-1-index;span.classList.toggle('sfg-digit-active',Math.abs(scale*10**exponent-ui.step)<.001);index++;}}
    document.getElementById('sfgUnit').textContent=state.powered?unit:'';
    for(const wave of ['sine','square','triangle'])document.querySelector(`[data-sfg-wave="${wave}"]`).classList.toggle('lit',state.powered&&state.waveform===wave);
    for(const [id,on] of Object.entries({sfgTtlLed:state.ttl,sfgAttLed:state.attenuated,sfgShiftLed:ui.shift,sfgOutputLed:state.output}))document.getElementById(id).classList.toggle('lit',state.powered&&on);
    document.querySelector('[data-sfg-key="SHIFT"]').setAttribute('aria-pressed',String(ui.shift));document.querySelector('[data-sfg-key="OUTPUT"]').setAttribute('aria-pressed',String(state.powered&&state.output));document.querySelector('[data-sfg-key="POWER"]').setAttribute('aria-pressed',String(state.powered));
    for(const name of ['duty','offset']){const button=document.querySelector(`[data-sfg-pull="${name}"]`);button.textContent=state[name+'Enabled']?'ADJ · push in':'DEFAULT · pull out';button.setAttribute('aria-pressed',String(state[name+'Enabled']));document.querySelector(`[data-sfg-knob="${name}"]`).classList.toggle('pulled',state[name+'Enabled']);}
    document.getElementById('sfgStep').textContent=`Knob step ${ui.step} Hz${ui.entry?' · entry pending':''}`;
    document.getElementById('sfgDutyReadout').textContent=`${Math.round(duty(state)*100)}% effective duty`;
    const offset=state.offsetEnabled?state.offset*(state.attenuated?.01:1):0;
    document.getElementById('sfgOutputReadout').textContent=`MAIN: ${active(state)?'enabled':'off'} · ${nominal.toPrecision(4)} Vpp nominal into 50 Ω; ${(nominal*2).toPrecision(4)} Vpp open circuit · offset ${offset.toFixed(3)} V open circuit. TTL: ${active(state,'ttl')?'enabled, ideal 0–5 V':'off'}.`;
    document.getElementById('sfgClipReadout').textContent=Math.abs(state.offsetEnabled?state.offset:0)+state.amplitude>10?'MAIN clips at its ±10 V open-circuit output limit before attenuation.':'';
    if(locked){document.getElementById('sfgOutputReadout').textContent='SFG-1013 disconnected while the synthetic source uses MAIN. Front-panel settings are retained; the MAIN and common-return connectors remain available.';document.getElementById('sfgClipReadout').textContent='';for(const id of ['sfgTtlLed','sfgOutputLed'])document.getElementById(id).classList.remove('lit');}
    document.getElementById('sfgTermination').checked=state.termination;
    document.querySelectorAll('[data-sfg-knob]').forEach(knob=>{const name=knob.dataset.sfgKnob,value=name==='frequency'?state.frequency:name==='duty'?state.duty:name==='offset'?state.offset:state.amplitude;knob.setAttribute('aria-valuenow',value);knob.setAttribute('aria-valuetext',`${value}${name==='frequency'?' Hz':name==='duty'?' percent':' volts'}`);const angle=name==='amplitude'?-135+(state.amplitude-.2)/9.8*270:name==='offset'?state.offset*13.5:name==='duty'?(state.duty-50)*5.4:Math.log10(Math.max(.1,state.frequency))*40;knob.style.setProperty('--sfg-angle',angle+'deg');});
  }
  function mount(options){
    bridge=options;
    document.querySelectorAll('[data-sfg-key]').forEach(button=>button.onclick=()=>press(button.dataset.sfgKey));
    document.querySelectorAll('[data-sfg-pull]').forEach(button=>button.onclick=()=>togglePull(button.dataset.sfgPull));
    document.querySelectorAll('[data-sfg-knob]').forEach(knob=>{
      let y=null,travel=0;
      knob.addEventListener('wheel',e=>{e.preventDefault();adjust(knob.dataset.sfgKnob,e.deltaY<0?1:-1);},{passive:false});
      knob.addEventListener('keydown',e=>{if(['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'].includes(e.key)){e.preventDefault();adjust(knob.dataset.sfgKnob,['ArrowUp','ArrowRight'].includes(e.key)?1:-1);}if(e.key==='Enter'&&['duty','offset'].includes(knob.dataset.sfgKnob))togglePull(knob.dataset.sfgKnob);});
      knob.addEventListener('pointerdown',e=>{if(e.button!==0)return;y=e.clientY;travel=0;knob.setPointerCapture(e.pointerId);});
      knob.addEventListener('pointermove',e=>{if(y===null)return;const steps=Math.trunc((y-e.clientY-travel)/10);if(steps){adjust(knob.dataset.sfgKnob,steps);travel+=steps*10;}});
      knob.addEventListener('pointerup',()=>y=null);knob.addEventListener('pointercancel',()=>y=null);
    });
    document.getElementById('sfgPanel').addEventListener('keydown',e=>{if(e.target.matches('input,select'))return;let key=e.key;if(/^[0-9.]$/.test(key)){e.preventDefault();press(key);}else if(key==='Escape'){e.preventDefault();press('ESC');}else if(key==='Backspace'){e.preventDefault();e.stopPropagation();press('BACKSPACE');}});
    for(const [id,tool] of Object.entries({sfgMainConnector:'generator',sfgTtlConnector:'genttl',sfgGroundConnector:'gengnd'}))document.getElementById(id).onclick=()=>{bridge.setTool(tool);document.getElementById('breadboardCanvas').scrollIntoView({block:'center'});};
    document.getElementById('sfgTermination').onchange=e=>{g().termination=e.target.checked;changed('External MAIN termination changed. This switch represents an added load, not a front-panel control.');};
    render();
  }
  window.SFG1013={normalize,active,voltage,duty,mount,render,setFrequency:limitFrequency};
})();
