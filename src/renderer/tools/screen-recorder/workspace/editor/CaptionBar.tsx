import { useCaptionsStore } from '../../features/captions/store/captions-store';

interface CaptionBarProps {
  currentTimeMs: number;
}

export default function CaptionBar({ currentTimeMs }: CaptionBarProps) {
  const captionsEnabled = useCaptionsStore((s) => s.enabled);
  const captionSegments = useCaptionsStore((s) => s.segments);
  const activeCaption = captionsEnabled
    ? captionSegments.find((s) => currentTimeMs >= s.startMs && currentTimeMs <= s.endMs)
    : undefined;

  if (!activeCaption) return null;

  return (
    <p className="absolute inset-x-0 bottom-6 z-10 mx-auto max-w-[80%] rounded-xl bg-black/70 px-5 py-2.5 text-center text-lg font-medium text-white">
      {activeCaption.text}
    </p>
  );
}
