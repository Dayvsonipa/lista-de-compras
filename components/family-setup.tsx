"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, Home, KeyRound, LoaderCircle, Users } from "lucide-react";
import { useAppLanguage } from "./language";
import { AppLanguage, translateServerMessage } from "@/lib/i18n";

export function FamilySetup({ firstName, initialLanguage }: { firstName: string; initialLanguage: AppLanguage }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState("");
  const { language, t } = useAppLanguage(initialLanguage);

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
      if (!response.ok) throw new Error(translateServerMessage(data.error, language, "continueError"));
      router.push("/");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("continueError"));
      setBusy(null);
    }
  }

  return (
    <main className="family-shell">
      <section className="family-container">
        <div className="family-heading">
          <span className="family-heading-icon"><Home /></span>
          <p>{t("familyHello", { name: firstName })}</p>
          <h1>{t("familyTitle")}</h1>
          <span>{t("familyDescription")}</span>
        </div>

        {error && <p className="family-error" role="alert">{error}</p>}

        <div className="family-options">
          <form className="family-option" onSubmit={(event) => void submit(event, "create")}>
            <div className="option-icon"><Users /></div>
            <h2>{t("createFamily")}</h2>
            <p>{t("createFamilyDescription")}</p>
            <label>
              <span>{t("familyName")}</span>
              <input name="name" placeholder={t("familyPlaceholder")} minLength={2} maxLength={100} required />
            </label>
            <button className="primary-button" type="submit" disabled={busy !== null}>
              {busy === "create" ? <LoaderCircle className="spin" /> : <ArrowRight />}
              {t("createFamily")}
            </button>
          </form>

          <div className="family-divider"><span>{t("or")}</span></div>

          <form className="family-option" onSubmit={(event) => void submit(event, "join")}>
            <div className="option-icon orange"><KeyRound /></div>
            <h2>{t("joinFamily")}</h2>
            <p>{t("joinFamilyDescription")}</p>
            <label>
              <span>{t("inviteCode")}</span>
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
              {t("joinWithCode")}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
