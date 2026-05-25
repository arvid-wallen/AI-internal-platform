"use client";

import { Icons } from "./icons";
import { toCsv } from "@/lib/csv";

export function ExportButton({
  rows,
  filename,
  label = "Export CSV",
}: {
  rows: (string | number)[][];
  filename: string;
  label?: string;
}) {
  const onClick = () => {
    const blob = new Blob([toCsv(rows)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button className="b" type="button" onClick={onClick}>
      <Icons.Download size={14} />
      {label}
    </button>
  );
}
