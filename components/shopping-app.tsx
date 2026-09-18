"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calculator, Check, CircleCheckBig, Clipboard, Cloud, CloudOff, ListChecks,
  LoaderCircle, LogOut, Minus, Moon, Pencil, Plus, RefreshCw, Settings,
  ShoppingBasket, Sun, Tags, Trash2, Users, X,
} from "lucide-react";
import { PriceComparator } from "./price-comparator";
import {
  clearOfflineData, enqueueMutation, getOfflineSnapshot, getPendingMutations,
  OfflineCategory, OfflineItem, PendingMutation, removePendingMutation, saveOfflineSnapshot,
} from "@/lib/offline-db";

type Item = OfflineItem;
type Category = OfflineCategory;

type Props = {
  userName: string;
  familyId: string;
  familyName: string;
  inviteCode: string | null;
  initialCollectPricesOnPurchase: boolean;
  canManageFamily: boolean;
};

class PermanentRequestError extends Error {}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || value;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function quantityMultiplier(value: string) {
  const match = value.trim().match(/^(\d+)(?:\s*(?:un\.?|unidades?|pacotes?|pcts?\.?|caixas?|garrafas?|fardos?))?$/i);
  if (!match) return 1;
  const quantity = Number(match[1]);
  return Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
}

function normalizeQuantity(value: string) {
  const quantity = Number(value);
  if (!/^\d+$/.test(value) || !Number.isInteger(quantity) || quantity < 1) return "1";
  return String(Math.min(quantity, 999));
}

function quantityDisplay(value: string) {
  const raw = value.trim();
  if (/^\d+$/.test(raw)) return `${normalizeQuantity(raw)} ×`;
  return raw || "1 ×";
}

