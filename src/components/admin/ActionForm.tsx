'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Result = { success: boolean; error?: string; message?: string };

/** Form yang memanggil server action (FormData) dan menampilkan hasilnya. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  confirmText,
  successText = 'Tersimpan.',
}: {
  action: (fd: FormData) => Promise<Result>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirmText?: string;
  successText?: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirmText && !window.confirm(confirmText)) return;
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await action(fd);
          setMsg({ ok: r.success, text: r.success ? r.message ?? successText : r.error ?? 'Gagal.' });
          if (r.success) {
            if (resetOnSuccess) ref.current?.reset();
            router.refresh();
          }
        });
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {pending && <p className="text-xs text-slate-500 mt-2">Memproses...</p>}
      {msg && !pending && (
        <p className={`text-xs mt-2 ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p>
      )}
    </form>
  );
}

/** Tombol yang memanggil server action tanpa argumen (bind di server). */
export function ActionButton({
  action,
  children,
  className,
  confirmText,
}: {
  action: () => Promise<Result>;
  children: React.ReactNode;
  className?: string;
  confirmText?: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        className={className}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
          start(async () => {
            const r = await action();
            setMsg({ ok: r.success, text: r.success ? r.message ?? 'Berhasil.' : r.error ?? 'Gagal.' });
            if (r.success) router.refresh();
          });
        }}
      >
        {pending ? 'Memproses...' : children}
      </button>
      {msg && <span className={`text-[11px] max-w-xs ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</span>}
    </span>
  );
}
