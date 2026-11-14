"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/flow-icons";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function InstallAppButton({ language }: { language: "en" | "ar" }) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const ar = language === "ar";

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(standalone);
    setIsIOS(/iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.warn("FLOW service worker registration failed", error);
      });
    }

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setShowGuide(false);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const install = async () => {
    if (installed) return;
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setInstallPrompt(null);
      return;
    }
    setShowGuide((value) => !value);
  };

  const label = installed ? (ar ? "مثبّت" : "Installed") : (ar ? "تثبيت التطبيق" : "Install app");
  const title = isIOS
    ? (ar ? "تثبيت على iPhone أو iPad" : "Install on iPhone or iPad")
    : (ar ? "تثبيت FLOW على جهازك" : "Install FLOW on your device");
  const instructions = isIOS
    ? (ar
      ? "افتح FLOW في متصفح Safari، واضغط زر المشاركة (المربع والسهم)، ثم اختر Add to Home Screen واضغط Add."
      : "Open FLOW in Safari, tap the Share button, choose Add to Home Screen, then tap Add.")
    : (ar
      ? "من قائمة المتصفح ⋮ اختر Install app أو Add to Home screen. على Chrome قد يظهر زر التثبيت مباشرة."
      : "Open your browser menu ⋮ and choose Install app or Add to Home screen. Chrome may also show an install icon in the address bar.");

  return (
    <div className="install-app-control">
      <button type="button" className="install-app-button" onClick={() => void install()} aria-expanded={showGuide} aria-label={label}>
        <Icon name={installed ? "check" : "download"} size={14} />
        {label}
      </button>
      {showGuide && !installed && (
        <div className="install-app-guide" dir={ar ? "rtl" : "ltr"} role="dialog" aria-label={title}>
          <strong>{title}</strong>
          <p>{instructions}</p>
          <button type="button" onClick={() => setShowGuide(false)}>{ar ? "إغلاق" : "Got it"}</button>
        </div>
      )}
    </div>
  );
}
