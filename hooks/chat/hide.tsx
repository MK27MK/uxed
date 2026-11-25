import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Rejected } from '../../types'

// Normalized texts of the replies a Stop hook blocked and sent back to the model.
const rejected = atom({ plugin: 'kulmine', key: 'hiddenReplies' } as const, [] as Rejected)

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

const remember = ($: EngineInterface, text: string) =>
  update($, rejected, list => [...list.slice(-199), norm(text)]).catch(() => undefined)

export const register: Register = on => {
  // Text written between tool calls: the step asks for tools, so it is not the final reply.
  on('turn.step', async function* ($, e, next) {
    const r = yield* next(e)
    if (r.answer.trim() && r.toolUses.length > 0) await remember($, r.answer)
    return r
  })

  // The reply a Stop hook sent back.
  on('classic.Stop', async ($, e, next) => {
    const result = await next(e)
    const text = e.last_assistant_message
    if (result.block && text) await remember($, text)
    return result
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const text = norm(e.props.text)
    if (!text) return next(e)
    const list = await read($, rejected)
    if (list.some(r => r === text || r.includes(text))) {
      const { Box } = $.ui.resolve(e)
      return <Box />
    }
    return next(e)
  })
}
