"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Eye, EyeOff, LoaderCircle, ShoppingBasket } from "lucide-react";
import { useAppLanguage } from "./language";
import { AppLanguage, languageOptions, translateServerMessage } from "@/lib/i18n";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const { language, setLanguage, t } = useAppLanguage("pt-BR", true);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");

    if (mode === "register" && password !== confirmation) {
      setError(t("passwordsMismatch"));
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
          preferredLanguage: language,
        }),
      });
      const data = (await response.json()) as { error?: string; redirectTo?: string; preferredLanguage?: AppLanguage };
      if (!response.ok) throw new Error(translateServerMessage(data.error, language, "continueError"));
      if (data.preferredLanguage) setLanguage(data.preferredLanguage);
      router.push(data.redirectTo ?? "/");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("continueError"));
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
            <p>{t("sharedList")}</p>
            <strong>{t("appName")}</strong>
          </div>
          <label className="language-quick-select">
            <span className="sr-only">{t("language")}</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value as AppLanguage)} aria-label={t("language")}>
              {languageOptions.map((option) => <option key={option.value} value={option.value}>{t(option.labelKey)}</option>)}
            </select>
          </label>
        </div>

        <div className="auth-heading">
          <h1>{registering ? t("registerTitle") : t("loginTitle")}</h1>
          <p>
            {registering
              ? t("registerDescription")
              : t("loginDescription")}
          </p>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {registering && (
            <label>
              <span>{t("name")}</span>
              <input name="name" type="text" autoComplete="name" placeholder={t("namePlaceholder")} minLength={2} maxLength={100} required />
            </label>
          )}
          <label>
            <span>{t("email")}</span>
            <input name="email" type="email" inputMode="email" autoComplete="email" placeholder="seuemail@exemplo.com" maxLength={254} required />
          </label>
          <label>
            <span>{t("password")}</span>
            <div className="password-field">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={registering ? "new-password" : "current-password"}
                placeholder={registering ? t("passwordMinimum") : t("passwordType")}
                minLength={8}
                maxLength={128}
                required
              />
              <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? t("hidePassword") : t("showPassword")}>
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </label>
          {registering && (
            <label>
              <span>{t("confirmPassword")}</span>
              <input name="confirmation" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder={t("repeatPassword")} minLength={8} maxLength={128} required />
            </label>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}

          <button className="primary-button" type="submit" disabled={loading}>
            {loading && <LoaderCircle className="spin" />}
            {registering ? t("createAccount") : t("login")}
          </button>
        </form>

        <p className="auth-switch">
          {registering ? t("alreadyAccount") : t("noAccount")}{" "}
          <Link href={registering ? "/entrar" : "/cadastro"}>
            {registering ? t("login") : t("createAccountShort")}
          </Link>
        </p>
      </section>
    </main>
  );
}
