"use client";

import { useState, useTransition } from "react";
import { Icons } from "@/components/icons";
import { createNote } from "@/lib/actions/notes";

// Inline note form used on project notes and the global wiki.
export function NoteForm({
  parentType,
  parentId,
}: {
  parentType: "project" | "global";
  parentId: string | null; // "p-<slug>" for projects, null for global
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const save = () => {
    if (!content.trim()) {
      setToast("Anteckningen är tom.");
      setTimeout(() => setToast(null), 4000);
      return;
    }
    startTransition(async () => {
      const res = await createNote({
        parent_type: parentType,
        parent_id: parentId,
        title: title.trim() || null,
        content: content.trim(),
      });
      if (res.ok) {
        setToast(res.message ?? "Sparat.");
        setTitle("");
        setContent("");
      } else {
        setToast("Fel: " + (res.message ?? "okänt"));
      }
      setTimeout(() => setToast(null), 4000);
    });
  };

  return (
    <div className="card">
      <div className="stack" style={{ gap: 8 }}>
        <input
          className="inp"
          placeholder="Titel (valfritt)"
          aria-label="Titel"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="inp"
          placeholder="Skriv en anteckning…"
          aria-label="Ny anteckning"
          rows={3}
          style={{ resize: "vertical", minHeight: 72 }}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
      <div className="row between" style={{ marginTop: 12 }}>
        <span className="dim" style={{ fontSize: 11.5 }}>
          {toast ?? ""}
        </span>
        <button
          className="b primary sm"
          type="button"
          onClick={save}
          disabled={pending}
        >
          <Icons.Plus size={12} />
          {pending ? "Sparar…" : "Spara"}
        </button>
      </div>
    </div>
  );
}
