export function mediaErrorMessage(error: MediaError | null): string {
  switch (error?.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return 'Playback was aborted.';
    case MediaError.MEDIA_ERR_NETWORK:
      return 'A network error interrupted loading the recording.';
    case MediaError.MEDIA_ERR_DECODE:
      return 'The browser could not decode this recording (corrupt or unsupported codec).';
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return 'This recording format is not supported for playback.';
    default:
      return 'Unknown video playback error.';
  }
}
