/** Browser view for local, unredacted model request captures. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import { LlmWireDebugView } from './LlmWireDebugView.tsx'
import { en, NS, zh } from './locales.ts'
import { styleText } from './styles.ts'

export type { LlmWireDebugKey } from './locales.ts'

/** Browser services required by the capture view. */
export const inject = ['slots', 'locale']

/** Register the raw-model-data view immediately after Trajectory. */
export function apply(ctx: Context): void {
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = 'dsh-plugin-llm-wire-debug'
    style.textContent = styleText
    document.head.append(style)
    return () => { style.remove() }
  }, 'llm-wire-debug: styles')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'llm-wire-debug: dictionaries')
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'llm-wire-debug',
    order: 20,
    locale: NS,
    label: () => t('view.title'),
  }, LlmWireDebugView))
}
