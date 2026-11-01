import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export { CameraSource };

export interface PickImageOptions {
  source?: CameraSource;
  quality?: number;
  fileNamePrefix?: string;
}

/**
 * Captures or picks an image natively via Capacitor Camera.
 * Returns a standard browser File object for 100% drop-in compatibility with FormData.
 * Returns null if running in browser / PWA (fallback to <input type="file">).
 */
export async function pickNativeImage(options: PickImageOptions = {}): Promise<File | null> {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  const {
    source = CameraSource.Photos, // Default to native system Photo Picker / Gallery
    quality = 90,
    fileNamePrefix = 'upload',
  } = options;

  try {
    const photo = await Camera.getPhoto({
      quality,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source,
    });

    if (!photo.webPath) {
      return null;
    }

    // Convert local webPath to Blob
    const response = await fetch(photo.webPath);
    const blob = await response.blob();

    const format = photo.format || 'jpeg';
    const mimeType = blob.type || `image/${format}`;
    const filename = `${fileNamePrefix}_${Date.now()}.${format}`;

    return new File([blob], filename, { type: mimeType });
  } catch (err: any) {
    // If the user cancelled the dialog, fail silently
    if (
      err?.message?.includes('User cancelled') ||
      err?.message?.includes('cancelled') ||
      err?.message?.includes('User denied')
    ) {
      return null;
    }
    console.error('Capacitor Camera error:', err);
    return null;
  }
}
