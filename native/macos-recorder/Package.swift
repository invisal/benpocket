// swift-tools-version: 5.9

import PackageDescription

let package = Package(
	name: "BenPocketMacOSRecorderHelper",
	platforms: [
		.macOS(.v13)
	],
	products: [
		.executable(
			name: "benpocket-macos-recorder-helper",
			targets: ["BenPocketMacOSRecorderHelper"]
		)
	],
	targets: [
		.executableTarget(
			name: "BenPocketMacOSRecorderHelper",
			path: "Sources/BenPocketMacOSRecorderHelper"
		)
	]
)
