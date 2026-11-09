import { useEffect, useState } from 'preact/hooks';
import { formatBytes, formatDate, formatReadTime } from '../../lib/format';
import { countWords } from '../../lib/text';
import { readSeconds } from '../../lib/wpm';
import { createScript, deleteScript, duplicateScript, listScripts, type Script } from '../../storage/scripts';
import { listAllTakes, storageUsage, type StorageUsage } from '../../storage/takes';
import { Icon } from '../components/Icon';
import { confirmDialog } from '../components/overlays';
import { Sheet } from '../components/Sheet';
import { useSettings } from '../hooks';
import { navigate } from '../router';

const SAMPLE_TITLE = 'Sample script';
const SAMPLE_BODY = `[breath] Hello everyone, and welcome.
This is a sample script, so you can see how the text moves on screen while you record. [smile]
Tap the text to pause it, then drag it to go back.
Every paragraph picks its own text direction, so Hebrew and English can mix freely.
[short pause] Look close to the lens, speak slowly, and enjoy it.`;

export function Library() {
  const [scripts, setScripts] = useState<Script[] | null>(null);
  const [takeCounts, setTakeCounts] = useState<Record<string, number>>({});
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [menuFor, setMenuFor] = useState<Script | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [{ wpm }] = useSettings();

  const reload = async () => {
    const [nextScripts, takes, nextUsage] = await Promise.all([listScripts(), listAllTakes(), storageUsage()]);
    const counts: Record<string, number> = {};
    for (const take of takes) counts[take.scriptId] = (counts[take.scriptId] ?? 0) + 1;
    setScripts(nextScripts);
    setTakeCounts(counts);
    setUsage(nextUsage);
  };

  useEffect(() => {
    void reload();
  }, []);

  const createNew = async () => navigate(`edit/${(await createScript()).id}`);
  const createSample = async () => navigate(`studio/${(await createScript(SAMPLE_TITLE, SAMPLE_BODY)).id}`);

  const openMenu = (script: Script) => {
    setMenuFor(script);
    setMenuOpen(true);
  };

  const duplicate = async () => {
    setMenuOpen(false);
    if (menuFor) await duplicateScript(menuFor);
    await reload();
  };

  const remove = async () => {
    setMenuOpen(false);
    if (!menuFor) return;
    const takes = takeCounts[menuFor.id] ?? 0;
    const confirmed = await confirmDialog({
      title: 'Delete this script?',
      body: takes > 0 ? `${takes === 1 ? 'Its 1 take' : `Its ${takes} takes`} will be deleted too. This can't be undone.` : "This can't be undone.",
      confirmLabel: 'Delete',
    });
    if (confirmed) {
      await deleteScript(menuFor.id);
      await reload();
    }
  };

  const isEmpty = scripts?.length === 0;

  return (
    <>
      <header class="topbar">
        <div class="brand">
          <span class="tally" />
          <h1 style={{ font: 'inherit' }}>Tally</h1>
        </div>
      </header>

      {isEmpty && (
        <div class="empty">
          <div class="empty__art">
            <Icon name="script" size={38} />
          </div>
          <h2>No scripts yet</h2>
          <p>Write or paste your text, and it will scroll right next to the lens while you film.</p>
          <button class="btn btn--ghost press" onClick={createSample}>
            Try a sample script
          </button>
        </div>
      )}

      {scripts && !isEmpty && (
        <div class="scroll">
          <div class="content">
            <ul class="script-list">
              {scripts.map((script) => {
                const words = countWords(script.body);
                const takes = takeCounts[script.id] ?? 0;
                return (
                  <li class="card" key={script.id}>
                    <button class="card__main" onClick={() => navigate(`studio/${script.id}`)}>
                      <h2 class="card__title" dir="auto">
                        {script.title || 'Untitled'}
                      </h2>
                      <div class="meta">
                        <span>{words} {words === 1 ? 'word' : 'words'}</span>
                        <span>{formatReadTime(readSeconds(words, wpm))}</span>
                        <span>{formatDate(script.updatedAt)}</span>
                      </div>
                    </button>
                    <div class="card__actions">
                      {takes > 0 && (
                        <button class="chip press" onClick={() => navigate(`takes/${script.id}`)}>
                          <Icon name="film" size={18} />
                          {takes}
                          <span style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}>takes</span>
                        </button>
                      )}
                      <button class="round-btn press" aria-label="Actions" onClick={() => openMenu(script)}>
                        <Icon name="more" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {usage && usage.takesBytes > 0 && (
              <p class="usage">
                Takes use <bdi>{formatBytes(usage.takesBytes)}</bdi>
                {usage.quota !== null && (
                  <>
                    {' '}
                    of <bdi>{formatBytes(usage.quota)}</bdi> available
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      )}

      <div class="fab-wrap">
        <button class="btn btn--primary press" onClick={createNew}>
          <Icon name="plus" />
          New script
        </button>
      </div>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={menuFor?.title || 'Untitled'}>
        <button class="menu-item press" onClick={() => menuFor && navigate(`edit/${menuFor.id}`)}>
          <Icon name="edit" /> Edit
        </button>
        <button class="menu-item press" onClick={duplicate}>
          <Icon name="copy" /> Duplicate
        </button>
        <button class="menu-item press" onClick={() => menuFor && navigate(`takes/${menuFor.id}`)}>
          <Icon name="film" /> Takes
        </button>
        <button class="menu-item press" onClick={remove}>
          <Icon name="trash" /> Delete
        </button>
      </Sheet>
    </>
  );
}
