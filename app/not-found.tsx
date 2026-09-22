"use client";

import Link from "next/link";
import { useAppLanguage } from "@/components/language";

export default function NotFound() {
  const { t } = useAppLanguage("pt-BR", true);
  return (
    <main className="auth-shell">
      <section className="auth-card simple-card">
        <h1>{t("notFoundTitle")}</h1>
        <p>{t("notFoundDescription")}</p>
        <Link className="primary-button" href="/">{t("backToList")}</Link>
      </section>
    </main>
  );
}
