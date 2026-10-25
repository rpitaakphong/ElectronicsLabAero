// One source for the displayed/downloaded examples and instructor compile fixture.
export const FILTER_EXAMPLE = `// Working independent examples. Paste above processSample().
// Start with a 5-sample trailing MA and EMA coefficient 0.40.
template <unsigned N> class ExampleMA {
  static_assert(N >= 1 && N <= 128, "Choose MA length 1..128");
  float history[N] = {};
  float sum = 0;
  unsigned head = 0;
  bool ready = false;
public:
  float next(float x) {
    if (!ready) {
      for (unsigned i = 0; i < N; ++i) history[i] = x;
      sum = N * x; ready = true;
    }
    sum += x - history[head];
    history[head] = x;
    head = (head + 1) % N;
    return sum / N;
  }
};
class ExampleEMA {
  float previous = 0;
  bool ready = false;
public:
  float next(float x) {
    constexpr float alpha = 0.40f;
    static_assert(alpha > 0 && alpha <= 1, "Choose EMA coefficient in (0,1]");
    if (!ready) { previous = x; ready = true; }
    previous = alpha * x + (1 - alpha) * previous;
    return previous;
  }
};
ExampleMA<5> movingAverage;
ExampleEMA exponentialAverage;

// Replace ONLY the existing processSample() definition with this definition:
void processSample(float measured, float &ma, float &ema) {
  ma = movingAverage.next(measured);
  ema = exponentialAverage.next(measured);
}
`;
