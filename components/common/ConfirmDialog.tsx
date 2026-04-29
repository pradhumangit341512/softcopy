'use client';

/**
 * ConfirmDialog — reusable confirmation modal that replaces the browser's
 * native `window.confirm()`. Promise-based imperative API:
 *
 *   const confirm = useConfirm();
 *   if (!await confirm({
 *     title: 'Delete this project?',
 *     message: 'All towers and units will be hidden.',
 *     tone: 'danger',
 *     confirmText: 'Delete',
 *   })) return;
 *
 * Why imperative
 * ──────────────
 * 16+ existing call sites use `if (!confirm(...)) return;` in inline event
 * handlers. A render-tree-only API would force every caller to manage open
 * state and a callback. A Promise API drops in line-for-line — only the
 * literal function name changes.
 *
 * Implementation
 * ──────────────
 *   <ConfirmProvider>  mounts the modal once at app root.
 *   useConfirm()       returns the Promise factory; resolves true on
 *                      Confirm, false on Cancel / Esc / backdrop click.
 *   Esc closes the dialog (resolves false). Enter triggers Confirm.
 *   Focus is captured into the dialog on open and restored on close.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, Info, ShieldAlert, X } from 'lucide-react';

export type ConfirmTone = 'danger' | 'warning' | 'info';

export interface ConfirmOptions {
  /** Headline shown in bold at the top. */
  title: string;
  /** Body copy below the title. Plain string or pre-rendered ReactNode. */
  message?: ReactNode;
  /** Confirm button label. Defaults to "Confirm" / "Delete" by tone. */
  confirmText?: string;
  /** Cancel button label. Defaults to "Cancel". */
  cancelText?: string;
  /** Visual tone — drives the icon + button color. */
  tone?: ConfirmTone;
}

type ResolveFn = (value: boolean) => void;

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

/**
 * Imperative confirmation hook. Always call inside a component that's
 * rendered under <ConfirmProvider> (mounted in app/layout.tsx).
 */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error(
      'useConfirm must be used inside <ConfirmProvider>. ' +
        'Mount it once near the app root.'
    );
  }
  return ctx.confirm;
}

interface QueueEntry {
  id: number;
  options: ConfirmOptions;
  resolve: ResolveFn;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<QueueEntry | null>(null);
  // Stable counter for unique IDs across rapid-fire calls.
  const idRef = useRef(0);
  // Element that had focus before we opened — restored on close.
  const lastFocused = useRef<HTMLElement | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      idRef.current += 1;
      lastFocused.current = (document.activeElement as HTMLElement) ?? null;
      setActive({ id: idRef.current, options, resolve });
    });
  }, []);

  function close(value: boolean) {
    if (!active) return;
    active.resolve(value);
    setActive(null);
    // Restore focus on the next tick so the modal has fully unmounted.
    requestAnimationFrame(() => {
      lastFocused.current?.focus?.();
    });
  }

  // Keyboard handlers + body scroll lock + autofocus while the modal is up.
  useEffect(() => {
    if (!active) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
      } else if (e.key === 'Enter') {
        // Only trigger if focus is inside the dialog — avoids accidental
        // confirm when the user is mid-typing in another (background) input.
        const dialog = document.getElementById('confirm-dialog-root');
        if (dialog && dialog.contains(document.activeElement)) {
          e.preventDefault();
          close(true);
        }
      }
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);

    // Autofocus the confirm button after mount so Enter / Space activate it.
    requestAnimationFrame(() => {
      confirmBtnRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {active && (
        <ConfirmDialogView
          options={active.options}
          onResolve={close}
          confirmBtnRef={confirmBtnRef}
        />
      )}
    </ConfirmContext.Provider>
  );
}

// ──────────────────────────────────────────────────────────────────────
// View — kept separate so the provider stays light + the modal can be
// tested in isolation if we ever add component tests.
// ──────────────────────────────────────────────────────────────────────

const TONE_CONFIG: Record<ConfirmTone, {
  Icon: typeof AlertTriangle;
  iconBg: string;
  iconColor: string;
  buttonClass: string;
  defaultConfirmText: string;
}> = {
  danger: {
    Icon: ShieldAlert,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    buttonClass: 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500',
    defaultConfirmText: 'Delete',
  },
  warning: {
    Icon: AlertTriangle,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    buttonClass: 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500',
    defaultConfirmText: 'Confirm',
  },
  info: {
    Icon: Info,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    buttonClass: 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500',
    defaultConfirmText: 'Confirm',
  },
};

function ConfirmDialogView({
  options,
  onResolve,
  confirmBtnRef,
}: {
  options: ConfirmOptions;
  onResolve: (value: boolean) => void;
  confirmBtnRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const tone: ConfirmTone = options.tone ?? 'warning';
  const cfg = TONE_CONFIG[tone];
  const { Icon } = cfg;

  return (
    <div
      id="confirm-dialog-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-6 bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        // Backdrop click cancels. Click on the inner card stops propagation.
        if (e.target === e.currentTarget) onResolve(false);
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden
          transition-all duration-150 ease-out animate-in fade-in zoom-in-95"
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 sm:px-6 pt-5 sm:pt-6">
          <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${cfg.iconBg}`}>
            <Icon className={`w-5 h-5 ${cfg.iconColor}`} aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <h2
              id="confirm-dialog-title"
              className="text-base sm:text-lg font-semibold text-gray-900 break-words"
            >
              {options.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onResolve(false)}
            aria-label="Close"
            className="shrink-0 -mr-1 -mt-1 w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        {options.message && (
          <div className="px-5 sm:px-6 pt-2 pb-1">
            <div className="text-sm text-gray-600 leading-relaxed pl-13 sm:pl-13">
              {/* Indent under the icon column on >= sm so the body text aligns
                  with the title baseline. Using ml instead of pl avoids
                  collapsing margins. */}
              <div className="ml-13 sm:ml-13" style={{ marginLeft: '52px' }}>
                {options.message}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 sm:px-6 py-4 mt-3 bg-gray-50 border-t border-gray-100">
          <button
            type="button"
            onClick={() => onResolve(false)}
            className="px-4 py-2 text-sm font-medium rounded-lg
              border border-gray-200 bg-white text-gray-700 hover:bg-gray-100
              focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1
              transition-colors"
          >
            {options.cancelText ?? 'Cancel'}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={() => onResolve(true)}
            className={
              'px-4 py-2 text-sm font-semibold rounded-lg text-white shadow-sm transition-colors ' +
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ' +
              cfg.buttonClass
            }
          >
            {options.confirmText ?? cfg.defaultConfirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
