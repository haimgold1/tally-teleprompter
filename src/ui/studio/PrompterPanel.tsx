import { useEffect, useMemo, useRef } from 'preact/hooks';
import { countWords, parseScript } from '../../lib/text';
import type { PrompterEngine } from '../../services/prompterEngine';
import type { Settings } from '../../storage/settings';

interface PrompterPanelProps {
  body: string;
  settings: Settings;
  engine: PrompterEngine;
  /** False during the countdown, when the text must stay put. */
  interactive: boolean;
  onPlayingChange: (playing: boolean) => void;
  onRemaining: (seconds: number) => void;
}

const TAP_SLOP_PX = 8;

export function PrompterPanel({ body, settings, engine, interactive, onPlayingChange, onRemaining }: PrompterPanelProps) {
  const paragraphs = useMemo(() => parseScript(body), [body]);
  const words = useMemo(() => countWords(body), [body]);
  const track = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, moved: false, startY: 0, lastY: 0 });

  useEffect(() => {
    engine.bind({
      applyOffset: (offset) => {
        if (track.current) track.current.style.transform = `translate3d(0, ${-offset}px, 0)`;
      },
      onPlayingChange,
      onRemaining,
    });
    return () => engine.bind(null);
  }, [engine, onPlayingChange, onRemaining]);

  useEffect(() => {
    const element = text.current;
    if (!element) return;
    const measure = () => engine.setMetrics(element.getBoundingClientRect().height, words);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [engine, words]);

  const onPointerDown = (event: PointerEvent) => {
    if (!interactive) return;
    drag.current = { active: true, moved: false, startY: event.clientY, lastY: event.clientY };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent) => {
    const state = drag.current;
    if (!state.active) return;
    if (Math.abs(event.clientY - state.startY) > TAP_SLOP_PX) state.moved = true;
    if (state.moved && !engine.isPlaying) engine.scrubBy(state.lastY - event.clientY);
    state.lastY = event.clientY;
  };

  const onPointerUp = () => {
    const state = drag.current;
    if (state.active && !state.moved) engine.toggle();
    state.active = false;
  };

  const style = {
    '--pf': `${settings.fontSize}px`,
    '--plh': settings.lineHeight,
    '--pm': `${settings.margin}%`,
    '--pop': settings.panelOpacity / 100,
  };

  return (
    <div class="prompter" style={style} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <div class={`prompter__mirror${settings.mirrorText ? ' is-mirrored' : ''}`}>
        <div class="prompter__track" ref={track}>
          <div class="prompter__text" ref={text}>
            {paragraphs.map((paragraph, index) => (
              <p dir={paragraph.dir} key={index}>
                {paragraph.segments.map((segment, part) =>
                  segment.kind === 'direction' ? (
                    <span class="prompter__direction" key={part}>
                      {segment.text}
                    </span>
                  ) : (
                    segment.text
                  ),
                )}
              </p>
            ))}
          </div>
        </div>
      </div>
      <div class="prompter__fade" />
      {settings.readingLine && <div class="prompter__line" />}
    </div>
  );
}
