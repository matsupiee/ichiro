import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// Re-encode native captures as opaque sRGB PNGs without changing their dimensions.
for path in CommandLine.arguments.dropFirst() {
    let url = URL(fileURLWithPath: path)
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
          image.width == 1320, image.height == 2868,
          let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
          let context = CGContext(data: nil, width: image.width, height: image.height,
                                  bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace,
                                  bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
    else { fatalError("Expected a 1320 × 2868 native PNG: \(path)") }
    let bounds = CGRect(x: 0, y: 0, width: image.width, height: image.height)
    context.setFillColor(CGColor(gray: 1, alpha: 1))
    context.fill(bounds)
    context.draw(image, in: bounds)
    guard let opaque = context.makeImage(),
          let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)
    else { fatalError("Cannot encode \(path)") }
    CGImageDestinationAddImage(destination, opaque, nil)
    guard CGImageDestinationFinalize(destination) else { fatalError("Cannot save \(path)") }
    print("Prepared \(path)")
}
