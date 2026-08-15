#include <X11/Xatom.h>
#include <X11/Xlib.h>

#include <cstdio>
#include <string>

// Serves the CLIPBOARD selection as a live X11 owner so a single "copy to
// clipboard" can be read correctly by two different audiences at once:
// GNOME-family file managers (Nautilus/Nemo/Caja), which only recognize the
// GNOME-proprietary `x-special/gnome-copied-files` target, and everything
// else (chat apps, browsers, mail clients), which read the freedesktop.org
// standard `text/uri-list` target instead. `xclip` can only ever serve one
// target per invocation -- it doesn't inspect each incoming request, it
// just answers every one the same way -- so neither audience alone was
// satisfiable through it. This process instead answers each
// SelectionRequest according to whichever target the requesting app
// actually asked for.
//
// Runs until superseded (SelectionClear -- something else took ownership of
// the clipboard) or killed, same lifecycle xclip already has. The caller
// (see copy-file-to-clipboard.ts) spawns this detached and does not wait
// for it to exit, only for the one "ready" line on stdout confirming
// ownership was actually acquired.

namespace {

std::string PercentEncodePath(const std::string& path) {
  static const char* hex = "0123456789ABCDEF";
  std::string out;
  out.reserve(path.size());
  for (unsigned char c : path) {
    const bool unreserved = (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
                             (c >= '0' && c <= '9') || c == '-' || c == '.' || c == '_' ||
                             c == '~' || c == '/';
    if (unreserved) {
      out.push_back(static_cast<char>(c));
    } else {
      out.push_back('%');
      out.push_back(hex[(c >> 4) & 0xF]);
      out.push_back(hex[c & 0xF]);
    }
  }
  return out;
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 2) {
    std::printf("{\"event\":\"error\",\"message\":\"missing file path argument\"}\n");
    std::fflush(stdout);
    return 1;
  }
  const std::string filePath = argv[1];
  // Same content format already verified working for each audience: the
  // GNOME format unencoded (matches what Nautilus paste already accepted
  // before this file existed), the URI-list format percent-encoded per
  // RFC 2483/3986 (needed for paths with spaces, e.g. this app's default
  // "Screen-Record-<date> <time>.mp4" export names).
  const std::string gnomeContent = "copy\nfile://" + filePath;
  const std::string uriListContent = "file://" + PercentEncodePath(filePath) + "\r\n";

  Display* display = XOpenDisplay(nullptr);
  if (!display) {
    std::printf("{\"event\":\"error\",\"message\":\"cannot open X display\"}\n");
    std::fflush(stdout);
    return 1;
  }

  Window window = XCreateSimpleWindow(display, DefaultRootWindow(display), 0, 0, 1, 1, 0, 0, 0);

  const Atom clipboardAtom = XInternAtom(display, "CLIPBOARD", False);
  const Atom targetsAtom = XInternAtom(display, "TARGETS", False);
  const Atom multipleAtom = XInternAtom(display, "MULTIPLE", False);
  const Atom timestampAtom = XInternAtom(display, "TIMESTAMP", False);
  const Atom uriListAtom = XInternAtom(display, "text/uri-list", False);
  const Atom gnomeAtom = XInternAtom(display, "x-special/gnome-copied-files", False);

  const Time acquireTime = CurrentTime;
  XSetSelectionOwner(display, clipboardAtom, window, acquireTime);
  XFlush(display);

  if (XGetSelectionOwner(display, clipboardAtom) != window) {
    std::printf("{\"event\":\"error\",\"message\":\"failed to acquire CLIPBOARD selection\"}\n");
    std::fflush(stdout);
    return 1;
  }

  std::printf("{\"event\":\"ready\"}\n");
  std::fflush(stdout);

  // Answers one target request into `property` on `requestor`; returns
  // false for anything unsupported so the caller can refuse it per ICCCM.
  auto respondToTarget = [&](Atom target, Window requestor, Atom property) -> bool {
    if (target == uriListAtom) {
      XChangeProperty(display, requestor, property, uriListAtom, 8, PropModeReplace,
                       reinterpret_cast<const unsigned char*>(uriListContent.data()),
                       static_cast<int>(uriListContent.size()));
      return true;
    }
    if (target == gnomeAtom) {
      XChangeProperty(display, requestor, property, gnomeAtom, 8, PropModeReplace,
                       reinterpret_cast<const unsigned char*>(gnomeContent.data()),
                       static_cast<int>(gnomeContent.size()));
      return true;
    }
    if (target == timestampAtom) {
      const long time = static_cast<long>(acquireTime);
      XChangeProperty(display, requestor, property, XA_INTEGER, 32, PropModeReplace,
                       reinterpret_cast<const unsigned char*>(&time), 1);
      return true;
    }
    if (target == targetsAtom) {
      Atom targets[] = {targetsAtom, multipleAtom, timestampAtom, gnomeAtom, uriListAtom};
      XChangeProperty(display, requestor, property, XA_ATOM, 32, PropModeReplace,
                       reinterpret_cast<const unsigned char*>(targets), 5);
      return true;
    }
    return false;
  };

  while (true) {
    XEvent event;
    XNextEvent(display, &event);

    if (event.type == SelectionClear) {
      break;  // Superseded by a newer clipboard owner -- nothing left to serve.
    }
    if (event.type != SelectionRequest) continue;

    XSelectionRequestEvent* req = &event.xselectionrequest;
    XSelectionEvent response;
    response.type = SelectionNotify;
    response.display = req->display;
    response.requestor = req->requestor;
    response.selection = req->selection;
    response.time = req->time;
    response.target = req->target;
    response.property = (req->property != None) ? req->property : req->target;

    if (req->target == multipleAtom) {
      // ICCCM MULTIPLE: requestor's `property` holds atom pairs (target,
      // property) to fulfil sequentially; a pair's property is set to None
      // in place to signal that particular sub-request failed.
      Atom actualType;
      int actualFormat;
      unsigned long itemCount, bytesAfter;
      unsigned char* data = nullptr;
      if (req->property != None &&
          XGetWindowProperty(display, req->requestor, req->property, 0, 65536, False,
                              AnyPropertyType, &actualType, &actualFormat, &itemCount,
                              &bytesAfter, &data) == Success &&
          data) {
        if (actualFormat == 32) {
          Atom* pairs = reinterpret_cast<Atom*>(data);
          for (unsigned long i = 0; i + 1 < itemCount; i += 2) {
            if (!respondToTarget(pairs[i], req->requestor, pairs[i + 1])) {
              pairs[i + 1] = None;
            }
          }
          XChangeProperty(display, req->requestor, req->property, actualType, actualFormat,
                           PropModeReplace, data, static_cast<int>(itemCount));
        }
        XFree(data);
      }
    } else if (!respondToTarget(req->target, req->requestor, response.property)) {
      response.property = None;  // Unsupported target -- refuse per ICCCM.
    }

    XSendEvent(display, req->requestor, False, NoEventMask, reinterpret_cast<XEvent*>(&response));
    XFlush(display);
  }

  XCloseDisplay(display);
  return 0;
}
