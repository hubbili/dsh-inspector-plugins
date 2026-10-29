/** URL-backed Flow Lens selection that survives reloads and can be shared. */

export interface FlowSelection {
  turn: number
  step?: number
  node?: string
}

const TURN = 'flow-turn'
const STEP = 'flow-step'
const NODE = 'flow-node'

/** Read a namespaced Flow Lens selection without consuming other query parameters. */
export function readFlowSelection(url: string): FlowSelection | null {
  const parsed = new URL(url)
  const turn = Number(parsed.searchParams.get(TURN))
  if (!Number.isInteger(turn) || turn < 0) return null
  const rawStep = parsed.searchParams.get(STEP)
  const step = rawStep === null ? undefined : Number(rawStep)
  if (step !== undefined && (!Number.isInteger(step) || step < 0)) return null
  const node = parsed.searchParams.get(NODE) ?? undefined
  return { turn, ...(step === undefined ? {} : { step }), ...(node === undefined ? {} : { node }) }
}

/** Return the same URL with only the Flow Lens selection replaced. */
export function writeFlowSelection(url: string, selection: FlowSelection): string {
  const parsed = new URL(url)
  parsed.searchParams.set(TURN, String(selection.turn))
  if (selection.step === undefined) parsed.searchParams.delete(STEP)
  else parsed.searchParams.set(STEP, String(selection.step))
  if (selection.node === undefined) parsed.searchParams.delete(NODE)
  else parsed.searchParams.set(NODE, selection.node)
  return parsed.href
}
