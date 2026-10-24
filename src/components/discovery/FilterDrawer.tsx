"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef } from "react";

/** Mobile filter drawer: changes are staged in the form until "Apply filters". */
export default function FilterDrawer({ count, children }: { count: number; children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const pathname = usePathname();
  const params = useSearchParams();

  // Close after the URL changes (i.e. filters were applied).
  useEffect(() => {
    dialogRef.current?.close();
  }, [pathname, params]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onSubmit = () => setTimeout(() => dialog.close(), 0);
    dialog.addEventListener("submit", onSubmit);
    return () => dialog.removeEventListener("submit", onSubmit);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface-2 px-4 text-sm font-medium hover:border-line-strong lg:hidden"
        aria-haspopup="dialog"
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        Filters
        {count > 0 ? <span className="rounded-full bg-fg px-1.5 text-xs text-[var(--ink-on-light)]">{count}</span> : null}
      </button>
      <dialog ref={dialogRef} className="sheet" aria-labelledby={titleId} onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}>
        <div className="sheet-panel fixed inset-x-0 bottom-0 flex max-h-[90dvh] flex-col rounded-t-3xl border border-line bg-raised">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 id={titleId} className="font-display text-lg font-semibold">
              Filters
            </h2>
            <button type="button" onClick={() => dialogRef.current?.close()} className="grid size-10 place-items-center rounded-full hover:bg-surface-3" aria-label="Close filters without applying">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
        </div>
      </dialog>
    </>
  );
}
