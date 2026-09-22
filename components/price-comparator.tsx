"use client";

import { useMemo, useState } from "react";
import { Calculator, Check, RotateCcw, Trophy } from "lucide-react";
import { AppLanguage, formatCurrency, localeFor, translate } from "@/lib/i18n";

type Unit = "ml" | "l";

type Product = {
  price: string;
  volume: string;
  unit: Unit;
  amount: string;
};

type CalculatedProduct = Product & {
  index: number;
  totalMl: number;
  priceNumber: number;
  pricePerMl: number;
  pricePerLiter: number;
};

const emptyProduct = (): Product => ({
  price: "",
  volume: "",
  unit: "ml",
  amount: "1",
});

function parseNumber(value: string) {
  const clean = value.trim().replace(/\s/g, "");
  if (!clean) return 0;

  const normalized = clean.includes(",")
    ? clean.replace(/\./g, "").replace(",", ".")
    : clean;
  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function perMl(value: number, language: AppLanguage) {
  return new Intl.NumberFormat(localeFor(language), {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
}

export function PriceComparator({ language }: { language: AppLanguage }) {
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) => translate(language, key, values);
  const [count, setCount] = useState<2 | 3>(2);
  const [products, setProducts] = useState<Product[]>([
    emptyProduct(),
    emptyProduct(),
    emptyProduct(),
  ]);

  const calculated = useMemo<CalculatedProduct[]>(() => {
    return products.slice(0, count).flatMap((product, index) => {
      const priceNumber = parseNumber(product.price);
      const volumeNumber = parseNumber(product.volume);
      const amountNumber = Math.max(1, Math.floor(parseNumber(product.amount) || 1));
      const totalMl = volumeNumber * (product.unit === "l" ? 1000 : 1) * amountNumber;

      if (!priceNumber || !totalMl) return [];

      const pricePerMl = priceNumber / totalMl;
      return [{
        ...product,
        index,
        totalMl,
        priceNumber,
        pricePerMl,
        pricePerLiter: pricePerMl * 1000,
      }];
    });
  }, [count, products]);

  const ranking = useMemo(
    () => [...calculated].sort((a, b) => a.pricePerMl - b.pricePerMl),
    [calculated],
  );
  const winner = calculated.length === count ? ranking[0] : null;
  const secondBest = calculated.length === count ? ranking[1] : null;
  const savings = winner && secondBest && secondBest.pricePerMl > 0
    ? ((secondBest.pricePerMl - winner.pricePerMl) / secondBest.pricePerMl) * 100
    : 0;

  function update(index: number, field: keyof Product, value: string) {
    setProducts((current) =>
      current.map((product, position) =>
        position === index ? { ...product, [field]: value } : product,
      ),
    );
  }

  function reset() {
    setProducts([emptyProduct(), emptyProduct(), emptyProduct()]);
  }

  return (
    <section className="comparator-view" aria-labelledby="comparator-title">
      <div className="comparator-heading">
        <div className="comparator-icon"><Calculator /></div>
        <div>
          <p>{t("comparatorEyebrow")}</p>
          <h2 id="comparator-title">{t("comparePrices")}</h2>
          <span>{t("comparatorDescription")}</span>
        </div>
      </div>

      <div className="comparison-count">
        <span>{t("howManyProducts")}</span>
        <div role="group" aria-label={t("productCountLabel")}>
          <button type="button" className={count === 2 ? "active" : ""} onClick={() => setCount(2)}>
            {count === 2 && <Check />} {t("twoProducts")}
          </button>
          <button type="button" className={count === 3 ? "active" : ""} onClick={() => setCount(3)}>
            {count === 3 && <Check />} {t("threeProducts")}
          </button>
        </div>
      </div>

      <div className="product-comparison-grid">
        {products.slice(0, count).map((product, index) => {
          const result = calculated.find((entry) => entry.index === index);
          const isWinner = winner?.index === index;

          return (
            <article className={`comparison-product ${isWinner ? "winner" : ""}`} key={index}>
              <div className="product-number">
                <span>{t("productNumber", { number: index + 1 })}</span>
                {isWinner && <strong><Trophy /> {t("bestBuy")}</strong>}
              </div>

              <div className="comparison-fields">
                <label className="comparison-field-row">
                  <span>{t("totalPrice")}</span>
                  <div className="money-input">
                    <span>R$</span>
                    <input
                      value={product.price}
                      onChange={(event) => update(index, "price", event.target.value)}
                      placeholder="0,00"
                      inputMode="decimal"
                      aria-label={t("productTotalPrice", { number: index + 1 })}
                    />
                  </div>
                </label>

                <label className="comparison-field-row">
                  <span>{t("quantity")}</span>
                  <div className="volume-input">
                    <input
                      value={product.volume}
                      onChange={(event) => update(index, "volume", event.target.value)}
                      placeholder="0"
                      inputMode="decimal"
                      aria-label={t("productVolume", { number: index + 1 })}
                    />
                    <select
                      value={product.unit}
                      onChange={(event) => update(index, "unit", event.target.value as Unit)}
                      aria-label={t("volumeUnit", { number: index + 1 })}
                    >
                      <option value="ml">mL</option>
                      <option value="l">{t("liters")}</option>
                    </select>
                  </div>
                </label>

                <label className="comparison-field-row">
                  <span>{t("unitsInPackage")}</span>
                  <input
                    value={product.amount}
                    onChange={(event) => update(index, "amount", event.target.value.replace(/\D/g, "").slice(0, 3))}
                    placeholder="1"
                    inputMode="numeric"
                    aria-label={t("productUnits", { number: index + 1 })}
                  />
                </label>
              </div>

              <div className="product-result">
                {result ? (
                  <>
                    <div><span>{t("pricePerLiter")}</span><strong>{formatCurrency(result.pricePerLiter, language)}</strong></div>
                    <div><span>{t("pricePerMl")}</span><strong>{perMl(result.pricePerMl, language)}</strong></div>
                    <small>{t("comparedVolume", { volume: result.totalMl.toLocaleString(localeFor(language)) })}</small>
                  </>
                ) : (
                  <p>{t("fillComparator")}</p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {winner && secondBest && (
        <div className="comparison-winner" aria-live="polite">
          <span><Trophy /></span>
          <div>
            <p>{t("bestValue")}</p>
            <h3>{t("productNumber", { number: winner.index + 1 })}</h3>
            <strong>
              {savings > 0.01
                ? t("cheaperThanNext", { percent: savings.toLocaleString(localeFor(language), { maximumFractionDigits: 1 }) })
                : t("almostSamePrice")}
            </strong>
          </div>
        </div>
      )}

      <button className="reset-comparison" type="button" onClick={reset}>
        <RotateCcw /> {t("clearComparison")}
      </button>
    </section>
  );
}
