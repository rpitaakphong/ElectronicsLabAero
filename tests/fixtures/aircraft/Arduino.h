#pragma once
#include <stdint.h>
#include <math.h>
#include <cassert>
#include <cstring>
#include <string>
#include <sstream>
#include <iomanip>
#include <algorithm>
constexpr int A0=0, A1=1;
inline uint32_t fakeMicros=0, dacWrites=0;
inline uint16_t fakeAdc=1638, lastDac=0;
inline int readBits=0, writeBits=0;
inline bool inCallback=false;
inline uint32_t micros(){return fakeMicros;}
inline void delayMicroseconds(uint32_t us){fakeMicros+=us;}
inline void noInterrupts(){}
inline void interrupts(){}
inline void analogReadResolution(int n){readBits=n;}
inline void analogWriteResolution(int n){writeBits=n;}
inline uint16_t analogRead(int pin){assert(pin==A1);return fakeAdc;}
inline void analogWrite(int pin,uint16_t value){assert(pin==A0);lastDac=value;++dacWrites;}
struct FakeSerial {
  bool connected=true;
  int capacity=96;
  unsigned maxWrite=96, baud=0;
  std::string input, output;
  operator bool() const{return connected;}
  void begin(unsigned n){baud=n;}
  int available(){return int(input.size());}
  int read(){const char c=input.front();input.erase(input.begin());return c;}
  int availableForWrite(){return capacity;}
  size_t write(const uint8_t *data,unsigned n){assert(!inCallback);const unsigned count=std::min(n,maxWrite);output.append(reinterpret_cast<const char*>(data),count);return count;}
  template<class T> void print(const T &v,int precision=6){assert(!inCallback);std::ostringstream s;s<<std::setprecision(precision)<<v;output+=s.str();}
  template<class T> void println(const T &v,int precision=6){print(v,precision);output+='\n';}
};
inline FakeSerial Serial;
