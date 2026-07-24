cmake_minimum_required(VERSION 3.16)

project(benpocket-linux-recorder LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Threads REQUIRED)
find_package(X11 REQUIRED)

if(NOT X11_Xext_FOUND)
  message(FATAL_ERROR "X11 Xext (XShm) development headers not found -- install libxext-dev")
endif()

if(NOT X11_Xfixes_FOUND)
  message(FATAL_ERROR "X11 Xfixes development headers not found -- install libxfixes-dev")
endif()

if(NOT X11_Xrandr_FOUND)
  message(FATAL_ERROR "X11 Xrandr development headers not found -- install libxrandr-dev")
endif()

add_executable(benpocket-linux-recorder-helper
  src/main.cpp
)

target_link_libraries(benpocket-linux-recorder-helper PRIVATE
  Threads::Threads
  ${X11_LIBRARIES}
  ${X11_Xext_LIB}
  ${X11_Xfixes_LIB}
  ${X11_Xrandr_LIB}
)

target_include_directories(benpocket-linux-recorder-helper PRIVATE
  ${X11_INCLUDE_DIR}
)

target_compile_options(benpocket-linux-recorder-helper PRIVATE -Wall -Wextra)
