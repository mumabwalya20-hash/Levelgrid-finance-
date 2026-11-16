"use client";

import { useEffect, useState } from "react";

type OfflineStatus = "preparing" | "ready" | "unavailable" | "development";

export function useAppStatus() {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [offlineStatus, setOfflineStatus] = useState<OfflineStatus>("preparing");

  useEffect(() => {
    const syncConnection = () => setIsOnline(navigator.onLine);
    syncConnection();
    window.addEventListener("online", syncConnection);
    window.addEventListener("offline", syncConnection);
    return () => {
      window.removeEventListener("online", syncConnection);
      window.removeEventListener("offline", syncConnection);
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      setOfflineStatus("development");
      return;
    }

    if (!("serviceWorker" in navigator)) {
      setOfflineStatus("unavailable");
      return;
    }

    const serviceWorkers = navigator.serviceWorker;
    let installing: ServiceWorker | null = null;
    let disposed = false;

    function updateStatus() {
      if (disposed) return;
      if (serviceWorkers.controller) {
        setOfflineStatus("ready");
      } else if (installing?.state === "redundant") {
        setOfflineStatus("unavailable");
      }
    }

    async function register() {
      updateStatus();
      try {
        const registration = await serviceWorkers.register("/sw.js", {
          updateViaCache: "none",
        });
        if (disposed) return;
        installing?.removeEventListener("statechange", updateStatus);
        installing = registration.installing;
        installing?.addEventListener("statechange", updateStatus);
        updateStatus();
      } catch {
        if (!disposed && !serviceWorkers.controller) setOfflineStatus("unavailable");
      }
    }

    serviceWorkers.addEventListener("controllerchange", updateStatus);
    window.addEventListener("online", register);
    void register();

    return () => {
      disposed = true;
      installing?.removeEventListener("statechange", updateStatus);
      serviceWorkers.removeEventListener("controllerchange", updateStatus);
      window.removeEventListener("online", register);
    };
  }, []);

  return { isOnline, offlineStatus };
}
