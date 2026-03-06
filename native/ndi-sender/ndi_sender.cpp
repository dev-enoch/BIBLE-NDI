/**
 * NDI Sender Native Module
 *
 * Wraps the NDI SDK (NewTek/Vizrt) to broadcast video frames over NDI.
 *
 * Prerequisites:
 *   - Download and install the NDI SDK from https://ndi.tv/sdk/
 *   - Default install path (Windows): C:\Program Files\NDI\NDI 5 SDK
 *   - Override with env var NDI_SDK_DIR when running electron-rebuild
 *
 * Exports:
 *   ndiInit()                                      → bool
 *   ndiCreate(name: string)                        → bool
 *   ndiSendBgra(name, width, height, buffer)       → void
 *   ndiDestroy(name: string)                       → void
 *   ndiShutdown()                                  → void
 */

#include <napi.h>
#include <map>
#include <string>
#include <mutex>

#include <Processing.NDI.Lib.h>

static bool            s_ndiInitialized = false;
static std::mutex      s_mutex;
static std::map<std::string, NDIlib_send_instance_t> s_senders;

// ndiInit() → bool
Napi::Value NdiInit(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  std::lock_guard<std::mutex> lock(s_mutex);
  if (s_ndiInitialized) return Napi::Boolean::New(env, true);
  if (!NDIlib_initialize()) {
    return Napi::Boolean::New(env, false);
  }
  s_ndiInitialized = true;
  return Napi::Boolean::New(env, true);
}

// ndiCreate(name: string) → bool
Napi::Value NdiCreate(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!s_ndiInitialized) return Napi::Boolean::New(env, false);

  std::string name = info[0].As<Napi::String>().Utf8Value();
  std::lock_guard<std::mutex> lock(s_mutex);

  if (s_senders.count(name)) return Napi::Boolean::New(env, true); // already exists

  NDIlib_send_create_t create;
  create.p_ndi_name   = name.c_str();
  create.p_groups     = nullptr;
  create.clock_video  = false; // we drive the clock ourselves
  create.clock_audio  = false;

  NDIlib_send_instance_t sender = NDIlib_send_create(&create);
  if (!sender) return Napi::Boolean::New(env, false);

  s_senders[name] = sender;
  return Napi::Boolean::New(env, true);
}

// ndiSendBgra(name: string, width: number, height: number, buffer: Buffer) → void
//
// Electron's NativeImage.toBitmap() returns BGRA on Windows/Linux.
// We declare FourCC_BGRA which NDI handles natively — no swizzle needed.
Napi::Value NdiSendBgra(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  std::string           name   = info[0].As<Napi::String>().Utf8Value();
  int                   width  = info[1].As<Napi::Number>().Int32Value();
  int                   height = info[2].As<Napi::Number>().Int32Value();
  Napi::Buffer<uint8_t> buf    = info[3].As<Napi::Buffer<uint8_t>>();

  std::lock_guard<std::mutex> lock(s_mutex);
  auto it = s_senders.find(name);
  if (it == s_senders.end()) return env.Undefined();

  NDIlib_video_frame_v2_t frame;
  frame.xres                  = width;
  frame.yres                  = height;
  frame.FourCC                = NDIlib_FourCC_video_type_BGRA;
  frame.frame_rate_N          = 30000;
  frame.frame_rate_D          = 1001;    // ≈ 29.97 fps
  frame.picture_aspect_ratio  = (float)width / (float)height;
  frame.frame_format_type     = NDIlib_frame_format_type_progressive;
  frame.timecode              = NDIlib_send_timecode_synthesize;
  frame.p_data                = buf.Data();
  frame.line_stride_in_bytes  = width * 4;

  NDIlib_send_send_video_v2(it->second, &frame);
  return env.Undefined();
}

// ndiDestroy(name: string) → void
Napi::Value NdiDestroy(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  std::string name = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(s_mutex);
  auto it = s_senders.find(name);
  if (it != s_senders.end()) {
    NDIlib_send_destroy(it->second);
    s_senders.erase(it);
  }
  return env.Undefined();
}

// ndiShutdown() → void  (call on app quit)
Napi::Value NdiShutdown(const Napi::CallbackInfo& info) {
  std::lock_guard<std::mutex> lock(s_mutex);
  for (auto& [name, sender] : s_senders) {
    NDIlib_send_destroy(sender);
  }
  s_senders.clear();
  if (s_ndiInitialized) {
    NDIlib_destroy();
    s_ndiInitialized = false;
  }
  return info.Env().Undefined();
}

Napi::Object Setup(Napi::Env env, Napi::Object exports) {
  exports.Set("ndiInit",     Napi::Function::New(env, NdiInit));
  exports.Set("ndiCreate",   Napi::Function::New(env, NdiCreate));
  exports.Set("ndiSendBgra", Napi::Function::New(env, NdiSendBgra));
  exports.Set("ndiDestroy",  Napi::Function::New(env, NdiDestroy));
  exports.Set("ndiShutdown", Napi::Function::New(env, NdiShutdown));
  return exports;
}

NODE_API_MODULE(ndi_sender, Setup)
