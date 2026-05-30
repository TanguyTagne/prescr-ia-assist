// Asclion — Native UI Automation watcher (Windows-only)
//
// Polls registered LGO barcode input fields via Microsoft UI Automation.  When
// a field's value changes and looks like a barcode (EAN-13 / CIP-13 / GS1
// DataMatrix payload), emits it to JS as a "fallback" capture channel —
// independent of the keyboard pipeline, the HID stack, the COM port, and the
// scanner's USB mode.  This is the universal "100% on supported LGOs"
// guarantee.
//
// Design choices:
//   • Polling (200 ms default) instead of UIA event handlers.  The COM-based
//     PropertyChangedEventHandler is more complex and has marshalling pitfalls
//     in a Node addon.  200 ms is invisible to a pharmacist and trivial in
//     CPU terms (one GetCurrentPropertyValue call per registered field).
//   • Field selectors expressed as JSON, passed from JS at start() time.
//     This lets the Asclion admin/dashboard configure new LGOs without
//     rebuilding the native binding.
//
// Selector schema (JSON object):
//   {
//     "lgoId":           "winpharma",        // logical name
//     "processName":     "Winpharma.exe",    // executable name (case-insensitive)
//     "windowTitleRe":   "Winpharma.*",      // optional regex on top-level window title
//     "automationId":    "txtCodeBarre",     // OR
//     "name":            "Code-barre",       // OR
//     "className":       "Edit"              // any subset is fine; we AND them.
//   }
//
// Reads field values via ValuePattern → GetCurrentValue, falls back to
// TextPattern → DocumentRange.GetText if no ValuePattern is exposed.

#include <napi.h>
#include <windows.h>
#include <comdef.h>
#include <uiautomation.h>
#include <atlbase.h>
#include <psapi.h>

#include <thread>
#include <atomic>
#include <vector>
#include <string>
#include <mutex>
#include <regex>
#include <memory>

namespace {

constexpr int    POLL_INTERVAL_MS  = 200;
constexpr size_t MIN_BARCODE_LEN   = 7;
constexpr size_t MAX_BARCODE_LEN   = 60;

struct FieldSelector {
  std::string lgoId;
  std::wstring processName;
  std::wstring windowTitleRe;
  std::wstring automationId;
  std::wstring name;
  std::wstring className;
};

struct WatchedField {
  FieldSelector selector;
  std::wstring  lastValue;
};

static std::wstring Utf8ToWide(const std::string& s) {
  if (s.empty()) return L"";
  int len = MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), nullptr, 0);
  std::wstring out(len, 0);
  MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), out.data(), len);
  return out;
}

static std::string WideToUtf8(const std::wstring& s) {
  if (s.empty()) return "";
  int len = WideCharToMultiByte(CP_UTF8, 0, s.data(), (int)s.size(), nullptr, 0, nullptr, nullptr);
  std::string out(len, 0);
  WideCharToMultiByte(CP_UTF8, 0, s.data(), (int)s.size(), out.data(), len, nullptr, nullptr);
  return out;
}

static bool LooksLikeBarcode(const std::wstring& s) {
  // Conservative: 7-60 chars, ≥70% digits, no whitespace/newline.
  if (s.size() < MIN_BARCODE_LEN || s.size() > MAX_BARCODE_LEN) return false;
  size_t digits = 0;
  for (wchar_t c : s) {
    if (c == L' ' || c == L'\n' || c == L'\r' || c == L'\t') return false;
    if (c >= L'0' && c <= L'9') digits++;
  }
  return (digits * 100) >= (s.size() * 70);
}

// Iterate top-level windows of a target process name.
struct EnumCtx {
  std::wstring targetProcLower;
  std::vector<HWND> hwnds;
};

static std::wstring ProcessNameOf(HWND hwnd) {
  DWORD pid = 0;
  GetWindowThreadProcessId(hwnd, &pid);
  if (!pid) return L"";
  HANDLE h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_VM_READ, FALSE, pid);
  if (!h) return L"";
  wchar_t name[MAX_PATH] = {0};
  DWORD sz = MAX_PATH;
  std::wstring out;
  if (QueryFullProcessImageNameW(h, 0, name, &sz)) {
    std::wstring full(name);
    auto pos = full.find_last_of(L"\\/");
    out = (pos == std::wstring::npos) ? full : full.substr(pos + 1);
  }
  CloseHandle(h);
  for (auto& c : out) c = (wchar_t)towlower(c);
  return out;
}

static BOOL CALLBACK EnumProc(HWND hwnd, LPARAM lp) {
  if (!IsWindowVisible(hwnd)) return TRUE;
  auto* ctx = reinterpret_cast<EnumCtx*>(lp);
  if (ProcessNameOf(hwnd) == ctx->targetProcLower) {
    ctx->hwnds.push_back(hwnd);
  }
  return TRUE;
}

