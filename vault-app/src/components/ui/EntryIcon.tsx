import { generateFallbackIcon, extractDomain } from '@/lib/iconUtils';
import { cn } from '@/lib/utils';

interface EntryIconProps {
  /** Service title, e.g. "GitHub" or URL "https://github.com" */
  name: string;
  /** Icon size in px — defaults to 36 */
  size?: number;
  /** Base64 icon string, if available */
  b64Icon?: string;
  className?: string;
}

/**
 * EntryIcon renders the best available icon for an entry.
 * Currently: generated SVG fallback (letter + gradient).
 * Future: bundled Simple Icons → custom upload → fallback.
 *
 * Offline-safe. Zero network requests.
 */
export default function EntryIcon({ name, size = 36, b64Icon, className }: EntryIconProps) {
  const iconSrc = b64Icon && b64Icon.startsWith('data:image/') ? b64Icon : generateFallbackIcon(name, size);
  const domain = extractDomain(name);

  return (
    <img
      src={iconSrc}
      alt={domain}
      width={size}
      height={size}
      className={cn('shrink-0 select-none', className)}
      draggable={false}
    />
  );
}
