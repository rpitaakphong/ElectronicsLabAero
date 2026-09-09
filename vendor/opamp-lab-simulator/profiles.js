/* Lab-specific capabilities; the editor and routing remain shared. */
(function (root) {
  'use strict';
  root.LabProfiles = {
    opamp: {
      id: 'opamp', validation:'opamp', references:'opamp', persistence:{lab:'opamp',legacy:true}, solver:'opamp-transient', connectivity:'powered-rails', instruments:['generator','scope','supply'], defaults:{capacitor:100e-9},
      tools: ['wire', 'resistor', 'capacitor', 'opamp'],
      storage: 'gds1202b',
      leads: {
        generator: ['#d99a38', 'MAIN', 176],
        genttl: ['#dc8be0', 'TTL', 224],
        gengnd: ['#4c6058', 'GEN GND', 128],
        ch1tip: ['#f1d63a', 'CH1 tip', 272],
        ch1gnd: ['#5e5e5e', 'CH1 GND', 80],
        ch2tip: ['#63b9ff', 'CH2 tip', 464],
        ch2gnd: ['#333333', 'CH2 GND', 544],
      },
    },
    'rc-filter': {
      id:'rc-filter', validation:'rc', solver:'rc-periodic', connectivity:'independent', instruments:['generator','scope'],
      tools:['wire','resistor','capacitor'], storage:'rc-filter-v1', defaults:{resistor:10000,capacitor:10e-9},
      ranges:{resistor:[100,1e6],capacitor:[1e-10,1e-5]}, references:'rc', persistence:{lab:'rc-filter',version:1},
      leads:{generator:['#d99a38','MAIN',176],genttl:['#dc8be0','TTL',224],gengnd:['#4c6058','GEN GND',128],ch1tip:['#f1d63a','CH1 tip',272],ch1gnd:['#5e5e5e','CH1 GND',80],ch2tip:['#63b9ff','CH2 tip',464],ch2gnd:['#333333','CH2 GND',544]},
    },
    'voltage-divider': {
      id: 'voltage-divider', validation:'divider', references:'divider', persistence:{lab:'voltage-divider',version:1}, solver:'dc', connectivity:'independent', instruments:['supply','meter'], defaults:{resistor:10000},
      tools: ['wire', 'resistor', 'potentiometer', 'sensor'],
      storage: 'voltage-divider-v1',
      leads: {
        supplyPositive: ['#a82936', 'DC +', 128],
        supplyNegative: ['#353d46', 'DC −', 224],
        meterRed: ['#b72f42', 'Meter red', 320],
        meterBlack: ['#303c49', 'Meter black', 464],
      },
    },
  };
})(globalThis);
