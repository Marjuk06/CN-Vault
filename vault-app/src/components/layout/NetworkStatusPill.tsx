import { useVaultStore } from '@/store/vaultStore';
import { Wifi, WifiOff } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function NetworkStatusPill() {
  const { isNetworkActive } = useVaultStore();

  return (
    <div
      className={twMerge(
        clsx(
          "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all duration-500",
          "border backdrop-blur-md shadow-sm",
          isNetworkActive 
            ? "bg-green-500/10 border-green-500/30 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.15)] anim-pulse-glow"
            : "bg-red-500/10 border-red-500/20 text-red-400/80"
        )
      )}
    >
      <div className="relative flex items-center justify-center w-3 h-3">
        {isNetworkActive ? (
          <>
            <span className="absolute inline-flex w-full h-full rounded-full opacity-50 bg-green-400 animate-ping" />
            <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-green-500" />
          </>
        ) : (
          <>
            <span className="absolute inline-flex w-full h-full rounded-full opacity-30 bg-red-400 animate-ping" />
            <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-red-500/80" />
          </>
        )}
      </div>
      <span>{isNetworkActive ? 'Online' : 'Offline'}</span>
      {isNetworkActive ? (
        <Wifi className="w-3 h-3 ml-1" />
      ) : (
        <WifiOff className="w-3 h-3 ml-1 opacity-70" />
      )}
    </div>
  );
}
