// Asclion — Native Raw Input capture (Windows-only)
//
// Replaces the PowerShell+C# subprocess of electron/main.js (lines 1538-1810)
// with an in-process N-API native addon.  Same Win32 Raw Input API
// (RegisterRawInputDevices + RIDEV_INPUTSINK + WM_INPUT message pump), but:
//
//   • No spawned process → not flagged by GPO blocking powershell.exe.
//   • No C# compilation on first launch → ~3 sec faster boot.
//   • Inherits the parent Electron signature → less AV friction.
//   • One worker thread, message-pumped, joined cleanly on Stop().
//
// Reads VK codes from RAWKEYBOARD events, accumulates digits/letters until a
// CR/Tab terminator arrives, then emits the buffer to JS via a
// ThreadSafeFunction.  Letters mapping is layout-independent — we only map
// VK_0..VK_9 and VK_A..VK_Z and digits via VkToChar.  The downstream parser
// in src/lib/barcodeParser.ts is tolerant of case and AZERTY/QWERTY weirdness.

#include <napi.h>
#include <windows.h>
#include <thread>
#include <atomic>
#include <string>
#include <vector>

namespace {

constexpr int   MAX_GAP_MS = 180;
constexpr size_t MIN_LEN    = 7;
constexpr size_t MAX_LEN    = 60;

class RawInputCapture {
 public:
  ~RawInputCapture() { StopInternal(); }

  bool Start(Napi::Env env, Napi::Function cb) {
    if (running_.load()) return false;
    tsfn_ = Napi::ThreadSafeFunction::New(env, cb, "asclion_rawinput_emit", 0, 1);
    running_.store(true);
    worker_ = std::thread([this]() { ThreadMain(); });
    return true;
  }

  void Stop() { StopInternal(); }

  bool IsRunning() const { return running_.load(); }

 private:
  static LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
    if (msg == WM_INPUT) {
      auto* self = reinterpret_cast<RawInputCapture*>(
          GetWindowLongPtrW(hwnd, GWLP_USERDATA));
      if (self) self->ProcessRawInput(reinterpret_cast<HRAWINPUT>(lp));
    }
    return DefWindowProcW(hwnd, msg, wp, lp);
  }

  void ThreadMain() {
    WNDCLASSW wc = {};
    wc.lpfnWndProc   = &WndProc;
    wc.hInstance     = GetModuleHandleW(nullptr);
    wc.lpszClassName = L"AsclionRawInputWindow";
    RegisterClassW(&wc);  // ignore "already registered" error

    hwnd_ = CreateWindowExW(0, wc.lpszClassName, L"AsclionRawInput",
                            0, 0, 0, 0, 0,
                            HWND_MESSAGE, nullptr, wc.hInstance, nullptr);
    if (!hwnd_) {
      running_.store(false);
      return;
    }
    SetWindowLongPtrW(hwnd_, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(this));

    RAWINPUTDEVICE rid = {};
    rid.usUsagePage = 0x01;   // HID_USAGE_PAGE_GENERIC
    rid.usUsage     = 0x06;   // HID_USAGE_GENERIC_KEYBOARD
    rid.dwFlags     = RIDEV_INPUTSINK;  // receive even when not focused
    rid.hwndTarget  = hwnd_;
    if (!RegisterRawInputDevices(&rid, 1, sizeof(rid))) {
      DestroyWindow(hwnd_);
      hwnd_ = nullptr;
      running_.store(false);
      return;
    }

    MSG msg;
    while (running_.load() && GetMessageW(&msg, nullptr, 0, 0) > 0) {
      TranslateMessage(&msg);
      DispatchMessageW(&msg);
    }

    // Unregister + cleanup
    rid.dwFlags    = RIDEV_REMOVE;
    rid.hwndTarget = nullptr;
    RegisterRawInputDevices(&rid, 1, sizeof(rid));
    if (hwnd_) {
      DestroyWindow(hwnd_);
      hwnd_ = nullptr;
    }
  }

