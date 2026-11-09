import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** A clear scrim keeps the live preview visible behind settings. */
  clearScrim?: boolean;
  children: ComponentChildren;
}

const EXIT_MS = 280;
const DISMISS_DRAG_PX = 90;

export function Sheet({ open, onClose, title, clearScrim, children }: SheetProps) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const dragStart = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(frame);
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(timer);
  }, [open]);

  if (!mounted) return null;

  const onPointerDown = (event: PointerEvent) => {
    dragStart.current = event.clientY;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    if (panel.current) panel.current.style.transition = 'none';
  };

  const onPointerMove = (event: PointerEvent) => {
    if (dragStart.current === null || !panel.current) return;
    panel.current.style.transform = `translateY(${Math.max(0, event.clientY - dragStart.current)}px)`;
  };

  const onPointerUp = (event: PointerEvent) => {
    if (dragStart.current === null || !panel.current) return;
    const dragged = event.clientY - dragStart.current;
    dragStart.current = null;
    panel.current.style.transition = '';
    panel.current.style.transform = '';
    if (dragged > DISMISS_DRAG_PX) onClose();
  };

  return (
    <>
      <div class={`scrim${shown ? ' is-open' : ''}${clearScrim ? ' is-clear' : ''}`} onClick={onClose} />
      <div ref={panel} class={`sheet${shown ? ' is-open' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div class="sheet__handle" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} />
        {title && <h2 class="sheet__title">{title}</h2>}
        <div class="sheet__body">{children}</div>
      </div>
    </>
  );
}
