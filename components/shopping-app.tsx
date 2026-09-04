"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Calculator,
  CircleCheckBig,
  Clipboard,
  LoaderCircle,
  ListChecks,
  LogOut,
  Moon,
  Plus,
  RefreshCw,
  ShoppingBasket,
  Sun,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { PriceComparator } from "./price-comparator";

type Item = {
  id: string;
  name: string;
  quantity: string;
  price: number | null;
  completed: boolean;
  addedBy: string;
  completedBy: string | null;
  createdAt: string;
  completedAt: string | null;
};

type Props = {
  userName: string;
  familyName: string;
  inviteCode: string | null;
};

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || value;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function quantityMultiplier(value: string) {
  const match = value.trim().match(/^(\d+(?:[.,]\d+)?)/);
  if (!match) return 1;

  const quantity = Number(match[1].replace(",", "."));
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function itemTotal(item: Item) {
  if (item.price === null) return null;
  return Math.round((item.price * quantityMultiplier(item.quantity) + Number.EPSILON) * 100) / 100;
}

export function ShoppingApp({ userName, familyName, inviteCode }: Props) {
  const router = useRouter();
  const inviteButtonRef = useRef<HTMLButtonElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [dark, setDark] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [mode, setMode] = useState<"list" | "compare">("list");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = localStorage.getItem("lista-theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const enabled = stored ? stored === "dark" : prefersDark;
      setDark(enabled);
      document.documentElement.classList.toggle("dark", enabled);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const loadItems = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/items", { cache: "no-store" });
      const data = (await response.json()) as { items?: Item[]; error?: string };
      if (response.status === 401) {
        router.push("/entrar");
        return;
      }
      if (!response.ok) throw new Error(data.error);
      setItems(data.items ?? []);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar a lista.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadItems(), 0);
    const interval = window.setInterval(() => void loadItems(true), 8000);
    const refresh = () => void loadItems(true);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadItems]);

  useEffect(() => {
    if (!inviteOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setInviteOpen(false);
        window.requestAnimationFrame(() => inviteButtonRef.current?.focus());
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [inviteOpen]);

  const pending = useMemo(() => items.filter((item) => !item.completed), [items]);
  const completed = useMemo(() => items.filter((item) => item.completed), [items]);
  const pendingTotal = useMemo(
    () => pending.reduce((total, item) => total + Math.round((itemTotal(item) ?? 0) * 100), 0) / 100,
    [pending],
  );
  const progress = items.length ? Math.round((completed.length / items.length) * 100) : 0;

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("lista-theme", next ? "dark" : "light");
  }

  async function request(method: "POST" | "PATCH" | "DELETE", body: object) {
    const response = await fetch("/api/items", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(data.error);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await request("POST", { name, quantity, price });
      setName("");
      setQuantity("");
      setPrice("");
      await loadItems(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível adicionar.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleItem(item: Item) {
    setBusyId(item.id);
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, completed: !entry.completed } : entry));
    try {
      await request("PATCH", { id: item.id, completed: !item.completed });
      await loadItems(true);
    } catch (toggleError) {
      await loadItems(true);
      setError(toggleError instanceof Error ? toggleError.message : "Não foi possível atualizar.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeItem(id: string) {
    setBusyId(id);
    try {
      await request("DELETE", { id });
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Não foi possível remover.");
    } finally {
      setBusyId(null);
    }
  }

  async function clearCompleted() {
    try {
      await request("DELETE", { clearCompleted: true });
      setItems((current) => current.filter((item) => !item.completed));
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Não foi possível limpar.");
    }
  }

  async function copyInvite() {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function closeInvite() {
    setInviteOpen(false);
    window.requestAnimationFrame(() => inviteButtonRef.current?.focus());
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/entrar");
    router.refresh();
  }

  return (
    <main className="app-shell">
      <section className="shopping-card" aria-labelledby="page-title">
        <header className="app-header">
          <div className="brand-mark"><ShoppingBasket /></div>
          <div className="brand-copy">
            <p>{familyName}</p>
            <h1 id="page-title">Lista de Casa</h1>
          </div>
          <button className="icon-button header-button" type="button" onClick={toggleTheme} aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"}>
            {dark ? <Sun /> : <Moon />}
          </button>
          <button className="icon-button header-button" type="button" onClick={() => void logout()} aria-label="Sair">
            <LogOut />
          </button>
        </header>

        <nav className="app-mode-tabs" aria-label="Ferramentas do aplicativo">
          <button
            type="button"
            className={mode === "list" ? "active" : ""}
            onClick={() => setMode("list")}
            aria-current={mode === "list" ? "page" : undefined}
          >
            <ListChecks /> Lista de compras
          </button>
          <button
            type="button"
            className={mode === "compare" ? "active" : ""}
            onClick={() => setMode("compare")}
            aria-current={mode === "compare" ? "page" : undefined}
          >
            <Calculator /> Comparar preços
          </button>
        </nav>

        {mode === "list" ? (
          <>
        <div className="welcome-row">
          <div>
            <p className="eyebrow">Olá, {firstName(userName)}</p>
            <p className="status-copy">
              {pending.length === 0 ? "Nada faltando por enquanto." : `${pending.length} ${pending.length === 1 ? "item falta" : "itens faltam"} comprar.`}
            </p>
          </div>
          <div className="welcome-actions">
            {inviteCode && (
              <button ref={inviteButtonRef} className="invite-trigger" type="button" onClick={() => setInviteOpen(true)}>
                <Users /> Convidar
              </button>
            )}
            <button className="icon-button refresh-button" type="button" onClick={() => void loadItems()} aria-label="Atualizar lista" disabled={loading}>
              <RefreshCw className={loading ? "spin" : ""} />
            </button>
          </div>
        </div>

        {inviteCode && inviteOpen && (
          <div className="invite-modal-backdrop" role="presentation" onMouseDown={closeInvite}>
            <div className="invite-modal" role="dialog" aria-modal="true" aria-labelledby="invite-title" onMouseDown={(event) => event.stopPropagation()}>
              <button className="icon-button invite-close" type="button" onClick={closeInvite} aria-label="Fechar convite" autoFocus>
                <X />
              </button>
              <span className="invite-modal-icon"><Users /></span>
              <p>Convide alguém para sua lista</p>
              <h2 id="invite-title">Código da família</h2>
              <strong>{inviteCode}</strong>
              <small>Compartilhe este código somente com quem fará parte da família.</small>
              <button className="primary-button invite-copy" type="button" onClick={() => void copyInvite()}>
                <Clipboard />
                {copied ? "Código copiado!" : "Copiar código"}
              </button>
            </div>
          </div>
        )}

        <form className="add-form" onSubmit={submit}>
          <label className="product-field">
            <span>O que está faltando?</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: leite, arroz, sabonete..." maxLength={120} autoComplete="off" required />
          </label>
          <label className="quantity-field">
            <span>Quantidade</span>
            <input value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Ex.: 2 un." maxLength={40} autoComplete="off" />
          </label>
          <label className="price-field">
            <span>Preço unitário</span>
            <input
              value={price}
              onChange={(event) => setPrice(event.target.value.replace(/[^\d,.]/g, "").slice(0, 15))}
              placeholder="R$ 0,00"
              inputMode="decimal"
              autoComplete="off"
              aria-label="Preço por unidade, opcional"
            />
          </label>
          <button className="primary-button add-button" type="submit" disabled={saving || !name.trim()}>
            {saving ? <LoaderCircle className="spin" /> : <Plus />}
            Adicionar
          </button>
        </form>

        <div className="progress-block" aria-label={`${progress}% da compra concluída`}>
          <div className="progress-labels"><span>Progresso da compra</span><strong>{progress}%</strong></div>
          <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
        </div>

        {error ? (
          <div className="error-state" role="alert">
            <p>{error}</p>
            <button className="secondary-button compact-button" onClick={() => { setError(""); void loadItems(); }}>Tentar novamente</button>
          </div>
        ) : loading ? (
          <div className="loading-state"><LoaderCircle className="spin" /> Buscando a lista...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <span><CircleCheckBig /></span>
            <h2>A casa está abastecida</h2>
            <p>Quando algo estiver faltando, adicione acima.</p>
          </div>
        ) : (
          <div className="list-sections">
            <section>
              <div className="section-heading">
                <div className="section-title-total"><h2>Para comprar</h2><strong>{formatCurrency(pendingTotal)}</strong></div>
                <span>{pending.length}</span>
              </div>
              {pending.length === 0 ? (
                <div className="all-done"><Check /> Tudo comprado!</div>
              ) : (
                <ul className="items-list">
                  {pending.map((item) => <ItemRow key={item.id} item={item} busy={busyId === item.id} onToggle={toggleItem} onRemove={removeItem} />)}
                </ul>
              )}
            </section>
            {completed.length > 0 && (
              <section className="completed-section">
                <div className="section-heading">
                  <h2>No carrinho</h2>
                  <button className="clear-button" type="button" onClick={() => void clearCompleted()}>Limpar comprados</button>
                </div>
                <ul className="items-list">
                  {completed.map((item) => <ItemRow key={item.id} item={item} busy={busyId === item.id} onToggle={toggleItem} onRemove={removeItem} />)}
                </ul>
              </section>
            )}
          </div>
        )}

        <footer className="app-footer"><span /> Lista sincronizada entre vocês</footer>
          </>
        ) : (
          <PriceComparator />
        )}
      </section>
    </main>
  );
}

function ItemRow({ item, busy, onToggle, onRemove }: { item: Item; busy: boolean; onToggle: (item: Item) => void; onRemove: (id: string) => void }) {
  const total = itemTotal(item);

  return (
    <li className={`item-row ${item.completed ? "is-completed" : ""}`}>
      <button className="check-button" type="button" onClick={() => onToggle(item)} aria-label={item.completed ? `Devolver ${item.name} para a lista` : `Marcar ${item.name} como comprado`} disabled={busy}>
        {busy ? <LoaderCircle className="spin" /> : item.completed ? <Check /> : null}
      </button>
      <div className="item-copy">
        <div className="item-main-line">
          <div className="item-description">{item.quantity && <span>{item.quantity}</span>}<strong>{item.name}</strong></div>
          {item.price !== null && total !== null && (
            <div className="item-price" aria-label={`${formatCurrency(item.price)} por unidade; total ${formatCurrency(total)}`}>
              <span>{formatCurrency(item.price)}/un.</span>
              <strong>{formatCurrency(total)}</strong>
            </div>
          )}
        </div>
        <small>{item.completed && item.completedBy ? `Comprado por ${firstName(item.completedBy)}` : `Adicionado por ${firstName(item.addedBy)}`}</small>
      </div>
      <button className="icon-button delete-button" type="button" onClick={() => onRemove(item.id)} aria-label={`Excluir ${item.name}`} disabled={busy}><Trash2 /></button>
    </li>
  );
}
