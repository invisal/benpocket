cmake_minimum_required(VERSION 3.20)

# The local Windows SDK image used by some contributors can miss gdi32.lib,
# while CMake's default MSVC console template links it unconditionally. This
# helper does not use GDI, so keep the standard library set minimal and explicit.
set(CMAKE_CXX_STANDARD_LIBRARIES
  "kernel32.lib user32.lib shell32.lib ole32.lib oleaut32.lib uuid.lib comdlg32.lib advapi32.lib"
  CACHE STRING "" FORCE)

project(benpocket-windows-recorder LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Adapted from a reference screen-recorder helper the user supplied (see the
# plan this was built from) -- same WGC/WASAPI/Media Foundation capture
# implementation, verbatim, only the executable name and JSON config field
# names (in main.cpp) differ to match this app's own contract. The
# reference's separate cursor-shape-sampling helper (cursor-sampler.exe) is
# deliberately not adopted -- this app already has its own cursor position/
# click tracking (cursor-tracker.ts/click-tracker.ts), so that's out of
# scope here.
add_executable(benpocket-windows-recorder-helper
  src/audio_sample_utils.cpp
  src/audio_sample_utils.h
  src/dshow_webcam_capture.cpp
  src/dshow_webcam_capture.h
  src/main.cpp
  src/mf_encoder.cpp
  src/mf_encoder.h
  src/monitor_utils.cpp
  src/monitor_utils.h
  src/wasapi_loopback_capture.cpp
  src/wasapi_loopback_capture.h
  src/webcam_capture.cpp
  src/webcam_capture.h
  src/wgc_session.cpp
  src/wgc_session.h
)

target_compile_definitions(benpocket-windows-recorder-helper PRIVATE
  NOMINMAX
  WIN32_LEAN_AND_MEAN
  _WIN32_WINNT=0x0A00
  # /await below (MSVC's pre-C++20 coroutine extension, needed by the WGC
  # session's winrt-based async code) pulls in <experimental/coroutine>.
  # Newer MSVC toolchains (14.5x+) turn that header's deprecation notice
  # into a hard compile error (C2338) unless explicitly silenced -- this is
  # the exact workaround Microsoft's own error message suggests. Migrating
  # off /await to standard C++20 <coroutine> would be the "real" fix, but
  # that means touching the vendored WGC session code's actual async
  # control flow, which can't be verified at all from a non-Windows
  # machine -- not worth that risk for what's currently just a toolchain
  # compatibility shim.
  _SILENCE_EXPERIMENTAL_COROUTINE_DEPRECATION_WARNINGS
)

target_compile_options(benpocket-windows-recorder-helper PRIVATE /EHsc /W4 /utf-8 /await)

target_link_libraries(benpocket-windows-recorder-helper PRIVATE
  d3d11
  dxgi
  mf
  mfplat
  mfreadwrite
  mfuuid
  runtimeobject
  windowsapp
)
