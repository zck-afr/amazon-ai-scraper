(function () {
  "use strict";

  /**
   * Vérifie si l’URL courante est une page produit Amazon (/dp/).
   */
  function isProductPage() {
    return typeof window !== "undefined" && window.location && window.location.href && window.location.href.indexOf("/dp/") !== -1;
  }

  /**
   * Récupère le texte d’un élément ou une valeur par défaut.
   */
  function getText(selector, defaultVal) {
    try {
      var el = document.querySelector(selector);
      if (el) {
        var text = (el.textContent || el.innerText || "").trim();
        if (text) return text;
      }
    } catch (e) {}
    return defaultVal;
  }

  /**
   * Récupère l’attribut d’un élément.
   */
  function getAttr(selector, attr, defaultVal) {
    try {
      var el = document.querySelector(selector);
      if (el && el.getAttribute(attr)) return el.getAttribute(attr).trim();
    } catch (e) {}
    return defaultVal;
  }

  /**
   * Récupère le premier élément dont le texte matche un pattern.
   */
  function getByTextContent(selector, pattern, defaultVal) {
    try {
      var nodes = document.querySelectorAll(selector);
      for (var i = 0; i < nodes.length; i++) {
        var text = (nodes[i].textContent || nodes[i].innerText || "").trim();
        if (pattern.test(text)) return text;
      }
    } catch (e) {}
    return defaultVal;
  }

  /**
   * Extraction du titre avec fallbacks.
   */
  function extractTitle() {
    return getText("#productTitle", null) ||
      getText(".product-title-word-break", null) ||
      (function () {
        try {
          var h1 = document.querySelector("h1");
          if (h1) {
            var span = h1.querySelector("span");
            if (span) {
              var t = (span.textContent || span.innerText || "").trim();
              if (t) return t;
            }
            var t = (h1.textContent || h1.innerText || "").trim();
            if (t) return t;
          }
        } catch (e) {}
        return null;
      })() ||
      "Title not found";
  }

  /**
   * Extraction du prix avec fallbacks.
   */
  function extractPrice() {
    var whole = getText(".a-price-whole", null);
    if (whole) {
      var fraction = getText(".a-price-fraction", "");
      var symbol = getText(".a-price-symbol", "€");
      return whole + (fraction ? "," + fraction : "") + " " + symbol;
    }
    return getText("#priceblock_ourprice", null) ||
      getText(".a-price .a-offscreen", null) ||
      (function () {
        try {
          var off = document.querySelector(".a-price .a-offscreen");
          if (off) return (off.textContent || off.innerText || "").trim();
        } catch (e) {}
        return null;
      })() ||
      "Price not available";
  }

  /**
   * Extraction de l’URL de l’image avec fallbacks.
   */
  function extractImage() {
    var src = getAttr("#landingImage", "src", null);
    if (src) return src;
    try {
      var img = document.querySelector(".imgTagWrapper img");
      if (img && img.getAttribute("src")) return img.getAttribute("src").trim();
    } catch (e) {}
    try {
      var block = document.querySelector("#imageBlock img");
      if (block && block.getAttribute("src")) return block.getAttribute("src").trim();
    } catch (e) {}
    return "";
  }

  /**
   * Extraction de la note avec fallbacks.
   */
  function extractRating() {
    var alt = getByTextContent(".a-icon-alt", /sur\s*5|out of 5/i, null);
    if (alt) return alt;
    var title = getAttr("#acrPopover", "title", null);
    if (title) return title.trim();
    return "No rating";
  }

  /**
   * Extraction du nombre d’avis avec fallbacks.
   */
  function extractReviewCount() {
    var text = getText("#acrCustomerReviewText", null);
    if (text) return text.trim();
    return getByTextContent(".a-size-base", /évaluations|avis|review/i, null) ||
      "No reviews";
  }

  /**
   * Extrait les données produit Amazon (avec fallbacks).
   * @returns {{ title: string, price: string, image: string, rating: string, reviewCount: string, url: string }}
   */
  function extractAmazonData() {
    return {
      title: extractTitle(),
      price: extractPrice(),
      image: extractImage(),
      rating: extractRating(),
      reviewCount: extractReviewCount(),
      url: window.location.href || ""
    };
  }

  /**
   * Génère le Markdown optimisé LLM à partir des données extraites.
   */
  function generateMarkdown(data) {
    var dateStr = new Date().toISOString().slice(0, 10);
    return [
      "# " + (data.title || "Product"),
      "",
      "## 📊 Informations",
      "- **Prix** : " + (data.price || "—"),
      "- **Note** : " + (data.rating || "—") + " (" + (data.reviewCount || "—") + ")",
      "",
      (data.image ? "![Product Image](" + data.image + ")" : ""),
      "",
      "---",
      "**Source** : " + (data.url || ""),
      "**Extracted** : " + dateStr
    ].join("\n");
  }

  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request && request.action === "extractData") {
      try {
        if (!isProductPage()) {
          sendResponse({ success: false, error: "Not on Amazon product page. Open a product URL containing /dp/." });
          return true;
        }
        var data = extractAmazonData();
        var markdown = generateMarkdown(data);
        sendResponse({ success: true, markdown: markdown });
      } catch (err) {
        sendResponse({ success: false, error: "Failed to extract data." });
      }
      return true;
    }
  });
})();
