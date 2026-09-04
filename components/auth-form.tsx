"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Eye, EyeOff, LoaderCircle, ShoppingBasket } from "lucide-react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");

    if (mode === "register" && password !== confirmation) {
      setError("As senhas não são iguais.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password,
        }),
      });
      const data = (await response.json()) as { error?: string; redirectTo?: string };
      if (!response.ok) throw new Error(data.error);
      router.push(data.redirectTo ?? "/");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível continuar.");
      setLoading(false);
    }
  }

  const registering = mode === "register";

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand">
          <span><ShoppingBasket /></span>
          <div>
            <p>Lista compartilhada</p>
            <strong>Lista de Casa</strong>
          </div>
        </div>

        <div className="auth-heading">
          <h1>{registering ? "Crie sua conta" : "Que bom ter você de volta"}</h1>
          <p>
            {registering
              ? "Depois, crie sua família ou entre com o código recebido."
              : "Entre para abrir a lista compartilhada da sua família."}
          </p>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {registering && (
            <label>
              <span>Nome</span>
              <input name="name" type="text" autoComplete="name" placeholder="Como devemos chamar você?" minLength={2} maxLength={100} required />
            </label>
          )}
          <label>
            <span>E-mail</span>
            <input name="email" type="email" inputMode="email" autoComplete="email" placeholder="seuemail@exemplo.com" maxLength={254} required />
          </label>
          <label>
            <span>Senha</span>
            <div className="password-field">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={registering ? "new-password" : "current-password"}
                placeholder={registering ? "Mínimo de 8 caracteres" : "Digite sua senha"}
                minLength={8}
                maxLength={128}
                required
              />
              <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </label>
          {registering && (
            <label>
              <span>Confirme a senha</span>
              <input name="confirmation" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Digite a senha novamente" minLength={8} maxLength={128} required />
            </label>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}

          <button className="primary-button" type="submit" disabled={loading}>
            {loading && <LoaderCircle className="spin" />}
            {registering ? "Criar minha conta" : "Entrar"}
          </button>
        </form>

        <p className="auth-switch">
          {registering ? "Já possui uma conta?" : "Ainda não possui uma conta?"}{" "}
          <Link href={registering ? "/entrar" : "/cadastro"}>
            {registering ? "Entrar" : "Criar conta"}
          </Link>
        </p>
      </section>
    </main>
  );
}
