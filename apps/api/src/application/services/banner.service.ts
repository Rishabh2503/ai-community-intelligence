import { createLogger } from '../../core/logger';

const logger = createLogger('Banner');

export interface BannerStyle {
  id: string;
  label: string;
  modifiers: string;
}

export interface GeneratedBanner {
  imageUrl: string;
  prompt: string;
  style: string;
  width: number;
  height: number;
  seed: number;
  provider: string;
}

/**
 * AI banner generation for event posters and announcements.
 *
 * Uses Pollinations, an open-source image endpoint that needs **no API key**,
 * so the feature works out of the box on any machine. The service owns prompt
 * engineering only - the image itself is a plain URL the browser loads
 * directly, which keeps the API free of binary streaming.
 */
export class BannerService {
  private static readonly ENDPOINT = 'https://image.pollinations.ai/prompt';

  static readonly STYLES: BannerStyle[] = [
    {
      id: 'TECH',
      label: 'Tech gradient',
      modifiers:
        'modern tech event poster, deep indigo and cyan gradient, geometric circuit patterns, clean negative space, professional, high contrast',
    },
    {
      id: 'MINIMAL',
      label: 'Minimal editorial',
      modifiers: 'minimal editorial poster design, lots of white space, single bold accent colour, swiss typography layout, elegant',
    },
    {
      id: 'VIBRANT',
      label: 'Vibrant community',
      modifiers: 'vibrant community celebration poster, warm energetic colours, abstract flowing shapes, friendly and inclusive mood',
    },
    {
      id: 'ILLUSTRATION',
      label: 'Flat illustration',
      modifiers: 'flat vector illustration, people collaborating at a tech meetup, soft pastel palette, simple shapes, editorial style',
    },
    {
      id: 'DARK',
      label: 'Dark neon',
      modifiers: 'dark futuristic poster, neon purple and teal glow, subtle grid, cinematic lighting, premium conference aesthetic',
    },
  ];

  /**
   * Text rendered inside generated images is almost always garbled, so the
   * prompt explicitly asks for a clean background and the real title is
   * overlaid by the UI instead.
   */
  private static readonly QUALITY = 'wide banner composition, no text, no letters, no watermark, high detail, 4k';

  generate(options: { description: string; style?: string; width?: number; height?: number; seed?: number }): GeneratedBanner {
    const description = options.description.trim().slice(0, 400);
    if (!description) throw new Error('Describe the banner you want');

    const style = BannerService.STYLES.find((item) => item.id === options.style) ?? BannerService.STYLES[0];
    const width = options.width ?? 1200;
    const height = options.height ?? 630;
    const seed = options.seed ?? Math.floor(Math.random() * 1_000_000);

    const prompt = `${description}. ${style.modifiers}. ${BannerService.QUALITY}`;
    const query = new URLSearchParams({
      width: String(width),
      height: String(height),
      seed: String(seed),
      nologo: 'true',
      model: 'flux',
    });

    const imageUrl = `${BannerService.ENDPOINT}/${encodeURIComponent(prompt)}?${query.toString()}`;
    logger.info('Generated banner prompt', { style: style.id, seed });

    return { imageUrl, prompt, style: style.id, width, height, seed, provider: 'pollinations' };
  }

  styles(): BannerStyle[] {
    return BannerService.STYLES;
  }
}
