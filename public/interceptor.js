(function () {
  // Avoid double-injection.
  if (window.__cerciaInterceptorInstalled) return;
  window.__cerciaInterceptorInstalled = true;

  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    // Only intercept Moltbook API responses.
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
    if (url.includes("/api/v1/")) {
      try {
        // Clone the response so we can read it without consuming the original.
        const clone = response.clone();
        const contentType = clone.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          const data = await clone.json();

          // Dispatch event for the content script to receive.
          window.dispatchEvent(
            new CustomEvent("cercia-api-response", {
              detail: { url, data },
            }),
          );
        }
      } catch (e) {
        // Ignore parsing errors - response might not be JSON.
      }
    }

    return response;
  };

  // Also intercept XMLHttpRequest for completeness.
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._cerciaUrl = url;
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", function () {
      const url = this._cerciaUrl || "";
      if (url.includes("/api/v1/")) {
        try {
          const contentType = this.getResponseHeader("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = JSON.parse(this.responseText);
            window.dispatchEvent(
              new CustomEvent("cercia-api-response", {
                detail: { url, data },
              }),
            );
          }
        } catch (e) {
          // Ignore parsing errors.
        }
      }
    });
    return originalXHRSend.apply(this, args);
  };

  console.log("[Cercia] API interceptor installed");
})();
