/**
 * Returns a function that asks for `fn` to run once in the next animation frame, for the handler
 * of an event that fires many times in a frame, such as `scroll` and `resize`. A call while a
 * frame is already waiting is dropped, so `fn` runs once for all the calls before the frame. The
 * wait ends just before `fn` runs, so a call from inside `fn` or after the frame asks for the
 * next frame. `fn` gets no arguments and its result is not kept.
 */
export function oncePerFrame(fn: () => void): () => void {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn();
    });
  };
}
