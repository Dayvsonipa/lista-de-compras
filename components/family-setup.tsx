"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, Home, KeyRound, LoaderCircle, Users } from "lucide-react";

export function FamilySetup({ firstName }: { firstName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>, action: "create" | "join") {
    event.preventDefault();
    setBusy(action);
    setError("");
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch(`/api/family/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "create" ? { name: form.get("name") } : { code: form.get("code") }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error);
      router.push("/");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível continuar.");
      setBusy(null);
    }
  }

  return (
    <main className="family-shell">
      <section className="family-container">
        <div className="family-heading">
          <span className="family-heading-icon"><Home /></span>
          <p>Olá, {firstName}!</p>
          <h1>Vamos conectar sua casa</h1>
          <span>Escolha uma das opções abaixo. Você fará isso apenas uma vez.</span>
        </div>

        {error && <p className="family-error" role="alert">{error}</p>}

        <div className="family-options">
          <form className="family-option" onSubmit={(event) => void submit(event, "create")}>
            <div className="option-icon"><Users /></div>
            <h2>Criar uma família</h2>
            <p>Você receberá um código para convidar outras pessoas.</p>
            <label>
              <span>Nome da família</span>
              <input name="name" placeholder="Ex.: Família Silva" minLength={2} maxLength={100} required />
            </label>
            <button className="primary-button" type="submit" disabled={busy !== null}>
              {busy === "create" ? <LoaderCircle className="spin" /> : <ArrowRight />}
              Criar família
            </button>
          </form>

          <div className="family-divider"><span>ou</span></div>

          <form className="family-option" onSubmit={(event) => void submit(event, "join")}>
            <div className="option-icon orange"><KeyRound /></div>
            <h2>Entrar em uma família</h2>
            <p>Use o código enviado por quem criou a família.</p>
            <label>
              <span>Código do convite</span>
              <input
                className="code-input"
                name="code"
                placeholder="ABCD1234"
                minLength={8}
                maxLength={8}
                autoCapitalize="characters"
                autoComplete="off"
                onInput={(event) => {
                  event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                }}
                required
              />
            </label>
            <button className="secondary-button" type="submit" disabled={busy !== null}>
              {busy === "join" ? <LoaderCircle className="spin" /> : <ArrowRight />}
              Entrar com o código
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
