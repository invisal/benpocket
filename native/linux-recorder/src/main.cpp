// Standalone Linux recording helper -- same subprocess architecture as
// native/macos-recorder and native/windows-recorder (spawn with one JSON
// config argument, emit newline-delimited JSON events on stdout, accept
// pause/resume/stop on stdin), see recording-helper.ts (main process).
//
// Unlike the macOS/Windows helpers, there was no reference implementation
// to adapt for Linux, and this has never been compiled or run on real
// Linux hardware from this development environment -- it ships unverified
// beyond a CI compile check (see .github/workflows/ci.yml). Treat any
// runtime behavior described here as a best-effort design, not a proven
// one.
//
// Capture: X11 core + MIT-SHM (XShmGetImage) on either the root window (a
// display source, cropped to the target monitor's rect via XRandR) or a
// specific window's own XID (a window source) -- the same technique
// ffmpeg's own x11grab input and most Linux screen recorders use. Assumes
// a standard 24/32-bit TrueColor visual (near-universal on modern X11
// desktops); anything else isn't handled.
//
// Cursor hide: XFixesHideCursor/XFixesShowCursor. Unlike ScreenCaptureKit
// (macOS) or Windows.Graphics.Capture, X11 has no per-application "exclude
// the cursor from just this capture" mechanism -- this hides the user's
// actual system pointer for everyone while `hideCursor` is active, a real,
// disclosed platform difference, not a bug.
//
// Encoding: rather than link libavcodec directly (a much larger, less
// universally-preinstalled dependency), this shells out to the `ffmpeg`
// CLI as a subprocess of this helper, piping raw BGRA frames to its stdin
// and letting it read system/microphone audio directly from PulseAudio
// itself (`-f pulse`). No frames or audio samples ever cross back into
// Electron -- this helper, plus the ffmpeg child it owns, produce the
// final MP4 directly, same as the other two platforms' helpers.

#include <X11/Xlib.h>
#include <X11/extensions/XShm.h>
#include <X11/extensions/Xfixes.h>
#include <X11/extensions/Xrandr.h>

#include <fcntl.h>
#include <sys/ipc.h>
#include <sys/shm.h>
#include <sys/wait.h>
#include <unistd.h>
#include <signal.h>

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

