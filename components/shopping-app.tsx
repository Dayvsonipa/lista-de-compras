"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calculator, Check, CircleCheckBig, Clipboard, Cloud, CloudOff, ListChecks,
  LoaderCircle, LogOut, Minus, Moon, Pencil, Plus, RefreshCw, Settings,
  ShoppingBasket, Sun, Tags, Trash2, Users, X,
} from "lucide-react";
import { PriceComparator } from "./price-comparator";
import { useAppLanguage } from "./language";
import {
  clearOfflineData, enqueueMutation, getOfflineSnapshot, getPendingMutations,
  OfflineCategory, OfflineItem, OfflineProduct, PendingMutation, removePendingMutation, saveOfflineSnapshot,
} from "@/lib/offline-db";
import { normalizeProductName } from "@/lib/validation";
import { AppLanguage, formatCurrency as formatAppCurrency, languageOptions, localeFor, translate, translateServerMessage } from "@/lib/i18n";

type Item = OfflineItem;
type Category = OfflineCategory;
type Product = OfflineProduct;

type Props = {
  userName: string;
  familyId: string;
  familyName: string;
  inviteCode: string | null;
  initialCollectPricesOnPurchase: boolean;
  initialLanguage: AppLanguage;
  canManageFamily: boolean;
};

class PermanentRequestError extends Error {}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || value;
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

