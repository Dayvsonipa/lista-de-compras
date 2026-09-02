import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-shell">
      <section className="auth-card simple-card">
        <h1>Página não encontrada</h1>
        <p>O endereço acessado não existe.</p>
        <Link className="primary-button" href="/">Voltar para a lista</Link>
      </section>
    </main>
  );
}