namespace {

// ---------------------------------------------------------------------
// Minimal hand-rolled flat-JSON reading -- same technique and same reason
// (avoid a new vendored dependency for one small helper binary) as
// windows-recorder/src/main.cpp's findString/findInt/findBool. Only flat,
// uniquely-named keys are used in this helper's own request schema
// specifically so this simple approach stays unambiguous.
// ---------------------------------------------------------------------

std::string findString(const std::string& json, const std::string& key) {
    auto pos = json.find("\"" + key + "\"");
    if (pos == std::string::npos) return {};
    pos = json.find(':', pos);
    if (pos == std::string::npos) return {};
    pos += 1;
    while (pos < json.size() && std::isspace(static_cast<unsigned char>(json[pos]))) pos += 1;
    if (pos >= json.size() || json[pos] != '"') return {};
    pos += 1;
    std::string result;
    while (pos < json.size()) {
        const char c = json[pos++];
        if (c == '"') break;
        if (c == '\\' && pos < json.size()) {
            const char escaped = json[pos++];
            switch (escaped) {
                case 'n': result.push_back('\n'); break;
                case 'r': result.push_back('\r'); break;
                case 't': result.push_back('\t'); break;
                default: result.push_back(escaped); break;
            }
            continue;
        }
        result.push_back(c);
    }
    return result;
}

long long findInt(const std::string& json, const std::string& key, long long fallback) {
    auto pos = json.find("\"" + key + "\"");
    if (pos == std::string::npos) return fallback;
    pos = json.find(':', pos);
    if (pos == std::string::npos) return fallback;
    pos += 1;
    while (pos < json.size() && std::isspace(static_cast<unsigned char>(json[pos]))) pos += 1;
    try {
        return std::stoll(json.substr(pos));
    } catch (...) {
        return fallback;
    }
}

bool findBool(const std::string& json, const std::string& key, bool fallback) {
    auto pos = json.find("\"" + key + "\"");
    if (pos == std::string::npos) return fallback;
    pos = json.find(':', pos);
    if (pos == std::string::npos) return fallback;
    pos += 1;
    while (pos < json.size() && std::isspace(static_cast<unsigned char>(json[pos]))) pos += 1;
    if (json.compare(pos, 4, "true") == 0) return true;
    if (json.compare(pos, 5, "false") == 0) return false;
    return fallback;
}

std::string jsonEscape(const std::string& value) {
    std::string result;
    result.reserve(value.size());
    for (const char c : value) {
        switch (c) {
            case '\\': result += "\\\\"; break;
            case '"': result += "\\\""; break;
            case '\n': result += "\\n"; break;
            default: result.push_back(c); break;
        }
    }
    return result;
}

void emit(const std::string& fieldsJson) {
    std::cout << "{" << fieldsJson << "}" << std::endl;
}

void emitError(const std::string& message) {
    emit("\"event\":\"error\",\"message\":\"" + jsonEscape(message) + "\"");
}

// ---------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------

struct Config {
    std::string sourceType = "display"; // "display" | "window"
    long long displayId = 0;
    long long windowId = 0;
    bool hasBounds = false;
    int boundsX = 0, boundsY = 0, boundsW = 0, boundsH = 0;
    int fps = 30;
    int width = 0;
    int height = 0;
    bool hideCursor = false;
    bool systemAudioEnabled = false;
    bool micEnabled = false;
    std::string micDeviceId;
    std::string outputPath;
};

bool parseConfig(const std::string& json, Config& config) {
    config.sourceType = findString(json, "sourceType");
    if (config.sourceType.empty()) config.sourceType = "display";
    config.displayId = findInt(json, "displayId", 0);
    config.windowId = findInt(json, "windowId", 0);
    config.hasBounds = findBool(json, "hasBounds", false);
    config.boundsX = static_cast<int>(findInt(json, "boundsX", 0));
    config.boundsY = static_cast<int>(findInt(json, "boundsY", 0));
    config.boundsW = static_cast<int>(findInt(json, "boundsW", 0));
    config.boundsH = static_cast<int>(findInt(json, "boundsH", 0));
    config.fps = static_cast<int>(findInt(json, "fps", 30));
    if (config.fps <= 0) config.fps = 30;
    config.width = static_cast<int>(findInt(json, "width", 0));
    config.height = static_cast<int>(findInt(json, "height", 0));
    config.hideCursor = findBool(json, "hideCursor", false);
    config.systemAudioEnabled = findBool(json, "systemAudioEnabled", false);
    config.micEnabled = findBool(json, "micEnabled", false);
    config.micDeviceId = findString(json, "micDeviceId");
    config.outputPath = findString(json, "outputPath");
    return !config.outputPath.empty();
}

// ---------------------------------------------------------------------
// Monitor / window resolution
// ---------------------------------------------------------------------

struct Rect {
    int x = 0, y = 0, width = 0, height = 0;
};

// Exact-bounds-match first, then nearest-distance, then "first available" --
// same precedence the macOS/Windows helpers use for the analogous lookup.
Rect resolveDisplayRect(Display* display, Window root, const Config& config) {
    std::vector<Rect> monitors;
    XRRScreenResources* res = XRRGetScreenResourcesCurrent(display, root);
    if (res) {
        for (int i = 0; i < res->ncrtc; i++) {
            XRRCrtcInfo* crtc = XRRGetCrtcInfo(display, res, res->crtcs[i]);
            if (crtc && crtc->width > 0 && crtc->height > 0) {
                monitors.push_back({crtc->x, crtc->y, static_cast<int>(crtc->width), static_cast<int>(crtc->height)});
            }
            if (crtc) XRRFreeCrtcInfo(crtc);
        }
        XRRFreeScreenResources(res);
    }

    if (monitors.empty()) {
        int screen = DefaultScreen(display);
        return {0, 0, DisplayWidth(display, screen), DisplayHeight(display, screen)};
    }

    if (config.hasBounds) {
        const Rect* best = nullptr;
        long long bestDistance = -1;
        for (const auto& m : monitors) {
            const long long dx = m.x - config.boundsX;
            const long long dy = m.y - config.boundsY;
            const long long dw = m.width - config.boundsW;
            const long long dh = m.height - config.boundsH;
            const long long distance = dx * dx + dy * dy + dw * dw + dh * dh;
            if (bestDistance < 0 || distance < bestDistance) {
                bestDistance = distance;
                best = &m;
            }
        }
        if (best) return *best;
    }

    return monitors.front();
}

bool resolveWindowRect(Display* display, Window window, Rect& rect) {
    XWindowAttributes attrs;
    if (!XGetWindowAttributes(display, window, &attrs)) return false;
    rect.width = attrs.width;
    rect.height = attrs.height;
    rect.x = 0;
    rect.y = 0;
    return true;
}

// ---------------------------------------------------------------------
// XShm frame grabber
// ---------------------------------------------------------------------

class ShmGrabber {
public:
    // `srcX`/`srcY` is where to read from within `target` -- 0,0 for a
    // window source (its own origin), or a monitor's root-relative offset
    // for a display source (the root window spans every monitor combined,
    // so a specific monitor is just a sub-rectangle read from it).
    bool initialize(Display* display, Drawable target, int srcX, int srcY, int width, int height) {
        display_ = display;
        target_ = target;
        srcX_ = srcX;
        srcY_ = srcY;
        height_ = height;

        int screen = DefaultScreen(display);
        Visual* visual = DefaultVisual(display, screen);
        int depth = DefaultDepth(display, screen);

        image_ = XShmCreateImage(display, visual, depth, ZPixmap, nullptr, &shmInfo_, width, height);
        if (!image_) return false;

        shmInfo_.shmid = shmget(IPC_PRIVATE, static_cast<size_t>(image_->bytes_per_line) * image_->height, IPC_CREAT | 0600);
        if (shmInfo_.shmid < 0) return false;

        shmInfo_.shmaddr = image_->data = static_cast<char*>(shmat(shmInfo_.shmid, nullptr, 0));
        if (shmInfo_.shmaddr == reinterpret_cast<char*>(-1)) return false;
        shmInfo_.readOnly = False;

        if (!XShmAttach(display, &shmInfo_)) return false;
        XSync(display, False);
        // Mark for destruction once detached -- avoids a leaked segment if
        // this process is killed before an explicit cleanup runs.
        shmctl(shmInfo_.shmid, IPC_RMID, nullptr);
        return true;
    }

