import CoreGraphics
import Foundation
import ImageIO
import Testing

@testable import StillCore

@Suite struct BackgroundCutoutTests {
  private func setup() throws -> URL {
    let dir = FileManager.default.temporaryDirectory
      .appendingPathComponent("StillCutoutTests-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir
  }

  private func teardown(_ dir: URL) {
    try? FileManager.default.removeItem(at: dir)
  }

  /// A red ball on a white backdrop: an unambiguous subject for the mask.
  private func subjectPhoto(in dir: URL, size: Int = 240) throws -> URL {
    let space = CGColorSpaceCreateDeviceRGB()
    guard
      let context = CGContext(
        data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: size * 4,
        space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
    else { throw CutoutError.encodingFailed }
    let white = CGColor(red: 1, green: 1, blue: 1, alpha: 1)
    let red = CGColor(red: 0.8, green: 0.1, blue: 0.1, alpha: 1)
    context.setFillColor(white)
    context.fill(CGRect(x: 0, y: 0, width: size, height: size))
    context.setFillColor(red)
    let radius = CGFloat(size) * 0.3
    context.fillEllipse(in: CGRect(
      x: (CGFloat(size) - radius) / 2, y: (CGFloat(size) - radius) / 2,
      width: radius, height: radius))
    guard let image = context.makeImage() else { throw CutoutError.encodingFailed }
    let url = dir.appendingPathComponent("subject.png")
    guard
      let writer = CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil)
    else { throw CutoutError.encodingFailed }
    CGImageDestinationAddImage(writer, image, nil)
    guard CGImageDestinationFinalize(writer) else { throw CutoutError.encodingFailed }
    return url
  }

  private func rgba(of url: URL) throws -> (width: Int, height: Int, pixels: [UInt8]) {
    guard
      let source = CGImageSourceCreateWithURL(url as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
    else { throw CutoutError.unreadable }
    let width = image.width, height = image.height
    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    guard
      let context = CGContext(
        data: &pixels, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
        space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
    else { throw CutoutError.encodingFailed }
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    return (width, height, pixels)
  }

  private func pixel(_ rgba: (width: Int, height: Int, pixels: [UInt8]), x: Int, y: Int) -> (r: UInt8, g: UInt8, b: UInt8, a: UInt8) {
    let offset = (y * rgba.width + x) * 4
    return (
      rgba.pixels[offset], rgba.pixels[offset + 1], rgba.pixels[offset + 2], rgba.pixels[offset + 3])
  }

  @Test func cutoutKeepsTheSubjectAndDropsTheBackdrop() throws {
    let dir = try setup()
    defer { teardown(dir) }
    let source = try subjectPhoto(in: dir)

    let cutout = try BackgroundCutout.isolateSubject(of: source)

    #expect(cutout.pathExtension == "png")
    #expect(!FileManager.default.fileExists(atPath: source.path))
    let rgba = try self.rgba(of: cutout)
    let center = pixel(rgba, x: rgba.width / 2, y: rgba.height / 2)
    // The ball stays opaque and red.
    #expect(center.a > 200)
    #expect(center.r > center.g + 60)
    // The white backdrop is gone, not painted over.
    for (x, y) in [(8, 8), (rgba.width - 9, 8), (8, rgba.height - 9)] {
      #expect(pixel(rgba, x: x, y: y).a < 64)
    }
  }

  @Test func cutoutRefusesAnUnreadableFile() throws {
    let dir = try setup()
    defer { teardown(dir) }
    let broken = dir.appendingPathComponent("broken.png")
    try Data("not-an-image".utf8).write(to: broken)

    #expect(throws: CutoutError.unreadable) {
      try BackgroundCutout.isolateSubject(of: broken)
    }
    // A failed cutout leaves the original alone.
    #expect(FileManager.default.fileExists(atPath: broken.path))
  }
}
