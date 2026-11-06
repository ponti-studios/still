import CoreGraphics
import CoreImage
import Foundation
import ImageIO
import Vision

/// Why a cutout failed, in the words the screen shows.
public enum CutoutError: Error, LocalizedError {
  case unreadable
  case noSubject
  case encodingFailed

  public var errorDescription: String? {
    switch self {
    case .unreadable:
      return "That photo could not be read. Try another."
    case .noSubject:
      return "No clear subject was found. Try a photo with the item against a plain backdrop."
    case .encodingFailed:
      return "The cutout could not be saved. Try again."
    }
  }
}

/// Cuts a photo's background out on the device: Vision masks the foreground
/// subject, Core Image composites it over transparency, and the result is a
/// PNG. No server, no network — like the rest of the photo path.
public enum BackgroundCutout {
  /// Isolates the subject of the image at `sourceURL` and writes it as a PNG
  /// beside the original, then removes the original. Returns the cutout URL.
  /// A photo with no clear subject keeps its original and throws.
  @discardableResult
  public static func isolateSubject(of sourceURL: URL) throws -> URL {
    guard let image = CIImage(contentsOf: sourceURL, options: [.applyOrientationProperty: true])
    else { throw CutoutError.unreadable }

    let handler = VNImageRequestHandler(ciImage: image, options: [:])
    let request = VNGenerateForegroundInstanceMaskRequest()
    do {
      try handler.perform([request])
    } catch {
      throw CutoutError.unreadable
    }
    guard let observation = request.results?.first else { throw CutoutError.noSubject }
    let maskBuffer: CVPixelBuffer
    do {
      maskBuffer = try observation.generateScaledMaskForImage(
        forInstances: observation.allInstances, from: handler)
    } catch {
      throw CutoutError.noSubject
    }

    guard let blend = CIFilter(name: "CIBlendWithMask") else { throw CutoutError.noSubject }
    blend.setValue(image, forKey: kCIInputImageKey)
    blend.setValue(CIImage(color: .clear).cropped(to: image.extent), forKey: kCIInputBackgroundImageKey)
    blend.setValue(CIImage(cvPixelBuffer: maskBuffer), forKey: kCIInputMaskImageKey)
    guard let output = blend.outputImage else { throw CutoutError.noSubject }

    let rendered = CIContext().createCGImage(output, from: output.extent)
    guard let rendered else { throw CutoutError.encodingFailed }
    let destination = sourceURL.deletingLastPathComponent()
      .appendingPathComponent(sourceURL.deletingPathExtension().lastPathComponent + "-cutout")
      .appendingPathExtension("png")
    guard
      let writer = CGImageDestinationCreateWithURL(destination as CFURL, "public.png" as CFString, 1, nil)
    else { throw CutoutError.encodingFailed }
    CGImageDestinationAddImage(writer, rendered, nil)
    guard CGImageDestinationFinalize(writer) else { throw CutoutError.encodingFailed }

    try? FileManager.default.removeItem(at: sourceURL)
    return destination
  }
}