// Read the value of a UIA element via ValuePattern or TextPattern.
static std::wstring ReadElementValue(IUIAutomationElement* el) {
  // Try ValuePattern first
  CComPtr<IUnknown> raw;
  if (SUCCEEDED(el->GetCurrentPattern(UIA_ValuePatternId, &raw)) && raw) {
    CComQIPtr<IUIAutomationValuePattern> vp(raw);
    if (vp) {
      CComBSTR b;
      if (SUCCEEDED(vp->get_CurrentValue(&b)) && b) {
        return std::wstring(b, SysStringLen(b));
      }
    }
  }
  // Fall back to TextPattern
  raw.Release();
  if (SUCCEEDED(el->GetCurrentPattern(UIA_TextPatternId, &raw)) && raw) {
    CComQIPtr<IUIAutomationTextPattern> tp(raw);
    if (tp) {
      CComPtr<IUIAutomationTextRange> range;
      if (SUCCEEDED(tp->get_DocumentRange(&range)) && range) {
        CComBSTR b;
        if (SUCCEEDED(range->GetText(-1, &b)) && b) {
          return std::wstring(b, SysStringLen(b));
        }
      }
    }
  }
  return L"";
}

// Find the first UIA element under `root` matching the selector.
static CComPtr<IUIAutomationElement> FindField(
    CComPtr<IUIAutomation>& uia,
    IUIAutomationElement* root,
    const FieldSelector& sel) {
  CComPtr<IUIAutomationCondition> finalCond;
  std::vector<CComPtr<IUIAutomationCondition>> conds;

  auto addPropCond = [&](PROPERTYID pid, const std::wstring& val) {
    if (val.empty()) return;
    VARIANT v;
    VariantInit(&v);
    v.vt = VT_BSTR;
    v.bstrVal = SysAllocStringLen(val.c_str(), (UINT)val.size());
    CComPtr<IUIAutomationCondition> c;
    if (SUCCEEDED(uia->CreatePropertyCondition(pid, v, &c)) && c) {
      conds.push_back(c);
    }
    VariantClear(&v);
  };

  addPropCond(UIA_AutomationIdPropertyId, sel.automationId);
  addPropCond(UIA_NamePropertyId,          sel.name);
  addPropCond(UIA_ClassNamePropertyId,     sel.className);

  if (conds.empty()) return nullptr;

  if (conds.size() == 1) {
    finalCond = conds[0];
  } else {
    // AND all conditions together
    std::vector<IUIAutomationCondition*> ptrs;
    for (auto& c : conds) ptrs.push_back(c);
    uia->CreateAndConditionFromNativeArray(ptrs.data(), (int)ptrs.size(), &finalCond);
  }
  if (!finalCond) return nullptr;

  CComPtr<IUIAutomationElement> found;
  root->FindFirst(TreeScope_Descendants, finalCond, &found);
  return found;
}

class UiaWatcher {
 public:
  ~UiaWatcher() { StopInternal(); }

  bool Start(Napi::Env env, Napi::Function cb,
             std::vector<FieldSelector> selectors) {
    if (running_.load()) return false;
    {
      std::lock_guard<std::mutex> lk(mu_);
      fields_.clear();
      for (auto& s : selectors) fields_.push_back({s, L""});
    }
    tsfn_ = Napi::ThreadSafeFunction::New(env, cb, "asclion_uia_emit", 0, 1);
    running_.store(true);
    worker_ = std::thread([this]() { ThreadMain(); });
    return true;
  }

  void Stop() { StopInternal(); }
  bool IsRunning() const { return running_.load(); }

  size_t FieldCount() {
    std::lock_guard<std::mutex> lk(mu_);
    return fields_.size();
  }

 private:
  void ThreadMain() {
    HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    bool comInit = SUCCEEDED(hr) || hr == RPC_E_CHANGED_MODE;

    CComPtr<IUIAutomation> uia;
    if (FAILED(CoCreateInstance(__uuidof(CUIAutomation), nullptr, CLSCTX_INPROC_SERVER,
                                __uuidof(IUIAutomation), (void**)&uia))) {
      if (comInit) CoUninitialize();
      running_.store(false);
      return;
    }

    while (running_.load()) {
      PollAllFields(uia);
      Sleep(POLL_INTERVAL_MS);
    }

    uia.Release();
    if (comInit) CoUninitialize();
  }

