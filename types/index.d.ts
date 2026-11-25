export type Rejected = string[]

declare module 'claude-code' {
  interface PluginState {
    'kulmine': { hiddenReplies: Rejected }
  }
}
