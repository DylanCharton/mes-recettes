import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { IMAGE_PATH_REGEX } from '@mes-recettes/shared';

export type ImageType = 'jpg' | 'png' | 'webp';

export const IMAGE_CONTENT_TYPES: Record<ImageType, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Type réel d'après les octets magiques : l'extension ou le type déclaré ne sont jamais crus. */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (ascii(0, 8) === '\x89PNG\r\n\x1a\n') return 'png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  return null;
}

export type ImageStore = ReturnType<typeof createImageStore>;

/** Images locales dans `dir`, nommées `<uuid>.<ext>` (spec § 19). */
export function createImageStore(dir: string) {
  fs.mkdirSync(dir, { recursive: true });

  const resolve = (name: string) => {
    if (!IMAGE_PATH_REGEX.test(name)) throw new Error(`Nom d'image invalide : ${name}`);
    return path.join(dir, name);
  };

  return {
    /** Enregistre l'image ; `null` si ce n'est ni un JPEG, ni un PNG, ni un WebP. */
    async save(bytes: Uint8Array): Promise<string | null> {
      const type = detectImageType(bytes);
      if (!type) return null;
      const name = `${randomUUID()}.${type}`;
      await fsp.writeFile(resolve(name), bytes);
      return name;
    },

    async read(name: string): Promise<{ data: Buffer; contentType: string } | null> {
      if (!IMAGE_PATH_REGEX.test(name)) return null;
      try {
        const data = await fsp.readFile(resolve(name));
        const type = path.extname(name).slice(1) as ImageType;
        return { data, contentType: IMAGE_CONTENT_TYPES[type] };
      } catch {
        return null;
      }
    },

    exists(name: string): boolean {
      return IMAGE_PATH_REGEX.test(name) && fs.existsSync(resolve(name));
    },

    async remove(name: string): Promise<void> {
      if (!IMAGE_PATH_REGEX.test(name)) return;
      await fsp.rm(resolve(name), { force: true });
    },
  };
}
