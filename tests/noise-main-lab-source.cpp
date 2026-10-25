#define ARDUINO_UNOR4_WIFI 1
#include "source.ino"
#include <cassert>
int main() {
  setup(); assert(timerOK && writeBits == 12 && readBits == 0 && Serial.baud == 0);
  assert(dacCode(-1) == 0 && dacCode(8) == 4095);
  unsigned longCount=0, shortCount=0;
  double coefficients[3]={};
  for (unsigned i=0;i<TABLE_SIZE;++i) {
    const double clean=i>=480&&i<1280?2.6:i>=2480&&i<2560?2.5:2.0;
    if(clean==2.6)++longCount; if(clean==2.5)++shortCount;
    assert(sourceVolts(i)>=1.699 && sourceVolts(i)<=2.901);
    assert(sourceVolts(i)==sourceVolts(i+TABLE_SIZE));
    assert(waveform[i]==dacCode(sourceVolts(i)));
    for(unsigned j=0;j<3;++j) coefficients[j]+=(sourceVolts(i)-clean)*sin(6.283185307179586*INTERFERENCE_HZ[j]*i/DAC_RATE)*2/TABLE_SIZE;
    fakeMicros=(i+1)*250;inCallback=true;onSignalTick(nullptr);inCallback=false;
    assert(lastDac==waveform[(i+1)%TABLE_SIZE]);
    loop();
  }
  assert(longCount==800&&shortCount==80);
  for(double amplitude:coefficients)assert(fabs(amplitude-.1)<1e-6);
  assert(Serial.output.empty()&&dacWrites==4001);
  fakeMicros+=750;onSignalTick(nullptr);assert(phaseTick==3); // Late callback keeps phase time.
  previousUs=0xffffff00u;fakeMicros=previousUs+250u;onSignalTick(nullptr);assert(phaseTick==4);
  fakeMicros+=250u;onSignalTick(nullptr);assert(phaseTick==5); // micros rollover.
}
