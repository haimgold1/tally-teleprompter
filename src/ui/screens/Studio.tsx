import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { errorCopy } from '../../lib/errors';
import { formatClock } from '../../lib/format';
import { actionForKey } from '../../lib/keymap';
import type { LevelReading } from '../../lib/levels';
import { decidePipeline } from '../../lib/pipeline';
import { isIOS } from '../../lib/platform';
import { clampWpm } from '../../lib/wpm';
import { PrompterEngine } from '../../services/prompterEngine';
import { StudioSession, type SessionState } from '../../services/studioSession';
import { getScript, type Script } from '../../storage/scripts';
import { Icon } from '../components/Icon';
import { toast } from '../components/overlays';
import { useSettings } from '../hooks';
import { navigate } from '../router';
import { PrompterPanel } from '../studio/PrompterPanel';
import { SettingsSheet } from '../studio/SettingsSheet';

const DIM_AFTER_MS = 3000;
const JUMP_BACK_SECONDS = 4;
const WPM_KEY_STEP = 10;

const INITIAL_STATE: SessionState = { phase: 'starting', countdown: 0, error: null, videoWidth: 0, videoHeight: 0 };

type AudioWarning = 'clipping' | 'silent' | null;

export function Studio({ scriptId }: { scriptId: string }) {
  const [script, setScript] = useState<Script | null>(null);
  const [settings, patch] = useSettings();
  const [state, setState] = useState(INITIAL_STATE);
  const [textPlaying, setTextPlaying] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dimmed, setDimmed] = useState(false);
  const [audioWarning, setAudioWarning] = useState<AudioWarning>(null);

  const engine = useMemo(() => new PrompterEngine(), []);
  const session = useRef<StudioSession | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const timerText = useRef<HTMLSpanElement>(null);
  const remainingText = useRef<HTMLElement>(null);
  const meterFill = useRef<HTMLDivElement>(null);
  const dimTimer = useRef(0);
  const autoPausedText = useRef(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const stateRef = useRef(state);
  stateRef.current = state;

  const { phase } = state;
  const isLive = phase === 'recording' || phase === 'paused';

  useEffect(() => {
    void getScript(scriptId).then((found) => {
      if (found) setScript(found);
      else navigate('', { replace: true });
    });
  }, [scriptId]);

  useEffect(() => {
    engine.setWpm(settings.wpm);
  }, [engine, settings.wpm]);

  const hasScript = script !== null;

  useEffect(() => {
    const element = video.current;
    if (!hasScript || !element) return;
    let mounted = true;

    const onLevel = ({ level, clipping, silent }: LevelReading) => {
      const fill = meterFill.current;
      if (fill) {
        fill.style.transform = `scaleX(${level})`;
        fill.classList.toggle('is-clipping', clipping);
      }
      const recording = stateRef.current.phase === 'recording';
      const next: AudioWarning = clipping ? 'clipping' : silent && recording ? 'silent' : null;
      setAudioWarning((current) => (current === next ? current : next));
    };

    const instance = new StudioSession(scriptId, {
      onState: setState,
      onLevel,
      onNotice: toast,
      onRecordingStarted: () => engine.play(),
      onRecordingPaused: () => {
        autoPausedText.current = settingsRef.current.autoPauseText && engine.isPlaying;
        if (autoPausedText.current) engine.pause();
      },
      onRecordingResumed: () => {
        if (autoPausedText.current) engine.play();
        autoPausedText.current = false;
      },
      onFinished: (takeId) => {
        engine.pause();
        if (!mounted) {
          if (takeId) toast('Take saved');
        } else if (takeId) {
          navigate(`review/${takeId}`, { replace: true });
        } else {
          toast('No video was captured in this take');
        }
      },
    });
    session.current = instance;
    void instance.open(element);

    return () => {
      mounted = false;
      engine.pause();
      void instance.close();
    };
  }, [hasScript, scriptId, engine]);

  useEffect(() => {
    if (!isLive) return;
    const update = () => {
      if (timerText.current) timerText.current.textContent = formatClock((session.current?.elapsedMs ?? 0) / 1000);
    };
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [isLive]);

  const wakeControls = useCallback(() => {
    setDimmed(false);
    clearTimeout(dimTimer.current);
    if (stateRef.current.phase === 'recording' || stateRef.current.phase === 'paused') {
      dimTimer.current = window.setTimeout(() => setDimmed(true), DIM_AFTER_MS);
    }
  }, []);

  useEffect(() => {
    wakeControls();
    return () => clearTimeout(dimTimer.current);
  }, [isLive, wakeControls]);

  const toggleRecord = useCallback(() => {
    const current = session.current;
    if (!current) return;
    if (current.phase === 'ready') {
      engine.pause();
      if (engine.isAtEnd) engine.reset();
      setSheetOpen(false);
      current.startCountdown(settingsRef.current.aspect);
    } else if (current.phase === 'countdown') {
      current.cancelCountdown();
    } else if (current.phase === 'recording' || current.phase === 'paused') {
      void current.stop();
    }
  }, [engine]);

  const togglePauseRecording = () => {
    if (session.current?.phase === 'recording') session.current.pauseRecording();
    else session.current?.resumeRecording();
  };

  const stepWpm = useCallback(
    (delta: number) => patch({ wpm: clampWpm(settingsRef.current.wpm + delta) }),
    [patch],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).matches?.('input, textarea')) return;
      const action = actionForKey(event);
      if (!action) return;
      event.preventDefault();
      if (event.repeat && action !== 'speed-up' && action !== 'speed-down') return;
      if (stateRef.current.phase === 'countdown' && action !== 'toggle-record') return;
      switch (action) {
        case 'toggle-text':
          engine.toggle();
          break;
        case 'jump-back':
          engine.jumpSeconds(-JUMP_BACK_SECONDS);
          break;
        case 'speed-up':
          stepWpm(WPM_KEY_STEP);
          break;
        case 'speed-down':
          stepWpm(-WPM_KEY_STEP);
          break;
        case 'toggle-record':
          toggleRecord();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine, stepWpm, toggleRecord]);

  const onRemaining = useCallback((seconds: number) => {
    if (remainingText.current) remainingText.current.textContent = formatClock(Math.ceil(seconds));
  }, []);

  const toggleAspect = () => patch({ aspect: settings.aspect === '9:16' ? '16:9' : '9:16' });

  const plan = state.videoWidth ? decidePipeline(state.videoWidth, state.videoHeight, settings.aspect) : null;
  const cameraPortrait = state.videoHeight > state.videoWidth;
  const orientationMismatch = plan?.mode === 'crop' && cameraPortrait !== (settings.aspect === '9:16');

  const errorInfo = state.error ? errorCopy(state.error, isIOS()) : null;
  const interactive = phase !== 'countdown' && phase !== 'saving';
  const ar = settings.aspect === '9:16' ? '0.5625' : '1.7778';

  return (
    <div
      class={`studio${dimmed ? ' is-dimmed' : ''}`}
      style={{ '--ph': `${settings.panelHeight}%`, '--ar': ar }}
      onPointerDownCapture={() => {
        wakeControls();
        session.current?.userGesture();
      }}
    >
      <div class={`stage ${settings.aspect === '9:16' ? 'stage--top' : 'stage--center'}`}>
        <video ref={video} autoPlay muted playsInline />
        {settings.grid && <div class="grid-lines" />}
      </div>

      {script && (
        <PrompterPanel
          body={script.body}
          settings={settings}
          engine={engine}
          interactive={interactive}
          onPlayingChange={setTextPlaying}
          onRemaining={onRemaining}
        />
      )}

      {phase !== 'error' && phase !== 'starting' && (
        <div class="hud">
          {isLive ? (
            <div class="hud__pill">
              <span class={`rec-dot${phase === 'paused' ? ' is-paused' : ''}`} />
              <span class="rec-label">REC</span>
              <span ref={timerText}>
                0:00
              </span>
            </div>
          ) : (
            <div class="hud__pill">
              {plan ? `${plan.outW}×${plan.outH}` : ''}
            </div>
          )}
          <div class="hud__pill" aria-label="Microphone level">
            <div class="meter">
              <div class="meter__fill" ref={meterFill} />
            </div>
          </div>
        </div>
      )}

      <div class="hud__notes">
        {audioWarning === 'clipping' && <div class="note">Audio is too loud and may distort</div>}
        {audioWarning === 'silent' && <div class="note">No sound for 3 seconds</div>}
        {orientationMismatch && !isLive && phase === 'ready' && <div class="note">Rotate the phone for full quality, or the picture will be cropped</div>}
      </div>

      {phase === 'countdown' && (
        <div class="countdown" onClick={toggleRecord} aria-live="assertive">
          <div class="countdown__num" key={state.countdown}>
            {state.countdown}
          </div>
        </div>
      )}

      {phase === 'starting' && (
        <div class="studio-state">
          <div class="spinner" />
          <div>Starting camera…</div>
        </div>
      )}

      {phase === 'saving' && (
        <div class="studio-state">
          <div class="spinner" />
          <div>Saving take…</div>
        </div>
      )}

      {phase !== 'error' && (
        <div class="dock">
          <div class="dock__speed">
            <button class="round-btn press" aria-label="Back to start of text" onClick={() => engine.reset()} disabled={isLive}>
              <Icon name="rewind" size={22} />
            </button>
            <div class="stepper">
              <button class="round-btn press" aria-label="Slower" onClick={() => stepWpm(-WPM_KEY_STEP)}>
                <Icon name="minus" size={20} />
              </button>
              <div class="stepper__value">
                <b>{settings.wpm}</b>words/min
              </div>
              <button class="round-btn press" aria-label="Faster" onClick={() => stepWpm(WPM_KEY_STEP)}>
                <Icon name="plus" size={20} />
              </button>
            </div>
            <div class="dock__remaining">
              <b ref={remainingText}>
                0:00
              </b>
              left
            </div>
          </div>

          {isLive ? (
            <div class="dock__row">
              <button class="icon-btn press" onClick={togglePauseRecording}>
                <Icon name={phase === 'paused' ? 'play' : 'pause'} />
                <span>{phase === 'paused' ? 'Resume' : 'Pause'}</span>
              </button>
              <button class="record is-live press" aria-label="Stop recording" onClick={toggleRecord} />
              <button class="icon-btn press" onClick={() => engine.toggle()}>
                <Icon name={textPlaying ? 'pause' : 'play'} />
                <span>Text</span>
              </button>
            </div>
          ) : (
            <div class="dock__row">
              <button class="icon-btn press" onClick={() => navigate('')}>
                <Icon name="back" />
                <span>Back</span>
              </button>
              <button class="icon-btn press" onClick={() => navigate(`takes/${scriptId}`)}>
                <Icon name="film" />
                <span>Takes</span>
              </button>
              <button class="record press" aria-label="Start recording" disabled={phase !== 'ready' && phase !== 'countdown'} onClick={toggleRecord} />
              <button class="icon-btn press" onClick={toggleAspect}>
                <Icon name={settings.aspect === '9:16' ? 'portrait' : 'landscape'} />
                <span>{settings.aspect}</span>
              </button>
              <button class="icon-btn press" onClick={() => setSheetOpen(true)}>
                <Icon name="sliders" />
                <span>Settings</span>
              </button>
            </div>
          )}
        </div>
      )}

      {errorInfo && (
        <div class="error" role="alert">
          <div class="empty__art">
            <Icon name="alert" size={38} />
          </div>
          <h2>{errorInfo.title}</h2>
          <p>{errorInfo.body}</p>
          {errorInfo.steps && (
            <ol>
              {errorInfo.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}
          <div class="error__actions">
            <button class="btn btn--secondary press" onClick={() => navigate('')}>
              Back
            </button>
            <button class="btn btn--primary press" onClick={() => video.current && session.current?.open(video.current)}>
              Try again
            </button>
          </div>
        </div>
      )}

      <SettingsSheet open={sheetOpen} onClose={() => setSheetOpen(false)} settings={settings} patch={patch} />
    </div>
  );
}