    // Returns a pointer to the frame's raw BGRX/BGRA bytes (owned by this
    // grabber, valid until the next call), or nullptr on failure.
    const char* grab() {
        if (!XShmGetImage(display_, target_, image_, srcX_, srcY_, AllPlanes)) return nullptr;
        return image_->data;
    }

    int bytesPerLine() const { return image_ ? image_->bytes_per_line : 0; }
    int height() const { return height_; }

    ~ShmGrabber() {
        if (display_ && image_) {
            XShmDetach(display_, &shmInfo_);
            XDestroyImage(image_);
        }
        if (shmInfo_.shmaddr) shmdt(shmInfo_.shmaddr);
    }

private:
    Display* display_ = nullptr;
    Drawable target_ = 0;
    int srcX_ = 0;
    int srcY_ = 0;
    int height_ = 0;
    XImage* image_ = nullptr;
    XShmSegmentInfo shmInfo_{};
};

// ---------------------------------------------------------------------
// ffmpeg subprocess -- owns encoding and audio capture (via its own
// built-in PulseAudio input), fed raw video frames over a pipe.
// ---------------------------------------------------------------------

std::string trim(const std::string& value) {
    size_t start = value.find_first_not_of(" \t\r\n");
    size_t end = value.find_last_not_of(" \t\r\n");
    if (start == std::string::npos) return {};
    return value.substr(start, end - start + 1);
}

// Best-effort: PulseAudio's default sink's monitor source is the standard
// way to capture "system/desktop" audio on Linux (there is no OS-level
// loopback-by-default the way WASAPI/ScreenCaptureKit provide). Falls back
// to the literal device name "default" (mic-style default source) if
// `pactl` isn't available or reports nothing -- ffmpeg will simply fail to
// open that input if it's wrong, surfaced as this helper's own spawn
// failure rather than silently recording no audio.
std::string defaultMonitorSourceName() {
    FILE* pipe = popen("pactl get-default-sink 2>/dev/null", "r");
    if (!pipe) return "default";
    char buffer[256];
    std::string sink;
    if (fgets(buffer, sizeof(buffer), pipe)) sink = trim(buffer);
    pclose(pipe);
    if (sink.empty()) return "default";
    return sink + ".monitor";
}

int bitrateFor(int width, int height) {
    const long long pixels = static_cast<long long>(width) * height;
    if (pixels >= 3840LL * 2160) return 45'000'000;
    if (pixels >= 2560LL * 1440) return 28'000'000;
    return 18'000'000;
}

class FfmpegSession {
public:
    bool start(const Config& config, int width, int height) {
        int pipeFds[2];
        if (pipe(pipeFds) != 0) return false;
        videoWriteFd_ = pipeFds[1];

        // -use_wallclock_as_timestamps and -thread_queue_size are the
        // standard mitigations for combining several *live* inputs (a raw
        // frame pipe plus one or two real-time PulseAudio captures) into a
        // single muxed output -- without them, ffmpeg's default timestamp
        // handling for this kind of setup is prone to drift/desync between
        // video and audio, and live inputs can log dropped-frame warnings
        // under normal system load.
        std::vector<std::string> args = {
            "ffmpeg", "-y", "-use_wallclock_as_timestamps", "1",
            "-thread_queue_size", "512",
            "-f", "rawvideo", "-pix_fmt", "bgra",
            "-s", std::to_string(width) + "x" + std::to_string(height),
            "-r", std::to_string(config.fps),
            "-i", "pipe:0",
        };

        if (config.systemAudioEnabled) {
            args.insert(args.end(), {"-thread_queue_size", "512", "-f", "pulse", "-i", defaultMonitorSourceName()});
        }
        if (config.micEnabled) {
            args.insert(args.end(), {"-thread_queue_size", "512", "-f", "pulse", "-i", config.micDeviceId.empty() ? "default" : config.micDeviceId});
        }
        if (config.systemAudioEnabled && config.micEnabled) {
            args.insert(args.end(), {"-filter_complex", "[1:a][2:a]amix=inputs=2:duration=longest[aout]", "-map", "0:v", "-map", "[aout]"});
        } else if (config.systemAudioEnabled || config.micEnabled) {
            args.insert(args.end(), {"-map", "0:v", "-map", "1:a"});
        }

        args.insert(args.end(), {
            "-c:v", "libx264", "-preset", "ultrafast",
            "-b:v", std::to_string(bitrateFor(width, height)),
            "-pix_fmt", "yuv420p",
        });
        if (config.systemAudioEnabled || config.micEnabled) {
            args.insert(args.end(), {"-c:a", "aac", "-b:a", "192k"});
        }
        args.insert(args.end(), {"-movflags", "+faststart", config.outputPath});

        std::vector<char*> argv;
        argv.reserve(args.size() + 1);
        for (auto& arg : args) argv.push_back(arg.data());
        argv.push_back(nullptr);

        pid_ = fork();
        if (pid_ < 0) return false;
        if (pid_ == 0) {
            dup2(pipeFds[0], STDIN_FILENO);
            close(pipeFds[0]);
            close(pipeFds[1]);
            // ffmpeg is chatty on stderr by design -- redirect both to
            // /dev/null rather than mixing into this helper's own stdout
            // JSON event stream.
            const int devNull = open("/dev/null", O_WRONLY);
            if (devNull >= 0) {
                dup2(devNull, STDOUT_FILENO);
                dup2(devNull, STDERR_FILENO);
            }
            execvp("ffmpeg", argv.data());
            _exit(127); // execvp only returns on failure
        }
        close(pipeFds[0]);
        return true;
    }

