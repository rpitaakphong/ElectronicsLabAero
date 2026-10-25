#pragma once
#include <stdint.h>
#include <math.h>

namespace NoiseLab {
constexpr uint32_t SAMPLE_US = 2000;
constexpr uint32_t CAPTURE_US = 4000000;
constexpr uint16_t CAPACITY = CAPTURE_US / SAMPLE_US;
constexpr uint16_t WARMUP_SAMPLES = 500;
constexpr uint16_t ADC_MAX = 4095;
constexpr float EMA_FAST = 0.20f, EMA_SLOW = 0.04f;

template <uint16_t N> struct MovingAverage {
  float buffer[N];
  uint16_t index = 0;
  double sum = 0;
  void seed(float value) { for (uint16_t i = 0; i < N; i++) buffer[i] = value; index = 0; sum = double(value) * N; }
  float next(float value) { sum -= buffer[index]; buffer[index] = value; sum += value; index = (index + 1) % N; return float(sum / N); }
};
struct Values { float raw, ma5, ma21, ema20, ema04; };
struct Filters {
  MovingAverage<5> shortMA;
  MovingAverage<21> longMA;
  float fast = 0, slow = 0;
  void seed(float value) { shortMA.seed(value); longMA.seed(value); fast = slow = value; }
  Values next(float raw) {
    fast = EMA_FAST * raw + (1.0f - EMA_FAST) * fast;
    slow = EMA_SLOW * raw + (1.0f - EMA_SLOW) * slow;
    return { raw, shortMA.next(raw), longMA.next(raw), fast, slow };
  }
};
struct Statistics {
  uint32_t n = 0;
  double mean = 0, m2 = 0;
  void add(double x) { n++; const double delta = x - mean; mean += delta / n; m2 += delta * (x - mean); }
  double noiseRms() const { return n ? sqrt(fmax(0.0, m2 / n)) : NAN; }
};
struct Timing {
  uint32_t missed = 0, maxLate = 0;
  uint32_t advance(uint32_t actual, uint32_t scheduled) {
    const uint32_t late = actual - scheduled;
    if (late > maxLate) maxLate = late;
    const uint32_t skipped = late / SAMPLE_US;
    missed += skipped;
    // Skip expired slots; never take rapid catch-up samples and call them 500 Hz.
    return scheduled + (skipped + 1) * SAMPLE_US;
  }
};
struct Sample { uint32_t us; uint16_t raw; uint8_t led; };
inline float volts(uint16_t code, float reference) { return float(code) * reference / ADC_MAX; }
inline bool clipped(uint16_t code) { return code == 0 || code >= ADC_MAX; }
inline double actualRate(uint32_t count, uint32_t first, uint32_t last) { return count > 1 && last > first ? double(count - 1) * 1000000.0 / (last - first) : NAN; }
}
