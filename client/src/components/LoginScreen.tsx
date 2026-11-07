import { LOGO_NORMAL } from "@/lib/brand";
import { trpc } from "@/lib/trpc";
import { Loader2, LockKeyhole, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

/** Tela de acesso próprio do SGPO, sem redirecionamento para OAuth externo. */
export function LoginScreen() {
  const utils = trpc.useUtils();
  const setupStatus = trpc.auth.setupStatus.useQuery(undefined, { retry: false });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const refreshSession = async () => {
    await utils.auth.me.invalidate();
    await utils.auth.setupStatus.invalidate();
    // As telas já tentaram carregar dados antes do login (e falharam por falta de sessão):
    // recarrega tudo para não ficar o aviso "Ocorreu um erro" até o usuário atualizar a página.
    await utils.invalidate();
  };

  const login = trpc.auth.login.useMutation({ onSuccess: refreshSession });
  const registerInitialAdmin = trpc.auth.registerInitialAdmin.useMutation({
    onSuccess: refreshSession,
  });

  const isSetup = setupStatus.data?.needsInitialSetup === true;
  const isPending = login.isPending || registerInitialAdmin.isPending;
  const error = login.error?.message ?? registerInitialAdmin.error?.message;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSetup) {
      await registerInitialAdmin.mutateAsync({
        name,
        email: email || undefined,
        username,
        password,
      });
      return;
    }
    await login.mutateAsync({ username, password });
  }

  if (setupStatus.isLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-flame" aria-label="Carregando" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-navy-deep p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-30 sgpo-grid-bg" aria-hidden="true" />
        <div className="relative">
          <img src={LOGO_NORMAL} alt="SGPO" className="h-16 w-auto rounded-lg bg-white p-2" />
          <div className="mt-24 max-w-xl">
            <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-flame">Gestão de oficinas</p>
            <h1 className="mt-4 font-display text-5xl font-bold leading-tight text-white">
              Controle completo para a sua oficina evoluir.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-300">
              Organize clientes, veículos, ordens de serviço, estoque e financeiro em um único sistema.
            </p>
          </div>
        </div>
        <p className="relative text-sm text-slate-400">SGPO — Sistema de Gestão para Pequenas Oficinas</p>
      </section>

      <section className="flex min-h-screen items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <img src={LOGO_NORMAL} alt="SGPO" className="mb-10 h-14 w-auto rounded-md bg-white p-1.5 lg:hidden" />
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
            <div className="mb-7">
              <h2 className="font-display text-3xl font-bold tracking-tight">
                {isSetup ? "Configuração inicial" : "Acesse sua conta"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {isSetup
                  ? "Crie o primeiro administrador para começar a usar o SGPO."
                  : "Informe suas credenciais para continuar."}
              </p>
            </div>

            <form className="space-y-5" onSubmit={submit}>
              {isSetup && (
                <div className="space-y-2">
                  <Label htmlFor="name">Nome completo</Label>
                  <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="username">Usuário</Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="username" className="pl-9" value={username} onChange={(event) => setUsername(event.target.value)} required autoComplete="username" placeholder="Ex.: oficina.central" />
                </div>
              </div>
              {isSetup && (
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail <span className="text-muted-foreground">(opcional)</span></Label>
                  <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="contato@oficina.com" />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="password" type="password" className="pl-9" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} autoComplete={isSetup ? "new-password" : "current-password"} />
                </div>
                {isSetup && <p className="text-xs text-muted-foreground">Use pelo menos 6 caracteres.</p>}
              </div>
              {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
              <Button type="submit" size="lg" className="w-full bg-flame text-white hover:bg-flame/90" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSetup ? "Criar administrador" : "Entrar no sistema"}
              </Button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
