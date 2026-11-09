const PATHS = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  back: 'M15 5l-7 7 7 7',
  close: 'M6 6l12 12M18 6L6 18',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  copy: 'M9 9h10v11H9zM5 15H4V4h11v1',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  film: 'M4 5h16v14H4zM8 5v14M16 5v14M4 9.5h4M4 14.5h4M16 9.5h4M16 14.5h4',
  share: 'M12 15V4M8 7.5L12 4l4 3.5M5 12v8h14v-8',
  download: 'M12 4v11M8 11.5l4 3.5 4-3.5M5 20h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  paste: 'M9 5h6v3H9zM9 6.5H6V20h12V6.5h-3',
  brackets: 'M9 4H5v16h4M15 4h4v16h-4',
  rewind: 'M4 5v5h5M5 10a8 8 0 1 1-1 5',
  portrait: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z',
  landscape: 'M3 8a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8z',
  alert: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  script: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7',
} as const;

const SOLID = {
  more: 'M5 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM19 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  play: 'M7 4.5v15l13-7.5z',
  pause: 'M7 4h3.5v16H7zM13.5 4H17v16h-3.5z',
  star: 'M12 3l2.8 5.9 6.2.8-4.6 4.3 1.2 6.3-5.6-3.2-5.6 3.2 1.2-6.3L3 9.7l6.2-.8z',
} as const;

export type IconName = keyof typeof PATHS | keyof typeof SOLID | 'star-outline';

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  const outline = name === 'star-outline' ? SOLID.star : (PATHS as Record<string, string>)[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {outline ? (
        <path d={outline} fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      ) : (
        <path d={(SOLID as Record<string, string>)[name]} fill="currentColor" />
      )}
    </svg>
  );
}
