import AVFoundation
import CoreGraphics
import CoreMedia
import Foundation
import ScreenCaptureKit

// Adapted from a reference screen-recorder helper the user supplied (see
// docs/receipts and the plan this was built from) -- same subprocess
// architecture (spawn with one JSON config argument, emit newline-delimited
// JSON events on stdout, accept pause/resume/stop on stdin), simplified for
// this app: no webcam (that stays an Electron-side sidecar, unchanged), no
// recording-id/manifest concepts this app doesn't have. Window/display
// target resolution follows the reference's precedence (explicit bounds/id
// from Electron, not just an opaque desktopCapturer id), plus a title-based
// window fallback this app's own debugging showed was necessary --
// Electron's window source id did not reliably map to SCWindow.windowID
// here even though it does on Windows in the reference.

struct Rectangle: Decodable {
	let x: Double
	let y: Double
	let width: Double
	let height: Double
}

struct RecordingRequest: Decodable {
	struct Source: Decodable {
		let type: String
		let displayId: UInt32?
		let windowHandle: UInt32?
		let windowTitle: String?
		let bounds: Rectangle?
		/// Drag-selected sub-rectangle of a "display" source ("Area" mode on
		/// the Electron side), as a 0-1 fraction of the display's own
		/// width/height -- fraction rather than raw points/pixels so this
		/// doesn't care whether the Electron side measured in DIP or bitmap
		/// pixels (see capture-region.ts's `imageSpace` caveat); this helper
		/// converts to real points (SCStreamConfiguration.sourceRect) and
		/// real pixels (output width/height) itself, from its own
		/// authoritative display data. Display sources only -- a window
		/// source has no crop concept here.
		let cropFraction: Rectangle?
	}

	struct Video: Decodable {
		let fps: Int
		let width: Int
		let height: Int
		let bitrate: Int?
		let hideCursor: Bool
	}

	struct Microphone: Decodable {
		let enabled: Bool
		let deviceId: String?
		let deviceName: String?
	}

	struct Audio: Decodable {
		struct SystemAudio: Decodable {
			let enabled: Bool
		}

		let system: SystemAudio
		let microphone: Microphone
	}

	let schemaVersion: Int?
	let source: Source
	let video: Video
	let audio: Audio
	let outputPath: String
}

enum HelperError: Error, CustomStringConvertible {
	case invalidArguments
	case unsupportedMacOS
	case sourceNotFound(String)
	case invalidSourceType(String)
	case permissionDenied(String)
	case writerSetupFailed(String)

	var description: String {
		switch self {
		case .invalidArguments:
			return "Expected one JSON recording request argument."
		case .unsupportedMacOS:
			return "ScreenCaptureKit recording requires macOS 13 or newer."
		case .sourceNotFound(let message):
			return message
		case .invalidSourceType(let sourceType):
			return "Unsupported source type: \(sourceType)."
		case .permissionDenied(let message):
			return message
		case .writerSetupFailed(let message):
			return message
		}
	}
}

func emit(_ fields: [String: Any]) {
	if let data = try? JSONSerialization.data(withJSONObject: fields, options: []),
		let line = String(data: data, encoding: .utf8)
	{
		print(line)
		fflush(stdout)
	}
}

func emitError(code: String, message: String) {
	emit([
		"event": "error",
		"code": code,
		"message": message,
	])
}

@available(macOS 13.0, *)
final class ScreenCaptureRecorder: NSObject, SCStreamOutput, SCStreamDelegate {
	private struct CaptureTarget {
		let filter: SCContentFilter
		let width: Int
		let height: Int
	}

