#include "../activities/noise-filtering-main-lab-v1/arduino/noise_filtering_main_lab/acquisition.h"
#include <assert.h>
#include <cmath>
using namespace NoiseLab;
int main() {
  Filters f; f.seed(2);
  for (int i=0; i<500; i++) { auto v=f.next(2); assert(v.raw==2 && v.ma5==2 && v.ma21==2 && fabs(v.ema04-2)<1e-6); }
  auto v=f.next(3); assert(fabs(v.ma5-2.2)<1e-6); assert(fabs(v.ma21-(2+1.0/21))<1e-6); assert(fabs(v.ema20-2.2)<1e-6); assert(fabs(v.ema04-2.04)<1e-6);
  Filters saved=f, replay=saved;
  for (int i=0;i<100;i++) { auto a=f.next(i%2?2.1f:1.9f), b=replay.next(i%2?2.1f:1.9f); assert(a.ema04==b.ema04 && a.ma21==b.ma21); }
  Statistics s; for(int i=0;i<1000;i++) s.add(i%2?2.01:1.99); assert(fabs(s.mean-2)<1e-10); assert(fabs(s.noiseRms()-.01)<1e-10);
  Statistics constant; constant.add(2);constant.add(2);assert(constant.noiseRms()==0);
  assert(volts(4095,4.98f)==4.98f); assert(clipped(0)&&clipped(4095)&&!clipped(2000));
  Timing t; assert(t.advance(2100,2000)==4000); assert(t.missed==0&&t.maxLate==100);
  assert(t.advance(8500,4000)==10000); assert(t.missed==2&&t.maxLate==4500);
  Timing wrap; assert(wrap.advance(1000,UINT32_MAX-999)==3000); assert(wrap.missed==1);
  assert(fabs(actualRate(2000,15,3998015)-500)<1e-12); assert(std::isnan(actualRate(1,0,0)));
  assert(sizeof(Sample)*CAPACITY<=16000);
}
