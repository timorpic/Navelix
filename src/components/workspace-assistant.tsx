"use client";

import { useEffect, useId, useRef } from "react";
import { useTranslations } from "next-intl";
import type { WorkspaceAssistantState } from "@/hooks/use-workspace-assistant";

export default function WorkspaceAssistant({ assistant }: { assistant: WorkspaceAssistantState }) {
  const t = useTranslations();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const id = useId();
  const { enabled, open, close, messages, pending, opener } = assistant;
  useEffect(() => {
    const panel = dialog.current;
    if (!panel) return;
    if (open && !panel.open) { panel.showModal(); input.current?.focus(); }
    else if (!open && panel.open) { panel.close(); opener.current?.focus(); }
  }, [open, opener]);
  useEffect(() => {
    if (open) end.current?.scrollIntoView({ block: "nearest" });
  }, [open, messages, pending]);
  if (!enabled) return null;
  return <>
    <button hidden={open} type="button" onClick={assistant.show} aria-haspopup="dialog" aria-expanded={false} aria-controls={id}
      className="fixed bottom-5 right-5 z-30 flex min-h-12 items-center gap-2 rounded-2xl bg-[#00C776] px-5 font-semibold text-white shadow-lg shadow-emerald-900/15 transition-colors hover:bg-[#00B068] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00C776] sm:bottom-6 sm:right-6">
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8L12 2Z" /></svg>{t("ai_assistant_1b0049fc")}
    </button>
    <dialog ref={dialog} id={id} aria-labelledby={`${id}-title`} onClose={close}
      onCancel={event => { event.preventDefault(); close(); }}
      onClick={event => {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) close();
      }}
      className="fixed inset-y-3 left-auto right-3 m-0 hidden h-[calc(100dvh-1.5rem)] max-h-none w-[calc(100vw-1.5rem)] max-w-[26rem] flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white p-0 text-gray-900 shadow-2xl shadow-slate-900/15 outline-none backdrop:bg-transparent open:flex max-sm:backdrop:bg-black/15 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-xl text-[#00C776] dark:bg-emerald-950/40" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8L12 2Z" /></svg></span>
          <div><h2 id={`${id}-title`} className="text-base font-bold">{t("ai_assistant_1b0049fc")}</h2><p className="text-xs text-gray-500 dark:text-slate-400">{t("assistant_workspace_context")}</p></div>
        </div>
        <button type="button" onClick={close} aria-label={t("assistant_close")} className="flex h-11 w-11 items-center justify-center rounded-xl text-xl text-gray-500 transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-[#00C776] dark:text-slate-300 dark:hover:bg-slate-800">×</button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
        {messages.length === 0 && <div className="space-y-5">
          <div><h3 className="text-xl font-bold tracking-tight">{t("assistant_greeting")}</h3><p className="mt-2 text-sm leading-6 text-gray-500 dark:text-slate-400">{t("assistant_description")}</p></div>
          <div className="flex flex-wrap gap-2">{[
            ["assistant_plan_day", "assistant_plan_prompt"],
            ["assistant_break_project", "assistant_break_prompt"],
            ["assistant_find_bookmark", "assistant_bookmark_prompt"],
          ].map(([label, prompt]) => <button key={label} type="button" onClick={() => assistant.send(t(prompt))} disabled={pending}
            className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-xs font-medium transition-colors hover:border-[#00C776]/40 hover:text-[#00C776] focus-visible:outline-2 focus-visible:outline-[#00C776] dark:border-slate-700 dark:bg-slate-800">{t(label)}</button>)}</div>
        </div>}
        <div role="log" aria-label={t("assistant_conversation")} aria-live="polite" className="space-y-4">
          {messages.map(message => <div key={message.id} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[92%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6 ${message.sender === "user" ? "rounded-br-md bg-[#00C776] text-white" : "rounded-bl-md bg-gray-50 text-gray-800 dark:bg-slate-800 dark:text-slate-100"}`}>
              <span className="sr-only">{t(message.sender === "user" ? "assistant_you" : "ai_assistant_1b0049fc")}: </span>{message.text}
              {message.deletions?.map(deletion => <div key={deletion.pendingId} className="mt-3 flex gap-2">
                <button type="button" disabled={!message.deletionPending} onClick={() => void assistant.decideDeletion(message.id, deletion.pendingId, "confirm")}
                  className="min-h-10 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:cursor-not-allowed disabled:opacity-40">
                  {t("confirm_delete_a3ea3c17")}
                </button>
                <button type="button" disabled={!message.deletionPending} onClick={() => void assistant.decideDeletion(message.id, deletion.pendingId, "cancel")}
                  className="min-h-10 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00C776] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-700">
                  {t("cancel_2cd0f3be")}
                </button>
              </div>)}
            </div>
          </div>)}
          {pending && <p role="status" className="text-sm text-gray-500 dark:text-slate-400">{t("ai_is_thinking_b67cf8f5")}</p>}
          <div ref={end} />
        </div>
        {assistant.error && <p role="alert" className="mt-4 whitespace-pre-wrap text-sm leading-6 text-rose-600 dark:text-rose-400">{assistant.error}</p>}
      </div>
      <form className="shrink-0 border-t border-gray-100 p-4 dark:border-slate-800" onSubmit={event => { event.preventDefault(); void assistant.send(); }}>
        <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-2 focus-within:border-[#00C776] dark:border-slate-700 dark:bg-slate-800">
          <textarea ref={input} rows={2} maxLength={8000} value={assistant.input} onChange={event => assistant.setInput(event.target.value)}
            onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void assistant.send(); } }}
            aria-label={t("ask_ai_copilot_a_question_or_give_an_instruction_37a91290")} placeholder={t("assistant_input_placeholder")}
            className="min-h-11 min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-6 text-gray-900 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-slate-500" />
          <button type="submit" disabled={pending || !assistant.input.trim()} aria-label={t("send_edecf0ae")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#00C776] text-white transition-colors hover:bg-[#00B068] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00C776] disabled:cursor-not-allowed disabled:opacity-40"><span aria-hidden="true">↑</span></button>
        </div>
      </form>
    </dialog>
  </>;
}
