const SHA256_FINGERPRINT = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export function parseSha256Fingerprints(value: string | undefined): string[] {
  if (!value) return [];

  return [...new Set(
    value
      .split(",")
      .map((fingerprint) => fingerprint.trim().toUpperCase())
      .filter((fingerprint) => SHA256_FINGERPRINT.test(fingerprint))
  )];
}