    bool writeFrame(const void* data, size_t size) {
        if (videoWriteFd_ < 0) return false;
        const char* bytes = static_cast<const char*>(data);
        size_t written = 0;
        while (written < size) {
            const ssize_t n = write(videoWriteFd_, bytes + written, size - written);
            if (n <= 0) return false;
            written += static_cast<size_t>(n);
        }
        return true;
    }

    void pause() {
        if (pid_ > 0) kill(pid_, SIGSTOP);
    }

    void resume() {
        if (pid_ > 0) kill(pid_, SIGCONT);
    }

    // Closes the video pipe (EOF, so ffmpeg finishes encoding whatever it
    // already has) and waits for it to exit, with a hard-kill fallback so a
    // wedged ffmpeg can never hang the whole recording-stop flow.
    void stop() {
        if (pid_ <= 0) return;
        resume(); // a paused ffmpeg needs to run again to actually observe EOF and flush
        if (videoWriteFd_ >= 0) {
            close(videoWriteFd_);
            videoWriteFd_ = -1;
        }

        std::atomic<bool> exited{false};
        std::thread waiter([&]() {
            int status = 0;
            waitpid(pid_, &status, 0);
            exited = true;
        });

        const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(15);
        while (!exited && std::chrono::steady_clock::now() < deadline) {
            std::this_thread::sleep_for(std::chrono::milliseconds(50));
        }
        if (!exited) kill(pid_, SIGKILL);
        waiter.join();
        pid_ = -1;
    }

