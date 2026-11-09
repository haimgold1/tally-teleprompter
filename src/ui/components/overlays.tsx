import { useEffect, useState } from 'preact/hooks';

interface ToastItem {
  id: number;
  text: string;
}

interface ConfirmRequest {
  title: string;
  body: string;
  confirmLabel: string;
  resolve: (confirmed: boolean) => void;
}

const TOAST_MS = 3800;

let nextId = 1;
let toasts: ToastItem[] = [];
let confirmRequest: ConfirmRequest | null = null;
let emit: () => void = () => undefined;

export function toast(text: string): void {
  if (toasts.some((item) => item.text === text)) return;
  const id = nextId++;
  toasts = [...toasts, { id, text }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((item) => item.id !== id);
    emit();
  }, TOAST_MS);
}

export function confirmDialog(options: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    confirmRequest = { ...options, resolve };
    emit();
  });
}

export function Overlays() {
  const [, setVersion] = useState(0);

  useEffect(() => {
    emit = () => setVersion((v) => v + 1);
    return () => {
      emit = () => undefined;
    };
  }, []);

  const answer = (confirmed: boolean) => {
    confirmRequest?.resolve(confirmed);
    confirmRequest = null;
    emit();
  };

  return (
    <>
      <div class="toasts" role="status" aria-live="polite">
        {toasts.map((item) => (
          <div class="toast" key={item.id}>
            {item.text}
          </div>
        ))}
      </div>
      {confirmRequest && (
        <div class="dialog-wrap" onClick={(event) => event.target === event.currentTarget && answer(false)}>
          <div class="dialog" role="alertdialog" aria-modal="true">
            <h2>{confirmRequest.title}</h2>
            <p>{confirmRequest.body}</p>
            <div class="dialog__actions">
              <button class="btn btn--secondary press" onClick={() => answer(false)}>
                Cancel
              </button>
              <button class="btn btn--primary press" onClick={() => answer(true)}>
                {confirmRequest.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
