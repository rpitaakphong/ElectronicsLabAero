#define ARDUINO_UNOR4_MINIMA 1
#include "digital.ino"
#include <iostream>
ExampleMA<5> oracleMA;
ExampleEMA oracleEMA;
void tick(unsigned n) {
  fakeMicros=n*250;
  fakeAdc=AircraftLab::dacCode(AircraftLab::sourceVolts(n),REFERENCE_V);
  inCallback=true;onSignalTick(nullptr);
  if(n%4==0){
    const auto used=outputQueue.used;
    const float measured=AircraftLab::volts(fakeAdc,REFERENCE_V);
    const float expectedMA=oracleMA.next(measured),expectedEMA=oracleEMA.next(measured);
    onSampleTick(nullptr);
    if(streaming&&used<64){
      const auto actual=outputQueue.values[(outputQueue.head+63)%64];
      assert(fabs(actual.ma-expectedMA)<1e-6&&fabs(actual.ema-expectedEMA)<1e-6);
    }
  }
  inCallback=false;
}
int main(){
  setup();assert(timerOK&&Serial.baud==500000&&readBits==12&&writeBits==12);
  Serial.capacity=0;
  for(unsigned n=1;n<=4000;++n){tick(n);serviceLivePlot();}
  assert(dacTiming.count==4000&&adcTiming.count==1000);
  assert(dacTiming.actualRate()==4000&&adcTiming.actualRate()==1000);
  assert(outputOverruns>900&&dacTiming.missed==0&&adcTiming.missed==0);
  assert(Serial.output.empty());
  // Resume below checks actual output against the uninterrupted filter oracle.
  pausePlot();assert(!streaming&&outputQueue.used==0);
  const auto writes=dacWrites;
  for(unsigned n=4001;n<=8000;++n)tick(n);
  assert(dacWrites==writes+4000&&adcTiming.count==2000&&outputQueue.used==0);
  Serial.capacity=96;Serial.maxWrite=3;handleCommand("plot");
  for(unsigned n=8001;n<=8256;++n)tick(n);
  assert(outputQueue.used==64);
  unsigned iterations=0;
  while(outputQueue.used||pendingLength){serviceLivePlot();assert(++iterations<5000);}
  assert(shortSerialWrites>0);
  unsigned rows=0;std::istringstream lines(Serial.output);std::string line;
  while(std::getline(lines,line)){
    assert(line.rfind("RC:",0)==0&&line.find("\tRC_MA:")!=std::string::npos&&line.find("\tRC_EMA:")!=std::string::npos);++rows;
  }
  assert(rows==64);
  Serial.output.clear();Serial.input="status\n";serviceLivePlot();
  assert(!streaming&&Serial.output.find("output_queue_overruns")!=std::string::npos&&Serial.output.find("partial_serial_writes")!=std::string::npos);
  handleCommand("resetstats");assert(dacTiming.count==0&&adcTiming.count==0&&outputOverruns==0);
  handleCommand("plot");assert(streaming);
  fakeAdc=0;fakeMicros+=1000;inCallback=true;onSampleTick(nullptr);inCallback=false;assert(clippingCount==1);
}