	private let request: RecordingRequest
	private let sampleQueue = DispatchQueue(label: "app.benpocket.macos-recorder-helper.samples")
	private let stateQueue = DispatchQueue(label: "app.benpocket.macos-recorder-helper.state")
	private var stream: SCStream?
	private var writer: AVAssetWriter?
	private var videoInput: AVAssetWriterInput?
	private var systemAudioInput: AVAssetWriterInput?
	private var microphoneAudioInput: AVAssetWriterInput?
	private var didStartWriting = false
	private var didEmitRecordingStarted = false
	private var isStopping = false
	private var isPaused = false
	private var pauseStartedAt: CMTime?
	private var totalPausedDuration = CMTime.zero
	private var nativeMicrophoneEnabled = false
	private var outputWidth = 1920
	private var outputHeight = 1080
	/// Set only when `request.source.cropFraction` is present -- passed to
	/// `SCStreamConfiguration.sourceRect` in `makeStreamConfiguration()` to
	/// crop capture at the ScreenCaptureKit level, so a cropped recording
	/// still goes through this helper (cursor-hide, native audio) instead
	/// of falling back to the renderer's canvas-crop-relay path, which has
	/// no way to hide the cursor at all -- see capture-engine.ts's
	/// `tryStartNativeRecording`.
	private var outputSourceRect: CGRect?
	private let microphoneOutputTypeRawValue = 2
	private let hostClock = CMClockGetHostTimeClock()

	init(request: RecordingRequest) {
		self.request = request
	}

	func start() async throws {
		try ensureRequestedPermissions()

		let content = try await SCShareableContent.excludingDesktopWindows(
			true,
			onScreenWindowsOnly: false
		)
		let target = try makeCaptureTarget(from: content)
		outputWidth = target.width
		outputHeight = target.height
		let configuration = makeStreamConfiguration()
		let stream = SCStream(filter: target.filter, configuration: configuration, delegate: self)

		try stream.addStreamOutput(self, type: .screen, sampleHandlerQueue: sampleQueue)
		if request.audio.system.enabled {
			try stream.addStreamOutput(self, type: .audio, sampleHandlerQueue: sampleQueue)
		}
		if nativeMicrophoneEnabled {
			guard let microphoneOutputType = SCStreamOutputType(rawValue: microphoneOutputTypeRawValue) else {
				throw HelperError.sourceNotFound(
					"Native microphone capture requires a macOS version with ScreenCaptureKit microphone output."
				)
			}
			try stream.addStreamOutput(self, type: microphoneOutputType, sampleHandlerQueue: sampleQueue)
		}
		try setupWriter()

		self.stream = stream
		emit(["event": "ready", "schemaVersion": 1])
		try await stream.startCapture()
	}

	func stop() async {
		let shouldStop = stateQueue.sync { () -> Bool in
			if isStopping {
				return false
			}
			isStopping = true
			return true
		}
		if !shouldStop {
			return
		}

		do {
			try await stream?.stopCapture()
		} catch {
			emit([
				"event": "warning",
				"code": "stop-capture-failed",
				"message": "\(error)",
			])
		}

		await finishWriter()
	}

	func pause() {
		let didPause = stateQueue.sync { () -> Bool in
			if isStopping || isPaused {
				return false
			}
			isPaused = true
			pauseStartedAt = CMClockGetTime(hostClock)
			return true
		}
		if didPause {
			emit(["event": "recording-paused", "timestampMs": Int(Date().timeIntervalSince1970 * 1000)])
		}
	}

	func resume() {
		let didResume = stateQueue.sync { () -> Bool in
			if isStopping || !isPaused {
				return false
			}
			if let pauseStartedAt {
				let now = CMClockGetTime(hostClock)
				totalPausedDuration = CMTimeAdd(totalPausedDuration, CMTimeSubtract(now, pauseStartedAt))
			}
			isPaused = false
			pauseStartedAt = nil
			return true
		}
		if didResume {
			emit(["event": "recording-resumed", "timestampMs": Int(Date().timeIntervalSince1970 * 1000)])
		}
	}

	func stream(_ stream: SCStream, didStopWithError error: Error) {
		emitError(code: "capture-stopped-with-error", message: "\(error)")
		Task {
			await stop()
		}
	}

