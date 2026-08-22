interface VideoErrorOverlayProps {
  message: string;
}

export default function VideoErrorOverlay({ message }: VideoErrorOverlayProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 p-6 text-center">
      <p className="font-medium text-red-400">Couldn&apos;t play this recording</p>
      <p className="max-w-xs text-sm text-white/50">{message}</p>
    </div>
  );
}
