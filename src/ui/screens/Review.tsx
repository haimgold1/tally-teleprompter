import { useEffect, useRef, useState } from 'preact/hooks';
import { formatClock, takeFilename } from '../../lib/format';
import { baseMime, fileExtension } from '../../lib/mime';
import { canShareFile, downloadFile, exportFile } from '../../services/share';
import { getScript, type Script } from '../../storage/scripts';
import { assembleTake, deleteTake, getTake, toggleStar, type Take } from '../../storage/takes';
import { Icon } from '../components/Icon';
import { confirmDialog, toast } from '../components/overlays';
import { navigate } from '../router';

export function Review({ takeId }: { takeId: string }) {
  const [take, setTake] = useState<Take | null>(null);
  const [script, setScript] = useState<Script | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    void (async () => {
      try {
        const found = await getTake(takeId);
        if (!found) {
          navigate('', { replace: true });
          return;
        }
        const [owner, blob] = await Promise.all([getScript(found.scriptId), assembleTake(found)]);
        if (cancelled) return;
        // Built up front: iOS only allows sharing synchronously from the tap.
        const name = takeFilename(owner?.title ?? '', found.number, new Date(found.createdAt), fileExtension(found.mimeType));
        const built = new File([blob], name, { type: baseMime(found.mimeType) });
        objectUrl = URL.createObjectURL(built);
        setTake(found);
        setScript(owner ?? null);
        setFile(built);
        setUrl(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [takeId]);

  /** MediaRecorder WebM has no duration header; seeking to the end makes the browser compute it. */
  const onLoadedMetadata = () => {
    const element = video.current;
    if (!element) return;
    if (element.duration === Infinity) {
      const onSeeked = () => {
        element.removeEventListener('seeked', onSeeked);
        element.currentTime = 0;
        setMediaDuration(Number.isFinite(element.duration) ? element.duration : 0);
      };
      element.addEventListener('seeked', onSeeked);
      element.currentTime = 1e7;
    } else if (Number.isFinite(element.duration)) {
      setMediaDuration(element.duration);
    }
  };

  const duration = mediaDuration || (take?.durationMs ?? 0) / 1000;

  const togglePlay = () => {
    const element = video.current;
    if (!element) return;
    if (element.paused) void element.play().catch(() => undefined);
    else element.pause();
  };

  const onExport = () => {
    if (!file) return;
    void exportFile(file).then((result) => {
      if (result === 'downloaded') toast('File downloaded');
    });
  };

  const onStar = async () => {
    if (!take) return;
    await toggleStar(take);
    setTake({ ...take, starred: !take.starred });
  };

  const onKeep = () => {
    toast('Take saved');
    if (take) navigate(`takes/${take.scriptId}`, { replace: true });
  };

  const onDiscard = async () => {
    if (!take) return;
    const confirmed = await confirmDialog({ title: 'Delete this take?', body: "This can't be undone.", confirmLabel: 'Delete' });
    if (!confirmed) return;
    await deleteTake(take.id);
    navigate(`studio/${take.scriptId}`, { replace: true });
  };

  if (failed) {
    return (
      <div class="empty">
        <div class="empty__art">
          <Icon name="alert" size={38} />
        </div>
        <h2>Couldn't load this take</h2>
        <p>The data may be damaged, or there may not be enough free memory.</p>
        <button class="btn btn--secondary press" onClick={() => navigate('')}>
          Library
        </button>
      </div>
    );
  }

  return (
    <>
      <header class="topbar">
        <button class="round-btn press" aria-label="Back" onClick={() => take && navigate(`takes/${take.scriptId}`, { replace: true })}>
          <Icon name="back" />
        </button>
        <div class="topbar__title" dir="auto">
          {take ? `Take ${take.number}${script?.title ? ` · ${script.title}` : ''}` : ''}
        </div>
        <button class={`round-btn press${take?.starred ? ' is-starred' : ''}`} aria-label="Best take" aria-pressed={take?.starred} onClick={onStar}>
          <Icon name={take?.starred ? 'star' : 'star-outline'} />
        </button>
      </header>

      <div class="review__player">
        {url ? (
          <>
            <video
              ref={video}
              src={url}
              playsInline
              preload="metadata"
              onClick={togglePlay}
              onLoadedMetadata={onLoadedMetadata}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={(event) => setTime((event.currentTarget as HTMLVideoElement).currentTime)}
            />
            {!playing && (
              <div class="review__center" style={{ pointerEvents: 'none' }}>
                <div class="review__big-play">
                  <Icon name="play" size={34} />
                </div>
              </div>
            )}
          </>
        ) : (
          <div class="studio-state">
            <div class="spinner" />
            <div>Preparing take…</div>
          </div>
        )}
      </div>

      <div class="review__panel">
        <div class="scrub">
          <span>{formatClock(time)}</span>
          <input
            class="range"
            type="range"
            aria-label="Video position"
            min={0}
            max={duration || 1}
            step={0.05}
            value={Math.min(time, duration)}
            style={{ '--pct': `${duration ? (Math.min(time, duration) / duration) * 100 : 0}%` }}
            onInput={(event) => {
              const next = Number((event.currentTarget as HTMLInputElement).value);
              if (video.current) video.current.currentTime = next;
              setTime(next);
            }}
          />
          <span>{formatClock(duration)}</span>
        </div>

        <div class="review__actions">
          <button class="icon-btn press" onClick={onDiscard} disabled={!take}>
            <Icon name="trash" />
            <span>Delete</span>
          </button>
          <button class="icon-btn press" onClick={() => take && navigate(`studio/${take.scriptId}`, { replace: true })} disabled={!take}>
            <Icon name="rewind" />
            <span>Another take</span>
          </button>
          {file && canShareFile(file) && (
            <button class="icon-btn press" onClick={() => downloadFile(file)}>
              <Icon name="download" />
              <span>Download</span>
            </button>
          )}
          <button class="icon-btn press" onClick={onKeep} disabled={!take}>
            <Icon name="check" />
            <span>Keep take</span>
          </button>
        </div>

        <button class="btn btn--primary btn--block press" onClick={onExport} disabled={!file}>
          <Icon name="share" />
          Save to Photos / Share
        </button>
      </div>
    </>
  );
}
