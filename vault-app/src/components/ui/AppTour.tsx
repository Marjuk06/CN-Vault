import { Joyride, STATUS } from 'react-joyride';
import type { Step, TooltipRenderProps, EventData } from 'react-joyride';
import { useVaultStore } from '@/store/vaultStore';
import { X, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const steps: Step[] = [
  { target: '#tour-add-btn', content: 'Click here to securely store your first password or note.' },
  { target: '#tour-tab-logins', content: 'Logins: Store your web passwords with auto-generated secure passwords.' },
  { target: '#tour-tab-email', content: 'Email: Keep track of your email accounts and IMAP/SMTP server settings.' },
  { target: '#tour-tab-api-keys', content: 'API Keys: Securely save developer tokens and secrets.' },
  { target: '#tour-tab-recovery', content: 'Recovery: Store backup codes and seed phrases safely offline.' },
  { target: '#tour-tab-notes', content: 'Notes: Write encrypted private notes or journal entries.' },
  { target: '#tour-entry-fields', content: 'Fill in your credentials. The app will automatically encrypt them before saving.' },
  { target: '#tour-entry-save', content: 'Click Add Entry to securely encrypt and save it.' },
  { target: '#tour-categories', content: 'Organize your entries into logical categories to find them quickly.' },
  { target: '#tour-search', content: 'Search for any credential or filter your vault instantly.' },
  { target: '#tour-generator', content: 'Need a strong password? Open the Password Generator.' },
  { target: '#tour-generator-length', content: 'Adjust the length of your password for optimal security. Longer is better.' },
  { target: '#tour-generator-options', content: 'Toggle uppercase, lowercase, numbers, and symbols to meet website requirements.' },
  { target: '#tour-generator-output', content: 'Your secure password is generated instantly. Check the entropy score to ensure it is strong.' },
  { target: '#tour-generator-close', content: 'Click to copy your new password to the clipboard and close the generator.' },
  { target: '#tour-settings', content: 'Configure auto-lock, clipboard clearing, and other security preferences here.' },
  { target: '#tour-settings-tab-profile', content: 'Profile: Customize your vault name, avatar, and restart this tour anytime.' },
  { target: '#tour-settings-tab-security', content: 'Security: Set auto-lock timers, clipboard clear limits, or change your master password.' },
  { target: '#tour-settings-tab-backup', content: 'Backup & Restore: Export an encrypted copy of your vault or import an existing one.' },
  { target: '#tour-settings-close', content: 'Close the settings panel.' },
  { target: '#tour-lock', content: 'Click here to instantly secure your vault when stepping away.' },
];

const Tooltip = ({
  index,
  step,
  backProps,
  closeProps,
  primaryProps,
  tooltipProps,
  isLastStep,
}: TooltipRenderProps) => {
  return (
    <div
      {...tooltipProps}
      className="glass-bright rounded-2xl p-5 w-72 shadow-[0_32px_80px_rgba(0,0,0,0.7),0_0_60px_rgba(124,58,237,0.2)] anim-scale-in relative border border-white/10"
    >
      <button
        {...closeProps}
        className="absolute top-3 right-3 text-white/50 hover:text-white transition-colors p-1"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="mb-4 mt-2">
        <h3 className="text-sm font-bold text-white mb-2 tracking-wide uppercase flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center text-[10px]">
            {index + 1}
          </span>
          Tour
        </h3>
        <p className="text-xs text-white/70 leading-relaxed">
          {step.content as string}
        </p>
      </div>

      <div className="flex items-center justify-between mt-6">
        {index > 0 ? (
          <button
            {...backProps}
            className="text-xs font-semibold text-white/50 hover:text-white transition-colors flex items-center gap-1 py-2 px-3 rounded-lg hover:bg-white/5"
          >
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
        ) : (
          <div />
        )}

        <button
          {...primaryProps}
          className={cn(
            "text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-lg",
            isLastStep
              ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:opacity-90 shadow-emerald-500/25"
              : "bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90 shadow-violet-500/25"
          )}
        >
          {isLastStep ? (
            <>
              Finish <Check className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              Next <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default function AppTour() {
  const { runTour, finishTour } = useVaultStore();

  const handleJoyrideCallback = async (data: EventData) => {
    const { status, type, index, action } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      document.getElementById('tour-modal-cancel')?.click();
      document.getElementById('tour-generator-close')?.click();
      document.getElementById('tour-settings-close')?.click();
      await finishTour();
    }

    if (type === 'tooltip') {
      if (index === 1) document.getElementById('tour-tab-logins')?.click();
      if (index === 2) document.getElementById('tour-tab-email')?.click();
      if (index === 3) document.getElementById('tour-tab-api-keys')?.click();
      if (index === 4) document.getElementById('tour-tab-recovery')?.click();
      if (index === 5) document.getElementById('tour-tab-notes')?.click();
      if (index === 16) document.getElementById('tour-settings-tab-profile')?.click();
      if (index === 17) document.getElementById('tour-settings-tab-security')?.click();
      if (index === 18) document.getElementById('tour-settings-tab-backup')?.click();
    }

    if (type === 'step:after') {
      if (action === 'next') {
        if (index === 0) document.getElementById('tour-add-btn')?.click();
        if (index === 7) document.getElementById('tour-modal-cancel')?.click();
        if (index === 10) document.getElementById('tour-generator')?.click();
        if (index === 14) document.getElementById('tour-generator-close')?.click();
        if (index === 15) document.getElementById('tour-settings')?.click();
        if (index === 19) document.getElementById('tour-settings-close')?.click();
      } else if (action === 'prev') {
        if (index === 1) document.getElementById('tour-modal-cancel')?.click();
        if (index === 8) document.getElementById('tour-add-btn')?.click();
        if (index === 11) document.getElementById('tour-generator-close')?.click();
        if (index === 15) document.getElementById('tour-generator')?.click();
        if (index === 16) document.getElementById('tour-settings-close')?.click();
        if (index === 20) document.getElementById('tour-settings')?.click();
      }
    }
  };

  return (
    <Joyride
      steps={steps}
      run={runTour}
      continuous
      scrollToFirstStep
      tooltipComponent={Tooltip}
      onEvent={handleJoyrideCallback}
      options={{
        zIndex: 10000,
        skipBeacon: true,
        overlayClickAction: false
      }}
      styles={{
        spotlight: {
          rx: 12,
        },
        overlay: {
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(3px)',
        }
      }}
    />
  );
}
