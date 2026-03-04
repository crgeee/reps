import type { CustomTopic } from '../types';
import { TOPICS } from '../types';
import { createCustomTopic } from '../api';
import { logger } from '../logger';

/**
 * Persists a custom topic if it's new (not predefined, not already saved,
 * and not using collection-scoped topics). Fire-and-forget — never throws.
 */
export function maybeCreateCustomTopic(opts: {
  topic: string;
  showCustomTopic: boolean;
  customTopics: CustomTopic[];
  useCollectionTopics: boolean;
  onCreated?: (topic: CustomTopic) => void;
}): void {
  const { topic, showCustomTopic, customTopics, useCollectionTopics, onCreated } = opts;
  const name = topic.trim();

  if (
    !showCustomTopic ||
    !name ||
    (TOPICS as readonly string[]).includes(name) ||
    customTopics.some((ct) => ct.name === name) ||
    useCollectionTopics
  ) {
    return;
  }

  createCustomTopic({ name })
    .then((saved) => onCreated?.(saved))
    .catch((err) => {
      logger.warn('Failed to persist custom topic', { topic: name, error: String(err) });
    });
}
