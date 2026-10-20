(() => {
  "use strict";
  const status = document.getElementById("offlineStatus");
  const installButton = document.getElementById("installApp");
  let installPrompt;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });
  installButton.addEventListener("click", async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    installButton.hidden = true;
    await prompt.prompt();
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installButton.hidden = true;
  });

  if (!window.isSecureContext || !("serviceWorker" in navigator)) {
    status.textContent = "Для установки и офлайн-запуска откройте игру по HTTPS в Chrome или Safari.";
    return;
  }

  let cacheReady = false;
  function showStatus() {
    status.textContent = cacheReady
      ? (navigator.onLine ? "Готово к игре без интернета" : "Без интернета — всё готово к игре")
      : "Не удалось сохранить игру. Подключитесь к сети и откройте её снова.";
  }

  // Ask the worker to verify every resource, rather than trust navigator.onLine.
  async function checkOfflineReady() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const worker = navigator.serviceWorker.controller || registration.active;
      cacheReady = await new Promise((resolve) => {
        const channel = new MessageChannel();
        const timer = setTimeout(() => { channel.port1.close(); resolve(false); }, 10000);
        channel.port1.onmessage = (event) => {
          clearTimeout(timer);
          channel.port1.close();
          resolve(event.data?.offlineReady === true);
        };
        worker.postMessage({ type: "CHECK_OFFLINE_READY" }, [channel.port2]);
      });
      if (cacheReady) {
        // A request can be denied; offline play must not depend on this hint.
        navigator.storage?.persist?.().catch(() => {});
      }
    } catch {
      cacheReady = false;
    }
    showStatus();
  }

  navigator.serviceWorker.addEventListener("controllerchange", checkOfflineReady);
  window.addEventListener("online", checkOfflineReady);
  window.addEventListener("offline", showStatus);
  navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" })
    .then(async (registration) => {
      const installing = registration.installing;
      if (installing) {
        installing.addEventListener("statechange", () => {
          if (installing.state === "redundant") {
            if (registration.active) checkOfflineReady();
            else status.textContent = "Не удалось сохранить игру. Подключитесь к сети и откройте её снова.";
          }
        });
      }
      await checkOfflineReady();
    })
    .catch(() => {
      cacheReady = false;
      showStatus();
    });
})();
