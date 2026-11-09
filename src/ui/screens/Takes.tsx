import { useEffect, useState } from 'preact/hooks';
import { formatBytes, formatClock, formatDate } from '../../lib/format';
import { getScript, type Script } from '../../storage/scripts';
import { deleteTake, listTakes, storageUsage, toggleStar, type StorageUsage, type Take } from '../../storage/takes';
import { Icon } from '../components/Icon';
import { confirmDialog } from '../components/overlays';
import { navigate } from '../router';

export function Takes({ scriptId }: { scriptId: string }) {
  const [script, setScript] = useState<Script | null>(null);
  const [takes, setTakes] = useState<Take[] | null>(null);
  const [usage, setUsage] = useState<StorageUsage | null>(null);

  const reload = async () => {
    const [found, list, nextUsage] = await Promise.all([getScript(scriptId), listTakes(scriptId), storageUsage()]);
    setScript(found ?? null);
    setTakes(list);
    setUsage(nextUsage);
  };

  useEffect(() => {
    void reload();
  }, [scriptId]);

  const onStar = async (take: Take) => {
    await toggleStar(take);
    await reload();
  };

  const onDelete = async (take: Take) => {
    const confirmed = await confirmDialog({ title: `Delete take ${take.number}?`, body: "This can't be undone.", confirmLabel: 'Delete' });
    if (!confirmed) return;
    await deleteTake(take.id);
    await reload();
  };

  const scriptSize = takes?.reduce((sum, take) => sum + take.size, 0) ?? 0;

  return (
    <>
      <header class="topbar">
        <button class="round-btn press" aria-label="Library" onClick={() => navigate('')}>
          <Icon name="back" />
        </button>
        <div class="topbar__title" dir="auto">
          {script?.title || 'Takes'}
        </div>
      </header>

      {takes?.length === 0 && (
        <div class="empty">
          <div class="empty__art">
            <Icon name="film" size={38} />
          </div>
          <h2>No takes yet</h2>
          <p>Every recording of this script is saved here, even if the page closes midway.</p>
          <button class="btn btn--primary press" onClick={() => navigate(`studio/${scriptId}`)}>
            Record
          </button>
        </div>
      )}

      {takes && takes.length > 0 && (
        <div class="scroll">
          <div class="content">
            <ul class="take-list">
              {takes.map((take) => (
                <li class="take" key={take.id}>
                  <div
                    class={`take__thumb${take.aspect === '16:9' ? ' take__thumb--wide' : ''}`}
                    style={take.thumbnail ? { backgroundImage: `url(${take.thumbnail})` } : undefined}
                  />
                  <button class="take__main" onClick={() => navigate(`review/${take.id}`)}>
                    <div class="take__title">Take {take.number}</div>
                    <div class="meta">
                      <span>{formatClock(take.durationMs / 1000)}</span>
                      <bdi>{formatBytes(take.size)}</bdi>
                    </div>
                    <div class="take__date">{formatDate(take.createdAt)}</div>
                  </button>
                  <div class="take__actions">
                    <button
                      class={`round-btn press${take.starred ? ' is-starred' : ''}`}
                      aria-label="Best take"
                      aria-pressed={take.starred}
                      onClick={() => onStar(take)}
                    >
                      <Icon name={take.starred ? 'star' : 'star-outline'} size={22} />
                    </button>
                    <button class="round-btn press" aria-label="Delete" onClick={() => onDelete(take)}>
                      <Icon name="trash" size={22} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <p class="usage">
              This script: <bdi>{formatBytes(scriptSize)}</bdi>
              {usage && (
                <>
                  {' · '}All takes: <bdi>{formatBytes(usage.takesBytes)}</bdi>
                </>
              )}
            </p>
            <div style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
              <button class="btn btn--primary btn--block press" onClick={() => navigate(`studio/${scriptId}`)}>
                Another take
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
