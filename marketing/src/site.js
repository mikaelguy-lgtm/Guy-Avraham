/* SynCash — JS מינימלי לאתר הציבורי. ללא מעקב, ללא cookies, ללא ספריות. */
/* global window, document, fetch, FormData */
(function () {
  "use strict";

  /* תפריט נייד */
  var toggle = document.querySelector("[data-nav-toggle]");
  var nav = document.querySelector("[data-nav]");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.querySelector(".nav-toggle-label").textContent = open ? "סגירה" : "תפריט";
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && nav.classList.contains("is-open")) { nav.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); toggle.focus(); }
    });
  }

  /* הגדרות ציבוריות מהשרת (WhatsApp / CTA / רשתות). ברירת המחדל ב-HTML: הכל מוסתר עד שהשרת עונה,
     חוץ מכפתורי הרשמה/כניסה שמוצגים כברירת מחדל (אם השרת לא זמין, האתר עדיין שימושי). */
  function apply(settings) {
    var whatsappNodes = document.querySelectorAll("[data-whatsapp]");
    for (var i = 0; i < whatsappNodes.length; i++) {
      var node = whatsappNodes[i];
      if (settings.whatsappAvailable && settings.whatsappLink) {
        node.setAttribute("href", settings.whatsappLink);
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
        node.hidden = false;
      } else {
        node.hidden = true;
      }
    }
    var ctaNodes = document.querySelectorAll("[data-cta]");
    for (var j = 0; j < ctaNodes.length; j++) {
      var kind = ctaNodes[j].getAttribute("data-cta");
      if (kind === "register") ctaNodes[j].hidden = settings.registrationEnabled === false;
      if (kind === "login") ctaNodes[j].hidden = settings.loginEnabled === false;
    }
    var socialNodes = document.querySelectorAll("[data-social]");
    var anyVisible = false;
    for (var k = 0; k < socialNodes.length; k++) {
      var network = socialNodes[k].getAttribute("data-social");
      var link = settings.socialLinks && settings.socialLinks[network];
      if (link && /^https:\/\//.test(link)) { socialNodes[k].setAttribute("href", link); socialNodes[k].hidden = false; anyVisible = true; }
      else socialNodes[k].hidden = true;
    }
    var socialWrap = document.querySelector("[data-social-list]");
    if (socialWrap) socialWrap.hidden = !anyVisible;
  }

  if (window.fetch) {
    fetch("/api/public/site-settings", {credentials: "omit", cache: "default"})
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (settings) { if (settings) apply(settings); })
      .catch(function () { /* האתר עובד גם בלי ההגדרות; הכפתורים נשארים במצב ברירת המחדל */ });
  }

  /* מסמכים משפטיים: אותו מקור אמת כמו מרכז המסמכים באפליקציה (הגרסה המפורסמת מה-API). */
  var legal = document.querySelector("[data-legal-document]");
  if (legal && window.fetch) {
    var type = legal.getAttribute("data-legal-document");
    fetch("/api/legal-documents/" + encodeURIComponent(type), {credentials: "omit"})
      .then(function (response) { if (!response.ok) throw new Error("unavailable"); return response.json(); })
      .then(function (doc) {
        var title = document.querySelector("[data-legal-title]");
        if (title && doc.title) title.textContent = doc.title;
        var meta = document.querySelector("[data-legal-meta]");
        if (meta) {
          var parts = [];
          if (doc.versionNumber) parts.push("גרסה " + doc.versionNumber);
          if (doc.effectiveDate) parts.push("בתוקף מ-" + formatDate(doc.effectiveDate));
          meta.textContent = parts.join(" · ");
        }
        legal.innerHTML = "";
        legal.appendChild(renderPlainText(doc.content || ""));
        var contact = document.querySelector("[data-legal-contact]");
        if (contact) {
          var lines = [];
          if (doc.contactEmail) lines.push("דוא\"ל: " + doc.contactEmail);
          if (doc.contactPhone) lines.push("טלפון: " + doc.contactPhone);
          if (doc.contactAddress) lines.push("כתובת: " + doc.contactAddress);
          contact.textContent = lines.join(" · ");
          contact.hidden = lines.length === 0;
        }
      })
      .catch(function () {
        legal.innerHTML = "";
        var p = document.createElement("p");
        p.textContent = "המסמך אינו זמין כרגע. ניתן לצפות בו מתוך המערכת דרך \"מסמכים משפטיים\".";
        legal.appendChild(p);
      });
  }

  function formatDate(value) {
    var d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString("he-IL", {timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", year: "numeric"});
  }

  /* מרנדר טקסט של מסמך כפסקאות/כותרות — ללא innerHTML של תוכן חיצוני (אין הזרקת HTML). */
  function renderPlainText(text) {
    var fragment = document.createDocumentFragment();
    var blocks = text.replace(/\r\n/g, "\n").split(/\n\s*\n/);
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i].trim();
      if (!block) continue;
      var heading = block.match(/^#{1,3}\s+(.+)$/);
      var element;
      if (heading) { element = document.createElement(block.charAt(1) === "#" ? "h3" : "h2"); element.textContent = heading[1]; }
      else if (/^(?:[-*•]\s.+\n?)+$/.test(block)) {
        element = document.createElement("ul");
        var items = block.split("\n");
        for (var j = 0; j < items.length; j++) { var li = document.createElement("li"); li.textContent = items[j].replace(/^[-*•]\s/, ""); element.appendChild(li); }
      } else {
        element = document.createElement("p");
        var lines = block.split("\n");
        for (var k = 0; k < lines.length; k++) { if (k > 0) element.appendChild(document.createElement("br")); element.appendChild(document.createTextNode(lines[k])); }
      }
      fragment.appendChild(element);
    }
    return fragment;
  }

  /* טופס בקשות פרטיות: אותו endpoint ציבורי שמרכז המסמכים באפליקציה משתמש בו. */
  var privacyForm = document.querySelector("[data-privacy-request-form]");
  if (privacyForm && window.fetch) {
    privacyForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var status = privacyForm.querySelector("[data-form-status]");
      var button = privacyForm.querySelector("button[type=submit]");
      var data = new FormData(privacyForm);
      var payload = {requestType: data.get("requestType"), name: String(data.get("name") || "").trim(), email: String(data.get("email") || "").trim()};
      var description = String(data.get("description") || "").trim();
      if (description) payload.description = description;
      button.disabled = true; status.textContent = "שולח…"; status.className = "form-status";
      fetch("/api/privacy-requests", {method: "POST", headers: {"content-type": "application/json"}, credentials: "omit", body: JSON.stringify(payload)})
        .then(function (response) {
          if (response.status === 429) throw new Error("rate");
          if (!response.ok) throw new Error("invalid");
          privacyForm.reset();
          status.textContent = "הבקשה התקבלה. נחזור אליך לכתובת הדוא\"ל שציינת.";
          status.className = "form-status is-success";
        })
        .catch(function (error) {
          status.textContent = error.message === "rate" ? "נשלחו יותר מדי בקשות. אפשר לנסות שוב מאוחר יותר." : "השליחה נכשלה. בדקו את הפרטים ונסו שוב.";
          status.className = "form-status is-error";
        })
        .then(function () { button.disabled = false; });
    });
  }
})();
