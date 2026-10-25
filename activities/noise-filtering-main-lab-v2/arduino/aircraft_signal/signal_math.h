#pragma once
#include <stdint.h>
#include <math.h>

namespace AircraftLab {
constexpr uint32_t DAC_RATE = 4000, ADC_RATE = 1000;
constexpr uint32_t DAC_INTERVAL_US = 1000000 / DAC_RATE;
constexpr uint32_t ADC_INTERVAL_US = 1000000 / ADC_RATE;
constexpr unsigned TABLE_SIZE = 800; // 0.2 s: all six frequencies repeat exactly.
constexpr uint16_t ADC_MAX = 4095;
constexpr float USEFUL_HZ[] = {50, 55, 70};
constexpr float INTERFERENCE_HZ[] = {120, 150, 180};
inline float sourceVolts(unsigned phase) {
  const double t = double(phase % TABLE_SIZE) / DAC_RATE;
  double v = 2.0;
  for (float f : USEFUL_HZ) v += 0.20 * sin(6.283185307179586 * f * t);
  for (float f : INTERFERENCE_HZ) v += 0.10 * sin(6.283185307179586 * f * t);
  return float(v);
}
inline uint16_t dacCode(float v, float reference) {
  const long value = lroundf(v * ADC_MAX / reference);
  return uint16_t(value < 0 ? 0 : value > ADC_MAX ? ADC_MAX : value);
}
inline float volts(uint16_t code, float reference) { return float(code) * reference / ADC_MAX; }
inline bool clipped(uint16_t code) { return code == 0 || code >= ADC_MAX; }
struct Values { float rc, ma, ema; };
struct Timing {
  uint32_t count = 0, previousUs = 0, missed = 0, maxGap = 0, maxIntervalError = 0;
  uint64_t elapsedUs = 0;
  uint32_t observe(uint32_t now, uint32_t interval) {
    uint32_t slots = 1;
    if (count) {
      const uint32_t gap = now - previousUs; // Unsigned subtraction handles micros wrap.
      elapsedUs += gap;
      if (gap > maxGap) maxGap = gap;
      const uint32_t error = gap > interval ? gap - interval : interval - gap;
      if (error > maxIntervalError) maxIntervalError = error;
      slots = (gap + interval / 2) / interval;
      if (!slots) slots = 1;
      missed += slots - 1;
    }
    previousUs = now; ++count;
    return slots;
  }
  double actualRate() const { return count > 1 && elapsedUs ? double(count - 1) * 1000000.0 / double(elapsedUs) : 0; }
};
template <unsigned N> struct OutputQueue {
  static_assert(N > 1, "Output queue must have at least two slots");
  Values values[N] = {};
  unsigned head = 0, tail = 0, used = 0;
  bool push(Values value) {
    if (used == N) return false;
    values[head] = value; head = (head + 1) % N; ++used; return true;
  }
  bool pop(Values &value) {
    if (!used) return false;
    value = values[tail]; tail = (tail + 1) % N; --used; return true;
  }
  void clear() { head = tail = used = 0; }
};
}
