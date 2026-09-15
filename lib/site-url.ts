// Metadata may render before a Worker request exists. Order links require PUBLIC_BASE_URL.
export function metadataBaseUrl(): string {
  return process.env.PUBLIC_BASE_URL || "https://roseofberlin.de";
}
