#include "../activities/noise-filtering-main-lab-v2/arduino/aircraft_signal/signal_math.h"
#include <cassert>
#include <cmath>
#include <initializer_list>
#include "filter_examples.h"
using namespace AircraftLab;
int main() {
  double mean = 0;
  for (unsigned i = 0; i < TABLE_SIZE; ++i) { const float v = sourceVolts(i); assert(v >= 1.1 && v <= 2.9); mean += v; assert(sourceVolts(i) == sourceVolts(i + TABLE_SIZE)); }
  assert(fabs(mean / TABLE_SIZE - 2.0) < 1e-7);
  for (int f : {50, 55, 70, 120, 150, 180, 30, 200}) {
    double a = 0, b = 0;
    for (unsigned i = 0; i < TABLE_SIZE; ++i) {
      const double theta = 6.283185307179586 * f * i / DAC_RATE;
      a += (sourceVolts(i) - 2) * sin(theta); b += (sourceVolts(i) - 2) * cos(theta);
    }
    const double peak = 2 * hypot(a, b) / TABLE_SIZE;
    const double expected = f == 50 || f == 55 || f == 70 ? .2 : f == 120 || f == 150 || f == 180 ? .1 : 0;
    assert(fabs(peak - expected) < 1e-7);
  }
  assert(dacCode(5,5)==4095 && dacCode(-1,5)==0); assert(fabs(volts(dacCode(2,4.98f),4.98f)-2)<.0013);
  assert(clipped(0) && clipped(4095) && !clipped(2000));
  Timing dac; for(unsigned i=0;i<4001;++i) dac.observe(i*250,250);
  assert(dac.actualRate()==4000 && dac.missed==0 && dac.maxGap==250);
  dac.observe(1001000,250); assert(dac.missed==3 && dac.maxGap==1000);
  Timing adc; for(unsigned i=0;i<1001;++i) adc.observe(i*1000,1000); assert(adc.actualRate()==1000);
  Timing wrap; wrap.observe(UINT32_MAX-499,1000); wrap.observe(500,1000); assert(wrap.elapsedUs==1000 && wrap.missed==0);
  OutputQueue<2> queue; assert(queue.push({1,2,3}) && queue.push({4,5,6}) && !queue.push({7,8,9}));
  Values v; assert(queue.pop(v) && v.rc==1 && v.ma==2); assert(queue.push({7,8,9}));
  assert(queue.pop(v) && v.rc==4); assert(queue.pop(v) && v.rc==7); assert(!queue.pop(v));
  ExampleMA<5> ma; ExampleEMA ema;
  assert(ma.next(2)==2 && ema.next(2)==2);
  assert(fabs(ma.next(3)-2.2)<1e-6 && fabs(ema.next(3)-2.4)<1e-6);
  for(int i=0;i<5;++i) v.ma=ma.next(3); assert(fabs(v.ma-3)<1e-6);
  // Long serial backpressure must not stop digital state updates.
  ExampleMA<5> a, b; ExampleEMA e, e2; unsigned overruns = 0;
  for(int i=0;i<10000;++i) {
    float x=sourceVolts(i*4);
    Values actual={x,a.next(x),e.next(x)}, expected={x,b.next(x),e2.next(x)};
    if(!queue.push(actual)) ++overruns;
    assert(actual.ma==expected.ma && actual.ema==expected.ema);
  }
  assert(overruns==9998);
}