function parseMoneyInput(value: string) {
  const raw = value.trim().replace(/\s/g, "");
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function itemTotal(item: Item) {
  if (item.unitPrice === null) return null;
  return Math.round((item.unitPrice * quantityMultiplier(item.quantity) + Number.EPSILON) * 100) / 100;
}

function nowIso() {
  return new Date().toISOString();
}

export function ShoppingApp({ userName, familyId, familyName, inviteCode, initialCollectPricesOnPurchase, canManageFamily }: Props) {
  const router = useRouter();
  const inviteButtonRef = useRef<HTMLButtonElement>(null);
  const syncingRef = useRef(false);
  const itemsRef = useRef<Item[]>([]);
  const categoriesRef = useRef<Category[]>([]);
  const syncedAtRef = useRef<string | null>(null);

  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingSaving, setSettingSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [dark, setDark] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [collectPricesOnPurchase, setCollectPricesOnPurchase] = useState(initialCollectPricesOnPurchase);
  const [purchaseItem, setPurchaseItem] = useState<Item | null>(null);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [editName, setEditName] = useState("");
  const [editQuantity, setEditQuantity] = useState("1");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [mode, setMode] = useState<"list" | "compare">("list");
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  const replaceLocalData = useCallback((nextItems: Item[], nextCategories: Category[], nextSyncedAt: string | null) => {
    itemsRef.current = nextItems;
    categoriesRef.current = nextCategories;
    syncedAtRef.current = nextSyncedAt;
    setItems(nextItems);
    setCategories(nextCategories);
    setLastSyncedAt(nextSyncedAt);
    void saveOfflineSnapshot({ familyId, items: nextItems, categories: nextCategories, syncedAt: nextSyncedAt }).catch(() => undefined);
  }, [familyId]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = localStorage.getItem("lista-theme");
      const enabled = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
      setDark(enabled);
      document.documentElement.classList.toggle("dark", enabled);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const syncNow = useCallback(async (quiet = false) => {
    if (syncingRef.current || !navigator.onLine) {
      setOnline(navigator.onLine);
      return;
    }
    syncingRef.current = true;
    if (!quiet) setSyncing(true);
    try {
      const queued = await getPendingMutations(familyId).catch(() => [] as PendingMutation[]);
      setPendingChanges(queued.length);
      for (const mutation of queued) {
        const response = await fetch(mutation.endpoint, {
          method: mutation.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mutation.body),
        });
        if (response.status === 401) { router.push("/entrar"); return; }
        if (response.ok || response.status === 404) {
          await removePendingMutation(mutation.mutationId);
          continue;
        }
        if (response.status < 500) {
          await removePendingMutation(mutation.mutationId);
          continue;
        }
        throw new Error("Servidor temporariamente indisponível.");
      }

      const [itemsResponse, categoriesResponse] = await Promise.all([
        fetch("/api/items", { cache: "no-store" }),
        fetch("/api/categories", { cache: "no-store" }),
      ]);
      if (itemsResponse.status === 401 || categoriesResponse.status === 401) { router.push("/entrar"); return; }
      const itemsData = (await itemsResponse.json()) as { items?: Item[]; collectPricesOnPurchase?: boolean; error?: string };
      const categoriesData = (await categoriesResponse.json()) as { categories?: Category[]; error?: string };
      if (!itemsResponse.ok) throw new Error(itemsData.error ?? "Não foi possível carregar a lista.");
      if (!categoriesResponse.ok) throw new Error(categoriesData.error ?? "Não foi possível carregar as categorias.");

      const syncedAt = nowIso();
      replaceLocalData(itemsData.items ?? [], categoriesData.categories ?? [], syncedAt);
      if (typeof itemsData.collectPricesOnPurchase === "boolean") setCollectPricesOnPurchase(itemsData.collectPricesOnPurchase);
      setPendingChanges(0);
      setOnline(true);
      setError("");
      const registration = await navigator.serviceWorker?.ready;
      registration?.active?.postMessage({ type: "CACHE_APP_SHELL" });
    } catch (syncError) {
      setOnline(false);
      if (itemsRef.current.length === 0) setError(syncError instanceof Error ? syncError.message : "Não foi possível carregar a lista.");
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      setLoading(false);
    }
  }, [familyId, replaceLocalData, router]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const snapshot = await getOfflineSnapshot(familyId).catch(() => null);
      if (!active) return;
      if (snapshot) replaceLocalData(snapshot.items, snapshot.categories, snapshot.syncedAt);
      const queued = await getPendingMutations(familyId).catch(() => [] as PendingMutation[]);
      if (active) setPendingChanges(queued.length);
      setOnline(navigator.onLine);
      setLoading(!snapshot);
      await syncNow(Boolean(snapshot));
    })();
    return () => { active = false; };
  }, [familyId, replaceLocalData, syncNow]);

  useEffect(() => {
    const goOnline = () => { setOnline(true); void syncNow(); };
    const goOffline = () => setOnline(false);
    const refresh = () => { if (document.visibilityState === "visible") void syncNow(true); };
    const interval = window.setInterval(() => { if (navigator.onLine) void syncNow(true); }, 15000);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [syncNow]);

  useEffect(() => {
    if (!inviteOpen && !purchaseItem && !editItem && !clearOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (purchaseItem) { setPurchaseItem(null); setPurchasePrice(""); }
      else if (editItem) setEditItem(null);
      else if (clearOpen) setClearOpen(false);
      else { setInviteOpen(false); window.requestAnimationFrame(() => inviteButtonRef.current?.focus()); }
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [inviteOpen, purchaseItem, editItem, clearOpen]);

  const pending = useMemo(() => items.filter((item) => !item.completed), [items]);
  const completed = useMemo(() => items.filter((item) => item.completed), [items]);
  const completedTotal = useMemo(() => completed.reduce((total, item) => total + Math.round((itemTotal(item) ?? 0) * 100), 0) / 100, [completed]);
  const completedWithoutPrice = useMemo(() => completed.filter((item) => item.unitPrice === null).length, [completed]);
  const hasCompletedPrices = completed.some((item) => item.unitPrice !== null);
  const parsedPurchasePrice = parseMoneyInput(purchasePrice);
  const progress = items.length ? Math.round((completed.length / items.length) * 100) : 0;
  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const pendingGroups = useMemo(() => {
    const groups = categories.map((category) => ({ id: category.id, name: category.name, items: pending.filter((item) => item.categoryId === category.id) }));
    const uncategorized = pending.filter((item) => !item.categoryId || !categoryMap.has(item.categoryId));
    if (uncategorized.length) groups.push({ id: "uncategorized", name: "Sem categoria", items: uncategorized });
    return groups.filter((group) => group.items.length > 0);
  }, [categories, categoryMap, pending]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("lista-theme", next ? "dark" : "light");
  }

  async function performMutation(endpoint: PendingMutation["endpoint"], method: PendingMutation["method"], body: Record<string, unknown>) {
    if (navigator.onLine) {
      try {
        const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        if (response.status === 401) {
          router.push("/entrar");
          throw new PermanentRequestError("Faça login novamente.");
        }
        if (response.ok || response.status === 404) return;
        if (response.status < 500) throw new PermanentRequestError(data.error ?? "Não foi possível salvar a alteração.");
      } catch (requestError) {
        if (requestError instanceof PermanentRequestError) throw requestError;
      }
    }
    await enqueueMutation({ mutationId: crypto.randomUUID(), familyId, endpoint, method, body, createdAt: nowIso() });
    const queued = await getPendingMutations(familyId);
    setPendingChanges(queued.length);
    setOnline(false);
  }

  function commitItems(nextItems: Item[]) {
    replaceLocalData(nextItems, categoriesRef.current, syncedAtRef.current);
  }

  function commitCategories(nextCategories: Category[], nextItems = itemsRef.current) {
    replaceLocalData(nextItems, nextCategories, syncedAtRef.current);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const timestamp = nowIso();
    const item: Item = {
      id: crypto.randomUUID(), name: name.trim(), quantity: normalizeQuantity(quantity), categoryId: categoryId || null,
      unitPrice: null, completed: false, addedBy: userName, completedBy: null, createdAt: timestamp,
      completedAt: null, updatedAt: timestamp,
    };
    commitItems([item, ...itemsRef.current]);
    setName("");
    setQuantity("1");
    try {
      await performMutation("/api/items", "POST", { id: item.id, name: item.name, quantity: item.quantity, categoryId: item.categoryId });
    } catch (submitError) {
      commitItems(itemsRef.current.filter((entry) => entry.id !== item.id));
      setError(submitError instanceof Error ? submitError.message : "Não foi possível adicionar.");
    } finally { setSaving(false); }
  }

  async function changeCompleted(item: Item, completedState: boolean, unitPrice: string | null = null) {
    setBusyId(item.id);
    const parsedPrice = completedState && unitPrice ? parseMoneyInput(unitPrice) : null;
    const timestamp = nowIso();
    commitItems(itemsRef.current.map((entry) => entry.id === item.id ? {
      ...entry, completed: completedState, unitPrice: parsedPrice, completedBy: completedState ? userName : null,
      completedAt: completedState ? timestamp : null, updatedAt: timestamp,
    } : entry));
    try {
      await performMutation("/api/items", "PATCH", { id: item.id, completed: completedState, unitPrice });
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Não foi possível atualizar.");
      void syncNow();
    } finally { setBusyId(null); }
  }

  async function toggleItem(item: Item) {
    if (!item.completed && collectPricesOnPurchase) { setPurchasePrice(""); setPurchaseItem(item); return; }
    await changeCompleted(item, !item.completed);
  }

  async function finishPurchase(unitPrice: string | null) {
    if (!purchaseItem) return;
    const item = purchaseItem;
    setPurchaseItem(null);
    setPurchasePrice("");
    await changeCompleted(item, true, unitPrice);
  }

  function openEdit(item: Item) {
    setEditItem(item);
    setEditName(item.name);
    setEditQuantity(String(quantityMultiplier(item.quantity)));
    setEditCategoryId(item.categoryId ?? "");
  }

  async function saveItemEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editItem || !editName.trim()) return;
    const item = editItem;
    const nextName = editName.trim();
    const nextQuantity = normalizeQuantity(editQuantity);
    const nextCategoryId = editCategoryId || null;
    setEditSaving(true);
    commitItems(itemsRef.current.map((entry) => entry.id === item.id ? { ...entry, name: nextName, quantity: nextQuantity, categoryId: nextCategoryId, updatedAt: nowIso() } : entry));
    setEditItem(null);
    try {
      await performMutation("/api/items", "PATCH", { id: item.id, name: nextName, quantity: nextQuantity, categoryId: nextCategoryId });
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "Não foi possível editar o produto.");
      void syncNow();
    } finally { setEditSaving(false); }
  }

  async function removeItem(id: string) {
    setBusyId(id);
    const previous = itemsRef.current;
    commitItems(previous.filter((item) => item.id !== id));
    try { await performMutation("/api/items", "DELETE", { id }); }
    catch (removeError) { commitItems(previous); setError(removeError instanceof Error ? removeError.message : "Não foi possível remover."); }
    finally { setBusyId(null); }
  }

  async function clearCompleted() {
    const purchasedIds = completed.map((item) => item.id);
    commitItems(itemsRef.current.filter((item) => !item.completed));
    setClearOpen(false);
    try { for (const id of purchasedIds) await performMutation("/api/items", "DELETE", { id }); }
    catch (clearError) { setError(clearError instanceof Error ? clearError.message : "Não foi possível limpar todos os produtos."); void syncNow(); }
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = newCategoryName.trim();
    if (cleanName.length < 2) return;
    if (categories.some((category) => category.name.localeCompare(cleanName, "pt-BR", { sensitivity: "accent" }) === 0)) {
      setError("Essa categoria já existe.");
      return;
    }
    setCategorySaving(true);
    const category: Category = { id: crypto.randomUUID(), name: cleanName, sortOrder: Math.max(0, ...categories.map((entry) => entry.sortOrder)) + 10, updatedAt: nowIso() };
    commitCategories([...categoriesRef.current, category]);
    setNewCategoryName("");
    setCategoryId(category.id);
    try { await performMutation("/api/categories", "POST", { id: category.id, name: category.name }); }
    catch (categoryError) { commitCategories(categoriesRef.current.filter((entry) => entry.id !== category.id)); setError(categoryError instanceof Error ? categoryError.message : "Não foi possível criar a categoria."); }
    finally { setCategorySaving(false); }
  }

  async function renameCategory(id: string) {
    const cleanName = editingCategoryName.trim();
    if (cleanName.length < 2) return;
    const previous = categoriesRef.current;
    commitCategories(previous.map((category) => category.id === id ? { ...category, name: cleanName, updatedAt: nowIso() } : category));
    setEditingCategoryId(null);
    try { await performMutation("/api/categories", "PATCH", { id, name: cleanName }); }
    catch (categoryError) { commitCategories(previous); setError(categoryError instanceof Error ? categoryError.message : "Não foi possível renomear a categoria."); }
  }

  async function removeCategory(id: string) {
    const previousCategories = categoriesRef.current;
    const previousItems = itemsRef.current;
    const nextItems = previousItems.map((item) => item.categoryId === id ? { ...item, categoryId: null, updatedAt: nowIso() } : item);
    commitCategories(previousCategories.filter((category) => category.id !== id), nextItems);
    if (categoryId === id) setCategoryId("");
    try { await performMutation("/api/categories", "DELETE", { id }); }
    catch (categoryError) { commitCategories(previousCategories, previousItems); setError(categoryError instanceof Error ? categoryError.message : "Não foi possível remover a categoria."); }
  }

  async function savePriceSetting(next: boolean) {
    if (!canManageFamily || settingSaving || !navigator.onLine) return;
    const previous = collectPricesOnPurchase;
    setCollectPricesOnPurchase(next);
    setSettingSaving(true);
    try {
      const response = await fetch("/api/family/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ collectPricesOnPurchase: next }) });
      const data = (await response.json()) as { collectPricesOnPurchase?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error);
      setCollectPricesOnPurchase(Boolean(data.collectPricesOnPurchase));
    } catch (settingsError) {
      setCollectPricesOnPurchase(previous);
      setError(settingsError instanceof Error ? settingsError.message : "Não foi possível salvar a configuração.");
    } finally { setSettingSaving(false); }
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
    await clearOfflineData().catch(() => undefined);
    const registration = await navigator.serviceWorker?.ready;
    registration?.active?.postMessage({ type: "CLEAR_PRIVATE_CACHE" });
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/entrar");
    router.refresh();
  }

  const formattedSyncTime = lastSyncedAt ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(lastSyncedAt)) : null;

  return (
    <main className="app-shell">
      <section className="shopping-card" aria-labelledby="page-title">
        <header className="app-header">
          <div className="brand-mark"><ShoppingBasket /></div>
          <div className="brand-copy"><p>{familyName}</p><h1 id="page-title">Lista de Casa</h1></div>
          <button className="icon-button header-button" type="button" onClick={toggleTheme} aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"}>{dark ? <Sun /> : <Moon />}</button>
          <button className="icon-button header-button" type="button" onClick={() => void logout()} aria-label="Sair"><LogOut /></button>
        </header>

        {(!online || pendingChanges > 0 || syncing) && <div className={`sync-banner ${online ? "is-syncing" : "is-offline"}`} role="status">
          {online ? <Cloud className={syncing ? "pulse" : ""} /> : <CloudOff />}
          <span>{!online ? `Modo offline${formattedSyncTime ? ` · lista salva às ${formattedSyncTime}` : ""}` : syncing ? "Sincronizando alterações..." : `${pendingChanges} ${pendingChanges === 1 ? "alteração aguardando" : "alterações aguardando"}`}</span>
        </div>}

        <nav className="app-mode-tabs" aria-label="Ferramentas do aplicativo">
          <button type="button" className={mode === "list" ? "active" : ""} onClick={() => setMode("list")} aria-current={mode === "list" ? "page" : undefined}><ListChecks /> Lista de compras</button>
          <button type="button" className={mode === "compare" ? "active" : ""} onClick={() => setMode("compare")} aria-current={mode === "compare" ? "page" : undefined}><Calculator /> Comparar preços</button>
        </nav>

        {mode === "list" ? <>
          <div className="welcome-row">
            <div><p className="eyebrow">Olá, {firstName(userName)}</p><p className="status-copy">{pending.length === 0 ? "Nada faltando por enquanto." : `${pending.length} ${pending.length === 1 ? "item falta" : "itens faltam"} comprar.`}</p></div>
            <div className="welcome-actions">
              <button ref={inviteButtonRef} className="invite-trigger" type="button" onClick={() => setInviteOpen(true)}><Settings /> Família</button>
              <button className="icon-button refresh-button" type="button" onClick={() => void syncNow()} aria-label="Atualizar lista" disabled={syncing || !online}><RefreshCw className={syncing ? "spin" : ""} /></button>
            </div>
          </div>

          {inviteOpen && <div className="invite-modal-backdrop" role="presentation" onMouseDown={closeInvite}>
            <div className="invite-modal family-settings-modal" role="dialog" aria-modal="true" aria-labelledby="invite-title" onMouseDown={(event) => event.stopPropagation()}>
              <button className="icon-button invite-close" type="button" onClick={closeInvite} aria-label="Fechar configurações" autoFocus><X /></button>
              <span className="invite-modal-icon"><Users /></span><p>{familyName}</p><h2 id="invite-title">Configurações da família</h2>
              <div className="family-setting-row">
                <div><strong>Registrar preços durante a compra</strong><small>Ao marcar um produto, pergunte o preço de um pacote ou unidade.</small></div>
                <button className={`setting-switch ${collectPricesOnPurchase ? "is-on" : ""}`} type="button" role="switch" aria-checked={collectPricesOnPurchase} aria-label="Registrar preços durante a compra" disabled={!canManageFamily || settingSaving || !online} onClick={() => void savePriceSetting(!collectPricesOnPurchase)}><span /></button>
              </div>
              {!canManageFamily && <small className="owner-note">Somente quem criou a família pode alterar esta configuração.</small>}
              {!online && <small className="owner-note">As configurações gerais ficam disponíveis quando a internet voltar.</small>}

              <section className="category-settings" aria-labelledby="category-settings-title">
                <div className="category-settings-heading"><span><Tags /></span><div><strong id="category-settings-title">Categorias de produtos</strong><small>Organize a lista por setor do supermercado.</small></div></div>
                <form className="category-create-form" onSubmit={(event) => void createCategory(event)}>
                  <input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Nova categoria" maxLength={60} aria-label="Nome da nova categoria" />
                  <button type="submit" aria-label="Criar categoria" disabled={categorySaving || newCategoryName.trim().length < 2}>{categorySaving ? <LoaderCircle className="spin" /> : <Plus />}</button>
                </form>
                <ul className="category-settings-list">{categories.map((category) => <li key={category.id}>
                  {editingCategoryId === category.id ? <>
                    <input value={editingCategoryName} onChange={(event) => setEditingCategoryName(event.target.value)} maxLength={60} aria-label={`Novo nome para ${category.name}`} autoFocus />
                    <button type="button" onClick={() => void renameCategory(category.id)} aria-label="Salvar nome"><Check /></button>
                    <button type="button" onClick={() => setEditingCategoryId(null)} aria-label="Cancelar edição"><X /></button>
                  </> : <>
                    <span>{category.name}</span>
                    <button type="button" onClick={() => { setEditingCategoryId(category.id); setEditingCategoryName(category.name); }} aria-label={`Editar ${category.name}`}><Pencil /></button>
                    <button type="button" onClick={() => void removeCategory(category.id)} aria-label={`Remover ${category.name}`}><Trash2 /></button>
                  </>}
                </li>)}</ul>
              </section>

              <div className="family-invite-block"><small>Código para convidar familiares</small><strong>{inviteCode ?? "Indisponível"}</strong><button className="primary-button invite-copy" type="button" onClick={() => void copyInvite()} disabled={!inviteCode}><Clipboard />{copied ? "Código copiado!" : "Copiar código"}</button></div>
            </div>
          </div>}

          {purchaseItem && <div className="invite-modal-backdrop purchase-backdrop" role="presentation" onMouseDown={() => setPurchaseItem(null)}>
            <form className="purchase-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-title" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); if (parsedPurchasePrice !== null) void finishPurchase(purchasePrice); }}>
              <button className="icon-button invite-close" type="button" onClick={() => setPurchaseItem(null)} aria-label="Cancelar compra"><X /></button>
              <p>Adicionar ao carrinho</p><h2 id="purchase-title">{purchaseItem.name}</h2>
              <span className="purchase-quantity">Quantidade: <strong>{quantityMultiplier(purchaseItem.quantity)} {quantityMultiplier(purchaseItem.quantity) === 1 ? "item" : "itens"}</strong></span>
              <label className="purchase-price-field"><span>Preço de 1 pacote ou unidade</span><input value={purchasePrice} onChange={(event) => setPurchasePrice(event.target.value.replace(/[^\d,.]/g, "").slice(0, 15))} placeholder="R$ 0,00" inputMode="decimal" autoComplete="off" autoFocus /></label>
              {parsedPurchasePrice !== null && <div className="purchase-calculation"><span>Total calculado</span><strong>{formatCurrency(parsedPurchasePrice * quantityMultiplier(purchaseItem.quantity))}</strong></div>}
              <button className="primary-button" type="submit" disabled={parsedPurchasePrice === null || busyId === purchaseItem.id}>{busyId === purchaseItem.id ? <LoaderCircle className="spin" /> : <Check />}Adicionar ao carrinho</button>
              <button className="secondary-button" type="button" onClick={() => void finishPurchase(null)} disabled={busyId === purchaseItem.id}>Marcar sem informar preço</button>
            </form>
          </div>}

          {editItem && <div className="invite-modal-backdrop purchase-backdrop" role="presentation" onMouseDown={() => setEditItem(null)}>
            <form className="purchase-modal edit-item-modal" role="dialog" aria-modal="true" aria-labelledby="edit-item-title" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => void saveItemEdit(event)}>
              <button className="icon-button invite-close" type="button" onClick={() => setEditItem(null)} aria-label="Cancelar edição"><X /></button>
              <p>Corrigir informações</p><h2 id="edit-item-title">Editar produto</h2>
              <label className="edit-product-field"><span>Produto e tamanho</span><input value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={120} autoComplete="off" autoFocus required /></label>
              <label className="edit-product-field"><span>Categoria</span><select value={editCategoryId} onChange={(event) => setEditCategoryId(event.target.value)}><option value="">Sem categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <div className="edit-quantity-field"><span>Quantidade</span><div className="quantity-stepper"><button type="button" onClick={() => setEditQuantity((current) => String(Math.max(1, Number(normalizeQuantity(current)) - 1)))} aria-label="Diminuir quantidade"><Minus /></button><input value={editQuantity} onChange={(event) => setEditQuantity(event.target.value.replace(/\D/g, "").slice(0, 3))} onBlur={() => setEditQuantity((current) => normalizeQuantity(current))} type="text" inputMode="numeric" aria-label="Quantidade de pacotes ou unidades" /><button type="button" onClick={() => setEditQuantity((current) => String(Math.min(999, Number(normalizeQuantity(current)) + 1)))} aria-label="Aumentar quantidade"><Plus /></button></div><small>Pacotes ou unidades</small></div>
              <button className="primary-button" type="submit" disabled={editSaving || !editName.trim()}>{editSaving ? <LoaderCircle className="spin" /> : <Check />}Salvar alterações</button>
            </form>
          </div>}

          <form className="add-form category-add-form" onSubmit={(event) => void submit(event)}>
            <label className="product-field"><span>O que está faltando?</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Arroz 5 kg" maxLength={120} autoComplete="off" required /><small className="field-hint">Inclua o peso ou tamanho no nome</small></label>
            <label className="category-field"><span>Categoria</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Sem categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><small className="field-hint">Setor do mercado</small></label>
            <div className="quantity-field"><span>Quantidade</span><div className="quantity-stepper"><button type="button" onClick={() => setQuantity((current) => String(Math.max(1, Number(normalizeQuantity(current)) - 1)))} aria-label="Diminuir quantidade"><Minus /></button><input value={quantity} onChange={(event) => setQuantity(event.target.value.replace(/\D/g, "").slice(0, 3))} onBlur={() => setQuantity((current) => normalizeQuantity(current))} type="text" inputMode="numeric" aria-label="Quantidade de pacotes ou unidades" /><button type="button" onClick={() => setQuantity((current) => String(Math.min(999, Number(normalizeQuantity(current)) + 1)))} aria-label="Aumentar quantidade"><Plus /></button></div><small className="field-hint">Pacotes ou unidades</small></div>
            <button className="primary-button add-button" type="submit" disabled={saving || !name.trim()}>{saving ? <LoaderCircle className="spin" /> : <Plus />}Adicionar</button>
          </form>

          <div className="progress-block" aria-label={`${progress}% da compra concluída`}><div className="progress-labels"><span>Progresso da compra</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div></div>
          {error && <div className="inline-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Fechar aviso"><X /></button></div>}

          {loading ? <div className="loading-state"><LoaderCircle className="spin" /> Buscando a lista...</div>
            : items.length === 0 ? <div className="empty-state"><span><CircleCheckBig /></span><h2>A casa está abastecida</h2><p>Quando algo estiver faltando, adicione acima.</p></div>
              : <div className="list-sections">
                <section>
                  <div className="section-heading"><h2>Para comprar</h2><span>{pending.length}</span></div>
                  {pending.length === 0 ? <div className="all-done"><Check /> Tudo comprado!</div>
                    : <div className="category-groups">{pendingGroups.map((group) => <section className="category-group" key={group.id}><div className="category-group-heading"><span><Tags /></span><h3>{group.name}</h3><strong>{group.items.length}</strong></div><ul className="items-list">{group.items.map((item) => <ItemRow key={item.id} item={item} busy={busyId === item.id} categoryName={null} showPriceStatus={collectPricesOnPurchase} onToggle={toggleItem} onEdit={openEdit} onRemove={removeItem} />)}</ul></section>)}</div>}
                </section>
                {completed.length > 0 && <section className="completed-section">
                  <div className="section-heading completed-heading"><div className="completed-summary"><div><h2>No carrinho</h2><span>{completed.length}</span></div>{(collectPricesOnPurchase || hasCompletedPrices) && <p><strong>{completedWithoutPrice > 0 ? "Total informado" : "Total da compra"}: {formatCurrency(completedTotal)}</strong>{completedWithoutPrice > 0 && <small>{completedWithoutPrice} {completedWithoutPrice === 1 ? "produto sem preço" : "produtos sem preço"}</small>}</p>}</div><button className="clear-button" type="button" onClick={() => setClearOpen(true)}>Limpar comprados</button></div>
                  <ul className="items-list">{completed.map((item) => <ItemRow key={item.id} item={item} busy={busyId === item.id} categoryName={item.categoryId ? categoryMap.get(item.categoryId) ?? "Sem categoria" : "Sem categoria"} showPriceStatus={collectPricesOnPurchase || hasCompletedPrices} onToggle={toggleItem} onEdit={openEdit} onRemove={removeItem} />)}</ul>
                </section>}
              </div>}

          {clearOpen && <div className="invite-modal-backdrop" role="presentation" onMouseDown={() => setClearOpen(false)}><div className="clear-modal" role="alertdialog" aria-modal="true" aria-labelledby="clear-title" onMouseDown={(event) => event.stopPropagation()}><h2 id="clear-title">Limpar produtos comprados?</h2><p>{completed.length} {completed.length === 1 ? "produto será removido" : "produtos serão removidos"}.</p>{(collectPricesOnPurchase || hasCompletedPrices) && <strong>Total: {formatCurrency(completedTotal)}</strong>}<small>Depois de limpar, os produtos e valores não aparecerão mais na lista.</small><div><button className="secondary-button" type="button" onClick={() => setClearOpen(false)}>Cancelar</button><button className="danger-button" type="button" onClick={() => void clearCompleted()}>Limpar produtos</button></div></div></div>}
          <footer className={`app-footer ${online ? "" : "is-offline"}`}><span />{online ? (pendingChanges ? "Alterações salvas no celular" : "Lista sincronizada entre vocês") : "Lista disponível sem internet"}</footer>
        </> : <PriceComparator />}
      </section>
    </main>
  );
}

