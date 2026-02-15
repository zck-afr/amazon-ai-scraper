(function () {
  "use strict";

  /* ========== PARTIE 1 & 6 : Validation URL et messages d'erreur ========== */

  /**
   * Vérifie que la page est une page produit Amazon.fr valide.
   * @returns {{ ok: boolean, error?: string }}
   */
  function validateUrl() {
    var href = typeof window !== "undefined" && window.location && window.location.href ? window.location.href : "";
    if (!href.includes("amazon.fr")) {
      return { ok: false, error: "⚠️ Cette extension fonctionne uniquement sur amazon.fr" };
    }
    if (!href.includes("/dp/")) {
      return { ok: false, error: "⚠️ Naviguez sur une page produit Amazon (URL avec /dp/)" };
    }
    return { ok: true };
  }

  /* ========== PARTIE 2 : Nettoyage universel ========== */

  /**
   * Nettoie un texte : caractères invisibles, entités HTML, espaces.
   * @param {string} text - Texte brut
   * @returns {string}
   */
  function cleanText(text) {
    if (text == null || typeof text !== "string") return "";
    var s = text
      .replace(/[\u200e\u200f\u200b\u00ad\u200c\u200d]/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .replace(/[\n\t]+/g, " ")
      .trim();
    return s;
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
   * Récupère le texte d'un élément dans un scope (conteneur) ou une valeur par défaut.
   */
  function getTextInScope(root, selector, defaultVal) {
    try {
      if (!root || !root.querySelector) return defaultVal;
      var el = root.querySelector(selector);
      if (el) {
        var text = (el.textContent || el.innerText || "").trim();
        if (text) return text;
      }
    } catch (e) {}
    return defaultVal;
  }

  /**
   * Récupère l'attribut d'un élément dans un scope.
   */
  function getAttrInScope(root, selector, attr, defaultVal) {
    try {
      if (!root || !root.querySelector) return defaultVal;
      var el = root.querySelector(selector);
      if (el && el.getAttribute(attr)) return el.getAttribute(attr).trim();
    } catch (e) {}
    return defaultVal;
  }

  /**
   * Vérifie si un élément est visible sur la page.
   */
  function isVisible(element) {
    if (!element) return false;
    try {
      var style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
      if (element.offsetParent === null) return false;
      return true;
    } catch (e) {}
    return false;
  }

  /**
   * Vérifie si un nœud est dans un conteneur interdit (produits alternatifs, carousels).
   */
  function isInForbiddenContainer(node) {
    if (!node) return true;
    try {
      var forbidden = document.querySelectorAll(".a-carousel, #purchase-sims-feature, #similarities_feature_div, #anonCarousel");
      for (var i = 0; i < forbidden.length; i++) {
        if (forbidden[i].contains(node)) return true;
      }
    } catch (e) {}
    return false;
  }

  /**
   * Vérifie si un nœud est dans #centerCol ou #ppd (colonne centrale produit).
   */
  function isInCenterColOrPpd(node) {
    if (!node) return false;
    try {
      var centerCol = document.querySelector("#centerCol");
      var ppd = document.querySelector("#ppd");
      return (centerCol && centerCol.contains(node)) || (ppd && ppd.contains(node));
    } catch (e) {}
    return false;
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
   * Extraction du titre avec fallbacks (sélecteurs existants).
   */
  function extractTitleRaw() {
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
      "";
  }

  /**
   * Extraction du prix UNIQUEMENT dans le conteneur produit principal.
   * 1) Si "Aucune offre" / "non disponible" → pas de prix.
   * 2) Cherche le prix dans #corePrice_feature_div, puis #apex_desktop_newAccordionRow, puis #price_inside_buybox.
   * 3) Le prix doit être dans #centerCol ou #ppd, sinon on l'ignore.
   */
  function extractPriceRaw() {
    try {
      var availability = getText("#availability span", null) || getText("#availability", null) || "";
      if (/Aucune offre|non disponible|Currently unavailable/i.test(availability)) {
        return "";
      }
    } catch (e) {}

    var scopes = ["#corePrice_feature_div", "#apex_desktop_newAccordionRow", "#price_inside_buybox"];
    for (var s = 0; s < scopes.length; s++) {
      try {
        var root = document.querySelector(scopes[s]);
        if (!root) continue;

        var wholeEl = root.querySelector(".a-price-whole");
        if (wholeEl && isInCenterColOrPpd(wholeEl)) {
          var whole = (wholeEl.textContent || wholeEl.innerText || "").trim();
          if (whole) {
            var fraction = getTextInScope(root, ".a-price-fraction", "");
            var symbol = getTextInScope(root, ".a-price-symbol", "€");
            var price = whole + (fraction ? "," + fraction : "") + " " + symbol;
            return price.replace(/,+/g, ",").replace(/\s+/g, " ").trim();
          }
        }

        var priceBlockEl = root.querySelector("#priceblock_ourprice");
        if (priceBlockEl && isInCenterColOrPpd(priceBlockEl)) {
          var pb = (priceBlockEl.textContent || priceBlockEl.innerText || "").trim();
          if (pb) return pb.replace(/,+/g, ",").replace(/\s+/g, " ").trim();
        }

        var offscreenEl = root.querySelector(".a-price .a-offscreen");
        if (offscreenEl && isInCenterColOrPpd(offscreenEl)) {
          var off = (offscreenEl.textContent || offscreenEl.innerText || "").trim();
          if (off) return off.replace(/,+/g, ",").replace(/\s+/g, " ").trim();
        }
      } catch (e) {}
    }

    return "";
  }

  /**
   * Extraction de l'URL de l'image avec fallbacks.
   */
  function extractImageRaw() {
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
   * Extraction de la note UNIQUEMENT dans #averageCustomerReviews (jamais dans carousels/alternatifs).
   */
  function extractRatingRaw() {
    try {
      var container = document.querySelector("#averageCustomerReviews");
      if (!container || !isVisible(container)) return "";
      if (isInForbiddenContainer(container)) return "";

      var popover = container.querySelector("#acrPopover");
      if (popover && isVisible(popover) && !isInForbiddenContainer(popover)) {
        var title = popover.getAttribute("title");
        if (title && (title.indexOf("sur") !== -1 || title.indexOf("out of") !== -1)) {
          return title.trim();
        }
      }

      var altSpans = container.querySelectorAll("span.a-icon-alt");
      for (var i = 0; i < altSpans.length; i++) {
        if (isVisible(altSpans[i]) && !isInForbiddenContainer(altSpans[i])) {
          var t = (altSpans[i].textContent || altSpans[i].innerText || "").trim();
          if (/sur\s*5|out of 5/i.test(t)) return t;
        }
      }
    } catch (e) {}
    return "";
  }

  /**
   * Extraction du nombre d'avis UNIQUEMENT dans #averageCustomerReviews (jamais dans carousels/alternatifs).
   */
  function extractReviewCountRaw() {
    try {
      var container = document.querySelector("#averageCustomerReviews");
      if (!container || !isVisible(container)) return "";
      if (isInForbiddenContainer(container)) return "";

      var reviewEl = container.querySelector("#acrCustomerReviewText");
      if (!reviewEl || !isVisible(reviewEl) || isInForbiddenContainer(reviewEl)) return "";

      var text = (reviewEl.textContent || reviewEl.innerText || "").trim();
      if (!text) return "";
      text = text.replace(/\s*\(+/g, " ").replace(/\s*\)+/g, " ").replace(/\s+/g, " ").trim();
      var match = text.match(/([\d\s]+)/);
      var num = match ? match[1].replace(/\s+/g, " ").trim() : text;
      var reviewCount = num ? num + " avis" : "";
      reviewCount = reviewCount.replace(/avis avis/gi, "avis").trim();
      reviewCount = reviewCount.replace(/^0+(\d)/, "$1");
      return reviewCount;
    } catch (e) {}
    return "";
  }

  /**
   * Extrait la section "À propos de cet article" (liste à puces).
   */
  function extractAboutItemRaw() {
    var items = [];
    var maxItems = 7;
    var minLength = 5;

    function collectFromSelector(selector) {
      try {
        var nodes = document.querySelectorAll(selector);
        for (var i = 0; i < nodes.length && items.length < maxItems; i++) {
          var raw = (nodes[i].textContent || nodes[i].innerText || "");
          var text = raw.replace(/[\n\t]+/g, " ").replace(/\s+/g, " ").trim();
          if (text && text.length >= minLength) items.push(text);
        }
      } catch (e) {}
    }

    try {
      collectFromSelector("#feature-bullets .a-list-item");
      if (items.length > 0) return items.slice(0, maxItems);
    } catch (e) {}
    items = [];
    try {
      collectFromSelector("#featurebullets_feature_div .a-list-item");
      if (items.length > 0) return items.slice(0, maxItems);
    } catch (e) {}
    items = [];
    try {
      collectFromSelector(".a-unordered-list.a-vertical.a-spacing-mini li span");
      if (items.length > 0) return items.slice(0, maxItems);
    } catch (e) {}
    items = [];
    try {
      collectFromSelector("#productFactsDesktopExpander .a-list-item");
    } catch (e) {}
    return items.slice(0, maxItems);
  }

  /**
   * Indique si un texte est uniquement chiffres/symboles (à ignorer).
   */
  function isOnlyDigitsOrSymbols(str) {
    if (!str || typeof str !== "string") return true;
    var t = str.replace(/\s/g, "");
    if (t.length < 10) return true;
    return /^[\d.,;:€$%+\-*\/\s]+$/.test(str);
  }

  /**
   * Extrait la description technique détaillée (paragraphes).
   * Sélecteurs : #productDescription p, #aplus_feature_div .aplus-v2, #aplus p, #productDescription_feature_div p, .productDescriptionWrapper p
   * @returns string[] (max 3 paragraphes, 200 chars chacun, texte uniquement)
   */
  function extractTechnicalDescriptionRaw() {
    var maxParas = 3;
    var minLength = 10;
    var maxLength = 200;
    var result = [];

    function isCssOrJsParagraph(p) {
      if (!p || p.length <= 20) return true;
      if (p.indexOf(".") === 0 || p.indexOf("#") === 0) return true;
      if (p.indexOf("display:") !== -1 || p.indexOf("margin:") !== -1 || p.indexOf("padding:") !== -1) return true;
      if (p.indexOf("{") !== -1 || p.indexOf("}") !== -1 || p.indexOf("function(") !== -1) return true;
      return false;
    }

    function collectAndFilter(nodes) {
      var list = [];
      for (var i = 0; i < nodes.length && list.length < maxParas; i++) {
        var raw = (nodes[i].textContent || nodes[i].innerText || "").trim();
        var text = cleanText(raw);
        if (text.length < minLength) continue;
        if (isOnlyDigitsOrSymbols(text)) continue;
        if (isCssOrJsParagraph(text)) continue;
        list.push(text.length > maxLength ? text.slice(0, 197) + "..." : text);
      }
      return list;
    }

    try {
      var root1 = document.querySelector("#productDescription");
      if (root1) {
        var p1 = root1.querySelectorAll("p");
        result = collectAndFilter(p1);
        if (result.length > 0) return result.slice(0, maxParas);
      }
    } catch (e) {}

    try {
      var root2 = document.querySelector("#aplus_feature_div");
      if (root2) {
        var blocks = root2.querySelectorAll(".aplus-v2");
        result = collectAndFilter(blocks);
        if (result.length > 0) return result.slice(0, maxParas);
      }
    } catch (e) {}

    try {
      var root3 = document.querySelector("#aplus");
      if (root3) {
        var p3 = root3.querySelectorAll("p");
        result = collectAndFilter(p3);
        if (result.length > 0) return result.slice(0, maxParas);
      }
    } catch (e) {}

    try {
      var root4 = document.querySelector("#productDescription_feature_div");
      if (root4) {
        var p4 = root4.querySelectorAll("p");
        result = collectAndFilter(p4);
        if (result.length > 0) return result.slice(0, maxParas);
      }
    } catch (e) {}

    try {
      var root5 = document.querySelector(".productDescriptionWrapper");
      if (root5) {
        var p5 = root5.querySelectorAll("p");
        result = collectAndFilter(p5);
      }
    } catch (e) {}

    return result.slice(0, maxParas);
  }

  /**
   * Indique si une clé doit être ignorée (non pertinente pour l'analyse IA).
   */
  function shouldIgnoreSpecKey(key) {
    if (!key || typeof key !== "string") return true;
    var k = key.toLowerCase();
    return /commentaires client|classement|étoiles|meilleures ventes/i.test(k);
  }

  /**
   * Extrait le tableau complet "Descriptif technique" (Informations sur le produit).
   * Sélecteurs : #productDetails_techSpec_section_1, _section_2, #productDetails_detailBullets_sections1, .a-keyvalue.prodDetTable, #detailBullets_feature_div li
   * @returns {{ key: string, value: string }[]} (max 15 paires)
   */
  function extractTechnicalSpecsRaw() {
    var technicalSpecs = [];
    var maxSpecs = 15;

    function addPair(key, value) {
      key = cleanText(key || "").replace(/\s*:\s*$/, "").trim();
      value = cleanText(value || "").trim();
      if (!key && !value) return;
      if (shouldIgnoreSpecKey(key)) return;
      if (key && value) technicalSpecs.push({ key: key, value: value });
    }

    function parseTableRows(rows) {
      for (var r = 0; r < rows.length && technicalSpecs.length < maxSpecs; r++) {
        try {
          var row = rows[r];
          var left = row.querySelector("th") || row.querySelector("td:first-child");
          var right = row.querySelector("td:last-child") || row.querySelector("td:nth-child(2)");
          if (left && right) {
            var key = (left.textContent || left.innerText || "").trim();
            var value = (right.textContent || right.innerText || "").trim();
            addPair(key, value);
          }
        } catch (e) {}
      }
    }

    function parseBulletList(container) {
      try {
        var items = container.querySelectorAll("li span.a-list-item, li");
        for (var i = 0; i < items.length && technicalSpecs.length < maxSpecs; i++) {
          var text = (items[i].textContent || items[i].innerText || "").trim();
          var idx = text.indexOf(":");
          if (idx > 0) {
            var key = text.slice(0, idx).trim();
            var value = text.slice(idx + 1).trim();
            addPair(key, value);
          }
        }
      } catch (e) {}
    }

    try {
      var section1 = document.querySelector("#productDetails_techSpec_section_1");
      if (section1) {
        var rows1 = section1.querySelectorAll("tr");
        if (rows1 && rows1.length) parseTableRows(rows1);
      }
      var section2 = document.querySelector("#productDetails_techSpec_section_2");
      if (section2) {
        var rows2 = section2.querySelectorAll("tr");
        if (rows2 && rows2.length) parseTableRows(rows2);
      }
      if (technicalSpecs.length > 0) return technicalSpecs.slice(0, maxSpecs);
    } catch (e) {}

    try {
      var sections1 = document.querySelector("#productDetails_detailBullets_sections1");
      if (sections1) {
        var rows3 = sections1.querySelectorAll("tr");
        if (rows3 && rows3.length) parseTableRows(rows3);
        if (technicalSpecs.length > 0) return technicalSpecs.slice(0, maxSpecs);
      }
    } catch (e) {}

    try {
      var table = document.querySelector(".a-keyvalue.prodDetTable");
      if (table) {
        var rows4 = table.querySelectorAll("tr");
        if (rows4 && rows4.length) parseTableRows(rows4);
        if (technicalSpecs.length > 0) return technicalSpecs.slice(0, maxSpecs);
      }
    } catch (e) {}

    try {
      var bullets = document.querySelector("#detailBullets_feature_div");
      if (bullets) parseBulletList(bullets);
    } catch (e) {}

    return technicalSpecs.slice(0, maxSpecs);
  }

  /**
   * Extrait les avis (texte brut).
   */
  function extractReviewsRaw() {
    var reviews = [];
    var maxReviews = 3;
    var maxChars = 120;

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
   * Extrait toutes les données brutes (sans validation).
   */
  function extractAmazonDataRaw() {
    var technicalSpecs = [];
    var reviews = [];
    var aboutItem = [];
    var technicalDescription = [];
    try {
      technicalSpecs = extractTechnicalSpecsRaw();
    } catch (e) {
      technicalSpecs = [];
    }
    try {
      reviews = extractReviewsRaw();
    } catch (e) {
      reviews = [];
    }
    try {
      aboutItem = extractAboutItemRaw();
    } catch (e) {
      aboutItem = [];
    }
    try {
      technicalDescription = extractTechnicalDescriptionRaw();
    } catch (e) {
      technicalDescription = [];
    }

    var rawUrl = window.location.href || "";
    var asinMatch = rawUrl.match(/\/dp\/([A-Z0-9]{10})/);
    var url = rawUrl;
    if (asinMatch && asinMatch[1]) {
      var origin = window.location.origin || "https://www.amazon.fr";
      url = origin + "/dp/" + asinMatch[1];
    }

    return {
      title: extractTitleRaw(),
      price: extractPriceRaw(),
      image: extractImageRaw(),
      rating: extractRatingRaw(),
      reviewCount: extractReviewCountRaw(),
      url: url,
      aboutItem: aboutItem,
      technicalDescription: technicalDescription,
      technicalSpecs: technicalSpecs,
      reviews: reviews
    };
  }

  /* ========== PARTIE 3 : Validation et nettoyage des champs ========== */

  /**
   * Valide et nettoie les données extraites (cleanText + règles métier).
   * @param {object} raw - Données brutes
   * @returns {object} Données validées
   */
  function validateAndCleanData(raw) {
    var title = cleanText(raw.title || "");
    if (!title || title.length < 3) title = "Titre non disponible";
    else if (title.length > 150) title = title.slice(0, 147) + "...";

    var price = cleanText(raw.price || "");
    if (!price) price = "Prix non disponible";
    else price = price.replace(/,+/g, ",").replace(/\s+/g, " ").trim();

    var rating = cleanText(raw.rating || "");
    var reviewCount = cleanText(raw.reviewCount || "");

    if (!reviewCount || /^0+\s*avis\s*$/i.test(reviewCount) || /aucun/i.test(reviewCount)) {
      rating = "Aucune note";
      reviewCount = "0 avis";
    } else if (rating && !reviewCount) {
      reviewCount = "0 avis";
    } else if (reviewCount && !rating) {
      rating = "Aucune note";
    } else {
      if (rating) {
        var ratingMatch = rating.match(/^([\d,\.]+)\s*(?:sur|out of)/i);
        if (ratingMatch && ratingMatch[1]) rating = ratingMatch[1].trim() + "/5";
        else if (rating.indexOf("/5") === -1) rating = rating + "/5";
      } else {
        rating = "Aucune note";
      }
      reviewCount = reviewCount.replace(/\s*\(+/g, " ").replace(/\s*\)+/g, " ").replace(/\s+/g, " ").trim();
      var numMatch = reviewCount.match(/([\d\s]+)/);
      var num = numMatch ? numMatch[1].replace(/\s+/g, " ").trim() : reviewCount;
      reviewCount = num ? num + " avis" : "0 avis";
      reviewCount = reviewCount.replace(/avis avis/gi, "avis").trim();
      reviewCount = reviewCount.replace(/^0+(\d)/, "$1");
    }

    var image = (raw.image || "").trim();
    if (!image || image.indexOf("http") !== 0) image = "";

    var url = raw.url || "";
    var asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
    if (asinMatch && asinMatch[1]) {
      url = "https://www.amazon.fr/dp/" + asinMatch[1];
    } else {
      url = window.location.href || url;
    }

    var technicalSpecs = (raw.technicalSpecs || []).slice(0, 15);
    technicalSpecs = technicalSpecs.filter(function (s) {
      var k = cleanText(s.key || "");
      var v = cleanText(s.value || "");
      return k.length >= 3 && v.length >= 3 && !shouldIgnoreSpecKey(k);
    }).map(function (s) {
      return { key: cleanText(s.key || ""), value: cleanText(s.value || "") };
    });

    var aboutItem = (raw.aboutItem || []).filter(function (item) {
      var t = cleanText(item || "");
      return t.length >= 5;
    }).slice(0, 7).map(function (item) {
      return cleanText(item || "");
    });

    var reviews = (raw.reviews || []).filter(function (r) {
      var t = cleanText(r || "");
      return t.length >= 10;
    }).slice(0, 3).map(function (r) {
      var t = cleanText(r || "");
      return t.length > 120 ? t.slice(0, 117) + "..." : t;
    });

    var technicalDescription = (raw.technicalDescription || []).map(function (p) {
      return cleanText(p || "");
    }).filter(function (t) {
      return t.length >= 10 && !isOnlyDigitsOrSymbols(t);
    }).filter(function (p) {
      return p.length > 20 &&
        p.indexOf(".") !== 0 &&
        p.indexOf("#") !== 0 &&
        p.indexOf("display:") === -1 &&
        p.indexOf("margin:") === -1 &&
        p.indexOf("padding:") === -1 &&
        p.indexOf("{") === -1 &&
        p.indexOf("}") === -1 &&
        p.indexOf("function(") === -1;
    }).slice(0, 3).map(function (t) {
      return t.length > 200 ? t.slice(0, 197) + "..." : t;
    });

    return {
      title: title,
      price: price,
      image: image,
      rating: rating,
      reviewCount: reviewCount,
      url: url,
      technicalSpecs: technicalSpecs,
      aboutItem: aboutItem,
      technicalDescription: technicalDescription,
      reviews: reviews
    };
  }

  /* ========== PARTIE 4 : Génération Markdown robuste ========== */

  /**
   * Génère le Markdown à partir des données validées.
   * Masque les sections si données absentes.
   */
  function generateMarkdown(data) {
    var dateStr = new Date().toISOString().slice(0, 10);

    var technicalSpecsBlock = "- Non disponible";
    if (data.technicalSpecs && data.technicalSpecs.length > 0) {
      var escapePipe = function (str) { return (str || "").replace(/\|/g, ", "); };
      technicalSpecsBlock = [
        "| Caractéristique | Valeur |",
        "|-----------------|--------|"
      ].concat(data.technicalSpecs.map(function (s) {
        return "| " + escapePipe(s.key) + " | " + escapePipe(s.value) + " |";
      })).join("\n");
    }

    var reviewsBlock = "- Aucun avis disponible";
    if (data.reviews && data.reviews.length > 0) {
      reviewsBlock = data.reviews.map(function (r, i) {
        return (i + 1) + ". " + (r || "");
      }).join("\n");
    }

    var aboutLines = [];
    if (data.aboutItem && data.aboutItem.length > 0) {
      aboutLines = [
        "",
        "## 📦 À propos de cet article",
        data.aboutItem.map(function (point) {
          return "- " + (point || "");
        }).join("\n")
      ];
    }

    var technicalLines = [];
    if (data.technicalDescription && data.technicalDescription.length > 0) {
      technicalLines = [
        "",
        "## 📝 Description technique",
        data.technicalDescription.map(function (p, i) {
          return (i + 1) + ". " + (p || "");
        }).join("\n")
      ];
    }

    var imageLine = data.image ? "![Image produit](" + data.image + ")" : "";
    var imageBlock = data.image ? [imageLine, ""] : [];

    return [
      "---",
      "# " + (data.title || "Product"),
      "",
      "## 📊 Informations clés",
      "- **Prix** : " + (data.price || "—"),
      "- **Note** : " + (data.rating || "—") + " (" + (data.reviewCount || "—") + ")"
    ].concat(aboutLines).concat(technicalLines).concat([
      "",
      "## 🔧 Descriptif technique",
      technicalSpecsBlock,
      "",
      "## 💬 Aperçu des avis clients",
      reviewsBlock,
      ""
    ].concat(imageBlock)).concat([
      "---",
      "🔗 **Source** : " + (data.url || ""),
      "📅 **Extrait le** : " + dateStr,
      "---"
    ]).join("\n");
  }

  /* ========== PARTIE 5 : Listener avec gestion d'erreurs globale ========== */

  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request && request.action === "extractData") {
      var urlCheck = validateUrl();
      if (!urlCheck.ok) {
        sendResponse({ success: false, error: urlCheck.error });
        return true;
      }
      try {
        var raw = extractAmazonDataRaw();
        var data = validateAndCleanData(raw);
        var markdown = generateMarkdown(data);
        sendResponse({ success: true, markdown: markdown });
      } catch (error) {
        sendResponse({
          success: false,
          error: "❌ Erreur inattendue : " + (error && error.message ? error.message : String(error))
        });
      }
      return true;
    }
  });
})();
