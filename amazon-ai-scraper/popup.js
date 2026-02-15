(function () {
  "use strict";

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
  var preview = document.getElementById("preview");
  var copyBtn = document.getElementById("copyBtn");
  var reExtractBtn = document.getElementById("reExtractBtn");
  var errorMessage = document.getElementById("errorMessage");
  var tryAgainBtn = document.getElementById("tryAgainBtn");

  /**
   * Affiche un état de l'UI (idle | loading | success | error).
   * Masque tous les blocs puis affiche celui correspondant et met à jour le header.
   * @param {string} state - 'idle' | 'loading' | 'success' | 'error'
   * @param {object} options - { errorText: string } pour state === 'error', { markdown: string } pour state === 'success'
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
      if (options.markdown != null) {
        preview.textContent = options.markdown;
      }
    } else if (state === "error") {
      blockError.classList.remove("hidden");
      statusIndicator.textContent = "❌";
      errorMessage.textContent = options.errorText || "Une erreur s'est produite.";
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
        reject(new Error("Timeout: impossible de contacter la page"));
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
        if (response && response.success && response.markdown) {
          showState("success", { markdown: response.markdown });
        } else {
          showState("error", {
            errorText: (response && response.error) ? response.error : "Extraction failed."
          });
        }
      })
      .catch(function (err) {
        var msg = (err && err.message) ? err.message : "Failed to extract data.";
        showState("error", { errorText: msg });
      });
  }

  /**
   * Clic sur "Copy Markdown" : copie du preview dans le presse-papier, feedback 2 s.
   */
  function onCopyClick() {
    var text = preview.textContent;
    if (!text) return;

    navigator.clipboard
      .writeText(text)
      .then(function () {
        var originalLabel = copyBtn.textContent;
        copyBtn.textContent = "✅ Copied!";
        copyBtn.disabled = true;
        window.setTimeout(function () {
          copyBtn.textContent = originalLabel;
          copyBtn.disabled = false;
        }, COPY_FEEDBACK_MS);
      })
      .catch(function () {
        showState("error", { errorText: "Could not copy to clipboard." });
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
