/* 2145427 Week 12 — Aircraft pulse investigation v3.0.0
   UNO R4 Minima / WiFi. A0 = DAC source. A1 = measured return. Common GND.
   Useful: repeating 1 s cycle, baseline 2 V, long pulse 2.6 V at 120..320 ms,
   short pulse 2.5 V at 620..640 ms. Interference: 120, 150, 180 Hz
   (0.10 V peak each). source clean / source noisy select the comparison.
   No external source connected to A0. Clean pulses have their own harmonics.
   The supplied starter has one deliberate compilation error to investigate.
   Downloaded student sketches are self-contained; the build inlines signal_math.h.
*/
#include <Arduino.h>
#include <FspTimer.h>
#include <stdio.h>
#include <string.h>
#include "signal_math.h"
#if !defined(ARDUINO_UNOR4_MINIMA) && !defined(ARDUINO_UNOR4_WIFI)
#error "Select Arduino UNO R4 Minima or UNO R4 WiFi, not UNO R3 or Mega."
#endif
using namespace AircraftLab;

// EDIT: enter the supply/reference you measured; it is not measured by this code.
constexpr float REFERENCE_V = 5.00f;
static_assert(REFERENCE_V >= 3.5f && REFERENCE_V <= 5.5f, "Check measured reference and voltage range");
// DIGITAL STAGE: integrate the working examples and then enable their trace labels.
constexpr bool DIGITAL_FILTERS = false;

// STUDENT FILTER AREA. The initial source stage has no digital filtering.
// Insert the example classes/objects above this function; replace its definition
// once to apply MA and EMA independently to measured. Keep timer/serial code below.
void processSample(float measured, float &ma, float &ema) {
  ma = measured;
  ema = measured;
}
// END STUDENT FILTER AREA

FspTimer signalTimer, sampleTimer;
uint16_t waveform[TABLE_SIZE], cleanLevels[3]; // Clean reference needs only three codes.
OutputQueue<64> outputQueue;
Timing dacTiming, adcTiming;
uint32_t phaseTick = 0, clippingCount = 0, outputOverruns = 0, invalidFilterValues = 0;
uint32_t maxProcessingUs = 0, shortSerialWrites = 0;
volatile bool streaming = true;
volatile bool interferenceEnabled = true;
bool timerOK = false;
char pendingLine[96];
unsigned pendingLength = 0;

