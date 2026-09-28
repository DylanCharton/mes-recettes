const MAX_SIDE = 1600;

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Redimensionne une photo dans le navigateur avant envoi (spec § 19) :
 * une photo de 4–10 Mo devient un WebP de quelques centaines de Ko, sans traitement serveur.
 */
export async function resizeImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Format de photo non pris en charge (utilisez JPEG, PNG ou WebP)');
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const webp = await toBlob(canvas, 'image/webp', 0.82);
  if (webp?.type === 'image/webp') return webp;

  const jpeg = await toBlob(canvas, 'image/jpeg', 0.85);
  if (!jpeg) throw new Error('Impossible de préparer la photo');
  return jpeg;
}
