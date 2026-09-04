"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Check,
  Italic,
  Link2,
  List,
  ListOrdered,
  RemoveFormatting,
  Underline,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type EditorCommand = "bold" | "italic" | "underline" | "insertUnorderedList" | "insertOrderedList" | "removeFormat";

const tools: Array<{ command: EditorCommand; label: string; icon: typeof Bold }> = [
  { command: "bold", label: "Negrito", icon: Bold },
  { command: "italic", label: "Itálico", icon: Italic },
  { command: "underline", label: "Sublinhado", icon: Underline },
  { command: "insertUnorderedList", label: "Lista com marcadores", icon: List },
  { command: "insertOrderedList", label: "Lista numerada", icon: ListOrdered },
  { command: "removeFormat", label: "Limpar formatação", icon: RemoveFormatting },
];

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Escreva uma descrição...",
  maxLength = 2000,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [characterCount, setCharacterCount] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState("");

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor || editor.innerHTML === value) return;
    editor.innerHTML = value;
    setCharacterCount(editor.innerText.length);
  }, [value]);

  const emitChange = () => {
    const editor = editorRef.current;
    if (!editor) return;
    setCharacterCount(editor.innerText.length);
    onChange(editor.innerHTML === "<br>" ? "" : editor.innerHTML);
  };

  const runCommand = (command: EditorCommand) => {
    editorRef.current?.focus();
    document.execCommand(command, false);
    emitChange();
  };

  const openLinkEditor = () => {
    const selection = window.getSelection();
    savedRangeRef.current = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    setLinkError("");
    setLinkOpen(true);
  };

  const applyLink = () => {
    const rawValue = linkValue.trim();
    if (!rawValue) {
      setLinkError("Informe o endereço do link.");
      return;
    }

    const normalized = /^https?:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`;
    try {
      const url = new URL(normalized);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("Protocolo inválido");
    } catch {
      setLinkError("Insira um endereço válido.");
      return;
    }

    editorRef.current?.focus();
    const selection = window.getSelection();
    if (selection && savedRangeRef.current) {
      selection.removeAllRanges();
      selection.addRange(savedRangeRef.current);
    }
    document.execCommand("createLink", false, normalized);
    emitChange();
    setLinkOpen(false);
    setLinkValue("");
    setLinkError("");
  };

  return (
    <div className={cn("overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.02)] focus-within:border-[#9a86ee] focus-within:ring-2 focus-within:ring-[#7657ff]/10", className)}>
      <div className="flex min-h-10 flex-wrap items-center gap-0.5 border-b border-slate-100 bg-[#fbfbfd] px-2 py-1.5">
        {tools.slice(0, 3).map(({ command, label, icon: Icon }) => (
          <button
            key={command}
            type="button"
            title={label}
            aria-label={label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runCommand(command)}
            className="focus-ring grid size-7 place-items-center rounded-md text-slate-500 transition hover:bg-white hover:text-[#6548df] hover:shadow-sm"
          >
            <Icon className="size-3.5" />
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-slate-200" />
        {tools.slice(3, 5).map(({ command, label, icon: Icon }) => (
          <button
            key={command}
            type="button"
            title={label}
            aria-label={label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runCommand(command)}
            className="focus-ring grid size-7 place-items-center rounded-md text-slate-500 transition hover:bg-white hover:text-[#6548df] hover:shadow-sm"
          >
            <Icon className="size-3.5" />
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-slate-200" />
        <button
          type="button"
          title="Adicionar link"
          aria-label="Adicionar link"
          onMouseDown={(event) => event.preventDefault()}
          onClick={openLinkEditor}
          className={cn("focus-ring grid size-7 place-items-center rounded-md text-slate-500 transition hover:bg-white hover:text-[#6548df] hover:shadow-sm", linkOpen && "bg-white text-[#6548df] shadow-sm")}
        >
          <Link2 className="size-3.5" />
        </button>
        {tools.slice(5).map(({ command, label, icon: Icon }) => (
          <button
            key={command}
            type="button"
            title={label}
            aria-label={label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runCommand(command)}
            className="focus-ring grid size-7 place-items-center rounded-md text-slate-500 transition hover:bg-white hover:text-[#6548df] hover:shadow-sm"
          >
            <Icon className="size-3.5" />
          </button>
        ))}

        {linkOpen && (
          <div className="mt-1 flex w-full items-center gap-1.5 border-t border-slate-100 pt-2 sm:mt-0 sm:ml-2 sm:w-auto sm:flex-1 sm:border-l sm:border-t-0 sm:pl-2 sm:pt-0">
            <div className="min-w-0 flex-1">
              <input
                autoFocus
                type="url"
                value={linkValue}
                onChange={(event) => { setLinkValue(event.target.value); setLinkError(""); }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") { event.preventDefault(); applyLink(); }
                  if (event.key === "Escape") setLinkOpen(false);
                }}
                placeholder="cole-o-link.com"
                className={cn("h-7 w-full rounded-md border bg-white px-2 text-xs text-slate-700 outline-none", linkError && "border-rose-400")}
                aria-label="Endereço do link"
                aria-invalid={Boolean(linkError)}
              />
              {linkError && <span className="sr-only" role="alert">{linkError}</span>}
            </div>
            <button type="button" onClick={applyLink} className="grid size-7 place-items-center rounded-md bg-[#7657ff] text-white transition hover:bg-[#6548df]" aria-label="Aplicar link"><Check className="size-3.5" /></button>
            <button type="button" onClick={() => { setLinkOpen(false); setLinkError(""); }} className="grid size-7 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Cancelar link"><X className="size-3.5" /></button>
          </div>
        )}
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Descrição da demanda"
        data-placeholder={placeholder}
        onInput={emitChange}
        onPaste={(event) => {
          event.preventDefault();
          const currentLength = editorRef.current?.innerText.length ?? 0;
          const text = event.clipboardData.getData("text/plain").slice(0, Math.max(0, maxLength - currentLength));
          document.execCommand("insertText", false, text);
        }}
        onBeforeInput={(event) => {
          if (event.nativeEvent.inputType.startsWith("insert") && characterCount >= maxLength && !window.getSelection()?.toString()) event.preventDefault();
        }}
        className="rich-text-editor min-h-32 px-4 py-3 text-sm leading-6 text-slate-700 outline-none"
      />
      <div className="flex justify-end border-t border-slate-100 px-3 py-1.5 text-[11px] tabular-nums text-slate-400">
        {characterCount}/{maxLength}
      </div>
    </div>
  );
}