// Hardware-timed source and acquisition. No serial calls, allocation or sin()
// here. Queue pressure never stops source, sampling or filter state updates.
void onSignalTick(timer_callback_args_t *) {
  const uint32_t now = micros();
  phaseTick += dacTiming.observe(now, DAC_INTERVAL_US);
  const unsigned tick = phaseTick % TABLE_SIZE;
  analogWrite(A0, interferenceEnabled ? waveform[tick] : cleanLevels[pulseLevel(tick)]);
}
void onSampleTick(timer_callback_args_t *) {
    const uint32_t start = micros();
    adcTiming.observe(start, ADC_INTERVAL_US);
    const uint16_t raw = analogRead(A1);
    if (clipped(raw)) ++clippingCount;
    const float measured = volts(raw, REFERENCE_V);
    float ma = measured, ema = measured;
    processSample(measured, ma, ema);
    if (!isfinite(ma) || !isfinite(ema)) ++invalidFilterValues;
    else if (streaming && !outputQueue.push({measured, ma, ema})) ++outputOverruns;
    const uint32_t duration = micros() - start;
    if (duration > maxProcessingUs) maxProcessingUs = duration;
}
bool startSignalGenerator() {
  uint8_t type = GPT_TIMER;
  const int8_t channel = FspTimer::get_available_timer(type);
  if (channel < 0) return false;
  if (!signalTimer.begin(TIMER_MODE_PERIODIC, type, uint8_t(channel), float(DAC_RATE), 0.0f, onSignalTick)) return false;
  if (!signalTimer.setup_overflow_irq(4) || !signalTimer.open()) return false;
  type = GPT_TIMER;
  const int8_t adcChannel = FspTimer::get_available_timer(type);
  if (adcChannel < 0 || !sampleTimer.begin(TIMER_MODE_PERIODIC, type, uint8_t(adcChannel), float(ADC_RATE), 0.0f, onSampleTick)) return false;
  if (!sampleTimer.setup_overflow_irq(8) || !sampleTimer.open()) return false;
  if (!signalTimer.start()) return false;
  // Offset ADC work from the DAC update. Higher-priority DAC IRQ can preempt ADC.
  delayMicroseconds(125);
  if (!sampleTimer.start()) { signalTimer.stop(); analogWrite(A0, dacCode(2.0f, REFERENCE_V)); return false; }
  return true;
}
void pausePlot() {
  noInterrupts(); streaming = false; outputQueue.clear(); interrupts();
  pendingLength = 0;
}
void printStatus() {
  pausePlot();
  Timing dacCopy, adcCopy;
  uint32_t clipping, overruns, invalid, processing, shortWrites;
  noInterrupts();
  dacCopy = dacTiming; adcCopy = adcTiming; clipping = clippingCount;
  overruns = outputOverruns; invalid = invalidFilterValues; processing = maxProcessingUs; shortWrites = shortSerialWrites;
  interrupts();
  Serial.println("# Aircraft pulses v3.0.0; LIVE stream only; status pauses plotting");
#if defined(ARDUINO_UNOR4_MINIMA)
  Serial.println("# board,UNO_R4_MINIMA");
#else
  Serial.println("# board,UNO_R4_WIFI");
#endif
  Serial.print("# timer_started,"); Serial.println(timerOK ? 1 : 0);
  Serial.println("# source,A0_DAC; return,A1_ADC; bits,12; baud,500000");
  Serial.println("# useful,repeating_long_short_pulses; cycle_ms,1000; baseline_v,2.0");
  Serial.println("# long_start_ms,120; long_width_ms,200; long_level_v,2.6");
  Serial.println("# short_start_ms,620; short_width_ms,20; short_level_v,2.5");
  Serial.println("# interference_hz,120,150,180; interference_peak_v_each,0.10");
  Serial.print("# source_mode,"); Serial.println(interferenceEnabled ? "noisy" : "clean");
  Serial.print("# entered_reference_v,"); Serial.println(REFERENCE_V, 6);
  Serial.print("# digital_filters_enabled,"); Serial.println(DIGITAL_FILTERS ? 1 : 0);
  Serial.println("# nominal_dac_hz,4000; nominal_adc_hz,1000");
  Serial.print("# actual_dac_updates_hz,"); Serial.println(dacCopy.actualRate(), 6);
  Serial.print("# actual_adc_samples_hz,"); Serial.println(adcCopy.actualRate(), 6);
  Serial.print("# dac_update_count,"); Serial.println(dacCopy.count);
  Serial.print("# adc_sample_count,"); Serial.println(adcCopy.count);
  Serial.print("# adc_elapsed_seconds,"); Serial.println(double(adcCopy.elapsedUs) / 1000000.0, 6);
  Serial.print("# dac_missed_slots_estimate,"); Serial.println(dacCopy.missed);
  Serial.print("# adc_missed_slots_estimate,"); Serial.println(adcCopy.missed);
  Serial.print("# max_dac_gap_us,"); Serial.println(dacCopy.maxGap);
  Serial.print("# max_adc_gap_us,"); Serial.println(adcCopy.maxGap);
  Serial.print("# max_dac_interval_error_us,"); Serial.println(dacCopy.maxIntervalError);
  Serial.print("# max_adc_interval_error_us,"); Serial.println(adcCopy.maxIntervalError);
  Serial.print("# max_sample_processing_us,"); Serial.println(processing);
  Serial.print("# clipping_count,"); Serial.println(clipping);
  Serial.print("# output_queue_overruns,"); Serial.println(overruns);
  Serial.print("# partial_serial_writes,"); Serial.println(shortWrites);
  Serial.print("# invalid_filter_values,"); Serial.println(invalid);
  Serial.println("# Missed-slot estimates use measured gaps. Inspect the source on the scope.");
  Serial.println("# plot = resume live plot; resetstats = clear diagnostics, not waveform/filter state");
  Serial.println("# source clean / source noisy = select source; phase continues; discard transition cycles");
}
void handleCommand(const char *line) {
  if (!strcmp(line, "plot")) {
    pendingLength = 0;
    noInterrupts(); outputQueue.clear(); streaming = true; interrupts();
  } else if (!strcmp(line, "source clean") || !strcmp(line, "source noisy")) {
    pausePlot();
    interferenceEnabled = !strcmp(line, "source noisy");
    Serial.print("# Source selected: "); Serial.println(interferenceEnabled ? "noisy" : "clean");
    Serial.println("# Cycle phase and acquisition continue. Wait two complete cycles; send plot to resume.");
  } else if (!strcmp(line, "status") || !strcmp(line, "help")) printStatus();
  else if (!strcmp(line, "resetstats")) {
    pausePlot();
    noInterrupts(); dacTiming = Timing{}; adcTiming = Timing{};
    clippingCount = outputOverruns = invalidFilterValues = maxProcessingUs = shortSerialWrites = 0;
    interrupts();
    Serial.println("# Diagnostics reset; generation continues. Send plot to resume.");
  } else {
    pausePlot(); Serial.println("# Unknown command. Use source clean, source noisy, plot, status, resetstats or help; newline required.");
  }
}
void serviceLivePlot() {
  static char commandLine[40]; static unsigned length = 0; static bool overflow = false;
  while (Serial.available()) {
    const char c = char(Serial.read());
    if (c == '\r') continue;
    if (c == '\n') {
      if (overflow) { pausePlot(); Serial.println("# Command too long; discarded."); }
      else if (length) { commandLine[length] = 0; handleCommand(commandLine); }
      length = 0; overflow = false;
    } else if (length < sizeof(commandLine) - 1 && !overflow) commandLine[length++] = c;
    else overflow = true;
  }
  if (!Serial || !streaming) return;
  if (!pendingLength) {
    Values value;
    noInterrupts(); const bool haveValue = outputQueue.pop(value); interrupts();
    if (!haveValue) return;
    const int n = DIGITAL_FILTERS
      ? snprintf(pendingLine, sizeof(pendingLine), "RC:%.5f\tRC_MA:%.5f\tRC_EMA:%.5f\n", double(value.rc), double(value.ma), double(value.ema))
      : snprintf(pendingLine, sizeof(pendingLine), "RC:%.5f\n", double(value.rc));
    if (n <= 0 || unsigned(n) >= sizeof(pendingLine)) { noInterrupts(); ++outputOverruns; interrupts(); return; }
    pendingLength = unsigned(n);
  }
  // Never wait for a full UART/USB transmit buffer. Keep a complete line pending.
  if (Serial.availableForWrite() >= int(pendingLength)) {
    const unsigned written = unsigned(Serial.write(reinterpret_cast<const uint8_t *>(pendingLine), pendingLength));
    if (written < pendingLength) {
      ++shortSerialWrites;
      memmove(pendingLine, pendingLine + written, pendingLength - written);
      pendingLength -= written;
    } else pendingLength = 0;
  }
}
void setup() {
  analogReadResolution(12);
  analogWriteResolution(12);
  Serial.begin(500000);
  for (unsigned i = 0; i < TABLE_SIZE; ++i) waveform[i] = dacCode(sourceVolts(i), REFERENCE_V);
  cleanLevels[0] = dacCode(2.00f, REFERENCE_V);
  cleanLevels[1] = dacCode(2.60f, REFERENCE_V);
  cleanLevels[2] = dacCode(2.50f, REFERENCE_V);
  analogWrite(A0, dacCode(2.0f, REFERENCE_V));
  (void)analogRead(A1); // Configure ADC before entering the timed callback.
  timerOK = startSignalGenrator();
}
void loop() {
  if (!timerOK) {
    static bool reported = false;
    if (Serial && !reported) { Serial.println("# Timer start failed. Check board/core and available timer. No waveform started."); reported = true; }
  }
  serviceLivePlot();
}
