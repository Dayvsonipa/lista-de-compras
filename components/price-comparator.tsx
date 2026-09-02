"use client";

import { useMemo, useState } from "react";
import { Calculator, Check, RotateCcw, Trophy } from "lucide-react";

type Unit = "ml" | "l";

type Product = {
  name: string;
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
  name: "",
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

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function perMl(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
}

export function PriceComparator() {
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
          <p>Economize no supermercado</p>
          <h2 id="comparator-title">Comparar preços</h2>
          <span>Descubra qual embalagem tem o menor preço por mililitro.</span>
        </div>
      </div>

      <div className="comparison-count">
        <span>Quantos produtos deseja comparar?</span>
        <div role="group" aria-label="Quantidade de produtos">
          <button type="button" className={count === 2 ? "active" : ""} onClick={() => setCount(2)}>
            {count === 2 && <Check />} 2 produtos
          </button>
          <button type="button" className={count === 3 ? "active" : ""} onClick={() => setCount(3)}>
            {count === 3 && <Check />} 3 produtos
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
                <span>Produto {index + 1}</span>
                {isWinner && <strong><Trophy /> Melhor compra</strong>}
              </div>

              <label>
                <span>Nome do produto</span>
                <input
                  value={product.name}
                  onChange={(event) => update(index, "name", event.target.value)}
                  placeholder={index === 0 ? "Ex.: Coca-Cola 2 L" : "Ex.: Coca-Cola lata"}
                  maxLength={80}
                />
              </label>

              <div className="comparison-fields">
                <label>
                  <span>Preço total</span>
                  <div className="money-input">
                    <span>R$</span>
                    <input
                      value={product.price}
                      onChange={(event) => update(index, "price", event.target.value)}
                      placeholder="0,00"
                      inputMode="decimal"
                      aria-label={`Preço total do produto ${index + 1}`}
                    />
                  </div>
                </label>

                <label>
                  <span>Volume por unidade</span>
                  <div className="volume-input">
                    <input
                      value={product.volume}
                      onChange={(event) => update(index, "volume", event.target.value)}
                      placeholder="0"
                      inputMode="decimal"
                      aria-label={`Volume do produto ${index + 1}`}
                    />
                    <select
                      value={product.unit}
                      onChange={(event) => update(index, "unit", event.target.value as Unit)}
                      aria-label={`Unidade de volume do produto ${index + 1}`}
                    >
                      <option value="ml">mL</option>
                      <option value="l">Litros</option>
                    </select>
                  </div>
                </label>

                <label>
                  <span>Unidades no pacote</span>
                  <input
                    value={product.amount}
                    onChange={(event) => update(index, "amount", event.target.value.replace(/\D/g, "").slice(0, 3))}
                    placeholder="1"
                    inputMode="numeric"
                    aria-label={`Quantidade de unidades do produto ${index + 1}`}
                  />
                </label>
              </div>

              <div className="product-result">
                {result ? (
                  <>
                    <div><span>Preço por litro</span><strong>{currency(result.pricePerLiter)}</strong></div>
                    <div><span>Preço por mL</span><strong>{perMl(result.pricePerMl)}</strong></div>
                    <small>Volume total comparado: {result.totalMl.toLocaleString("pt-BR")} mL</small>
                  </>
                ) : (
                  <p>Preencha o preço e o volume para calcular.</p>
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
            <p>Melhor custo-benefício</p>
            <h3>{winner.name.trim() || `Produto ${winner.index + 1}`}</h3>
            <strong>
              {savings > 0.01
                ? `${savings.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% mais barato por mL que a próxima opção.`
                : "Os produtos têm praticamente o mesmo preço por mL."}
            </strong>
          </div>
        </div>
      )}

      <button className="reset-comparison" type="button" onClick={reset}>
        <RotateCcw /> Limpar comparação
      </button>
    </section>
  );
}
