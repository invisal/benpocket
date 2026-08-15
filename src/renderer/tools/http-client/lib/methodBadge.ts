// Bordered so the badge still reads as a distinct chip against a light-theme
// surface, where the `-950` fill alone blends into near-white; the border
// pins the shape while the fill/text colors do the rest (`--color-purple-400`
// gets a light-theme override in main.css since its default is too washed out
// on a white background).
export function methodBadgeClass(method: string): string {
  switch (method) {
    case 'WEBSOCKET':
      return 'text-cyan-500';
    case 'GET':
      return 'text-emerald-500';
    case 'POST':
      return 'text-amber-500';
    case 'PUT':
      return 'text-sky-500';
    case 'PATCH':
      return 'text-purple-400';
    case 'DELETE':
      return 'text-red-500';
    default:
      return 'text-zinc-400';
  }
}
