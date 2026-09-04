"use client";

import { useEffect, useState } from "react";
import { ShoppingBasket } from "lucide-react";

const SPLASH_VISIBLE_MS = 700;
const SPLASH_REMOVE_MS = 980;

export function AppSplash() {
  const [leaving, setLeaving] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    document.body.classList.add("splash-active");

    const leaveTimer = window.setTimeout(() => setLeaving(true), SPLASH_VISIBLE_MS);
    const removeTimer = window.setTimeout(() => setVisible(false), SPLASH_REMOVE_MS);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(removeTimer);
      document.body.classList.remove("splash-active");
    };
  }, []);

  useEffect(() => {
    if (!visible) document.body.classList.remove("splash-active");
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className={`app-splash${leaving ? " app-splash-leaving" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Abrindo Lista de Casa"
    >
      <div className="app-splash-content">
        <span className="app-splash-mark" aria-hidden="true">
          <ShoppingBasket />
        </span>
        <strong>Lista de Casa</strong>
      </div>
    </div>
  );
}
