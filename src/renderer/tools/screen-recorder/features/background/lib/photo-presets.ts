import chicagoSunset from '@renderer/assets/wallpapers/chicago-sunset.jpg';
import coastalCliffs from '@renderer/assets/wallpapers/coastal-cliffs.jpg';
import forestWaterfall from '@renderer/assets/wallpapers/forest-waterfall.jpg';
import mallorcaCoast from '@renderer/assets/wallpapers/mallorca-coast.jpg';
import oceanWaves from '@renderer/assets/wallpapers/ocean-waves.jpg';
import satelliteCoastline from '@renderer/assets/wallpapers/satellite-coastline.jpg';
import scottishHighlands from '@renderer/assets/wallpapers/scottish-highlands.jpg';
import yosemiteValley from '@renderer/assets/wallpapers/yosemite-valley.jpg';

/**
 * Bundled photo backgrounds -- free-to-use landscape photography (Unsplash
 * License, via Lorem Picsum) rather than macOS's own wallpapers, since those
 * are Apple's copyrighted assets and can't be redistributed in this repo.
 * Picking one just sets kind: 'image' with this src, same as a user upload.
 */
export interface PhotoPreset {
  id: string;
  label: string;
  src: string;
}

export const PHOTO_PRESETS: PhotoPreset[] = [
  { id: 'yosemite-valley', label: 'Yosemite Valley', src: yosemiteValley },
  { id: 'scottish-highlands', label: 'Scottish Highlands', src: scottishHighlands },
  { id: 'forest-waterfall', label: 'Forest Waterfall', src: forestWaterfall },
  { id: 'coastal-cliffs', label: 'Coastal Cliffs', src: coastalCliffs },
  { id: 'ocean-waves', label: 'Ocean Waves', src: oceanWaves },
  { id: 'mallorca-coast', label: 'Mallorca Coast', src: mallorcaCoast },
  { id: 'chicago-sunset', label: 'Chicago Sunset', src: chicagoSunset },
  { id: 'satellite-coastline', label: 'Satellite Coastline', src: satelliteCoastline }
];
