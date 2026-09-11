"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { accountApiEnabled } from "@/features/account/use-weeki-account";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8 || password !== confirm) {
      setMessage("Revise a senha e a confirmação.");
      return;
    }
    if (!accountApiEnabled) {
      setMessage("A redefinição depende do provedor de identidade configurado no servidor.");
      return;
    }
    const response = await fetch("/api/auth/password/reset", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await response.json();
    setMessage(data.message || (response.ok ? "Senha redefinida." : "Não foi possível redefinir a senha."));
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-8">
      <form onSubmit={submit} className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="text-2xl font-semibold tracking-tight text-foreground">weeki</span>
          <span className="size-2 rounded-full bg-ring" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Redefinir senha</h1>
        <p className="mt-1 text-sm leading-6 text-slate-500">A validação do link e a troca efetiva são feitas pelo provedor de identidade seguro.</p>
        <div className="mt-5 space-y-4">
          <Field label="Nova senha">
            <div className="relative">
              <Input type={visible ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className="h-10 pr-10 text-sm shadow-none" />
              <button type="button" onClick={() => setVisible((current) => !current)} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:bg-slate-100" aria-label={visible ? "Ocultar senha" : "Exibir senha"}>{visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
            </div>
          </Field>
          <Field label="Confirmar senha"><Input type={visible ? "text" : "password"} value={confirm} onChange={(event) => setConfirm(event.target.value)} className="h-10 text-sm shadow-none" /></Field>
        </div>
        {message && <p className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-700">{message}</p>}
        <div className="mt-5 flex items-center justify-between">
          <Link href="/entrar" className="text-xs font-semibold text-[#5d48dd]">Voltar ao login</Link>
          <Button type="submit" className="h-9 bg-[#5140df] text-xs"><LockKeyhole className="size-3.5" /> Redefinir</Button>
        </div>
      </form>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <Label className="block"><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.04em] text-slate-500">{label}</span>{children}</Label>;
}
