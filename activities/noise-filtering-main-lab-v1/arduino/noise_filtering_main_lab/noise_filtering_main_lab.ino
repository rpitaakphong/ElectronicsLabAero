/* 2145427 Week 12 — Noise and Filtering acquisition v1.0.0
   UNO R4 Minima / WiFi only. A0 input; D9 -> 1 kOhm -> LED -> GND.
   Generator mode: sensor source disconnected; D9 is high impedance.
   All instrument grounds at circuit GND. Verify 1–3 V at A0 with a scope.
   Four-second acquisition is buffered; serial output happens afterward.
   No SNR calculation: preserve CSV for individual post-lab analysis.
*/
#include <Arduino.h>
#include <stdlib.h>
#include <string.h>
#include "acquisition.h"
#if !defined(ARDUINO_UNOR4_MINIMA) && !defined(ARDUINO_UNOR4_WIFI)
#error "Select Arduino UNO R4 Minima or UNO R4 WiFi. This sketch is not for UNO R3."
#endif
using namespace NoiseLab;
constexpr int LED_PIN = 9;
enum Mode { STEADY, DARK, STEP, PULSE, EXTERNAL };
const char *modeNames[] = { "steady", "dark", "step", "pulse", "external" };
Sample samples[CAPACITY];
Filters initialFilters;
Timing captureTiming, warmupTiming;
float referenceV = 5.0f, capturedReference = 5.0f;
uint32_t pulseMs = 250, capturedPulseMs = 250, run = 0;
uint32_t riseUs = 0, fallUs = 0, railCount = 0, maxGapUs = 0;
uint16_t count = 0;
Mode capturedMode = STEADY;
bool haveCapture = false, referenceConfirmed = false, capturedReferenceConfirmed = false;
static_assert(sizeof(samples) <= 16000, "Capture exceeds the UNO R4 RAM budget.");

