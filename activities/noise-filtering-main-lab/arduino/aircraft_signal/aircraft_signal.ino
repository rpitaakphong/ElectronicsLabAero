/* Aircraft pulse investigation v4.0.0 — working source only.
   UNO R4 Minima / WiFi: A0 DAC to scope CH1; probe ground to UNO GND.
   No A1 acquisition, digital filtering or serial output in this sketch.
   A one-second pattern repeats: 2.0 V baseline; 2.6 V at 120–320 ms;
   2.5 V at 620–640 ms. Added interference: 120, 150, 180 Hz, 0.10 V peak each.
   Do not connect another output to A0. Verify actual levels on the scope.
*/
#include <Arduino.h>
#include <FspTimer.h>
#include <math.h>
#if !defined(ARDUINO_UNOR4_MINIMA) && !defined(ARDUINO_UNOR4_WIFI)
#error "Select Arduino UNO R4 Minima or UNO R4 WiFi."
#endif
// Enter the measured supply/reference voltage; the sketch does not measure it.
constexpr float REFERENCE_V = 5.00f;
static_assert(REFERENCE_V >= 3.5f && REFERENCE_V <= 5.5f, "Check the measured reference voltage");
constexpr uint32_t DAC_RATE = 4000, DAC_INTERVAL_US = 1000000 / DAC_RATE;
constexpr unsigned TABLE_SIZE = DAC_RATE;
constexpr float INTERFERENCE_HZ[] = {120, 150, 180};
uint16_t waveform[TABLE_SIZE];
FspTimer signalTimer;
uint32_t phaseTick = 0, previousUs = 0;
bool firstTick = true, timerOK = false;
uint16_t dacCode(float voltage) {
  const long code = lroundf(voltage * 4095.0f / REFERENCE_V);
  return uint16_t(code < 0 ? 0 : code > 4095 ? 4095 : code);
}
float sourceVolts(unsigned tick) {
  tick %= TABLE_SIZE;
  const double t = double(tick) / DAC_RATE;
  double voltage = tick >= 480 && tick < 1280 ? 2.60 : tick >= 2480 && tick < 2560 ? 2.50 : 2.00;
  for (float frequency : INTERFERENCE_HZ) voltage += 0.10 * sin(6.283185307179586 * frequency * t);
  return float(voltage);
}
// No sine calculation, allocation or printing in the timed callback.
void onSignalTick(timer_callback_args_t *) {
  const uint32_t now = micros();
  uint32_t slots = 1;
  if (!firstTick) {
    const uint32_t gap = now - previousUs; // Also works across micros() rollover.
    slots = (gap + DAC_INTERVAL_US / 2) / DAC_INTERVAL_US;
    if (!slots) slots = 1;
  }
  firstTick = false; previousUs = now;
  phaseTick = (phaseTick + slots) % TABLE_SIZE;
  analogWrite(A0, waveform[phaseTick]);
}
bool startSignalGenerator() {
  uint8_t type = GPT_TIMER;
  const int8_t channel = FspTimer::get_available_timer(type);
  if (channel < 0) return false;
  if (!signalTimer.begin(TIMER_MODE_PERIODIC, type, uint8_t(channel), float(DAC_RATE), 0.0f, onSignalTick)) return false;
  return signalTimer.setup_overflow_irq(4) && signalTimer.open() && signalTimer.start();
}
void setup() {
  analogWriteResolution(12);
  for (unsigned i = 0; i < TABLE_SIZE; ++i) waveform[i] = dacCode(sourceVolts(i));
  analogWrite(A0, dacCode(2.0f));
  timerOK = startSignalGenerator();
  // If the timer cannot start, A0 stays at the baseline. Check board/core/timer.
}
void loop() {
  // The hardware timer continuously generates the signal. No other output.
}
