/**
 * iconUtils.ts — Offline-first icon generation system.
 *
 * Priority (per Project Constitution Article VII):
 *   1. Bundled icons (future — Simple Icons)
 *   2. User-uploaded custom icons (future)
 *   3. Locally cached favicons (future — user-initiated only)
 *   4. Generated fallback (THIS FILE) — always available, zero network
 *
 * FORBIDDEN: Google Favicon API, DuckDuckGo API, any third-party icon service.
 */

// ─────────────────────────────────────────────────────────
// Deterministic color palette
// Each service name hashes to a consistent hue — same name = same color always.
// ─────────────────────────────────────────────────────────

const PALETTE: [string, string][] = [
  ['#7c3aed', '#4f46e5'], // violet → indigo
  ['#2563eb', '#0891b2'], // blue → cyan
  ['#0891b2', '#0d9488'], // cyan → teal
  ['#059669', '#16a34a'], // emerald → green
  ['#ca8a04', '#d97706'], // yellow → amber
  ['#ea580c', '#dc2626'], // orange → red
  ['#db2777', '#9333ea'], // pink → purple
  ['#6366f1', '#8b5cf6'], // indigo → violet
  ['#0284c7', '#7c3aed'], // sky → violet
  ['#10b981', '#3b82f6'], // emerald → blue
  ['#f59e0b', '#ef4444'], // amber → red
  ['#8b5cf6', '#ec4899'], // violet → pink
];

/**
 * Returns a consistent palette index derived from the service name.
 * Same name → same index → same colors. Always.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash % PALETTE.length;
}

// ─────────────────────────────────────────────────────────
// Domain extraction
// ─────────────────────────────────────────────────────────

/**
 * Extracts a normalised display name from a URL or free-text title.
 * "https://github.com" → "github"
 * "My GitHub Token"   → "my"  (first word, lowercased)
 */
export function extractDomain(input: string): string {
  if (!input) return 'vault';
  try {
    const url = input.startsWith('http') ? input : `https://${input}`;
    const hostname = new URL(url).hostname;
    // Remove www., strip TLD if possible
    return hostname.replace(/^www\./, '').split('.')[0].toLowerCase();
  } catch {
    // Not a URL — use the first word of the title
    return input.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  }
}

// ─────────────────────────────────────────────────────────
// SVG fallback icon generator
// ─────────────────────────────────────────────────────────

/**
 * Generates an SVG data URL for a given service name.
 * The icon is a rounded square with a gradient background and the first letter.
 * Fully deterministic — same input = same SVG = same data URL.
 *
 * @param name  Service name or domain (e.g. "GitHub", "github.com")
 * @param size  Icon size in px (default: 40)
 */
export function generateFallbackIcon(name: string, size = 40): string {
  if (!name) name = 'V';
  const domain = extractDomain(name) || name;
  const letter = domain[0]?.toUpperCase() ?? 'V';
  const idx = hashString(domain);
  const [colorA, colorB] = PALETTE[idx];

  const radius = Math.round(size * 0.24); // ~24% corner radius
  const fontSize = Math.round(size * 0.44);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${colorA}"/>
      <stop offset="100%" stop-color="${colorB}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>
  <text
    x="50%"
    y="50%"
    dominant-baseline="central"
    text-anchor="middle"
    font-family="system-ui, -apple-system, sans-serif"
    font-weight="700"
    font-size="${fontSize}"
    fill="rgba(255,255,255,0.95)"
  >${letter}</text>
</svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Returns the gradient CSS string for a given service name.
 * Useful for background-image: linear-gradient(...) on div elements.
 */
export function getServiceGradient(name: string): string {
  const domain = extractDomain(name) || name;
  const idx = hashString(domain);
  const [colorA, colorB] = PALETTE[idx];
  return `linear-gradient(135deg, ${colorA}, ${colorB})`;
}
