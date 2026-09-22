"use client";
import type { ReactNode } from "react";
import { Button } from "./ui";
export function Drawer({ title, open, onClose, children, }: {
    title: string;
    open: boolean;
    onClose: () => void;
    children: ReactNode;
}) {
    if (!open)
        return null;
    return (<div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close" onClick={onClose} className="flex-1 cursor-default bg-black/20"/>
      <aside role="dialog" aria-label={title} className="border-line bg-surface flex w-full max-w-md flex-col border-l shadow-xl">
        <header className="border-line flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-ink text-sm font-semibold">{title}</h2>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>);
}
