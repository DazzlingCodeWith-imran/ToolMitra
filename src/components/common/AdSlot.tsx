import { SITE_CONFIG } from '@/src/config/site';

interface AdSlotProps {
  slotId?: string;
  format?: 'horizontal' | 'rectangle';
  className?: string;
}

/**
 * Unobtrusive, CLS-safe AdSense slot.
 * Renders nothing until VITE_ADSENSE_CLIENT_ID is configured after approval.
 */
export function AdSlot({ slotId, format = 'horizontal', className = '' }: AdSlotProps) {
  if (!SITE_CONFIG.adsenseClientId || !slotId) {
    return null;
  }

  const minHeightClass = format === 'horizontal' ? 'min-h-[90px]' : 'min-h-[250px]';

  return (
    <aside
      aria-label="Advertisement"
      className={`my-8 flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60 ${minHeightClass} ${className}`}
    >
      <span className="mb-2 text-[11px] font-medium tracking-wide text-slate-400 dark:text-slate-500">
        Advertisement
      </span>
      <ins
        className="adsbygoogle block w-full"
        style={{ display: 'block' }}
        data-ad-client={SITE_CONFIG.adsenseClientId}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
