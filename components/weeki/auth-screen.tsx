"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Apple, Check, Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { accountApiEnabled, accountMessage, type useWeekiAccount } from "@/features/account/use-weeki-account";
import { cn } from "@/lib/utils";

type AccountController = ReturnType<typeof useWeekiAccount>;
type AuthMode = "login" | "signup" | "forgot";

const passwordRules = [
  { id: "length", label: "8 caracteres", test: (value: string) => value.length >= 8 },
  { id: "letter", label: "letras maiúsculas e minúsculas", test: (value: string) => /[a-z]/.test(value) && /[A-Z]/.test(value) },
  { id: "number", label: "número", test: (value: string) => /\d/.test(value) },
];

export function AuthScreen({ controller, initialMode = "login" }: { controller: AccountController; initialMode?: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const validPassword = passwordRules.every((rule) => rule.test(password));
  const authReady = accountApiEnabled && controller.authConfigured;
  const returnTo = useMemo(() => {
    if (typeof window === "undefined") return "/";
    const params = new URLSearchParams(window.location.search);
    return params.get("returnTo") || "/";
  }, []);

  const login = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Informe e-mail e senha.");
      return;
    }
    setLoading(true);
    controller.loginWithEmail(email.trim(), returnTo);
  };

  const signup = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim()) return setError("Informe nome e e-mail.");
    if (!validPassword || password !== confirmPassword) return setError("Revise a senha e a confirmação.");
    if (!termsAccepted) return setError("Aceite os Termos de Uso e a Política de Privacidade.");
    setLoading(true);
    controller.signUpWithEmail({ name: name.trim(), email: email.trim(), termsAccepted, returnTo });
  };

  const forgot = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!email.trim()) return setError("Informe o e-mail cadastrado.");
    setLoading(true);
    try {
      const response = await controller.requestPasswordReset(email.trim());
      if (response.resetUrl) {
        window.location.assign(response.resetUrl);
        return;
      }
      setMessage(response.message);
    } catch (e) {
      setError(accountMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const social = (provider: "google" | "apple") => {
    setLoading(true);
    controller.continueWithProvider(provider, returnTo);
  };

  return (
    <main className="grid min-h-screen bg-background px-4 py-8 sm:px-6 lg:grid-cols-[minmax(420px,0.95fr)_1.05fr] lg:px-0 lg:py-0">
      <section className="mx-auto flex w-full max-w-md flex-col justify-center lg:px-10">
        <div className="mb-8 flex items-center gap-2">
          <span className="text-3xl font-semibold tracking-tight text-foreground">weeki</span>
          <span className="size-2.5 rounded-full bg-ring" />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-card sm:p-6">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[#f1efff] px-2 py-1 text-[10px] font-semibold text-[#5d48dd]"><ShieldCheck className="size-3" /> Conta segura</span>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{mode === "login" ? "Entrar na Weeki" : mode === "signup" ? "Criar sua conta" : "Recuperar senha"}</h1>
            <p className="mt-1 text-sm leading-6 text-slate-500">{mode === "login" ? "Acesse seu workspace, agenda e configurações." : mode === "signup" ? "Comece com o essencial; o restante vem no onboarding." : "Receba instruções seguras sem expor se o e-mail existe."}</p>
          </div>

          {mode !== "forgot" && (
            <div className="mt-5 grid gap-2">
              <Button type="button" variant="outline" onClick={() => social("google")} disabled={loading || !authReady} className="h-10 justify-center bg-white text-sm shadow-none"><Mail className="size-4 text-blue-600" /> Continuar com Google</Button>
              <Button type="button" variant="outline" onClick={() => social("apple")} disabled={loading || !authReady} className="h-10 justify-center bg-white text-sm shadow-none"><Apple className="size-4" /> Continuar com Apple</Button>
              <div className="my-2 flex items-center gap-3 text-[10px] uppercase tracking-[0.08em] text-slate-400"><span className="h-px flex-1 bg-slate-200" />ou<span className="h-px flex-1 bg-slate-200" /></div>
            </div>
          )}

          {mode === "login" && (
            <form onSubmit={login} className="mt-4 space-y-4">
              <Field label="E-mail"><Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-10 rounded-md text-sm shadow-none" /></Field>
              <PasswordField value={password} visible={showPassword} onToggle={() => setShowPassword((current) => !current)} onChange={setPassword} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-500"><Checkbox checked={remember} onCheckedChange={(checked) => setRemember(checked === true)} /> Lembrar de mim</label>
                <button type="button" onClick={() => setMode("forgot")} className="text-xs font-semibold text-[#5d48dd]">Esqueci minha senha</button>
              </div>
              <Button type="submit" disabled={loading || !authReady} className="h-10 w-full bg-[#5140df]">{loading ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />} Entrar</Button>
              <p className="text-center text-xs text-slate-500">Não tem conta? <button type="button" onClick={() => setMode("signup")} className="font-semibold text-[#5d48dd]">Criar conta</button></p>
            </form>
          )}

          {mode === "signup" && (
            <form onSubmit={signup} className="mt-4 space-y-4">
              <Field label="Nome"><Input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="h-10 rounded-md text-sm shadow-none" /></Field>
              <Field label="E-mail"><Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-10 rounded-md text-sm shadow-none" /></Field>
              <PasswordField value={password} visible={showPassword} onToggle={() => setShowPassword((current) => !current)} onChange={setPassword} />
              <Field label="Confirmar senha"><Input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-10 rounded-md text-sm shadow-none" /></Field>
              <div className="grid gap-1.5 rounded-lg bg-slate-50 p-3 text-[10px] text-slate-500 dark:bg-white/[0.04]">
                {passwordRules.map((rule) => <span key={rule.id} className={cn("flex items-center gap-1.5", rule.test(password) && "text-emerald-700")}><Check className="size-3" /> {rule.label}</span>)}
              </div>
              <label className="flex items-start gap-2 text-xs leading-5 text-slate-500"><Checkbox checked={termsAccepted} onCheckedChange={(checked) => setTermsAccepted(checked === true)} className="mt-0.5" /> Aceito os Termos de Uso e a Política de Privacidade.</label>
              <Button type="submit" disabled={loading || !authReady} className="h-10 w-full bg-[#5140df]">{loading ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />} Criar conta</Button>
              <p className="text-center text-xs text-slate-500">Já tem conta? <button type="button" onClick={() => setMode("login")} className="font-semibold text-[#5d48dd]">Entrar</button></p>
            </form>
          )}

          {mode === "forgot" && (
            <form onSubmit={forgot} className="mt-5 space-y-4">
              <Field label="E-mail"><Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-10 rounded-md text-sm shadow-none" /></Field>
              <Button type="submit" disabled={loading || !authReady} className="h-10 w-full bg-[#5140df]">{loading ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Enviar instruções</Button>
              <p className="text-center text-xs text-slate-500"><button type="button" onClick={() => setMode("login")} className="font-semibold text-[#5d48dd]">Voltar ao login</button></p>
            </form>
          )}

          {!authReady && <p className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-700">A API autenticada ainda não está pronta. Configure as variáveis OIDC e habilite `NEXT_PUBLIC_AUTH_API_ENABLED=true` para ativar estes fluxos.</p>}
          {(error || message) && <p className={cn("mt-4 rounded-lg px-3 py-2 text-[10px] leading-4", error ? "border border-rose-100 bg-rose-50 text-rose-700" : "border border-emerald-100 bg-emerald-50 text-emerald-700")}>{error || message}</p>}
        </div>
      </section>

      <aside className="hidden min-h-screen bg-sidebar px-10 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 rounded-md bg-white/8 px-2.5 py-1 text-xs text-white/70"><ShieldCheck className="size-3.5" /> Sessão protegida por cookie HttpOnly</span>
          <h2 className="mt-8 max-w-xl text-4xl font-semibold tracking-tight">Organize agenda, clientes e cobranças em um workspace só.</h2>
          <p className="mt-4 max-w-lg text-sm leading-7 text-white/58">Após o primeiro acesso, a Weeki retoma o onboarding, salva disponibilidade no banco e mantém cada conta isolada pelo workspace autenticado.</p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs text-white/62">
          <span className="rounded-lg border border-white/10 bg-white/[0.04] p-3">OAuth seguro</span>
          <span className="rounded-lg border border-white/10 bg-white/[0.04] p-3">Onboarding progressivo</span>
          <span className="rounded-lg border border-white/10 bg-white/[0.04] p-3">Disponibilidade persistente</span>
        </div>
      </aside>
    </main>
  );
}

function PasswordField({ value, visible, onToggle, onChange }: { value: string; visible: boolean; onToggle: () => void; onChange: (value: string) => void }) {
  return (
    <Field label="Senha">
      <div className="relative">
        <Input type={visible ? "text" : "password"} autoComplete="current-password" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-md pr-10 text-sm shadow-none" />
        <button type="button" onClick={onToggle} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:bg-slate-100" aria-label={visible ? "Ocultar senha" : "Exibir senha"}>
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </Field>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <Label className="block"><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.04em] text-slate-500">{label}</span>{children}</Label>;
}
