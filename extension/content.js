(() => {

  const SENSITIVE_SELECTOR = [
    'input[type="password"]',

    'input[name*="ssn" i]',
    'input[id*="ssn" i]',

    'input[name*="social" i]',
    'input[id*="social" i]',

    'input[name*="dob" i]',
    'input[id*="dob" i]',

    'input[name*="birth" i]',
    'input[id*="birth" i]',

    'input[name*="card" i]',
    'input[id*="card" i]',

    'input[name*="account" i]',
    'input[id*="account" i]',

    'input[name*="routing" i]',
    'input[id*="routing" i]',

    'input[name*="license" i]',
    'input[id*="license" i]',

    'input[name*="cdl" i]',
    'input[id*="cdl" i]',

    '[data-s4u-sensitive="true"]'
  ].join(",");

  function getLabel(element) {

    const aria =
      element.getAttribute?.(
        "aria-label"
      );

    if (aria?.trim()) {
      return aria.trim();
    }

    const labelledBy =
      element.getAttribute?.(
        "aria-labelledby"
      );

    if (labelledBy) {
      const label =
        document.getElementById(
          labelledBy
        );

      if (label?.textContent?.trim()) {
        return label.textContent
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 120);
      }
    }

    if (element.id) {

      const label =
        document.querySelector(
          `label[for="${CSS.escape(
            element.id
          )}"]`
        );

      if (label?.textContent?.trim()) {
        return label.textContent
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 120);
      }
    }

    const interactive =
      element.closest?.(
        "button,a,label,[role='button']"
      );

    const text =
      interactive?.innerText ||
      element.innerText ||
      element.textContent ||
      element.getAttribute?.(
        "title"
      ) ||
      element.getAttribute?.(
        "name"
      ) ||
      element.id ||
      element.tagName ||
      "Control";

    /*
     * DO NOT USE element.value HERE.
     *
     * That prevents typed form values
     * from becoming recorder metadata.
     */
    return String(text)
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 120);
  }

  function getSelector(element) {

    if (element.id) {
      return (
        "#" +
        CSS.escape(element.id)
      );
    }

    const testId =
      element.getAttribute?.(
        "data-testid"
      );

    if (testId) {
      return (
        `[data-testid="${CSS.escape(
          testId
        )}"]`
      );
    }

    const name =
      element.getAttribute?.(
        "name"
      );

    if (name) {
      return (
        `${element.tagName.toLowerCase()}` +
        `[name="${CSS.escape(
          name
        )}"]`
      );
    }

    return element
      .tagName
      .toLowerCase();
  }

  function createPrivacyMasks() {

    const masks = [];

    document
      .querySelectorAll(
        SENSITIVE_SELECTOR
      )
      .forEach(element => {

        const rect =
          element.getBoundingClientRect();

        if (
          rect.width < 1 ||
          rect.height < 1
        ) {
          return;
        }

        const mask =
          document.createElement(
            "div"
          );

        Object.assign(
          mask.style,
          {
            position:
              "fixed",

            left:
              `${rect.left}px`,

            top:
              `${rect.top}px`,

            width:
              `${rect.width}px`,

            height:
              `${rect.height}px`,

            background:
              "#111827",

            borderRadius:
              "5px",

            zIndex:
              "2147483647",

            pointerEvents:
              "none"
          }
        );

        document.documentElement
          .appendChild(mask);

        masks.push(mask);
      });

    return () => {
      masks.forEach(
        mask =>
          mask.remove()
      );
    };
  }

  document.addEventListener(
    "click",
    async event => {

      const target =
        event.target instanceof Element
          ? event.target
          : null;

      if (!target) {
        return;
      }

      let stateResponse;

      try {
        stateResponse =
          await chrome.runtime
            .sendMessage({
              type:
                "GET_STATE"
            });
      } catch {
        return;
      }

      const state =
        stateResponse?.state;

      if (!state?.recording) {
        return;
      }

      const xPercent =
        Math.max(
          0,
          Math.min(
            100,
            (
              event.clientX /
              window.innerWidth
            ) * 100
          )
        );

      const yPercent =
        Math.max(
          0,
          Math.min(
            100,
            (
              event.clientY /
              window.innerHeight
            ) * 100
          )
        );

      const cleanupMasks =
        createPrivacyMasks();

      const label =
        getLabel(target);

      try {

        await chrome.runtime
          .sendMessage({
            type:
              "RECORD_CLICK",

            title:
              `Select ${label}`,

            instruction:
              `Select ${label}.`,

            url:
              location.href,

            page_title:
              document.title,

            element: {
              tag:
                target.tagName
                  .toLowerCase(),

              label,

              selector:
                getSelector(target)
            },

            click: {
              x:
                event.clientX,

              y:
                event.clientY,

              x_pct:
                xPercent,

              y_pct:
                yPercent,

              viewport: {
                width:
                  window.innerWidth,

                height:
                  window.innerHeight
              }
            }
          });

      } finally {

        /*
         * Give captureVisibleTab time
         * to take the screenshot before
         * removing the privacy masks.
         */
        setTimeout(
          cleanupMasks,
          350
        );
      }

    },
    true
  );

})();