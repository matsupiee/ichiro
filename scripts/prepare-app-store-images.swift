import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// --iphone-6.5 exports a separate set for the 6.5-inch App Store screenshot slot.
let arguments = Array(CommandLine.arguments.dropFirst())
let export65 = arguments.first == "--iphone-6.5"
let exportIPad = arguments.first == "--ipad-13"
let paths = (export65 || exportIPad) ? Array(arguments.dropFirst()) : arguments
let width = exportIPad ? 2048 : (export65 ? 1284 : 1320)
let height = exportIPad ? 2732 : (export65 ? 2778 : 2868)
let sourceWidth = exportIPad ? 2048 : 1320
let sourceHeight = exportIPad ? 2732 : 2868
for path in paths {
    let url = URL(fileURLWithPath: path)
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
          image.width == sourceWidth, image.height == sourceHeight,
          let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
          let context = CGContext(data: nil, width: width, height: height,
                                  bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace,
                                  bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
    else { fatalError("Expected a \(sourceWidth) × \(sourceHeight) native PNG: \(path)") }
    let bounds = CGRect(x: 0, y: 0, width: width, height: height)
    context.setFillColor(CGColor(gray: 1, alpha: 1))
    context.fill(bounds)
    // Preserve proportions; trim only the outer top/bottom margin (about 6 px).
    let scale = max(Double(width) / Double(image.width), Double(height) / Double(image.height))
    let drawWidth = Double(image.width) * scale
    let drawHeight = Double(image.height) * scale
    context.interpolationQuality = .high
    context.draw(image, in: CGRect(x: (Double(width) - drawWidth) / 2,
                                  y: (Double(height) - drawHeight) / 2,
                                  width: drawWidth, height: drawHeight))
    let outputDirectory = export65
        ? url.deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("iphone-6.5")
        : url.deletingLastPathComponent()
    try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
    let output = outputDirectory.appendingPathComponent(url.lastPathComponent)
    guard let opaque = context.makeImage(),
          let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil)
    else { fatalError("Cannot encode \(path)") }
    CGImageDestinationAddImage(destination, opaque, nil)
    guard CGImageDestinationFinalize(destination) else { fatalError("Cannot save \(path)") }
    print("Prepared \(output.path)")
}
