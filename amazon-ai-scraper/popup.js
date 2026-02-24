(function () {
  "use strict";

  /* ----- i18n : charge les traductions au chargement ----- */
  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    var key = el.getAttribute("data-i18n");
    var msg = chrome.i18n.getMessage(key);
    if (msg) {
      var prefix = el.getAttribute("data-i18n-prefix") || "";
      el.textContent = prefix + msg;
    }
  });
  document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
    var key = el.getAttribute("data-i18n-title");
    var msg = chrome.i18n.getMessage(key);
    if (msg) el.setAttribute("title", msg);
  });
  var titleEl = document.querySelector("title[data-i18n]");
  if (titleEl) {
    var titleMsg = chrome.i18n.getMessage(titleEl.getAttribute("data-i18n"));
    if (titleMsg) document.title = titleMsg;
  }

  /* ----- Constantes ----- */
  var RESPONSE_TIMEOUT_MS = 5000;
  var COPY_FEEDBACK_MS = 2000;

  /* ----- Éléments DOM ----- */
  var statusIndicator = document.getElementById("statusIndicator");
  var blockIdle = document.getElementById("block-idle");
  var blockLoading = document.getElementById("block-loading");
  var blockSuccess = document.getElementById("block-success");
  var blockError = document.getElementById("block-error");
  var extractBtn = document.getElementById("extractBtn");
  var jsonPreview = document.getElementById("jsonPreview");
  var copyBtn = document.getElementById("copyBtn");
  var reExtractBtn = document.getElementById("reExtractBtn");
  var errorMessage = document.getElementById("errorMessage");
  var tryAgainBtn = document.getElementById("tryAgainBtn");

  /** Dernier JSON produit (pour copie clipboard). */
  var currentProductJson = null;

  /**
   * Affiche un état de l'UI (idle | loading | success | error).
   * Masque tous les blocs puis affiche celui correspondant et met à jour le header.
   * @param {string} state - 'idle' | 'loading' | 'success' | 'error'
   * @param {object} options - { errorText: string } pour state === 'error', { json: object } pour state === 'success'
   */
  function showState(state, options) {
    options = options || {};
    var blocks = [blockIdle, blockLoading, blockSuccess, blockError];
    blocks.forEach(function (block) {
      block.classList.add("hidden");
    });

    statusIndicator.className = "status-indicator";
    statusIndicator.textContent = "";

    if (state === "idle") {
      blockIdle.classList.remove("hidden");
    } else if (state === "loading") {
      blockLoading.classList.remove("hidden");
      statusIndicator.className = "status-indicator status-loading";
    } else if (state === "success") {
      blockSuccess.classList.remove("hidden");
      statusIndicator.textContent = "✅";
      if (options.json != null) {
        currentProductJson = options.json;
        jsonPreview.textContent = JSON.stringify(options.json, null, 2);
      }
    } else if (state === "error") {
      blockError.classList.remove("hidden");
      statusIndicator.textContent = "❌";
      errorMessage.textContent = options.errorText || chrome.i18n.getMessage("errorDefault");
    }
  }

  /**
   * Récupère l'onglet actif et envoie { action: "extractData" } au content script.
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
        var tab = tabs[0];
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
   * Appel extraction avec timeout (5 s).
   * En cas de timeout : reject avec message "Timeout: impossible de contacter la page".
   */
  function extractWithTimeout() {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        reject(new Error(chrome.i18n.getMessage("errorTimeout")));
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
   * Clic sur "Extract Product Data" : passage en loading puis envoi du message.
   */
  function onExtractClick() {
    showState("loading");
    extractWithTimeout()
      .then(function (response) {
        if (response && response.success && response.json) {
          showState("success", { json: response.json });
        } else {
          showState("error", {
            errorText: (response && response.error) ? response.error : chrome.i18n.getMessage("errorExtractionFailed")
          });
        }
      })
      .catch(function (err) {
        var msg = (err && err.message) ? err.message : chrome.i18n.getMessage("errorExtractionFailed");
        showState("error", { errorText: msg });
      });
  }

  /**
   * Clic sur "Copy JSON" : copie le JSON pretty-printed dans le presse-papier.
   */
  function onCopyClick() {
    if (!currentProductJson) return;

    var jsonString = JSON.stringify(currentProductJson, null, 2);
    navigator.clipboard
      .writeText(jsonString)
      .then(function () {
        copyBtn.textContent = "✅ " + chrome.i18n.getMessage("copiedButton");
        copyBtn.disabled = true;
        window.setTimeout(function () {
          copyBtn.textContent = "📋 " + chrome.i18n.getMessage("copyButton");
          copyBtn.disabled = false;
        }, COPY_FEEDBACK_MS);
      })
      .catch(function () {
        copyBtn.textContent = "❌ Error";
        window.setTimeout(function () {
          copyBtn.textContent = "📋 " + chrome.i18n.getMessage("copyButton");
        }, 2000);
        showState("error", { errorText: chrome.i18n.getMessage("errorCopyFailed") });
      });
  }

  /**
   * Clic sur "Try Again" ou "🔄" (Re-extract) : retour à l'état idle.
   */
  function onResetClick() {
    showState("idle");
  }

  /* ----- Init : état idle au chargement ----- */
  showState("idle");

  /* ----- Event listeners ----- */
  extractBtn.addEventListener("click", onExtractClick);
  copyBtn.addEventListener("click", onCopyClick);
  reExtractBtn.addEventListener("click", onResetClick);
  tryAgainBtn.addEventListener("click", onResetClick);
})();
