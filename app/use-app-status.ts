"use client";

import { useEffect, useState } from "react";

type OfflineStatus = "preparing" | "ready" | "unavailable" | "development";

export function useAppStatus() {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [offlineStatus, setOfflineStatus] = useState<OfflineStatus>("preparing");
  const [updateReady, setUpdateReady] = useState(false);

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
    let registration: ServiceWorkerRegistration | undefined;
    let installing: ServiceWorker | null = null;
    let controller = serviceWorkers.controller;
    let updateCheck: Promise<void> | undefined;
    let disposed = false;

    function updateStatus() {
      if (disposed) return;
      if (serviceWorkers.controller) {
        setOfflineStatus("ready");
      } else if (installing?.state === "redundant") {
        setOfflineStatus("unavailable");
      }
    }

    function controllerChanged() {
      const current = serviceWorkers.controller;
      if (controller && current && current !== controller) setUpdateReady(true);
      controller = current;
      updateStatus();
    }

    function watchInstall() {
      installing?.removeEventListener("statechange", updateStatus);
      installing = registration?.installing ?? null;
      installing?.addEventListener("statechange", updateStatus);
      updateStatus();
    }

    async function registerOrUpdate() {
      try {
        if (!registration) {
          const registered = await serviceWorkers.register("/sw.js", { updateViaCache: "none" });
          if (disposed) return;
          registration = registered;
          registration.addEventListener("updatefound", watchInstall);
          watchInstall();
        }
        if (navigator.onLine && registration.active) await registration.update();
      } catch {
        if (!disposed && !serviceWorkers.controller) setOfflineStatus("unavailable");
      }
    }

    function checkForUpdate() {
      if (disposed || updateCheck) return;
      updateCheck = registerOrUpdate().finally(() => { updateCheck = undefined; });
    }

    function onVisibility() {
      if (document.visibilityState === "visible" && navigator.onLine) checkForUpdate();
    }

    serviceWorkers.addEventListener("controllerchange", controllerChanged);
    window.addEventListener("online", checkForUpdate);
    document.addEventListener("visibilitychange", onVisibility);
    updateStatus();
    checkForUpdate();

    return () => {
      disposed = true;
      installing?.removeEventListener("statechange", updateStatus);
      registration?.removeEventListener("updatefound", watchInstall);
      serviceWorkers.removeEventListener("controllerchange", controllerChanged);
      window.removeEventListener("online", checkForUpdate);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return { isOnline, offlineStatus, updateReady };
}
