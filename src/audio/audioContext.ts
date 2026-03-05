let ctx: AudioContext | null = null

export function getAudioContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
  }
  return ctx
}

export async function ensureAudioContext(): Promise<AudioContext> {
  const audioCtx = getAudioContext()
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume()
  }
  return audioCtx
}
