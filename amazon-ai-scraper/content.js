(function () {
  "use strict";

  /**
   * Vérifie si l'URL courante est une page produit Amazon (/dp/).
   */
  function isProductPage() {
    return typeof window !== "undefined" && window.location && window.location.href && window.location.href.indexOf("/dp/") !== -1;
  }

  /**
   * Récupère le texte d'un élément ou une valeur par défaut.
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
   * Récupère l'attribut d'un élément.
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
    var price;
    var whole = getText(".a-price-whole", null);
    if (whole) {
      var fraction = getText(".a-price-fraction", "");
      var symbol = getText(".a-price-symbol", "€");
      price = whole + (fraction ? "," + fraction : "") + " " + symbol;
    } else {
      price = getText("#priceblock_ourprice", null) ||
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
    return price.replace(/,+/g, ",").replace(/\s+/g, " ").trim();
  }

  /**
   * Extraction de l'URL de l'image avec fallbacks.
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
   * Format final : "4,7/5" (nombre avant "sur" + "/5").
   */
  function extractRating() {
    var raw = getByTextContent(".a-icon-alt", /sur\s*5|out of 5/i, null) ||
      getAttr("#acrPopover", "title", null) || "";
    raw = (raw || "").trim();
    if (!raw) return "No rating";
    var match = raw.match(/^([\d,\.]+)\s*(?:sur|out of)/i);
    if (match && match[1]) return match[1].trim() + "/5";
    return raw;
  }

  /**
   * Extraction du nombre d'avis avec fallbacks.
   * Format final : "1 252 avis" (sans parenthèses doubles).
   */
  function extractReviewCount() {
    var text = getText("#acrCustomerReviewText", null);
    if (!text) text = getByTextContent(".a-size-base", /évaluations|avis|review/i, null);
    if (!text) return "No reviews";
    text = text.trim().replace(/\s*\(+/g, " ").replace(/\s*\)+/g, " ").replace(/\s+/g, " ").trim();
    var match = text.match(/([\d\s]+)/);
    var num = match ? match[1].replace(/\s+/g, " ").trim() : text;
    var reviewCount = num ? num + " avis" : "No reviews";
    reviewCount = reviewCount.replace(/avis avis/gi, "avis").trim();
    return reviewCount;
  }

  /**
   * Extrait les 5 premières spécifications techniques (tableau key/value).
   * Sélecteurs : #productDetails_techSpec_section_1, #detailBullets_feature_div, .a-keyvalue.prodDetTable
   * @returns {{ key: string, value: string }[]}
   */
  function extractTechSpecs() {
    var specs = [];
    var maxSpecs = 5;

    function parseRowCells(rows) {
      for (var r = 0; r < rows.length && specs.length < maxSpecs; r++) {
        try {
          var cells = rows[r].querySelectorAll("th, td");
          if (cells.length >= 2) {
            var key = (cells[0].textContent || cells[0].innerText || "").trim();
            var value = (cells[1].textContent || cells[1].innerText || "").trim();
            if (key && value) specs.push({ key: key.replace(/\s*:\s*$/, ""), value: value });
          }
        } catch (e) {}
      }
    }

    function parseBulletList(container) {
      try {
        var items = container.querySelectorAll("li span.a-list-item");
        for (var i = 0; i < items.length && specs.length < maxSpecs; i++) {
          var text = (items[i].textContent || items[i].innerText || "").trim();
          var idx = text.indexOf(":");
          if (idx > 0) {
            var key = text.slice(0, idx).trim();
            var value = text.slice(idx + 1).trim();
            if (key && value) specs.push({ key: key, value: value });
          }
        }
      } catch (e) {}
    }

    try {
      // 1. Tableau #productDetails_techSpec_section_1
      var section1 = document.querySelector("#productDetails_techSpec_section_1");
      if (section1) {
        var rows1 = section1.querySelectorAll("tr");
        if (rows1 && rows1.length) {
          parseRowCells(rows1);
          if (specs.length > 0) return specs.slice(0, maxSpecs);
        }
      }
    } catch (e) {}

    try {
      // 2. Liste #detailBullets_feature_div
      var bullets = document.querySelector("#detailBullets_feature_div");
      if (bullets) {
        parseBulletList(bullets);
        if (specs.length > 0) return specs.slice(0, maxSpecs);
      }
    } catch (e) {}

    try {
      // 3. Tableau .a-keyvalue.prodDetTable
      var table = document.querySelector(".a-keyvalue.prodDetTable");
      if (table) {
        var rows3 = table.querySelectorAll("tr");
        if (rows3 && rows3.length) parseRowCells(rows3);
      }
    } catch (e) {}

    return specs.slice(0, maxSpecs);
  }

  /**
   * Extrait les 3 premiers avis (100 premiers caractères chacun).
   * Sélecteurs : [data-hook="review-body"], .review-text-content span, [data-hook="genome-widget"]
   * @returns string[]
   */
  function extractReviews() {
    var reviews = [];
    var maxReviews = 3;
    var maxChars = 100;

    function collectFromSelector(selector) {
      try {
        var nodes = document.querySelectorAll(selector);
        for (var i = 0; i < nodes.length && reviews.length < maxReviews; i++) {
          var text = (nodes[i].textContent || nodes[i].innerText || "").trim();
          if (text.length > 0) {
            var excerpt = text.length <= maxChars ? text : text.slice(0, maxChars) + "...";
            reviews.push(excerpt);
          }
        }
      } catch (e) {}
    }

    try {
      collectFromSelector('[data-hook="review-body"]');
      if (reviews.length >= maxReviews) return reviews.slice(0, maxReviews);
    } catch (e) {}

    try {
      collectFromSelector(".review-text-content span");
      if (reviews.length >= maxReviews) return reviews.slice(0, maxReviews);
    } catch (e) {}

    try {
      collectFromSelector('[data-hook="genome-widget"]');
    } catch (e) {}

    return reviews.slice(0, maxReviews);
  }

  /**
   * Extrait les données produit Amazon (avec fallbacks).
   * @returns {{ title, price, image, rating, reviewCount, url, specs, reviews }}
   */
  function extractAmazonData() {
    var specs = [];
    var reviews = [];
    try {
      specs = extractTechSpecs();
    } catch (e) {
      specs = [];
    }
    try {
      reviews = extractReviews();
    } catch (e) {
      reviews = [];
    }

    var url = window.location.href || "";
    var asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
    if (asinMatch && asinMatch[1]) {
      var origin = window.location.origin || "https://www.amazon.fr";
      url = origin + "/dp/" + asinMatch[1];
    }

    return {
      title: extractTitle(),
      price: extractPrice(),
      image: extractImage(),
      rating: extractRating(),
      reviewCount: extractReviewCount(),
      url: url,
      specs: specs,
      reviews: reviews
    };
  }

  /**
   * Génère le Markdown optimisé LLM à partir des données extraites.
   * Template Jour 2 : spécifications techniques + aperçu avis clients.
   */
  function generateMarkdown(data) {
    var dateStr = new Date().toISOString().slice(0, 10);

    // Spécifications : liste à puces ou "Non disponibles"
    var specsBlock = "Non disponibles";
    if (data.specs && data.specs.length > 0) {
      specsBlock = data.specs.map(function (s) {
        return "- " + (s.key || "") + " : " + (s.value || "");
      }).join("\n");
    }

    // Avis : liste numérotée ou "Aucun avis disponible"
    var reviewsBlock = "Aucun avis disponible";
    if (data.reviews && data.reviews.length > 0) {
      reviewsBlock = data.reviews.map(function (r, i) {
        return (i + 1) + ". " + (r || "");
      }).join("\n");
    }

    return [
      "---",
      "# " + (data.title || "Product"),
      "",
      "## 📊 Informations clés",
      "- **Prix** : " + (data.price || "—"),
      "- **Note** : " + (data.rating || "—") + " (" + (data.reviewCount || "—") + ")",
      "",
      "## 🔧 Spécifications techniques",
      specsBlock,
      "",
      "## 💬 Aperçu des avis clients",
      reviewsBlock,
      "",
      (data.image ? "![Image produit](" + data.image + ")" : ""),
      "",
      "---",
      "🔗 **Source** : " + (data.url || ""),
      "📅 **Extrait le** : " + dateStr,
      "---"
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
