import { createLogger } from '../../core/logger';
import type { ChatMessage, ChatResult, IChatProvider } from '../../domain/services/ai-provider';

const logger = createLogger('PollinationsChat');

/**
 * Keyless general-knowledge chat provider.
 *
 * Pollinations exposes an open text endpoint that needs no account, which makes
 * the "answer questions outside the community" feature work on any machine,
 * even with no Hugging Face key. It implements the same `IChatProvider`
 * interface as every other provider, so the assistant cannot tell them apart.
 */
export class PollinationsChatProvider implements IChatProvider {
  public readonly name = 'pollinations';

  constructor(private readonly timeoutMs = 25000) {}

  async complete(messages: ChatMessage[]): Promise<ChatResult> {
    const system = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join(' ');
    const user = messages
      .filter((message) => message.role === 'user')
      .map((message) => message.content)
      .join('\n');

    const prompt = system ? `${system}\n\nQuestion: ${user}` : user;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, {
        signal: controller.signal,
        headers: { Accept: 'text/plain' },
      });
      if (!response.ok) throw new Error(`Pollinations text failed (${response.status})`);

      const content = (await response.text()).trim();
      if (!content) throw new Error('Pollinations returned an empty result');

      logger.debug('general answer received', { chars: content.length });
      return { content, provider: this.name };
    } finally {
      clearTimeout(timer);
    }
  }
}
