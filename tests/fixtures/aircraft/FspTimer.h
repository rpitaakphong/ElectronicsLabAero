#pragma once
#include <stdint.h>
constexpr uint8_t GPT_TIMER=0;
constexpr int TIMER_MODE_PERIODIC=0;
struct timer_callback_args_t {};
struct FspTimer {
  static int8_t get_available_timer(uint8_t &){static int8_t channel=0;return channel++;}
  bool begin(int,uint8_t,uint8_t,float,float,void(*)(timer_callback_args_t*)){return true;}
  bool setup_overflow_irq(int){return true;}
  bool open(){return true;}
  bool start(){return true;}
  void stop(){}
};
