/* Repeatable teaching sources. Electrical amplitudes are open-circuit volts. */
(function(root){
  'use strict';
  const defaults=()=>({mode:'generator',enabled:true,noiseEnabled:true,noiseStrength:100});
  function phases(seed,count){
    let value=seed>>>0;
    return Array.from({length:count},()=>{value=(Math.imul(1664525,value)+1013904223)>>>0;return 2*Math.PI*value/4294967296;});
  }
  const eegPhases=phases(0x45454731,6),sensorPhases=phases(0x534E5331,9),uavPhases=phases(0x55415631,3);
  function validate(input){
    if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Choose valid RC input settings.');
    const settings=input;
    if(!['generator','uav','eeg','sensor'].includes(settings.mode))throw new Error('Choose Function generator, UAV, Sensor, or a saved Legacy EEG input.');
    if(typeof settings.enabled!=='boolean'||typeof settings.noiseEnabled!=='boolean')throw new Error('Choose whether the RC input and noise are enabled.');
    if(!Number.isFinite(settings.noiseStrength)||settings.noiseStrength<0||settings.noiseStrength>200)throw new Error('Noise strength must be between 0 and 200 percent.');
    return {mode:settings.mode,enabled:settings.enabled,noiseEnabled:settings.noiseEnabled,noiseStrength:settings.noiseStrength};
  }
  function describe(input=defaults()){
    const settings=validate(input);
    if(settings.mode==='generator')return null;
    // Fixed seeded phases retain the same signal at every absolute time after a redraw,
    // component edit, or timebase change. EEG is explicitly amplified by 1000.
    const activeNoise=settings.noiseEnabled&&settings.noiseStrength>0;
    const tones=settings.mode==='uav'?[{id:'motor',label:'Motor vibration',role:'useful',frequency:200,amplitude:1,phase:uavPhases[0]}]:settings.mode==='eeg'?[
      {id:'delta',label:'Delta',role:'useful',frequency:2,amplitude:.040,phase:eegPhases[0]},
      {id:'theta',label:'Theta',role:'useful',frequency:6,amplitude:.020,phase:eegPhases[1]},
      {id:'alpha',label:'Alpha',role:'useful',frequency:10,amplitude:.015,phase:eegPhases[2]},
      {id:'beta',label:'Beta',role:'useful',frequency:20,amplitude:.008,phase:eegPhases[3]},
    ]:[{id:'sensor',label:'Sensor signal',role:'useful',frequency:200,amplitude:1,phase:sensorPhases[0]}];
    if(activeNoise){
      const strength=settings.noiseStrength/100;
      if(settings.mode==='eeg')tones.push(
        {id:'movement',label:'Movement drift',role:'noise',frequency:.12,amplitude:.120*strength,phase:eegPhases[4]},
        {id:'electrode',label:'Electrode drift',role:'noise',frequency:.28,amplitude:.045*strength,phase:eegPhases[5]},
      );
      else if(settings.mode==='uav')tones.push(
        {id:'movement',label:'Slow aircraft movement',role:'noise',frequency:2,amplitude:.6*strength,phase:uavPhases[1]},
        {id:'airframe',label:'Additional slow movement',role:'noise',frequency:5,amplitude:.3*strength,phase:uavPhases[2]},
      );
      else {
        const frequencies=[5000,6500,8000,10000,12000,14500,17000,20000];
        // Eight equal 0.125 V-peak tones have a combined long-term RMS of 0.25 V.
        frequencies.forEach((frequency,i)=>tones.push({id:`noise-${i+1}`,label:`Fast noise ${i+1}`,role:'noise',frequency,amplitude:.125*strength,phase:sensorPhases[i+1]}));
      }
    }
    const autosetTimeDiv=settings.mode==='uav'?(activeNoise?.1:.002):settings.mode==='eeg'?(activeNoise?1:.2):.002;
    return {tones,enabled:settings.enabled,mode:settings.mode,maxFrequency:settings.enabled?Math.max(...tones.map(tone=>tone.frequency)):0,mixed:settings.enabled&&tones.length>1,frequency:settings.mode==='eeg'?10:200,autosetTimeDiv};
  }
  const api={defaults,validate,describe};root.RcSignals=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