void printHelp() {
  Serial.println("# Noise Lab v1.0.0; UNO R4; input A0; 12-bit; nominal 500 samples/s");
  Serial.println("# ref 4.98 : enter your measured supply/reference voltage (3.0–5.5 V)");
  Serial.println("# pulsems 250 : optical pulse width (20–1000 ms); instructor checks LDR response");
  Serial.println("# steady | dark | step | pulse | external : acquire and export CSV");
  Serial.println("# csv : repeat last complete CSV; plot : replay last record, NOT live");
  Serial.println("# summary : steady/dark mean and mean-removed RMS; help : commands");
  Serial.println("# Use newline in Serial Monitor, 115200 baud. No serial printing during acquisition.");
}
void printMetadata() {
  Serial.println("# BEGIN_NOISE_LAB_CSV_V1");
  Serial.println("# sketch_version,1.0.0");
#if defined(ARDUINO_UNOR4_MINIMA)
  Serial.println("# board,UNO_R4_MINIMA");
#else
  Serial.println("# board,UNO_R4_WIFI");
#endif
  Serial.print("# run_id,"); Serial.println(run);
  Serial.print("# mode,"); Serial.println(modeNames[capturedMode]);
  Serial.println("# adc_pin,A0"); Serial.println("# adc_bits,12");
  Serial.print("# reference_v,"); Serial.println(capturedReference, 6);
  Serial.print("# measured_reference_confirmed,"); Serial.println(capturedReferenceConfirmed ? 1 : 0);
  Serial.println("# nominal_sample_rate_hz,500");
  Serial.println("# requested_capture_us,4000000");
  Serial.print("# sample_count,"); Serial.println(count);
  Serial.print("# actual_sample_rate_hz,"); Serial.println(count > 1 ? actualRate(count, samples[0].us, samples[count - 1].us) : NAN, 6);
  Serial.print("# first_sample_us,"); Serial.println(count ? samples[0].us : 0);
  Serial.print("# last_sample_us,"); Serial.println(count ? samples[count - 1].us : 0);
  Serial.print("# max_sample_gap_us,"); Serial.println(maxGapUs);
  Serial.print("# missed_sample_slots,"); Serial.println(captureTiming.missed);
  Serial.print("# max_deadline_lateness_us,"); Serial.println(captureTiming.maxLate);
  Serial.print("# clipping_count,"); Serial.println(railCount);
  Serial.println("# initial_settle_ms,1500");
  Serial.println("# warmup_samples,500");
  Serial.print("# warmup_missed_slots,"); Serial.println(warmupTiming.missed);
  Serial.print("# warmup_max_lateness_us,"); Serial.println(warmupTiming.maxLate);
  Serial.println("# ma_short_samples,5"); Serial.println("# ma_long_samples,21");
  Serial.println("# ema_fast_alpha,0.20"); Serial.println("# ema_slow_alpha,0.04");
  Serial.print("# initial_ema_fast_v,"); Serial.println(initialFilters.fast, 9);
  Serial.print("# initial_ema_slow_v,"); Serial.println(initialFilters.slow, 9);
  Serial.print("# initial_ma_short_history_oldest_first_v");
  for (uint16_t i = 0; i < 5; i++) { Serial.print(','); Serial.print(initialFilters.shortMA.buffer[(initialFilters.shortMA.index + i) % 5], 9); } Serial.println();
  Serial.print("# initial_ma_long_history_oldest_first_v");
  for (uint16_t i = 0; i < 21; i++) { Serial.print(','); Serial.print(initialFilters.longMA.buffer[(initialFilters.longMA.index + i) % 21], 9); } Serial.println();
  Serial.print("# requested_optical_pulse_ms,"); Serial.println(capturedPulseMs);
  Serial.print("# led_rise_us,"); Serial.println(riseUs);
  Serial.print("# led_fall_us,"); Serial.println(fallUs);
  Serial.println("# time_origin,scheduled_capture_start; sample time is micros immediately before analogRead");
  Serial.println("# led_state,0=LOW;1=HIGH;2=high_impedance_external_mode");
  Serial.println("# event_note,zero edge timestamp means no edge in this record; external timing comes from scope");
}
void exportCsv() {
  if (!haveCapture) { Serial.println("# No capture yet."); return; }
  printMetadata();
  Serial.println("sample_index,t_us,raw_counts,raw_v,ma5_v,ma21_v,ema20_v,ema04_v,led_state,clipped");
  Filters filters = initialFilters;
  for (uint16_t i = 0; i < count; i++) {
    const Values v = filters.next(volts(samples[i].raw, capturedReference));
    Serial.print(i); Serial.print(','); Serial.print(samples[i].us); Serial.print(','); Serial.print(samples[i].raw); Serial.print(',');
    Serial.print(v.raw, 7); Serial.print(','); Serial.print(v.ma5, 7); Serial.print(','); Serial.print(v.ma21, 7); Serial.print(',');
    Serial.print(v.ema20, 7); Serial.print(','); Serial.print(v.ema04, 7); Serial.print(',');
    Serial.print(samples[i].led); Serial.print(','); Serial.println(clipped(samples[i].raw) ? 1 : 0);
  }
  Serial.println("# END_NOISE_LAB_CSV_V1");
}
void acquire(Mode mode) {
  if (!referenceConfirmed) { Serial.println("# Enter the measured reference first, e.g. ref 4.98. No acquisition started."); return; }
  Serial.println("# Settling, warming up and capturing. Wait for END_NOISE_LAB_CSV_V1 before saving."); Serial.flush();
  capturedMode = mode; capturedReference = referenceV; capturedReferenceConfirmed = referenceConfirmed; capturedPulseMs = pulseMs;
  capturedMode == EXTERNAL ? pinMode(LED_PIN, INPUT) : pinMode(LED_PIN, OUTPUT);
  uint8_t led = mode == EXTERNAL ? 2 : mode == STEADY ? 1 : 0;
  if (mode != EXTERNAL) digitalWrite(LED_PIN, led ? HIGH : LOW);
  delay(1500);
  Filters warmup; warmup.seed(volts(analogRead(A0), capturedReference));
  warmupTiming = Timing{};
  uint32_t scheduled = micros() + SAMPLE_US;
  for (uint16_t i = 0; i < WARMUP_SAMPLES; i++) {
    while (int32_t(micros() - scheduled) < 0) {}
    const uint32_t actual = micros();
    scheduled = warmupTiming.advance(actual, scheduled);
    warmup.next(volts(analogRead(A0), capturedReference));
  }
  initialFilters = warmup;
  const uint32_t origin = scheduled;
  count = 0; railCount = 0; riseUs = fallUs = maxGapUs = 0; captureTiming = Timing{};
  while (count < CAPACITY) {
    while (int32_t(micros() - scheduled) < 0) {}
    uint32_t actual = micros();
    if (actual - origin >= CAPTURE_US) break;
    const uint32_t elapsed = actual - origin;
    if ((mode == STEP || mode == PULSE) && !riseUs && elapsed >= 1000000) { digitalWrite(LED_PIN, HIGH); led = 1; riseUs = micros() - origin; }
    if (mode == PULSE && riseUs && !fallUs && elapsed >= 1000000 + capturedPulseMs * 1000) { digitalWrite(LED_PIN, LOW); led = 0; fallUs = micros() - origin; }
    actual = micros();
    scheduled = captureTiming.advance(actual, scheduled);
    const uint16_t raw = analogRead(A0);
    samples[count] = { actual - origin, raw, led };
    if (clipped(raw)) railCount++;
    if (count && samples[count].us - samples[count - 1].us > maxGapUs) maxGapUs = samples[count].us - samples[count - 1].us;
    count++;
    if (scheduled - origin >= CAPTURE_US) break;
  }
  // Count any remaining expired end-of-window slots as well.
  if (count + captureTiming.missed < CAPACITY) captureTiming.missed = CAPACITY - count;
  if (mode != EXTERNAL) digitalWrite(LED_PIN, LOW);
  run++; haveCapture = true;
  exportCsv();
}
void printSummary() {
  if (!haveCapture || (capturedMode != STEADY && capturedMode != DARK)) { Serial.println("# Noise summary requires a steady or dark capture. A sine/step/pulse contains useful variation."); return; }
  Statistics stats[5]; Filters filters = initialFilters;
  for (uint16_t i = 0; i < count; i++) {
    const Values v = filters.next(volts(samples[i].raw, capturedReference));
    const float values[] = {v.raw, v.ma5, v.ma21, v.ema20, v.ema04};
    for (uint8_t j = 0; j < 5; j++) stats[j].add(values[j]);
  }
  Serial.println("# Whole settled record; mean-removed finite-record RMS; same volts and window for each path.");
  Serial.print("# run_id,"); Serial.println(run);
  Serial.print("# window_first_us,"); Serial.println(count ? samples[0].us : 0);
  Serial.print("# window_last_us,"); Serial.println(count ? samples[count - 1].us : 0);
  const char *labels[] = {"RAW", "MA5", "MA21", "EMA20", "EMA04"};
  Serial.println("# path,mean_v,noise_rms_v");
  for (uint8_t j = 0; j < 5; j++) { Serial.print("# "); Serial.print(labels[j]); Serial.print(','); Serial.print(stats[j].mean, 9); Serial.print(','); Serial.println(stats[j].noiseRms(), 9); }
  Serial.println("# Zero variation is a measurement/resolution limit, not infinite SNR.");
}
void plotReplay() {
  if (!haveCapture) { Serial.println("# No capture yet."); return; }
  Filters filters = initialFilters;
  for (uint16_t i = 0; i < count; i++) {
    const Values v = filters.next(volts(samples[i].raw, capturedReference));
    Serial.print("RAW:"); Serial.print(v.raw, 5); Serial.print("\tMA5:"); Serial.print(v.ma5, 5);
    Serial.print("\tMA21:"); Serial.print(v.ma21, 5); Serial.print("\tEMA20:"); Serial.print(v.ema20, 5); Serial.print("\tEMA04:"); Serial.println(v.ema04, 5);
    delay(2); // Replay pacing only; original timestamps are retained in CSV.
  }
}
bool numericArgument(const char *text, float &value) {
  char *end; value = strtof(text, &end);
  while (*end == ' ') end++;
  return end != text && !*end && isfinite(value);
}
void command(const char *line) {
  float value;
  for (int i = 0; i <= EXTERNAL; i++) if (!strcmp(line, modeNames[i])) { acquire(Mode(i)); return; }
  if (!strcmp(line, "csv")) exportCsv();
  else if (!strcmp(line, "summary")) printSummary();
  else if (!strcmp(line, "plot")) plotReplay();
  else if (!strncmp(line, "ref ", 4) && numericArgument(line + 4, value) && value >= 3 && value <= 5.5) { referenceV = value; referenceConfirmed = true; Serial.println("# Reference set for the NEXT capture. Existing CSV remains unchanged."); }
  else if (!strncmp(line, "pulsems ", 8) && numericArgument(line + 8, value) && value >= 20 && value <= 1000 && floorf(value) == value) { pulseMs = uint32_t(value); Serial.println("# Pulse width set for the NEXT capture."); }
  else if (!strcmp(line, "help")) printHelp();
  else Serial.println("# Unknown command or invalid value. Type help. Nothing acquired or replaced.");
}
void setup() {
  pinMode(LED_PIN, INPUT);
  analogReadResolution(12);
  Serial.begin(115200);
  // A serial connection is required for commands, but never hang startup waiting for one.
}
void loop() {
  static char line[64]; static uint8_t length = 0; static bool overflow = false;
  while (Serial.available()) {
    const char c = char(Serial.read());
    if (c == '\r') continue;
    if (c == '\n') {
      if (overflow) Serial.println("# Command too long; discarded.");
      else if (length) { line[length] = '\0'; command(line); }
      length = 0; overflow = false;
    } else if (length < sizeof(line) - 1 && !overflow) line[length++] = c;
    else overflow = true;
  }
}
