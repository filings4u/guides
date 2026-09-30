(() => {
  if (globalThis.__S4U_GUIDE_RECORDER_LOADED__) return;
  globalThis.__S4U_GUIDE_RECORDER_LOADED__ = true;

  const isGuideBuilder = location.hostname.toLowerCase() === "guides.screenings4u.com";
  let busy = false;
  let lastCaptureAt = 0;
  let recorderActive = false;

  // Secure bridge: only the Guide Builder origin can ask this extension content
  // script to perform recorder actions. The webpage never receives extension IDs.
  if (isGuideBuilder) {
    window.addEventListener("message", async event => {
      if (event.source !== window || event.origin !== location.origin) return;
      const msg = event.data;
      if (!msg || msg.source !== "S4U_GUIDE_BUILDER" || !msg.id) return;

      const allowed = new Set([
        "AUTH_FROM_SITE",
        "AUTH_STATUS",
        "GET_STATE",
        "START_RECORDING_FROM_SITE",
        "STOP_RECORDING",
        "OPEN_GUIDE",
        "CLEAR_RECORDING"
      ]);
      if (!allowed.has(msg.type)) return;

      let response;
      try {
        response = await chrome.runtime.sendMessage({
          type: msg.type,
          ...(msg.payload || {})
        });
      } catch (error) {
        response = { ok: false, error: error?.message || String(error) };
      }

      window.postMessage({
        source: "S4U_GUIDE_RECORDER",
        id: msg.id,
        response
      }, location.origin);
    });

    window.postMessage({ source: "S4U_GUIDE_RECORDER_READY" }, location.origin);
    return;
  }

  const SENSITIVE_SELECTOR = [
    'input[type="password"]',
    'input[name*="ssn" i]', 'input[id*="ssn" i]',
    'input[name*="social" i]', 'input[id*="social" i]',
    'input[name*="dob" i]', 'input[id*="dob" i]',
    'input[name*="birth" i]', 'input[id*="birth" i]',
    'input[name*="card" i]', 'input[id*="card" i]',
    'input[name*="account" i]', 'input[id*="account" i]',
    'input[name*="routing" i]', 'input[id*="routing" i]',
    'input[name*="license" i]', 'input[id*="license" i]',
    'input[name*="cdl" i]', 'input[id*="cdl" i]',
    '[data-s4u-sensitive="true"]'
  ].join(",");

  const INTERACTIVE_SELECTOR = [
    "button", "a[href]", "input", "select", "textarea", "label",
    "[role='button']", "[role='link']", "[role='menuitem']", "[tabindex]"
  ].join(",");

  function labelFor(element) {
    const aria = element.getAttribute?.("aria-label");
    if (aria?.trim()) return aria.trim();
    const labelledBy = element.getAttribute?.("aria-labelledby");
    if (labelledBy) {
      const label = document.getElementById(labelledBy);
      if (label?.textContent?.trim()) return label.textContent.trim().replace(/\s+/g, " ").slice(0, 120);
    }
    if (element.id) {
      const label = document.querySelector('label[for="' + CSS.escape(element.id) + '"]');
      if (label?.textContent?.trim()) return label.textContent.trim().replace(/\s+/g, " ").slice(0, 120);
    }
    const text = element.innerText || element.textContent || element.getAttribute?.("title") || element.getAttribute?.("name") || element.id || element.tagName || "Control";
    return String(text).trim().replace(/\s+/g, " ").slice(0, 120);
  }

  function selectorFor(element) {
    if (element.id) return "#" + CSS.escape(element.id);
    const testId = element.getAttribute?.("data-testid");
    if (testId) return '[data-testid="' + CSS.escape(testId) + '"]';
    const name = element.getAttribute?.("name");
    if (name) return element.tagName.toLowerCase() + '[name="' + CSS.escape(name) + '"]';
    return element.tagName.toLowerCase();
  }

  function createPrivacyMasks() {
    const masks = [];
    document.querySelectorAll(SENSITIVE_SELECTOR).forEach(element => {
      const rect = element.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const mask = document.createElement("div");
      Object.assign(mask.style, {
        position: "fixed", left: rect.left + "px", top: rect.top + "px",
        width: rect.width + "px", height: rect.height + "px",
        background: "#111827", borderRadius: "5px", zIndex: "2147483647",
        pointerEvents: "none"
      });
      document.documentElement.appendChild(mask);
      masks.push(mask);
    });
    return () => masks.forEach(mask => mask.remove());
  }

  async function capture(event) {
    if (!recorderActive) return;
    if (event.button !== undefined && event.button !== 0) return;
    const now = Date.now();
    if (busy || now - lastCaptureAt < 350) return;
    const rawTarget = event.target instanceof Element ? event.target : null;
    const target = rawTarget?.closest?.(INTERACTIVE_SELECTOR) || null;
    if (!target) return;

    busy = true;
    lastCaptureAt = now;
    const cleanupMasks = createPrivacyMasks();
    const label = labelFor(target);

    try {
      // Send immediately on pointerdown. We deliberately avoid a preliminary
      // GET_STATE round trip so captureVisibleTab starts before the click changes
      // the page or navigates away.
      const response = await chrome.runtime.sendMessage({
        type: "RECORD_CLICK",
        title: "Select " + label,
        instruction: "Select " + label + ".",
        url: location.href,
        page_title: document.title,
        element: { tag: target.tagName.toLowerCase(), label, selector: selectorFor(target) },
        click: {
          x: event.clientX, y: event.clientY,
          x_pct: Math.max(0, Math.min(100, (event.clientX / window.innerWidth) * 100)),
          y_pct: Math.max(0, Math.min(100, (event.clientY / window.innerHeight) * 100)),
          viewport: { width: window.innerWidth, height: window.innerHeight }
        }
      });
      if (!response?.ok && response?.error) console.error("[screenings4u Guide Recorder]", response.error);
    } catch (error) {
      console.error("[screenings4u Guide Recorder]", error);
    } finally {
      setTimeout(cleanupMasks, 250);
      setTimeout(() => { busy = false; }, 300);
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "RECORDER_PING") sendResponse({ ok: true, loaded: true });
    if (message?.type === "RECORDER_STATE") {
      recorderActive = !!message.recording;
      sendResponse({ ok: true });
    }
  });

  // Initialize once when a portal page loads. Future state changes are pushed
  // from the service worker, so every click does not need a state lookup.
  chrome.runtime.sendMessage({ type: "GET_STATE" }).then(r => {
    recorderActive = !!r?.state?.recording;
  }).catch(() => {});

  document.addEventListener("pointerdown", capture, true);
})();
