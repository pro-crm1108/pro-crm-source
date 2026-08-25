/* ------------------------------------------------------------------
   Мягкий звук уведомления — синтезируется WebAudio на лету,
   без аудиофайлов. Короткое приятное «дин-дин» низкой громкости.
------------------------------------------------------------------- */
let ctx: AudioContext | null = null;

export function playNotifSound() {
  try {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return;
    ctx = ctx ?? new AC();
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime + 0.02;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.9, t0);
    master.connect(ctx.destination);

    /* две ноты: тёплый перезвон (E5 → B5) */
    const notes = [
      { f: 659.25, at: 0 },
      { f: 987.77, at: 0.12 },
    ];
    for (const { f, at } of notes) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.085, t0 + at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.55);
      osc.connect(g);
      g.connect(master);
      osc.start(t0 + at);
      osc.stop(t0 + at + 0.6);
    }
  } catch {
    /* браузер запретил звук — молча пропускаем */
  }
}