export function ShoppingApp({ userName, familyId, familyName, inviteCode, initialCollectPricesOnPurchase, initialLanguage, canManageFamily }: Props) {
  const router = useRouter();
  const { language, setLanguage, t } = useAppLanguage(initialLanguage);
  const currency = useCallback((value: number) => formatAppCurrency(value, language), [language]);
  const inviteButtonRef = useRef<HTMLButtonElement>(null);
  const syncingRef = useRef(false);
  const itemsRef = useRef<Item[]>([]);
  const categoriesRef = useRef<Category[]>([]);
  const productsRef = useRef<Product[]>([]);
  const syncedAtRef = useRef<string | null>(null);

  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [categoryId, setCategoryId] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingSaving, setSettingSaving] = useState(false);
  const [languageSaving, setLanguageSaving] = useState(false);
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

  const replaceLocalData = useCallback((nextItems: Item[], nextCategories: Category[], nextProducts: Product[], nextSyncedAt: string | null) => {
    itemsRef.current = nextItems;
    categoriesRef.current = nextCategories;
    productsRef.current = nextProducts;
    syncedAtRef.current = nextSyncedAt;
    setItems(nextItems);
    setCategories(nextCategories);
    setProducts(nextProducts);
    setLastSyncedAt(nextSyncedAt);
    void saveOfflineSnapshot({ familyId, items: nextItems, categories: nextCategories, products: nextProducts, syncedAt: nextSyncedAt }).catch(() => undefined);
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
        throw new Error(t("temporaryServer"));
      }

      const [itemsResponse, categoriesResponse, productsResponse] = await Promise.all([
        fetch("/api/items", { cache: "no-store" }),
        fetch("/api/categories", { cache: "no-store" }),
        fetch("/api/products", { cache: "no-store" }),
      ]);
      if (itemsResponse.status === 401 || categoriesResponse.status === 401 || productsResponse.status === 401) { router.push("/entrar"); return; }
      const itemsData = (await itemsResponse.json()) as { items?: Item[]; collectPricesOnPurchase?: boolean; error?: string };
      const categoriesData = (await categoriesResponse.json()) as { categories?: Category[]; error?: string };
      const productsData = (await productsResponse.json()) as { products?: Product[]; error?: string };
      if (!itemsResponse.ok) throw new Error(translateServerMessage(itemsData.error, language, "loadListError"));
      if (!categoriesResponse.ok) throw new Error(translateServerMessage(categoriesData.error, language, "loadCategoriesError"));
      if (!productsResponse.ok) throw new Error(translateServerMessage(productsData.error, language, "loadCatalogError"));

      const syncedAt = nowIso();
      replaceLocalData(itemsData.items ?? [], categoriesData.categories ?? [], productsData.products ?? [], syncedAt);
      if (typeof itemsData.collectPricesOnPurchase === "boolean") setCollectPricesOnPurchase(itemsData.collectPricesOnPurchase);
      setPendingChanges(0);
      setOnline(true);
      setError("");
      const registration = await navigator.serviceWorker?.ready;
      registration?.active?.postMessage({ type: "CACHE_APP_SHELL" });
    } catch (syncError) {
      setOnline(false);
      if (itemsRef.current.length === 0) setError(syncError instanceof Error ? syncError.message : t("loadListError"));
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      setLoading(false);
    }
  }, [familyId, language, replaceLocalData, router, t]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const snapshot = await getOfflineSnapshot(familyId).catch(() => null);
      if (!active) return;
      if (snapshot) replaceLocalData(snapshot.items, snapshot.categories, snapshot.products ?? [], snapshot.syncedAt);
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
  const productSuggestions = useMemo(() => {
    const query = normalizeProductName(name);
    if (query.length < 2) return [];
    return products
      .filter((product) => normalizeProductName(product.name).includes(query))
      .slice(0, 5);
  }, [name, products]);
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
          throw new PermanentRequestError(t("loginAgain"));
        }
        if (response.ok || response.status === 404) return;
        if (response.status < 500) throw new PermanentRequestError(translateServerMessage(data.error, language, "saveChangeError"));
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
    replaceLocalData(nextItems, categoriesRef.current, productsRef.current, syncedAtRef.current);
  }

  function commitCategories(nextCategories: Category[], nextItems = itemsRef.current) {
    replaceLocalData(nextItems, nextCategories, productsRef.current, syncedAtRef.current);
  }

  function commitItemsAndProducts(nextItems: Item[], nextProducts: Product[]) {
    replaceLocalData(nextItems, categoriesRef.current, nextProducts, syncedAtRef.current);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const timestamp = nowIso();
    const previousItems = itemsRef.current;
    const previousProducts = productsRef.current;
    const normalizedName = normalizeProductName(name);
    const existingProduct = previousProducts.find((product) => normalizeProductName(product.name) === normalizedName);
    const productId = existingProduct?.id ?? crypto.randomUUID();
    const nextProducts = existingProduct ? previousProducts.map((product) => product.id === existingProduct.id ? { ...product, name: name.trim(), categoryId: categoryId || product.categoryId, updatedAt: timestamp } : product) : [{
      id: productId,
      name: name.trim(),
      categoryId: categoryId || null,
      lastUnitPrice: null,
      lastPurchasedAt: null,
      updatedAt: timestamp,
    }, ...previousProducts];
    const item: Item = {
      id: crypto.randomUUID(), productId, name: name.trim(), quantity: normalizeQuantity(quantity), categoryId: categoryId || existingProduct?.categoryId || null,
      previousUnitPrice: existingProduct?.lastUnitPrice ?? null,
      unitPrice: null, completed: false, addedBy: userName, completedBy: null, createdAt: timestamp,
      completedAt: null, updatedAt: timestamp,
    };
    commitItemsAndProducts([item, ...previousItems], nextProducts);
    setName("");
    setQuantity("1");
    try {
      await performMutation("/api/items", "POST", { id: item.id, productId: item.productId, name: item.name, quantity: item.quantity, categoryId: item.categoryId });
    } catch (submitError) {
      commitItemsAndProducts(previousItems, previousProducts);
      setError(submitError instanceof Error ? submitError.message : t("addError"));
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
      setError(toggleError instanceof Error ? toggleError.message : t("updateError"));
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
    const previousItems = itemsRef.current;
    const previousProducts = productsRef.current;
    const existingProduct = previousProducts.find((product) => normalizeProductName(product.name) === normalizeProductName(nextName));
    const nextProductId = existingProduct?.id ?? crypto.randomUUID();
    const nextProducts = existingProduct ? previousProducts.map((product) => product.id === existingProduct.id ? { ...product, name: nextName, categoryId: nextCategoryId || product.categoryId, updatedAt: nowIso() } : product) : [{
      id: nextProductId,
      name: nextName,
      categoryId: nextCategoryId,
      lastUnitPrice: null,
      lastPurchasedAt: null,
      updatedAt: nowIso(),
    }, ...previousProducts];
    setEditSaving(true);
    commitItemsAndProducts(previousItems.map((entry) => entry.id === item.id ? {
      ...entry,
      productId: nextProductId,
      name: nextName,
      quantity: nextQuantity,
      categoryId: nextCategoryId,
      previousUnitPrice: existingProduct?.lastUnitPrice ?? null,
      updatedAt: nowIso(),
    } : entry), nextProducts);
    setEditItem(null);
    try {
      await performMutation("/api/items", "PATCH", { id: item.id, productId: nextProductId, name: nextName, quantity: nextQuantity, categoryId: nextCategoryId });
    } catch (editError) {
      commitItemsAndProducts(previousItems, previousProducts);
      setError(editError instanceof Error ? editError.message : t("editProductError"));
      void syncNow();
    } finally { setEditSaving(false); }
  }

  async function removeItem(id: string) {
    setBusyId(id);
    const previous = itemsRef.current;
    commitItems(previous.filter((item) => item.id !== id));
    try { await performMutation("/api/items", "DELETE", { id }); }
    catch (removeError) { commitItems(previous); setError(removeError instanceof Error ? removeError.message : t("removeError")); }
    finally { setBusyId(null); }
  }

  async function clearCompleted() {
    const purchasedIds = completed.map((item) => item.id);
    const previousItems = itemsRef.current;
    const previousProducts = productsRef.current;
    const purchaseDate = nowIso();
    const updatedPrices = new Map<string, { unitPrice: number; purchasedAt: string }>();
    [...completed]
      .sort((a, b) => String(a.completedAt).localeCompare(String(b.completedAt)))
      .forEach((item) => {
        if (item.productId && item.unitPrice !== null) updatedPrices.set(item.productId, { unitPrice: item.unitPrice, purchasedAt: item.completedAt ?? purchaseDate });
      });
    const nextProducts = previousProducts.map((product) => {
      const price = updatedPrices.get(product.id);
      return price ? { ...product, lastUnitPrice: price.unitPrice, lastPurchasedAt: price.purchasedAt, updatedAt: purchaseDate } : product;
    });
    const nextItems = previousItems
      .filter((item) => !item.completed)
      .map((item) => {
        const price = item.productId ? updatedPrices.get(item.productId) : undefined;
        return price ? { ...item, previousUnitPrice: price.unitPrice } : item;
      });
    commitItemsAndProducts(nextItems, nextProducts);
    setClearOpen(false);
    try {
      await performMutation("/api/purchases/complete", "POST", { sessionId: crypto.randomUUID(), itemIds: purchasedIds });
    } catch (clearError) {
      commitItemsAndProducts(previousItems, previousProducts);
      setError(clearError instanceof Error ? clearError.message : t("archiveError"));
      void syncNow();
    }
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = newCategoryName.trim();
    if (cleanName.length < 2) return;
    if (categories.some((category) => category.name.localeCompare(cleanName, "pt-BR", { sensitivity: "accent" }) === 0)) {
      setError(t("categoryExists"));
      return;
    }
    setCategorySaving(true);
    const category: Category = { id: crypto.randomUUID(), name: cleanName, sortOrder: Math.max(0, ...categories.map((entry) => entry.sortOrder)) + 10, updatedAt: nowIso() };
    commitCategories([...categoriesRef.current, category]);
    setNewCategoryName("");
    setCategoryId(category.id);
    try { await performMutation("/api/categories", "POST", { id: category.id, name: category.name }); }
    catch (categoryError) { commitCategories(categoriesRef.current.filter((entry) => entry.id !== category.id)); setError(categoryError instanceof Error ? categoryError.message : t("createCategoryError")); }
    finally { setCategorySaving(false); }
  }

  async function renameCategory(id: string) {
    const cleanName = editingCategoryName.trim();
    if (cleanName.length < 2) return;
    const previous = categoriesRef.current;
    commitCategories(previous.map((category) => category.id === id ? { ...category, name: cleanName, updatedAt: nowIso() } : category));
    setEditingCategoryId(null);
    try { await performMutation("/api/categories", "PATCH", { id, name: cleanName }); }
    catch (categoryError) { commitCategories(previous); setError(categoryError instanceof Error ? categoryError.message : t("renameCategoryError")); }
  }

  async function removeCategory(id: string) {
    const previousCategories = categoriesRef.current;
    const previousItems = itemsRef.current;
    const previousProducts = productsRef.current;
    const nextItems = previousItems.map((item) => item.categoryId === id ? { ...item, categoryId: null, updatedAt: nowIso() } : item);
    const nextProducts = previousProducts.map((product) => product.categoryId === id ? { ...product, categoryId: null, updatedAt: nowIso() } : product);
    replaceLocalData(nextItems, previousCategories.filter((category) => category.id !== id), nextProducts, syncedAtRef.current);
    if (categoryId === id) setCategoryId("");
    try { await performMutation("/api/categories", "DELETE", { id }); }
    catch (categoryError) { replaceLocalData(previousItems, previousCategories, previousProducts, syncedAtRef.current); setError(categoryError instanceof Error ? categoryError.message : t("removeCategoryError")); }
  }

  async function savePriceSetting(next: boolean) {
    if (!canManageFamily || settingSaving || !navigator.onLine) return;
    const previous = collectPricesOnPurchase;
    setCollectPricesOnPurchase(next);
    setSettingSaving(true);
    try {
      const response = await fetch("/api/family/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ collectPricesOnPurchase: next }) });
      const data = (await response.json()) as { collectPricesOnPurchase?: boolean; error?: string };
      if (!response.ok) throw new Error(translateServerMessage(data.error, language, "saveSettingError"));
      setCollectPricesOnPurchase(Boolean(data.collectPricesOnPurchase));
    } catch (settingsError) {
      setCollectPricesOnPurchase(previous);
      setError(settingsError instanceof Error ? settingsError.message : t("saveSettingError"));
    } finally { setSettingSaving(false); }
  }

  async function saveLanguage(next: AppLanguage) {
    const previous = language;
    setLanguage(next);
    setLanguageSaving(true);
    try {
      await performMutation("/api/user/settings", "PATCH", { preferredLanguage: next });
    } catch {
      setLanguage(previous);
      setError(t("languageSaveError"));
    } finally {
      setLanguageSaving(false);
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
    await clearOfflineData().catch(() => undefined);
    const registration = await navigator.serviceWorker?.ready;
    registration?.active?.postMessage({ type: "CLEAR_PRIVATE_CACHE" });
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/entrar");
    router.refresh();
  }

  const formattedSyncTime = lastSyncedAt ? new Intl.DateTimeFormat(localeFor(language), { hour: "2-digit", minute: "2-digit" }).format(new Date(lastSyncedAt)) : null;

  return (
    <main className="app-shell">
      <section className="shopping-card" aria-labelledby="page-title">
        <header className="app-header">
          <div className="brand-mark"><ShoppingBasket /></div>
          <div className="brand-copy"><p>{familyName}</p><h1 id="page-title">{t("appName")}</h1></div>
          <button className="icon-button header-button" type="button" onClick={toggleTheme} aria-label={dark ? t("lightTheme") : t("darkTheme")}>{dark ? <Sun /> : <Moon />}</button>
          <button className="icon-button header-button" type="button" onClick={() => void logout()} aria-label={t("logout")}><LogOut /></button>
        </header>

        {(!online || pendingChanges > 0 || syncing) && <div className={`sync-banner ${online ? "is-syncing" : "is-offline"}`} role="status">
          {online ? <Cloud className={syncing ? "pulse" : ""} /> : <CloudOff />}
          <span>{!online ? `${t("offlineMode")}${formattedSyncTime ? ` · ${t("listSavedAt", { time: formattedSyncTime })}` : ""}` : syncing ? t("syncing") : pendingChanges === 1 ? t("onePendingChange") : t("manyPendingChanges", { count: pendingChanges })}</span>
        </div>}

        <nav className="app-mode-tabs" aria-label={t("appTools")}>
          <button type="button" className={mode === "list" ? "active" : ""} onClick={() => setMode("list")} aria-current={mode === "list" ? "page" : undefined}><ListChecks /> {t("shoppingList")}</button>
          <button type="button" className={mode === "compare" ? "active" : ""} onClick={() => setMode("compare")} aria-current={mode === "compare" ? "page" : undefined}><Calculator /> {t("comparePrices")}</button>
        </nav>

        {mode === "list" ? <>
          <div className="welcome-row">
            <div><p className="eyebrow">{t("hello", { name: firstName(userName) })}</p><p className="status-copy">{pending.length === 0 ? t("nothingMissing") : pending.length === 1 ? t("oneItemMissing") : t("manyItemsMissing", { count: pending.length })}</p></div>
            <div className="welcome-actions">
              <button ref={inviteButtonRef} className="invite-trigger" type="button" onClick={() => setInviteOpen(true)}><Settings /> {t("settings")}</button>
              <button className="icon-button refresh-button" type="button" onClick={() => void syncNow()} aria-label={t("refreshList")} disabled={syncing || !online}><RefreshCw className={syncing ? "spin" : ""} /></button>
            </div>
          </div>

          {inviteOpen && <div className="invite-modal-backdrop" role="presentation" onMouseDown={closeInvite}>
            <div className="invite-modal family-settings-modal" role="dialog" aria-modal="true" aria-labelledby="invite-title" onMouseDown={(event) => event.stopPropagation()}>
              <button className="icon-button invite-close" type="button" onClick={closeInvite} aria-label={t("closeSettings")} autoFocus><X /></button>
              <span className="invite-modal-icon"><Users /></span><p>{familyName}</p><h2 id="invite-title">{t("settingsTitle")}</h2>
              <div className="family-setting-row language-setting-row">
                <div><strong>{t("appLanguage")}</strong><small>{t("appLanguageDescription")}</small></div>
                <select value={language} onChange={(event) => void saveLanguage(event.target.value as AppLanguage)} disabled={languageSaving} aria-label={t("appLanguage")}>
                  {languageOptions.map((option) => <option key={option.value} value={option.value}>{t(option.labelKey)}</option>)}
                </select>
              </div>
              <div className="family-setting-row">
                <div><strong>{t("recordPrices")}</strong><small>{t("recordPricesDescription")}</small></div>
                <button className={`setting-switch ${collectPricesOnPurchase ? "is-on" : ""}`} type="button" role="switch" aria-checked={collectPricesOnPurchase} aria-label={t("recordPrices")} disabled={!canManageFamily || settingSaving || !online} onClick={() => void savePriceSetting(!collectPricesOnPurchase)}><span /></button>
              </div>
              {!canManageFamily && <small className="owner-note">{t("ownerOnly")}</small>}
              {!online && <small className="owner-note">{t("onlineSettingsOnly")}</small>}

              <section className="category-settings" aria-labelledby="category-settings-title">
                <div className="category-settings-heading"><span><Tags /></span><div><strong id="category-settings-title">{t("productCategories")}</strong><small>{t("categoriesDescription")}</small></div></div>
                <form className="category-create-form" onSubmit={(event) => void createCategory(event)}>
                  <input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder={t("newCategory")} maxLength={60} aria-label={t("newCategoryName")} />
                  <button type="submit" aria-label={t("createCategory")} disabled={categorySaving || newCategoryName.trim().length < 2}>{categorySaving ? <LoaderCircle className="spin" /> : <Plus />}</button>
                </form>
                <ul className="category-settings-list">{categories.map((category) => <li key={category.id}>
                  {editingCategoryId === category.id ? <>
                    <input value={editingCategoryName} onChange={(event) => setEditingCategoryName(event.target.value)} maxLength={60} aria-label={`Novo nome para ${category.name}`} autoFocus />
                    <button type="button" onClick={() => void renameCategory(category.id)} aria-label={t("saveName")}><Check /></button>
                    <button type="button" onClick={() => setEditingCategoryId(null)} aria-label={t("cancelEdit")}><X /></button>
                  </> : <>
                    <span>{category.name}</span>
                    <button type="button" onClick={() => { setEditingCategoryId(category.id); setEditingCategoryName(category.name); }} aria-label={t("edit", { name: category.name })}><Pencil /></button>
                    <button type="button" onClick={() => void removeCategory(category.id)} aria-label={t("remove", { name: category.name })}><Trash2 /></button>
                  </>}
                </li>)}</ul>
              </section>

              <div className="family-invite-block"><small>{t("familyInviteCode")}</small><strong>{inviteCode ?? t("unavailable")}</strong><button className="primary-button invite-copy" type="button" onClick={() => void copyInvite()} disabled={!inviteCode}><Clipboard />{copied ? t("codeCopied") : t("copyCode")}</button></div>
            </div>
          </div>}

          {purchaseItem && <div className="invite-modal-backdrop purchase-backdrop" role="presentation" onMouseDown={() => setPurchaseItem(null)}>
            <form className="purchase-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-title" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); if (parsedPurchasePrice !== null) void finishPurchase(purchasePrice); }}>
              <button className="icon-button invite-close" type="button" onClick={() => setPurchaseItem(null)} aria-label={t("cancelPurchase")}><X /></button>
              <p>{t("addPriceTitle")}</p><h2 id="purchase-title">{purchaseItem.name}</h2>
              <span className="purchase-quantity">{t("quantity")}: <strong>{quantityMultiplier(purchaseItem.quantity) === 1 ? t("oneItem") : t("manyItems", { count: quantityMultiplier(purchaseItem.quantity) })}</strong></span>
              <label className="purchase-price-field"><span>{t("unitPriceLabel")}</span><input value={purchasePrice} onChange={(event) => setPurchasePrice(event.target.value.replace(/[^\d,.]/g, "").slice(0, 15))} placeholder="R$ 0,00" inputMode="decimal" autoComplete="off" autoFocus /></label>
              {parsedPurchasePrice !== null && <div className="purchase-calculation"><span>{t("calculatedTotal")}</span><strong>{currency(parsedPurchasePrice * quantityMultiplier(purchaseItem.quantity))}</strong></div>}
              <button className="primary-button" type="submit" disabled={parsedPurchasePrice === null || busyId === purchaseItem.id}>{busyId === purchaseItem.id ? <LoaderCircle className="spin" /> : <Check />}{t("addToCart")}</button>
              <button className="secondary-button" type="button" onClick={() => void finishPurchase(null)} disabled={busyId === purchaseItem.id}>{t("markWithoutPrice")}</button>
            </form>
          </div>}

          {editItem && <div className="invite-modal-backdrop purchase-backdrop" role="presentation" onMouseDown={() => setEditItem(null)}>
            <form className="purchase-modal edit-item-modal" role="dialog" aria-modal="true" aria-labelledby="edit-item-title" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => void saveItemEdit(event)}>
              <button className="icon-button invite-close" type="button" onClick={() => setEditItem(null)} aria-label={t("cancelEdit")}><X /></button>
              <p>{t("correctInformation")}</p><h2 id="edit-item-title">{t("editProduct")}</h2>
              <label className="edit-product-field"><span>{t("productAndSize")}</span><input value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={120} autoComplete="off" autoFocus required /></label>
              <label className="edit-product-field"><span>{t("category")}</span><select value={editCategoryId} onChange={(event) => setEditCategoryId(event.target.value)}><option value="">{t("noCategory")}</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <div className="edit-quantity-field"><span>{t("quantity")}</span><div className="quantity-stepper"><button type="button" onClick={() => setEditQuantity((current) => String(Math.max(1, Number(normalizeQuantity(current)) - 1)))} aria-label={t("decreaseQuantity")}><Minus /></button><input value={editQuantity} onChange={(event) => setEditQuantity(event.target.value.replace(/\D/g, "").slice(0, 3))} onBlur={() => setEditQuantity((current) => normalizeQuantity(current))} type="text" inputMode="numeric" aria-label={t("packageQuantity")} /><button type="button" onClick={() => setEditQuantity((current) => String(Math.min(999, Number(normalizeQuantity(current)) + 1)))} aria-label={t("increaseQuantity")}><Plus /></button></div><small>{t("packagesOrUnits")}</small></div>
              <button className="primary-button" type="submit" disabled={editSaving || !editName.trim()}>{editSaving ? <LoaderCircle className="spin" /> : <Check />}{t("saveChanges")}</button>
            </form>
          </div>}

          <form className="add-form category-add-form" onSubmit={(event) => void submit(event)}>
            <label className="product-field product-autocomplete"><span>{t("whatIsMissing")}</span><input value={name} onFocus={() => setSuggestionsOpen(true)} onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)} onChange={(event) => { const nextName = event.target.value; setName(nextName); const match = productsRef.current.find((product) => normalizeProductName(product.name) === normalizeProductName(nextName)); if (match?.categoryId) setCategoryId(match.categoryId); setSuggestionsOpen(true); }} placeholder={t("productExample")} maxLength={120} autoComplete="off" required />
              {suggestionsOpen && productSuggestions.length > 0 && <div className="product-suggestions" role="listbox" aria-label={t("purchasedProducts")}>{productSuggestions.map((product) => <button key={product.id} type="button" role="option" aria-selected={normalizeProductName(product.name) === normalizeProductName(name)} onMouseDown={(event) => { event.preventDefault(); setName(product.name); if (product.categoryId) setCategoryId(product.categoryId); setSuggestionsOpen(false); }}><span>{product.name}</span><small>{product.lastUnitPrice === null ? t("noPreviousPrice") : t("lastPrice", { price: currency(product.lastUnitPrice) })}</small></button>)}</div>}
              <small className="field-hint">{t("includeSize")}</small>
            </label>
            <label className="category-field"><span>{t("category")}</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">{t("noCategory")}</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><small className="field-hint">{t("marketSection")}</small></label>
            <div className="quantity-field"><span>{t("quantity")}</span><div className="quantity-stepper"><button type="button" onClick={() => setQuantity((current) => String(Math.max(1, Number(normalizeQuantity(current)) - 1)))} aria-label={t("decreaseQuantity")}><Minus /></button><input value={quantity} onChange={(event) => setQuantity(event.target.value.replace(/\D/g, "").slice(0, 3))} onBlur={() => setQuantity((current) => normalizeQuantity(current))} type="text" inputMode="numeric" aria-label={t("packageQuantity")} /><button type="button" onClick={() => setQuantity((current) => String(Math.min(999, Number(normalizeQuantity(current)) + 1)))} aria-label={t("increaseQuantity")}><Plus /></button></div><small className="field-hint">{t("packagesOrUnits")}</small></div>
            <button className="primary-button add-button" type="submit" disabled={saving || !name.trim()}>{saving ? <LoaderCircle className="spin" /> : <Plus />}{t("add")}</button>
          </form>

          <div className="progress-block" aria-label={t("purchaseCompletedPercent", { percent: progress })}><div className="progress-labels"><span>{t("purchaseProgress")}</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div></div>
          {error && <div className="inline-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label={t("closeNotice")}><X /></button></div>}

          {loading ? <div className="loading-state"><LoaderCircle className="spin" /> {t("loadingList")}</div>
            : items.length === 0 ? <div className="empty-state"><span><CircleCheckBig /></span><h2>{t("stockedHome")}</h2><p>{t("stockedHomeDescription")}</p></div>
              : <div className="list-sections">
                <section>
                  <div className="section-heading"><h2>{t("toBuy")}</h2><span>{pending.length}</span></div>
                  {pending.length === 0 ? <div className="all-done"><Check /> {t("allPurchased")}</div>
                    : <div className="category-groups">{pendingGroups.map((group) => <section className="category-group" key={group.id}><div className="category-group-heading"><span><Tags /></span><h3>{group.name}</h3><strong>{group.items.length}</strong></div><ul className="items-list">{group.items.map((item) => <ItemRow key={item.id} item={item} language={language} busy={busyId === item.id} categoryName={null} showPriceStatus={collectPricesOnPurchase} onToggle={toggleItem} onEdit={openEdit} onRemove={removeItem} />)}</ul></section>)}</div>}
                </section>
                {completed.length > 0 && <section className="completed-section">
                  <div className="section-heading completed-heading"><div className="completed-summary"><div><h2>{t("inCart")}</h2><span>{completed.length}</span></div>{(collectPricesOnPurchase || hasCompletedPrices) && <p><strong>{completedWithoutPrice > 0 ? t("informedTotal") : t("purchaseTotal")}: {currency(completedTotal)}</strong>{completedWithoutPrice > 0 && <small>{completedWithoutPrice === 1 ? t("oneWithoutPrice") : t("manyWithoutPrice", { count: completedWithoutPrice })}</small>}</p>}</div><button className="clear-button" type="button" onClick={() => setClearOpen(true)}>{t("finishPurchase")}</button></div>
                  <ul className="items-list">{completed.map((item) => <ItemRow key={item.id} item={item} language={language} busy={busyId === item.id} categoryName={item.categoryId ? categoryMap.get(item.categoryId) ?? t("noCategory") : t("noCategory")} showPriceStatus={collectPricesOnPurchase || hasCompletedPrices} onToggle={toggleItem} onEdit={openEdit} onRemove={removeItem} />)}</ul>
                </section>}
              </div>}

          {clearOpen && <div className="invite-modal-backdrop" role="presentation" onMouseDown={() => setClearOpen(false)}><div className="clear-modal" role="alertdialog" aria-modal="true" aria-labelledby="clear-title" onMouseDown={(event) => event.stopPropagation()}><h2 id="clear-title">{t("finishPurchaseQuestion")}</h2><p>{completed.length === 1 ? t("oneArchived") : t("manyArchived", { count: completed.length })}</p>{(collectPricesOnPurchase || hasCompletedPrices) && <strong>{t("purchaseTotal")}: {currency(completedTotal)}</strong>}<small>{t("historyExplanation")}</small><div><button className="secondary-button" type="button" onClick={() => setClearOpen(false)}>{t("cancel")}</button><button className="danger-button" type="button" onClick={() => void clearCompleted()}>{t("finishPurchase")}</button></div></div></div>}
          <footer className={`app-footer ${online ? "" : "is-offline"}`}><span />{online ? (pendingChanges ? t("changesSavedPhone") : t("listSynced")) : t("listOffline")}</footer>
        </> : <PriceComparator language={language} />}
      </section>
    </main>
  );
}

