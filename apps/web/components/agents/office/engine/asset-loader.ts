export interface AssetManifest {
  images: Record<string, string>;
  sounds: Record<string, string>;
}

const imageCache = new Map<string, HTMLImageElement>();
const audioCache = new Map<string, AudioBuffer>();

export function getImage(key: string): HTMLImageElement | undefined {
  return imageCache.get(key);
}

export function getAudioBuffer(key: string): AudioBuffer | undefined {
  return audioCache.get(key);
}

function loadImage(key: string, src: string): Promise<void> {
  return new Promise((resolve) => {
    if (imageCache.has(key)) {
      resolve();
      return;
    }
    const img = new Image();
    const timeout = setTimeout(() => {
      resolve();
    }, 10000);
    img.onload = () => {
      clearTimeout(timeout);
      imageCache.set(key, img);
      resolve();
    };
    img.onerror = () => {
      clearTimeout(timeout);
      resolve();
    };
    img.src = src;
  });
}

export async function preloadAssets(
  manifest: AssetManifest,
  audioCtx?: AudioContext,
): Promise<void> {
  // Load images in parallel
  const imagePromises = Object.entries(manifest.images).map(([key, src]) => loadImage(key, src));

  // Load sounds in parallel (optional)
  const soundPromises = audioCtx
    ? Object.entries(manifest.sounds).map(async ([key, src]) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          const res = await fetch(src, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (!res.ok) return;
          const buf = await res.arrayBuffer();
          const decoded = await audioCtx.decodeAudioData(buf);
          audioCache.set(key, decoded);
        } catch {
          // Graceful: missing sounds don't crash
        }
      })
    : [];

  await Promise.all([...imagePromises, ...soundPromises]);
}

/** Build the asset manifest for the office */
export function buildOfficeManifest(): AssetManifest {
  const images: Record<string, string> = {};
  const sounds: Record<string, string> = {};

  // Character sprites (6 palettes)
  for (let i = 0; i < 6; i++) {
    images[`char_${i}`] = `/office/characters/char_${i}.png`;
  }

  // Floor tiles (9 patterns)
  for (let i = 0; i < 9; i++) {
    images[`floor_${i}`] = `/office/floors/floor_${i}.png`;
  }

  // Wall
  images.wall_0 = '/office/walls/wall_0.png';

  // Furniture
  const furnitureFiles = [
    'DESK_FRONT',
    'DESK_SIDE',
    'PC_FRONT_OFF',
    'PC_FRONT_ON_1',
    'PC_FRONT_ON_2',
    'PC_FRONT_ON_3',
    'PC_SIDE',
    'PC_BACK',
    'CUSHIONED_CHAIR_FRONT',
    'CUSHIONED_CHAIR_BACK',
    'CUSHIONED_CHAIR_SIDE',
    'SOFA_FRONT',
    'SOFA_BACK',
    'SOFA_SIDE',
    'BOOKSHELF',
    'DOUBLE_BOOKSHELF',
    'PLANT',
    'PLANT_2',
    'LARGE_PLANT',
    'CACTUS',
    'POT',
    'COFFEE',
    'CLOCK',
    'WHITEBOARD',
    'SMALL_TABLE_FRONT',
    'SMALL_TABLE_SIDE',
    'SMALL_PAINTING',
    'LARGE_PAINTING',
    'HANGING_PLANT',
    'BIN',
    'WOODEN_CHAIR_FRONT',
    'WOODEN_CHAIR_BACK',
    'WOODEN_CHAIR_SIDE',
    'WOODEN_BENCH',
  ];

  for (const f of furnitureFiles) {
    images[f] = `/office/furniture/${f}.png`;
  }

  // Sounds (optional)
  sounds.typing = '/office/sfx/typing.mp3';
  sounds.door_open = '/office/sfx/door-open.mp3';
  sounds.poring_bounce = '/office/sfx/poring-bounce.mp3';
  sounds.click = '/office/sfx/click.mp3';

  return { images, sounds };
}
