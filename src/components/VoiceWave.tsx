type VoiceWaveProps = {
  active?: boolean;
  tone?: 'indigo' | 'light' | 'rose' | 'emerald';
  className?: string;
};

export function VoiceWave({ active = true, tone = 'indigo', className = '' }: VoiceWaveProps) {
  const barColor =
    tone === 'light'
      ? 'bg-white'
      : tone === 'rose'
        ? 'bg-rose-500'
        : tone === 'emerald'
          ? 'bg-emerald-500'
          : 'bg-indigo-600';

  if (!active) return null;

  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-end gap-[2.5px] h-3.5 shrink-0 ${className}`}
    >
      <span className={`w-[2.5px] h-full rounded-full ${barColor} wave-bar`} />
      <span className={`w-[2.5px] h-full rounded-full ${barColor} wave-bar wave-bar-2`} />
      <span className={`w-[2.5px] h-full rounded-full ${barColor} wave-bar wave-bar-3`} />
      <span className={`w-[2.5px] h-full rounded-full ${barColor} wave-bar wave-bar-4`} />
    </span>
  );
}