	func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
		guard CMSampleBufferDataIsReady(sampleBuffer) else {
			return
		}
		let pauseState = currentPauseState()
		if pauseState.paused {
			return
		}
		guard let sampleBuffer = retimedSampleBuffer(sampleBuffer, subtracting: pauseState.offset) else {
			return
		}

		if type == .audio {
			appendAudioSampleBuffer(sampleBuffer, to: systemAudioInput)
			return
		}

		if type.rawValue == microphoneOutputTypeRawValue {
			appendAudioSampleBuffer(sampleBuffer, to: microphoneAudioInput)
			return
		}

		guard type == .screen else {
			return
		}
		guard isCompleteFrame(sampleBuffer) else {
			return
		}
		guard let videoInput, let writer else {
			return
		}
		let presentationTime = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
		if !didStartWriting {
			writer.startWriting()
			writer.startSession(atSourceTime: presentationTime)
			didStartWriting = true
		}

		if videoInput.isReadyForMoreMediaData {
			if videoInput.append(sampleBuffer), !didEmitRecordingStarted {
				didEmitRecordingStarted = true
				emit([
					"event": "recording-started",
					"timestampMs": Int(Date().timeIntervalSince1970 * 1000),
					"width": outputWidth,
					"height": outputHeight,
				])
			}
		}
	}

	private func ensureRequestedPermissions() throws {
		if !CGPreflightScreenCaptureAccess() {
			let granted = CGRequestScreenCaptureAccess()
			if !granted {
				throw HelperError.permissionDenied("Screen recording permission is required for ScreenCaptureKit capture.")
			}
		}

		if request.audio.microphone.enabled {
			switch AVCaptureDevice.authorizationStatus(for: .audio) {
			case .authorized:
				break
			case .notDetermined:
				let semaphore = DispatchSemaphore(value: 0)
				AVCaptureDevice.requestAccess(for: .audio) { _ in
					semaphore.signal()
				}
				let waitResult = semaphore.wait(timeout: .now() + 30)
				if waitResult == .timedOut || AVCaptureDevice.authorizationStatus(for: .audio) != .authorized {
					throw HelperError.permissionDenied("Microphone permission is required for native microphone capture.")
				}
			default:
				throw HelperError.permissionDenied("Microphone permission is required for native microphone capture.")
			}
		}
	}

	private func makeCaptureTarget(from content: SCShareableContent) throws -> CaptureTarget {
		switch request.source.type {
		case "display":
			let display = try resolveDisplay(from: content.displays)
			// CGDisplayPixelsWide/High is a legacy Quartz Display Services API
			// that, for a bare command-line binary with no Info.plist
			// declaring Retina awareness, reports the display's *points*
			// resolution rather than its true backing pixel resolution --
			// confirmed by inspecting a real recording, which came out at
			// exactly half the display's actual panel resolution. The mode's
			// own pixelWidth/pixelHeight (same API `scaleFactor(for:)` below
			// already relies on for the window case) is the HiDPI-safe way
			// to get real pixel dimensions regardless of the calling
			// process's resolution-awareness.
			let mode = CGDisplayCopyDisplayMode(display.displayID)
			let fullPixelWidth = mode.map { $0.pixelWidth } ?? Int(CGDisplayPixelsWide(display.displayID))
			let fullPixelHeight = mode.map { $0.pixelHeight } ?? Int(CGDisplayPixelsHigh(display.displayID))

			if let cropFraction = request.source.cropFraction {
				// SCStreamConfiguration.sourceRect is in points, local to the
				// display's own origin (not the global multi-monitor space
				// display.frame.origin sits in) -- display.frame.size is
				// already the display's own point dimensions.
				outputSourceRect = CGRect(
					x: cropFraction.x * display.frame.width,
					y: cropFraction.y * display.frame.height,
					width: cropFraction.width * display.frame.width,
					height: cropFraction.height * display.frame.height
				)
				let cropPixelWidth = Int((Double(fullPixelWidth) * cropFraction.width).rounded())
				let cropPixelHeight = Int((Double(fullPixelHeight) * cropFraction.height).rounded())
				return CaptureTarget(
					filter: SCContentFilter(display: display, excludingWindows: []),
					width: clampCaptureDimension(cropPixelWidth, fallback: request.video.width),
					height: clampCaptureDimension(cropPixelHeight, fallback: request.video.height)
				)
			}

			return CaptureTarget(
				filter: SCContentFilter(display: display, excludingWindows: []),
				width: clampCaptureDimension(fullPixelWidth, fallback: request.video.width),
				height: clampCaptureDimension(fullPixelHeight, fallback: request.video.height)
			)
		case "window":
			let window = try resolveWindow(from: content.windows)
			let candidateDisplay = content.displays.first {
				$0.frame.intersects(window.frame) || $0.frame.contains(CGPoint(x: window.frame.midX, y: window.frame.midY))
			}
			let scaleFactor = Self.scaleFactor(for: candidateDisplay?.displayID ?? CGMainDisplayID())
			let width = Int(window.frame.width) * scaleFactor
			let height = Int(window.frame.height) * scaleFactor
			return CaptureTarget(
				filter: SCContentFilter(desktopIndependentWindow: window),
				width: clampCaptureDimension(width, fallback: request.video.width),
				height: clampCaptureDimension(height, fallback: request.video.height)
			)
		default:
			throw HelperError.invalidSourceType(request.source.type)
		}
	}

	// Bounds-match first (Electron's Display.bounds and SCDisplay.frame both
	// use the shared global display coordinate space), falling back to the
	// first enumerated display rather than failing outright -- matches the
	// precedence the reference's Windows monitor matcher uses (exact/best
	// match first, permissive fallback last), not a strict "must match
	// exactly or fail" policy.
	private func resolveDisplay(from displays: [SCDisplay]) throws -> SCDisplay {
		if let bounds = request.source.bounds {
			var best: SCDisplay?
			var bestDistance = Double.greatestFiniteMagnitude
			for display in displays {
				let frame = display.frame
				let dx = frame.origin.x - bounds.x
				let dy = frame.origin.y - bounds.y
				let dw = frame.size.width - bounds.width
				let dh = frame.size.height - bounds.height
				let distance = dx * dx + dy * dy + dw * dw + dh * dh
				if distance < bestDistance {
					bestDistance = distance
					best = display
				}
			}
			if let best {
				return best
			}
		}
		if let first = displays.first {
			return first
		}
		throw HelperError.sourceNotFound("No display available for capture.")
	}

	// Handle-match first (desktopCapturer's window source id embeds a
	// number its own docs describe as the native handle), falling back to
	// title match -- confirmed necessary in practice: id-only matching
	// failed on a real recording attempt during this app's own testing,
	// even though the equivalent technique works reliably on Windows.
	private func resolveWindow(from windows: [SCWindow]) throws -> SCWindow {
		if let handle = request.source.windowHandle,
			let match = windows.first(where: { $0.windowID == handle })
		{
			return match
		}
		if let title = request.source.windowTitle, !title.isEmpty {
			if let exact = windows.first(where: { $0.title == title }) {
				return exact
			}
			if let contains = windows.first(where: { $0.title?.contains(title) == true }) {
				return contains
			}
		}
		throw HelperError.sourceNotFound("Window not found for capture.")
	}

	private func makeStreamConfiguration() -> SCStreamConfiguration {
		let configuration = SCStreamConfiguration()
		configuration.width = outputWidth
		configuration.height = outputHeight
		if let outputSourceRect {
			configuration.sourceRect = outputSourceRect
		}
		configuration.minimumFrameInterval = CMTime(value: 1, timescale: CMTimeScale(max(1, request.video.fps)))
		configuration.queueDepth = 6
		configuration.showsCursor = !request.video.hideCursor
		configuration.pixelFormat = kCVPixelFormatType_32BGRA
		configuration.sampleRate = 48_000
		configuration.channelCount = 2
		configuration.excludesCurrentProcessAudio = true
		configuration.capturesAudio = request.audio.system.enabled

		if request.audio.microphone.enabled {
			guard supportsNativeMicrophoneCapture(streamConfig: configuration) else {
				nativeMicrophoneEnabled = false
				emit([
					"event": "warning",
					"code": "microphone-unavailable",
					"message": "Native microphone capture requires ScreenCaptureKit microphone support on this macOS version.",
				])
				return configuration
			}
			nativeMicrophoneEnabled = true
			configuration.capturesAudio = true
			configuration.setValue(true, forKey: "captureMicrophone")
			if let deviceId = resolveMicrophoneCaptureDeviceID() {
				configuration.setValue(deviceId, forKey: "microphoneCaptureDeviceID")
			}
		} else {
			nativeMicrophoneEnabled = false
		}

		return configuration
	}

	private func setupWriter() throws {
		let outputUrl = URL(fileURLWithPath: request.outputPath)
		try? FileManager.default.removeItem(at: outputUrl)
		try FileManager.default.createDirectory(
			at: outputUrl.deletingLastPathComponent(),
			withIntermediateDirectories: true
		)

		let writer = try AVAssetWriter(outputURL: outputUrl, fileType: .mp4)
		let settings: [String: Any] = [
			AVVideoCodecKey: AVVideoCodecType.h264,
			AVVideoWidthKey: outputWidth,
			AVVideoHeightKey: outputHeight,
			AVVideoCompressionPropertiesKey: [
				AVVideoAverageBitRateKey: request.video.bitrate ?? Self.defaultBitRate(
					width: outputWidth,
					height: outputHeight
				),
				AVVideoExpectedSourceFrameRateKey: request.video.fps,
				AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
			],
		]
		let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
		input.expectsMediaDataInRealTime = true

		guard writer.canAdd(input) else {
			throw HelperError.writerSetupFailed("Unable to add H.264 video input to AVAssetWriter.")
		}

		writer.add(input)
		self.writer = writer
		self.videoInput = input

		if request.audio.system.enabled {
			systemAudioInput = try addAudioInput(to: writer, bitRate: 192_000)
		}
		if nativeMicrophoneEnabled {
			microphoneAudioInput = try addAudioInput(to: writer, bitRate: 128_000)
		}
	}

	private func finishWriter() async {
		guard let writer else {
			return
		}

		videoInput?.markAsFinished()
		systemAudioInput?.markAsFinished()
		microphoneAudioInput?.markAsFinished()

		await withCheckedContinuation { continuation in
			writer.finishWriting {
				continuation.resume()
			}
		}

		if writer.status == .completed {
			emit(["event": "recording-stopped", "outputPath": request.outputPath])
		} else {
			emitError(
				code: "writer-failed",
				message: writer.error.map { "\($0)" } ?? "AVAssetWriter failed with status \(writer.status.rawValue)."
			)
		}
	}

	private func addAudioInput(to writer: AVAssetWriter, bitRate: Int) throws -> AVAssetWriterInput {
		let settings: [String: Any] = [
			AVFormatIDKey: kAudioFormatMPEG4AAC,
			AVSampleRateKey: 48_000,
			AVNumberOfChannelsKey: 2,
			AVEncoderBitRateKey: bitRate,
		]
		let input = AVAssetWriterInput(mediaType: .audio, outputSettings: settings)
		input.expectsMediaDataInRealTime = true

		guard writer.canAdd(input) else {
			throw HelperError.writerSetupFailed("Unable to add AAC audio input to AVAssetWriter.")
		}

		writer.add(input)
		return input
	}

	private func appendAudioSampleBuffer(_ sampleBuffer: CMSampleBuffer, to input: AVAssetWriterInput?) {
		guard didStartWriting else {
			return
		}
		guard let input, input.isReadyForMoreMediaData else {
			return
		}

		input.append(sampleBuffer)
	}

	private func currentPauseState() -> (paused: Bool, offset: CMTime) {
		stateQueue.sync {
			(isPaused, totalPausedDuration)
		}
	}

	private func retimedSampleBuffer(_ sampleBuffer: CMSampleBuffer, subtracting offset: CMTime) -> CMSampleBuffer? {
		if !offset.isValid || offset == .zero {
			return sampleBuffer
		}

		let sampleCount = CMSampleBufferGetNumSamples(sampleBuffer)
		if sampleCount <= 0 {
			return sampleBuffer
		}

		var timing = Array(repeating: CMSampleTimingInfo(), count: sampleCount)
		let timingStatus = CMSampleBufferGetSampleTimingInfoArray(
			sampleBuffer,
			entryCount: sampleCount,
			arrayToFill: &timing,
			entriesNeededOut: nil
		)
		if timingStatus != noErr {
			return sampleBuffer
		}

		for index in timing.indices {
			if timing[index].presentationTimeStamp.isValid {
				timing[index].presentationTimeStamp = CMTimeSubtract(timing[index].presentationTimeStamp, offset)
			}
			if timing[index].decodeTimeStamp.isValid {
				timing[index].decodeTimeStamp = CMTimeSubtract(timing[index].decodeTimeStamp, offset)
			}
		}

		var retimedBuffer: CMSampleBuffer?
		let copyStatus = CMSampleBufferCreateCopyWithNewTiming(
			allocator: kCFAllocatorDefault,
			sampleBuffer: sampleBuffer,
			sampleTimingEntryCount: sampleCount,
			sampleTimingArray: &timing,
			sampleBufferOut: &retimedBuffer
		)
		if copyStatus != noErr {
			return sampleBuffer
		}

		return retimedBuffer
	}

	private func isCompleteFrame(_ sampleBuffer: CMSampleBuffer) -> Bool {
		guard
			let attachments = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, createIfNecessary: false)
				as? [[SCStreamFrameInfo: Any]],
			let attachment = attachments.first,
			let statusRawValue = attachment[SCStreamFrameInfo.status] as? Int,
			let status = SCFrameStatus(rawValue: statusRawValue)
		else {
			return true
		}

		return status == .complete
	}

	// `value` (from CGDisplayPixelsWide/High, or the window frame times its
	// display's real backing scale factor) is the display's actual native
	// pixel resolution -- always preferred over `fallback` (the renderer's
	// own estimate, computed from window.screen/devicePixelRatio, which can
	// legitimately be off for a display the app's own window isn't sitting
	// on, or a non-default HiDPI "scaled resolution" mode). Clamping the
	// real value down to a smaller estimate silently threw away resolution
	// on Retina/4K captures -- only fall back to the estimate when the real
	// value isn't available at all (value <= 0).
	private func clampCaptureDimension(_ value: Int, fallback: Int) -> Int {
		let base = value > 0 ? value : max(2, fallback)
		return max(2, base - (base % 2))
	}

	// Matches this app's own scratch-recording bitrate target on the
	// Electron side (capture-engine.ts's videoBitsPerSecondFor) -- ~3 bits
	// per pixel per second, floor/ceiling so 1080p lands on 8 Mbps and
	// 4K/5K captures don't get crushed by a flat rate that was only ever
	// reasonable for 1080p.
	private static func defaultBitRate(width: Int, height: Int) -> Int {
		min(max(width * height * 3, 8_000_000), 40_000_000)
	}

	private static func scaleFactor(for displayId: CGDirectDisplayID) -> Int {
		guard let mode = CGDisplayCopyDisplayMode(displayId) else {
			return 1
		}
		return max(1, mode.pixelWidth / max(1, mode.width))
	}

	private func supportsNativeMicrophoneCapture(streamConfig: SCStreamConfiguration) -> Bool {
		streamConfig.responds(to: Selector(("setCaptureMicrophone:")))
			&& streamConfig.responds(to: Selector(("setMicrophoneCaptureDeviceID:")))
			&& SCStreamOutputType(rawValue: microphoneOutputTypeRawValue) != nil
	}

	private func resolveMicrophoneCaptureDeviceID() -> String? {
		let devices = AVCaptureDevice.devices(for: .audio)

		if let deviceName = request.audio.microphone.deviceName?.trimmingCharacters(in: .whitespacesAndNewlines),
			!deviceName.isEmpty,
			let device = devices.first(where: { $0.localizedName == deviceName })
		{
			return device.uniqueID
		}

		if let deviceId = request.audio.microphone.deviceId?.trimmingCharacters(in: .whitespacesAndNewlines),
			!deviceId.isEmpty,
			devices.contains(where: { $0.uniqueID == deviceId })
		{
			return deviceId
		}

		return nil
	}
}