    ~FfmpegSession() {
        if (videoWriteFd_ >= 0) close(videoWriteFd_);
    }

private:
    pid_t pid_ = -1;
    int videoWriteFd_ = -1;
};

// ---------------------------------------------------------------------
// Cursor hide/show -- always restored on normal exit or a caught signal,
// since leaving the user's real system cursor invisible would be a much
// worse failure mode than a missed recording.
// ---------------------------------------------------------------------

Display* g_cursorDisplay = nullptr;
Window g_cursorWindow = 0;
std::atomic<bool> g_cursorHidden{false};

void restoreCursorIfHidden() {
    if (g_cursorHidden.exchange(false) && g_cursorDisplay) {
        XFixesShowCursor(g_cursorDisplay, g_cursorWindow);
        XFlush(g_cursorDisplay);
    }
}

void handleTerminatingSignal(int signum) {
    restoreCursorIfHidden();
    _exit(128 + signum);
}

} // namespace

int main(int argc, char* argv[]) {
    if (argc != 2) {
        emitError("Missing JSON config argument");
        return 1;
    }

    signal(SIGPIPE, SIG_IGN);
    signal(SIGINT, handleTerminatingSignal);
    signal(SIGTERM, handleTerminatingSignal);

    Config config;
    if (!parseConfig(argv[1], config)) {
        emitError("Failed to parse config JSON");
        return 1;
    }

    if (!XInitThreads()) {
        emitError("Failed to initialize Xlib threading");
        return 1;
    }
    Display* display = XOpenDisplay(nullptr);
    if (!display) {
        emitError("Failed to open X display (is DISPLAY set?)");
        return 1;
    }
    Window root = DefaultRootWindow(display);

    int shmMajor, shmMinor;
    Bool shmPixmaps;
    if (!XShmQueryVersion(display, &shmMajor, &shmMinor, &shmPixmaps)) {
        emitError("X server does not support the MIT-SHM extension");
        return 1;
    }
    int fixesEventBase, fixesErrorBase;
    if (!XFixesQueryExtension(display, &fixesEventBase, &fixesErrorBase)) {
        emitError("X server does not support the XFixes extension");
        return 1;
    }

    Drawable captureTarget;
    Rect rect;
    if (config.sourceType == "window") {
        if (config.windowId <= 0) {
            emitError("Window source requires a valid windowId");
            return 1;
        }
        const Window window = static_cast<Window>(config.windowId);
        if (!resolveWindowRect(display, window, rect)) {
            emitError("Could not resolve window for capture");
            return 1;
        }
        captureTarget = window;
    } else {
        rect = resolveDisplayRect(display, root, config);
        captureTarget = root;
    }

    const int width = (std::max(2, config.width > 0 ? config.width : rect.width) / 2) * 2;
    const int height = (std::max(2, config.height > 0 ? config.height : rect.height) / 2) * 2;

    // A window source reads from its own origin (0,0); a display source
    // reads a sub-rectangle of the root window at the resolved monitor's
    // root-relative offset (the root window spans every monitor combined).
    const int srcX = config.sourceType == "window" ? 0 : rect.x;
    const int srcY = config.sourceType == "window" ? 0 : rect.y;
    ShmGrabber grabber;
    if (!grabber.initialize(display, captureTarget, srcX, srcY, width, height)) {
        emitError("Failed to initialize XShm capture");
        return 1;
    }

    if (config.hideCursor) {
        g_cursorDisplay = display;
        g_cursorWindow = root;
        XFixesHideCursor(display, root);
        g_cursorHidden = true;
    }

    emit("\"event\":\"ready\",\"schemaVersion\":1");

    FfmpegSession ffmpeg;
    if (!ffmpeg.start(config, width, height)) {
        restoreCursorIfHidden();
        emitError("Failed to spawn ffmpeg (is it installed and on PATH?)");
        return 1;
    }

    std::atomic<bool> stopRequested{false};
    std::atomic<bool> paused{false};

    std::thread stdinThread([&]() {
        std::string line;
        while (std::getline(std::cin, line)) {
            if (line == "stop") {
                stopRequested = true;
                return;
            }
            if (line == "pause" && !paused.exchange(true)) {
                ffmpeg.pause();
                emit("\"event\":\"recording-paused\"");
            } else if (line == "resume" && paused.exchange(false)) {
                ffmpeg.resume();
                emit("\"event\":\"recording-resumed\"");
            }
        }
        stopRequested = true;
    });

    {
        std::ostringstream fields;
        fields << "\"event\":\"recording-started\",\"width\":" << width << ",\"height\":" << height;
        emit(fields.str());
    }

    const auto frameInterval = std::chrono::duration<double>(1.0 / config.fps);
    bool captureFailed = false;
    while (!stopRequested) {
        const auto frameStart = std::chrono::steady_clock::now();
        if (!paused) {
            const char* frame = grabber.grab();
            if (!frame) {
                captureFailed = true;
                break;
            }
            const size_t frameSize = static_cast<size_t>(grabber.bytesPerLine()) * grabber.height();
            if (!ffmpeg.writeFrame(frame, frameSize)) {
                captureFailed = true;
                break;
            }
        }
        std::this_thread::sleep_until(frameStart + std::chrono::duration_cast<std::chrono::steady_clock::duration>(frameInterval));
    }

    stopRequested = true;
    if (stdinThread.joinable()) stdinThread.detach();
    ffmpeg.stop();
    restoreCursorIfHidden();
    XCloseDisplay(display);

    if (captureFailed) {
        emitError("Lost the capture stream or the ffmpeg pipe mid-recording");
        return 1;
    }

    emit("\"event\":\"recording-stopped\",\"outputPath\":\"" + jsonEscape(config.outputPath) + "\"");
    return 0;
}