function ItemRow({ item, busy, categoryName, showPriceStatus, onToggle, onEdit, onRemove }: { item: Item; busy: boolean; categoryName: string | null; showPriceStatus: boolean; onToggle: (item: Item) => void; onEdit: (item: Item) => void; onRemove: (id: string) => void }) {
  const total = itemTotal(item);
  return <li className={`item-row ${item.completed ? "is-completed" : ""}`}>
    <button className="check-button" type="button" onClick={() => onToggle(item)} aria-label={item.completed ? `Devolver ${item.name} para a lista` : `Marcar ${item.name} como comprado`} disabled={busy}>{busy ? <LoaderCircle className="spin" /> : item.completed ? <Check /> : null}</button>
    <div className="item-copy"><div className="item-main-line"><div className="item-description"><span>{quantityDisplay(item.quantity)}</span><strong>{item.name}</strong></div>{item.completed && item.unitPrice !== null && total !== null && <div className="item-price" aria-label={`${formatCurrency(item.unitPrice)} por pacote ou unidade; total ${formatCurrency(total)}`}><span>{formatCurrency(item.unitPrice)} cada</span><strong>{formatCurrency(total)}</strong></div>}</div><small>{categoryName && <em className="item-category">{categoryName}</em>}{item.completed && item.completedBy ? `Comprado por ${firstName(item.completedBy)}` : `Adicionado por ${firstName(item.addedBy)}`}{item.completed && item.unitPrice === null && showPriceStatus ? " · Preço não informado" : ""}</small></div>
    <div className="item-actions">{!item.completed && <button className="icon-button edit-button" type="button" onClick={() => onEdit(item)} aria-label={`Editar ${item.name}`} disabled={busy}><Pencil /></button>}<button className="icon-button delete-button" type="button" onClick={() => onRemove(item.id)} aria-label={`Excluir ${item.name}`} disabled={busy}><Trash2 /></button></div>
  </li>;
}
