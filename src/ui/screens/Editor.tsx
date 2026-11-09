import { useEffect, useRef, useState } from 'preact/hooks';
import { formatReadTime } from '../../lib/format';
import { countWords } from '../../lib/text';
import { readSeconds } from '../../lib/wpm';
import { deleteScript, getScript, saveScript, type Script } from '../../storage/scripts';
import { Icon } from '../components/Icon';
import { toast } from '../components/overlays';
import { useSettings } from '../hooks';
import { navigate } from '../router';

const SAVE_DELAY_MS = 400;

export function Editor({ scriptId }: { scriptId: string }) {
  const [script, setScript] = useState<Script | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const textarea = useRef<HTMLTextAreaElement>(null);
  const latest = useRef({ script, title, body });
  latest.current = { script, title, body };
  const [{ wpm }] = useSettings();

  useEffect(() => {
    void getScript(scriptId).then((found) => {
      if (!found) {
        navigate('', { replace: true });
        return;
      }
      setScript(found);
      setTitle(found.title);
      setBody(found.body);
    });
  }, [scriptId]);

  const persist = () => {
    const { script: current, title: nextTitle, body: nextBody } = latest.current;
    if (!current || (current.title === nextTitle && current.body === nextBody)) return Promise.resolve();
    const next = { ...current, title: nextTitle, body: nextBody, updatedAt: Date.now() };
    latest.current.script = next;
    setScript(next);
    return saveScript(next);
  };

  useEffect(() => {
    if (!script) return;
    const timer = setTimeout(() => void persist(), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [title, body]);

  // Leaving a script that was never written to removes it instead of keeping a blank card.
  useEffect(
    () => () => {
      const { script: current, title: finalTitle, body: finalBody } = latest.current;
      if (!current) return;
      if (!finalTitle.trim() && !finalBody.trim() && current.takeCounter === 0) void deleteScript(current.id);
      else void persist();
    },
    [],
  );

  const words = countWords(body);

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setBody((current) => (current ? `${current}\n${text}` : text));
    } catch {
      textarea.current?.focus();
      toast('Clipboard not available. Long-press the box and choose Paste.');
    }
  };

  const insertDirection = () => {
    const element = textarea.current;
    if (!element) return;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    setBody(`${body.slice(0, start)}[${body.slice(start, end)}]${body.slice(end)}`);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + 1, end + 1);
    });
  };

  const goRecord = async () => {
    await persist();
    navigate(`studio/${scriptId}`);
  };

  if (!script) return null;

  return (
    <>
      <header class="topbar">
        <button class="round-btn press" aria-label="Back" onClick={() => navigate('')}>
          <Icon name="back" />
        </button>
        <div class="topbar__title">Edit script</div>
      </header>
      <div class="content editor">
        <input
          class="title-input"
          dir="auto"
          placeholder="Script title"
          aria-label="Script title"
          value={title}
          onInput={(event) => setTitle((event.currentTarget as HTMLInputElement).value)}
        />
        <div class="editor__tools">
          <div class="editor__stats">
            {words} {words === 1 ? 'word' : 'words'} · {words > 0 ? formatReadTime(readSeconds(words, wpm)) : '0 min'}
          </div>
          <button class="mini-btn press" onClick={insertDirection} aria-label="Add stage direction">
            <Icon name="brackets" size={18} /> Note
          </button>
          <button class="mini-btn press" onClick={paste}>
            <Icon name="paste" size={18} /> Paste
          </button>
        </div>
        <textarea
          ref={textarea}
          class="body-input"
          aria-label="Script text"
          placeholder={'Write or paste your script here.\nNotes in square brackets, like [breath] or [smile], show small and colored and are not counted as words.'}
          value={body}
          onInput={(event) => setBody((event.currentTarget as HTMLTextAreaElement).value)}
        />
        <div class="editor__cta">
          <button class="btn btn--primary btn--block press" disabled={words === 0} onClick={goRecord}>
            Record
          </button>
        </div>
      </div>
    </>
  );
}
