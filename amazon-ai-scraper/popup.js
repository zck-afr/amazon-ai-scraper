(function () {
  "use strict";

  const EXTRACT_BTN_ID = "extractBtn";
  const PREVIEW_ID = "preview";
  const COPY_BTN_ID = "copyBtn";
  const MESSAGE_ID = "message";
  const RESPONSE_TIMEOUT_MS = 5000;

  const extractBtn = document.getElementById(EXTRACT_BTN_ID);
  const preview = document.getElementById(PREVIEW_ID);
  const copyBtn = document.getElementById(COPY_BTN_ID);
  const messageEl = document.getElementById(MESSAGE_ID);

  /**
   * Affiche un message dans la zone message (info, succès ou erreur).
   */
  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = "message " + (type || "info");
  }

  /**
   * Réinitialise l’UI (message, preview, bouton copy).
   */
  function resetUI() {
    messageEl.textContent = "";
    messageEl.className = "message";
    preview.textContent = "";
    preview.classList.remove("visible");
    copyBtn.hidden = true;
  }

  /**
   * Récupère l’onglet actif et envoie un message au content script.
   */
  function getTabAndSendMessage() {
    return new Promise(function (resolve, reject) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!tabs || !tabs[0]) {
          reject(new Error("No active tab"));
          return;
        }
        const tab = tabs[0];
        chrome.tabs.sendMessage(tab.id, { action: "extractData" }, function (response) {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        });
      });
    });
  }

  /**
   * Timeout wrapper pour l’appel au content script.
   */
  function extractWithTimeout() {
    return new Promise(function (resolve, reject) {
      const timer = setTimeout(function () {
        reject(new Error("No response from page. Open an Amazon product page (URL with /dp/) and try again."));
      }, RESPONSE_TIMEOUT_MS);

      getTabAndSendMessage()
        .then(function (response) {
          clearTimeout(timer);
          resolve(response);
        })
        .catch(function (err) {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  /**
   * Clic sur "Extract Product Data".
   */
  function onExtractClick() {
    resetUI();
    extractBtn.disabled = true;
    showMessage("Extracting...", "info");

    extractWithTimeout()
      .then(function (response) {
        if (response && response.success && response.markdown) {
          preview.textContent = response.markdown;
          preview.classList.add("visible");
          copyBtn.hidden = false;
          showMessage("", "");
        } else {
          showMessage(response && response.error ? response.error : "Extraction failed.", "error");
        }
      })
      .catch(function (err) {
        const msg = err && err.message ? err.message : "Failed to extract data.";
        showMessage(msg, "error");
      })
      .finally(function () {
        extractBtn.disabled = false;
      });
  }

  /**
   * Clic sur "Copy to Clipboard".
   */
  function onCopyClick() {
    const text = preview.textContent;
    if (!text) return;

    navigator.clipboard
      .writeText(text)
      .then(function () {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = "✓ Copied!";
        copyBtn.disabled = true;
        window.setTimeout(function () {
          copyBtn.textContent = originalText;
          copyBtn.disabled = false;
        }, 2000);
      })
      .catch(function () {
        showMessage("Could not copy to clipboard.", "error");
      });
  }

  extractBtn.addEventListener("click", onExtractClick);
  copyBtn.addEventListener("click", onCopyClick);
})();
