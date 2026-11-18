"use client";

import { useEffect, useRef, useState } from "react";

type RejectDialogProps = {
  open: boolean;
  subject: string;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

const MIN_REASON_LENGTH = 10;

export default function RejectDialog({ open, ...props }: RejectDialogProps) {
  // Mounting the panel only while open gives each opening a fresh, empty reason.
  return open ? <RejectDialogPanel {...props} /> : null;
}

function RejectDialogPanel({
  subject,
  submitting = false,
  onCancel,
  onConfirm,
}: Omit<RejectDialogProps, "open">) {
  const [reason, setReason] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submitting, onCancel]);

  const trimmed = reason.trim();
  const valid = trimmed.length >= MIN_REASON_LENGTH;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-dialog-title"
        className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl shadow-black/50"
      >
        <h2 id="reject-dialog-title" className="text-lg font-semibold text-white">
          Reject {subject}?
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          The landlord will see this reason and can fix the issue and resubmit.
        </p>

        <form
          className="mt-5 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid && !submitting) onConfirm(trimmed);
          }}
        >
          <label className="grid gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Reason</span>
            <textarea
              ref={textareaRef}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="e.g. The ownership document is blurry. Please upload a clear scan of the title deed."
              className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
            />
            <span className="text-xs text-slate-500">
              {valid ? `${trimmed.length}/1000` : `At least ${MIN_REASON_LENGTH} characters`}
            </span>
          </label>

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="rounded-2xl border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!valid || submitting}
              className="rounded-2xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Rejecting..." : "Reject"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
