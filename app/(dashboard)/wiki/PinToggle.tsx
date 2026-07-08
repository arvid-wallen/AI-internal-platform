"use client";

import { useTransition } from "react";
import { toggleNotePin } from "@/lib/actions/notes";

export function PinToggle({
  noteId,
  pinned,
}: {
  noteId: string; // real uuid
  pinned: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const toggle = () =>
    startTransition(async () => {
      await toggleNotePin(noteId, !pinned);
    });
  return (
    <button
      className="b sm"
      type="button"
      onClick={toggle}
      disabled={pending}
      title={pinned ? "Lossa anteckning" : "Fäst anteckning överst"}
      aria-pressed={pinned}
    >
      {pending ? "…" : pinned ? "Lossa" : "Fäst"}
    </button>
  );
}
