import { useEffect, useState } from 'preact/hooks';
import { prefersReducedMotion } from '../lib/platform';
import { recoverInterruptedTakes } from '../storage/takes';
import { Overlays, toast } from './components/overlays';
import { parseHash, type Route } from './router';
import { Editor } from './screens/Editor';
import { Library } from './screens/Library';
import { Review } from './screens/Review';
import { Studio } from './screens/Studio';
import { Takes } from './screens/Takes';

const LEAVE_MS = 130;

function screenFor(route: Route) {
  switch (route.name) {
    case 'edit':
      return <Editor scriptId={route.id} />;
    case 'studio':
      return <Studio scriptId={route.id} />;
    case 'review':
      return <Review takeId={route.id} />;
    case 'takes':
      return <Takes scriptId={route.id} />;
    default:
      return <Library />;
  }
}

export function App() {
  const [hash, setHash] = useState(location.hash);
  const [leaving, setLeaving] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    recoverInterruptedTakes()
      .then((count) => {
        if (count > 0) toast(count === 1 ? 'An interrupted take was recovered and saved' : `${count} interrupted takes were recovered and saved`);
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    let timer = 0;
    const onChange = () => {
      clearTimeout(timer);
      if (prefersReducedMotion()) {
        setHash(location.hash);
        return;
      }
      setLeaving(true);
      timer = window.setTimeout(() => {
        setHash(location.hash);
        setLeaving(false);
      }, LEAVE_MS);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return (
    <div class="app">
      {ready && (
        <div key={hash} class={`screen${leaving ? ' is-leaving' : ''}`}>
          {screenFor(parseHash(hash))}
        </div>
      )}
      <Overlays />
    </div>
  );
}