function ItemRow({ item, language, busy, categoryName, showPriceStatus, onToggle, onEdit, onRemove }: { item: Item; language: AppLanguage; busy: boolean; categoryName: string | null; showPriceStatus: boolean; onToggle: (item: Item) => void; onEdit: (item: Item) => void; onRemove: (id: string) => void }) {
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) => translate(language, key, values);
  const currency = (value: number) => formatAppCurrency(value, language);
  const total = itemTotal(item);
  const currentCents = item.unitPrice === null ? null : Math.round(item.unitPrice * 100);
  const previousCents = item.previousUnitPrice === null ? null : Math.round(item.previousUnitPrice * 100);
  const priceDirection = currentCents === null || previousCents === null ? null : currentCents < previousCents ? "down" : currentCents > previousCents ? "up" : "same";
  const pricePercent = currentCents !== null && previousCents ? Math.round((Math.abs(currentCents - previousCents) / previousCents) * 100) : 0;
  const trendText = priceDirection === "down" ? t("priceDropped", { percent: pricePercent }) : priceDirection === "up" ? t("priceIncreased", { percent: pricePercent }) : priceDirection === "same" ? t("priceSame") : "";
  return <li className={`item-row ${item.completed ? "is-completed" : ""}`}>
    <button className="check-button" type="button" onClick={() => onToggle(item)} aria-label={item.completed ? t("returnToList", { name: item.name }) : t("markPurchased", { name: item.name })} disabled={busy}>{busy ? <LoaderCircle className="spin" /> : item.completed ? <Check /> : null}</button>
    <div className="item-copy"><div className="item-main-line"><div className="item-description"><span>{quantityDisplay(item.quantity)}</span><strong>{item.name}</strong></div>{item.completed && item.unitPrice !== null && total !== null && <div className="item-price" aria-label={`${currency(item.unitPrice)}; ${t("purchaseTotal")} ${currency(total)}${trendText ? `; ${trendText}` : ""}`}><span>{currency(item.unitPrice)} {t("each")}</span><div className="item-price-total"><strong>{currency(total)}</strong>{priceDirection && <em className={`price-trend is-${priceDirection}`} title={trendText} aria-label={trendText}>{priceDirection === "down" ? "▼" : priceDirection === "up" ? "▲" : "—"}{priceDirection !== "same" && pricePercent > 0 ? ` ${pricePercent}%` : ""}</em>}</div></div>}</div><small>{categoryName && <em className="item-category">{categoryName}</em>}{item.completed && item.completedBy ? t("purchasedBy", { name: firstName(item.completedBy) }) : t("addedBy", { name: firstName(item.addedBy) })}{!item.completed && item.previousUnitPrice !== null ? ` · ${t("lastShort", { price: currency(item.previousUnitPrice) })}` : ""}{item.completed && item.unitPrice !== null && item.previousUnitPrice === null ? ` · ${t("firstPrice")}` : ""}{item.completed && item.unitPrice === null && showPriceStatus ? ` · ${t("priceNotInformed")}` : ""}</small></div>
    <div className="item-actions">{!item.completed && <><button className="icon-button edit-button" type="button" onClick={() => onEdit(item)} aria-label={t("edit", { name: item.name })} disabled={busy}><Pencil /></button><button className="icon-button delete-button" type="button" onClick={() => onRemove(item.id)} aria-label={t("delete", { name: item.name })} disabled={busy}><Trash2 /></button></>}</div>
  </li>;
}