  void ProcessRawInput(HRAWINPUT hRawInput) {
    UINT size = 0;
    GetRawInputData(hRawInput, RID_INPUT, nullptr, &size, sizeof(RAWINPUTHEADER));
    if (size == 0) return;
    std::vector<BYTE> raw(size);
    if (GetRawInputData(hRawInput, RID_INPUT, raw.data(), &size,
                        sizeof(RAWINPUTHEADER)) != size) return;
    auto* ri = reinterpret_cast<RAWINPUT*>(raw.data());
    if (ri->header.dwType != RIM_TYPEKEYBOARD) return;
    USHORT flags = ri->data.keyboard.Flags;
    USHORT vkey  = ri->data.keyboard.VKey;
    if (flags & RI_KEY_BREAK) return;  // key-up, ignore
    HandleVKey(vkey);
  }

  void HandleVKey(USHORT vk) {
    // Enter or Tab terminates the buffer
    if (vk == VK_RETURN || vk == VK_TAB) {
      if (buf_.size() >= MIN_LEN) Emit(buf_);
      buf_.clear();
      return;
    }
    // Modifier keys never break the sequence
    if (vk == VK_SHIFT || vk == VK_CONTROL || vk == VK_MENU ||
        vk == VK_LSHIFT || vk == VK_RSHIFT ||
        vk == VK_LCONTROL || vk == VK_RCONTROL ||
        vk == VK_LMENU || vk == VK_RMENU ||
        vk == VK_LWIN || vk == VK_RWIN) {
      return;
    }
    ULONGLONG now = GetTickCount64();
    if (!buf_.empty() && (now - lastMs_) > MAX_GAP_MS) buf_.clear();
    lastMs_ = now;

    char ch = VkToChar(vk);
    if (ch) {
      if (buf_.size() < MAX_LEN) buf_.push_back(ch);
    } else {
      // Unrecognised non-modifier (F1, arrows, etc.) → abort sequence
      buf_.clear();
    }
  }

  static char VkToChar(USHORT vk) {
    if (vk >= 0x30 && vk <= 0x39) return static_cast<char>(vk);               // 0-9
    if (vk >= VK_NUMPAD0 && vk <= VK_NUMPAD9)
      return static_cast<char>(vk - VK_NUMPAD0 + '0');                        // numpad
    if (vk >= 0x41 && vk <= 0x5A) return static_cast<char>(vk + 32);          // A-Z → a-z
    if (vk == VK_OEM_MINUS) return '-';
    return 0;
  }

  void Emit(const std::string& code) {
    // Heap-allocate the string and let the JS callback delete it.
    auto* payload = new std::string(code);
    auto status = tsfn_.NonBlockingCall(payload,
        [](Napi::Env env, Napi::Function jsCb, std::string* s) {
          jsCb.Call({ Napi::String::New(env, *s) });
          delete s;
        });
    if (status != napi_ok) delete payload;
  }

  void StopInternal() {
    bool expected = true;
    if (!running_.compare_exchange_strong(expected, false)) return;
    if (hwnd_) PostMessageW(hwnd_, WM_QUIT, 0, 0);
    if (worker_.joinable()) worker_.join();
    tsfn_.Release();
  }

  std::atomic<bool> running_{false};
  std::thread       worker_;
  HWND              hwnd_ = nullptr;
  Napi::ThreadSafeFunction tsfn_;
  std::string       buf_;
  ULONGLONG         lastMs_ = 0;
};

// Single global instance — Raw Input is per-process anyway.
RawInputCapture g_capture;

Napi::Value Start(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsFunction()) {
    Napi::TypeError::New(env, "Start: expected (callback)").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  bool ok = g_capture.Start(env, info[0].As<Napi::Function>());
  return Napi::Boolean::New(env, ok);
}

Napi::Value Stop(const Napi::CallbackInfo& info) {
  g_capture.Stop();
  return info.Env().Undefined();
}

Napi::Value IsRunning(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), g_capture.IsRunning());
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("start",     Napi::Function::New(env, Start));
  exports.Set("stop",      Napi::Function::New(env, Stop));
  exports.Set("isRunning", Napi::Function::New(env, IsRunning));
  return exports;
}

}  // namespace

NODE_API_MODULE(asclion_rawinput, Init)