// A one-shot query, distinct from the RecordingRequest/recording-session
// protocol above: no ScreenCaptureKit session, no permission dependency
// beyond what Quartz Window Services itself needs (window geometry is
// available without Screen Recording access -- only window *content*/name
// is redacted without it, and by the time this app asks for a window's
// bounds, recording permission is already required elsewhere anyway).
// Exists so `useRecordingController.ts` can normalize cursor-tracking
// samples against a real on-screen rect for *any* selected window, not
// just the one app (Simulator) this helper used to special-case via
// AppleScript/System Events on the Electron side.
private func queryWindowBounds(windowId: CGWindowID) -> CGRect? {
	guard
		let info = CGWindowListCopyWindowInfo(.optionIncludingWindow, windowId) as? [[String: Any]],
		let windowInfo = info.first,
		let boundsDict = windowInfo[kCGWindowBounds as String] as? [String: Any]
	else {
		return nil
	}
	return CGRect(dictionaryRepresentation: boundsDict as CFDictionary)
}

@main
struct BenPocketMacOSRecorderHelper {
	static func main() async {
		do {
			guard CommandLine.arguments.count == 2 else {
				throw HelperError.invalidArguments
			}

			let argData = Data(CommandLine.arguments[1].utf8)

			if let rawJson = try? JSONSerialization.jsonObject(with: argData) as? [String: Any],
				let mode = rawJson["mode"] as? String, mode == "window-bounds"
			{
				let windowId = (rawJson["windowId"] as? NSNumber)?.uint32Value ?? 0
				if let bounds = queryWindowBounds(windowId: CGWindowID(windowId)) {
					emit([
						"event": "window-bounds",
						"found": true,
						"x": bounds.origin.x,
						"y": bounds.origin.y,
						"width": bounds.width,
						"height": bounds.height,
					])
				} else {
					emit(["event": "window-bounds", "found": false])
				}
				exit(0)
			}

			guard #available(macOS 13.0, *) else {
				throw HelperError.unsupportedMacOS
			}

			let requestData = argData
			let decoder = JSONDecoder()
			let request = try decoder.decode(RecordingRequest.self, from: requestData)
			let recorder = ScreenCaptureRecorder(request: request)
			let stopTask = Task.detached {
				while let line = readLine() {
					let command = line.trimmingCharacters(in: .whitespacesAndNewlines)
					switch command {
					case "pause":
						recorder.pause()
					case "resume":
						recorder.resume()
					case "stop":
						await recorder.stop()
						exit(0)
					default:
						break
					}
				}
			}

			try await recorder.start()
			await stopTask.value
		} catch let error as HelperError {
			emitError(code: "helper-error", message: error.description)
			exit(1)
		} catch {
			emitError(code: "helper-error", message: "\(error)")
			exit(1)
		}
	}
}
