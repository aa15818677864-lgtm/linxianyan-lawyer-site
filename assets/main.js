(function () {
  const siteConfig = window.LAWYER_SITE_CONFIG || {};
  const form = document.getElementById("consult-form");
  const statusNode = document.getElementById("form-status");
  const navToggle = document.querySelector(".nav-toggle");
  const siteNav = document.getElementById("site-nav");

  if (navToggle && siteNav) {
    navToggle.addEventListener("click", function () {
      const isOpen = siteNav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    siteNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        siteNav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  if (!form || !statusNode) {
    return;
  }

  hydrateHiddenFields(form);

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    statusNode.textContent = "";

    const endpoint = siteConfig.formEndpoint;
    if (!endpoint || endpoint.indexOf("REPLACE_WITH") !== -1) {
      statusNode.textContent = "請先在 assets/config.js 內設定 Google Apps Script 網址。";
      return;
    }

    if (!form.reportValidity()) {
      statusNode.textContent = "請先填好必填欄位。";
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    formData.append("lawyer_name", siteConfig.lawyerName || "林先妍");
    formData.append("site_label", siteConfig.siteLabel || "林先妍律師個人落地頁");
    formData.append("submitted_from", window.location.href);

    try {
      if (submitButton) {
        submitButton.disabled = true;
      }
      statusNode.textContent = "提交中，請稍候...";

      await fetch(endpoint, {
        method: "POST",
        mode: "no-cors",
        body: formData
      });

      statusNode.textContent = "已提交，正在跳轉...";
      window.setTimeout(function () {
        window.location.href = "thanks.html";
      }, 800);
    } catch (error) {
      statusNode.textContent = "提交失敗，請稍後再試。";
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });

  function hydrateHiddenFields(currentForm) {
    const url = new URL(window.location.href);
    setValue(currentForm, "referrer", document.referrer || "");
    setValue(currentForm, "landing_url", window.location.href);
    setValue(currentForm, "submitted_at", new Date().toISOString());
    setValue(currentForm, "utm_source", url.searchParams.get("utm_source") || "");
    setValue(currentForm, "utm_medium", url.searchParams.get("utm_medium") || "");
    setValue(currentForm, "utm_campaign", url.searchParams.get("utm_campaign") || "");
    setValue(currentForm, "utm_term", url.searchParams.get("utm_term") || "");
    setValue(currentForm, "utm_content", url.searchParams.get("utm_content") || "");
  }

  function setValue(currentForm, name, value) {
    const field = currentForm.elements.namedItem(name);
    if (field) {
      field.value = value;
    }
  }
})();
