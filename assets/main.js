(function () {
  const siteConfig = window.LAWYER_SITE_CONFIG || {};
  const form = document.getElementById("consult-form");
  const statusNode = document.getElementById("form-status");
  const navToggle = document.querySelector(".nav-toggle");
  const siteNav = document.getElementById("site-nav");
  const privacyModal = document.getElementById("privacy-modal");
  const privacyOpeners = document.querySelectorAll("[data-open-privacy]");
  const privacyClosers = document.querySelectorAll("[data-close-privacy]");
  const phoneRegionField = form ? form.elements.namedItem("contact_region") : null;
  const phoneField = form ? form.elements.namedItem("contact_phone") : null;
  let clientIpPromise = null;
  const phoneLengths = {
    "+852": 8,
    "+86": 11
  };

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

    document.addEventListener("click", function (event) {
      const target = event.target;
      if (!siteNav.classList.contains("is-open")) {
        return;
      }

      if (target instanceof Node && !siteNav.contains(target) && !navToggle.contains(target)) {
        siteNav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  if (privacyModal) {
    privacyOpeners.forEach(function (trigger) {
      trigger.addEventListener("click", function (event) {
        event.preventDefault();
        privacyModal.hidden = false;
        document.body.classList.add("modal-open");
      });
    });

    privacyClosers.forEach(function (trigger) {
      trigger.addEventListener("click", function () {
        closePrivacyModal();
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !privacyModal.hidden) {
        closePrivacyModal();
      }
    });
  }

  if (!form || !statusNode) {
    setupRevealAnimations();
    return;
  }

  hydrateHiddenFields(form);
  preloadClientIp(form);
  setupPhoneValidation();
  setupRevealAnimations();

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    statusNode.textContent = "";

    const endpoint = siteConfig.formEndpoint;
    if (!endpoint || endpoint.indexOf("REPLACE_WITH") !== -1) {
      statusNode.textContent = "請先在 assets/config.js 內設定 Google Apps Script 網址。";
      return;
    }

    if (!validatePhoneField() || !form.reportValidity()) {
      statusNode.textContent = "請先填好必填欄位。";
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    await ensureClientIp(form);
    const formData = new FormData(form);
    const contactRegion = getFieldValue(form, "contact_region") || "+852";
    const contactPhone = getFieldValue(form, "contact_phone");
    const contactIm = getFieldValue(form, "contact_im");
    const summary = getFieldValue(form, "summary");
    const composedSummaryParts = [];

    if (summary) {
      composedSummaryParts.push(summary);
    }

    if (contactIm) {
      composedSummaryParts.push("補充聯絡方式：" + contactIm);
    }

    formData.set("contact", [contactRegion, contactPhone].filter(Boolean).join(" ").trim());
    formData.set("summary", composedSummaryParts.join("\n") || "未填寫個案簡述");
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

  function preloadClientIp(currentForm) {
    ensureClientIp(currentForm).catch(function () {
      return "";
    });
  }

  async function ensureClientIp(currentForm) {
    const existingIp = getFieldValue(currentForm, "client_ip");
    if (existingIp) {
      return existingIp;
    }

    if (!clientIpPromise) {
      clientIpPromise = fetch("https://api64.ipify.org?format=json", {
        cache: "no-store"
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error("Unable to fetch client IP");
          }
          return response.json();
        })
        .then(function (data) {
          return data && data.ip ? String(data.ip).trim() : "";
        })
        .catch(function () {
          return "";
        });
    }

    const ip = await clientIpPromise;
    if (ip) {
      setValue(currentForm, "client_ip", ip);
    }
    return ip;
  }

  function setValue(currentForm, name, value) {
    const field = currentForm.elements.namedItem(name);
    if (field) {
      field.value = value;
    }
  }

  function getFieldValue(currentForm, name) {
    const field = currentForm.elements.namedItem(name);
    if (!field) {
      return "";
    }

    return String(field.value || "").trim();
  }

  function setupPhoneValidation() {
    if (!(phoneRegionField instanceof HTMLSelectElement) || !(phoneField instanceof HTMLInputElement)) {
      return;
    }

    syncPhoneRule();
    validatePhoneField();

    phoneRegionField.addEventListener("change", function () {
      syncPhoneRule();
      phoneField.value = phoneField.value.replace(/\D+/g, "").slice(0, getExpectedPhoneLength());
      validatePhoneField();
    });

    phoneField.addEventListener("input", function () {
      const expectedLength = getExpectedPhoneLength();
      phoneField.value = phoneField.value.replace(/\D+/g, "").slice(0, expectedLength);
      validatePhoneField();
    });

    phoneField.addEventListener("blur", validatePhoneField);
  }

  function syncPhoneRule() {
    if (!(phoneRegionField instanceof HTMLSelectElement) || !(phoneField instanceof HTMLInputElement)) {
      return;
    }

    const expectedLength = getExpectedPhoneLength();
    phoneField.maxLength = expectedLength;
    phoneField.placeholder = expectedLength === 8 ? "00000000" : "00000000000";
    phoneField.setAttribute("aria-label", phoneRegionField.value === "+852" ? "香港電話號碼" : "內地電話號碼");
  }

  function getExpectedPhoneLength() {
    if (!(phoneRegionField instanceof HTMLSelectElement)) {
      return 8;
    }

    return phoneLengths[phoneRegionField.value] || 8;
  }

  function validatePhoneField() {
    if (!(phoneRegionField instanceof HTMLSelectElement) || !(phoneField instanceof HTMLInputElement)) {
      return true;
    }

    const digits = phoneField.value.replace(/\D+/g, "");
    const expectedLength = getExpectedPhoneLength();
    let message = "";

    if (!digits) {
      message = "請填寫電話號碼。";
    } else if (digits.length !== expectedLength) {
      message = phoneRegionField.value === "+852"
        ? "香港電話請填寫 8 位數字。"
        : "內地電話請填寫 11 位數字。";
    }

    phoneField.setCustomValidity(message);
    return message === "";
  }

  function setupRevealAnimations() {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets = Array.from(document.querySelectorAll([
      ".hero-copy",
      ".hero-aside",
      ".section-heading",
      ".issue-card",
      ".process-card",
      ".faq-list details",
      ".contact-copy",
      ".contact-panel",
      ".footer-grid > div"
    ].join(",")));

    if (!targets.length) {
      return;
    }

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      targets.forEach(function (element) {
        element.classList.add("is-visible");
      });
      return;
    }

    targets.forEach(function (element, index) {
      element.classList.add("reveal-item");
      element.dataset.revealKind = element.matches(".issue-card, .process-card, .faq-list details") ? "cards" : "copy";
      element.style.setProperty("--reveal-delay", String((index % 4) * 70) + "ms");
      if (element.getBoundingClientRect().top < window.innerHeight * 0.9) {
        element.classList.add("is-visible");
      }
    });

    document.body.classList.add("reveal-enabled");

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.14,
      rootMargin: "0px 0px -10% 0px"
    });

    targets.forEach(function (element) {
      if (!element.classList.contains("is-visible")) {
        observer.observe(element);
      }
    });
  }

  function closePrivacyModal() {
    if (!privacyModal) {
      return;
    }

    privacyModal.hidden = true;
    document.body.classList.remove("modal-open");
  }
})();