  void PollAllFields(CComPtr<IUIAutomation>& uia) {
    std::vector<WatchedField> snapshot;
    {
      std::lock_guard<std::mutex> lk(mu_);
      snapshot = fields_;  // copy under lock, work outside
    }
    for (auto& wf : snapshot) {
      EnumCtx ctx;
      ctx.targetProcLower = wf.selector.processName;
      for (auto& c : ctx.targetProcLower) c = (wchar_t)towlower(c);
      EnumWindows(EnumProc, reinterpret_cast<LPARAM>(&ctx));
      if (ctx.hwnds.empty()) continue;

      // Optional title regex filter
      std::vector<HWND> matched;
      if (!wf.selector.windowTitleRe.empty()) {
        try {
          std::wregex re(wf.selector.windowTitleRe);
          for (HWND h : ctx.hwnds) {
            wchar_t title[512] = {0};
            GetWindowTextW(h, title, 512);
            if (std::regex_search(std::wstring(title), re)) matched.push_back(h);
          }
        } catch (...) {
          matched = ctx.hwnds;
        }
      } else {
        matched = ctx.hwnds;
      }

      for (HWND h : matched) {
        CComPtr<IUIAutomationElement> root;
        if (FAILED(uia->ElementFromHandle(h, &root)) || !root) continue;
        CComPtr<IUIAutomationElement> field = FindField(uia, root, wf.selector);
        if (!field) continue;
        std::wstring val = ReadElementValue(field);
        if (val.empty()) continue;
        if (val == wf.lastValue) continue;

        std::wstring previous = wf.lastValue;
        UpdateLast(wf.selector.lgoId, val);
        wf.lastValue = val;

        if (!previous.empty() && LooksLikeBarcode(val)) {
          Emit(wf.selector.lgoId, val);
        } else if (previous.empty() && LooksLikeBarcode(val)) {
          // First seen + already a barcode → emit anyway (handles cold-start)
          Emit(wf.selector.lgoId, val);
        }
      }
    }
  }

  void UpdateLast(const std::string& lgoId, const std::wstring& val) {
    std::lock_guard<std::mutex> lk(mu_);
    for (auto& wf : fields_) {
      if (wf.selector.lgoId == lgoId) wf.lastValue = val;
    }
  }

  void Emit(const std::string& lgoId, const std::wstring& code) {
    // Pack as JSON-ish payload: "lgoId|barcode"
    std::string payload = lgoId + "|" + WideToUtf8(code);
    auto* heap = new std::string(payload);
    auto st = tsfn_.NonBlockingCall(heap,
        [](Napi::Env env, Napi::Function jsCb, std::string* s) {
          // Split on first '|'
          size_t bar = s->find('|');
          std::string id   = (bar == std::string::npos) ? "" : s->substr(0, bar);
          std::string code = (bar == std::string::npos) ? *s : s->substr(bar + 1);
          Napi::Object o = Napi::Object::New(env);
          o.Set("lgoId",   Napi::String::New(env, id));
          o.Set("barcode", Napi::String::New(env, code));
          jsCb.Call({ o });
          delete s;
        });
    if (st != napi_ok) delete heap;
  }

  void StopInternal() {
    bool expected = true;
    if (!running_.compare_exchange_strong(expected, false)) return;
    if (worker_.joinable()) worker_.join();
    tsfn_.Release();
  }

  std::atomic<bool>          running_{false};
  std::thread                worker_;
  std::mutex                 mu_;
  std::vector<WatchedField>  fields_;
  Napi::ThreadSafeFunction   tsfn_;
};

UiaWatcher g_watcher;

static FieldSelector SelectorFromJs(const Napi::Object& o) {
  FieldSelector s;
  if (o.Has("lgoId"))         s.lgoId         = o.Get("lgoId").As<Napi::String>().Utf8Value();
  if (o.Has("processName"))   s.processName   = Utf8ToWide(o.Get("processName").As<Napi::String>().Utf8Value());
  if (o.Has("windowTitleRe")) s.windowTitleRe = Utf8ToWide(o.Get("windowTitleRe").As<Napi::String>().Utf8Value());
  if (o.Has("automationId"))  s.automationId  = Utf8ToWide(o.Get("automationId").As<Napi::String>().Utf8Value());
  if (o.Has("name"))          s.name          = Utf8ToWide(o.Get("name").As<Napi::String>().Utf8Value());
  if (o.Has("className"))     s.className     = Utf8ToWide(o.Get("className").As<Napi::String>().Utf8Value());
  return s;
}

Napi::Value Start(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsArray() || !info[1].IsFunction()) {
    Napi::TypeError::New(env, "Start: expected (selectorsArray, callback)")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }
  Napi::Array arr = info[0].As<Napi::Array>();
  std::vector<FieldSelector> selectors;
  for (uint32_t i = 0; i < arr.Length(); i++) {
    Napi::Value v = arr.Get(i);
    if (!v.IsObject()) continue;
    selectors.push_back(SelectorFromJs(v.As<Napi::Object>()));
  }
  if (selectors.empty()) return Napi::Boolean::New(env, false);
  bool ok = g_watcher.Start(env, info[1].As<Napi::Function>(), std::move(selectors));
  return Napi::Boolean::New(env, ok);
}

Napi::Value Stop(const Napi::CallbackInfo& info) {
  g_watcher.Stop();
  return info.Env().Undefined();
}

Napi::Value IsRunning(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), g_watcher.IsRunning());
}

Napi::Value FieldCount(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), (double)g_watcher.FieldCount());
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("start",      Napi::Function::New(env, Start));
  exports.Set("stop",       Napi::Function::New(env, Stop));
  exports.Set("isRunning",  Napi::Function::New(env, IsRunning));
  exports.Set("fieldCount", Napi::Function::New(env, FieldCount));
  return exports;
}

}  // namespace

NODE_API_MODULE(asclion_uiawatcher, Init)
