import Foundation

/// RFC 9562 UUID v7 (time-ordered, ms timestamp prefix).
public enum UUIDv7 {
    public static func generate() -> String {
        let ms = UInt64(Date().timeIntervalSince1970 * 1000)
        let randA = UInt16.random(in: 0...0x0FFF)
        let randB = UInt64.random(in: 0...0x3FFFFFFFFFFFFFFF)

        var bytes = [UInt8](repeating: 0, count: 16)
        bytes[0] = UInt8((ms >> 40) & 0xFF)
        bytes[1] = UInt8((ms >> 32) & 0xFF)
        bytes[2] = UInt8((ms >> 24) & 0xFF)
        bytes[3] = UInt8((ms >> 16) & 0xFF)
        bytes[4] = UInt8((ms >> 8) & 0xFF)
        bytes[5] = UInt8(ms & 0xFF)
        bytes[6] = 0x70 | UInt8((randA >> 8) & 0x0F)
        bytes[7] = UInt8(randA & 0xFF)
        bytes[8] = 0x80 | UInt8((randB >> 56) & 0x3F)
        bytes[9] = UInt8((randB >> 48) & 0xFF)
        bytes[10] = UInt8((randB >> 40) & 0xFF)
        bytes[11] = UInt8((randB >> 32) & 0xFF)
        bytes[12] = UInt8((randB >> 24) & 0xFF)
        bytes[13] = UInt8((randB >> 16) & 0xFF)
        bytes[14] = UInt8((randB >> 8) & 0xFF)
        bytes[15] = UInt8(randB & 0xFF)

        let hex = bytes.map { String(format: "%02x", $0) }.joined()
        return [
            String(hex.prefix(8)),
            String(hex.dropFirst(8).prefix(4)),
            String(hex.dropFirst(12).prefix(4)),
            String(hex.dropFirst(16).prefix(4)),
            String(hex.dropFirst(20)),
        ].joined(separator: "-")
    }
}