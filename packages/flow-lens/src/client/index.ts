/** Browser plugin registering the Flow Lens conversation view. */

import type { Context } from '@deepseek-ai/cordis'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-trajectory/client'
import { FlowLensView, type FlowLensInjected } from './FlowLensView.tsx'
import { en, NS, zh } from './locales.ts'
import { styleText } from './styles.ts'

export { deriveFlowMap, findFlowNode } from './model.ts'
export type { FlowMapModel, FlowNode, FlowStatus, FlowToolNode } from './model.ts'
export type { FlowLensKey } from './locales.ts'

/** Required services: conversation slots, Session paging, Trajectory data, and localization. */
export const inject = ['slots', 'sessions', 'locale']

/** Register Flow Lens as a separate tab after Trajectory. */
export function apply(ctx: Context): void {
  const sessions = ctx.sessions as unknown as ISessions
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = 'dsh-plugin-flow-lens'
    style.textContent = styleText
    document.head.append(style)
    return () => { style.remove() }
  }, 'flow-lens: styles')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'flow-lens: dictionaries')
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'flow-lens',
    order: 15,
    locale: NS,
    label: () => t('view.title'),
    inject: (sessionId: SessionId): FlowLensInjected => {
      const binding = sessions.binding(sessionId)
      const session = binding?.session
      if (binding === undefined || session === undefined) {
        throw new Error(`flow-lens: session "${sessionId}" is unavailable`)
      }
      return {
        eventWindow: () => binding.eventSource.getSnapshot(),
        subscribeEvents: listener => binding.eventSource.subscribe(listener),
        loadOlder: async () => {
          const revision = binding.eventSource.getSnapshot().revision
          await session.loadOlder()
          return binding.eventSource.getSnapshot().revision !== revision
        },
      }
    },
  }, FlowLensView))
}
