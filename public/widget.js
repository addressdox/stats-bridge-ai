/**
 * Naledi by AddressDox widget loader.
 *
 * Drop this on any site:
 *   <script src="https://naledi.example/widget.js" data-statbridge async></script>
 *
 * Optional attributes:
 *   data-origin="https://naledi.example"   where the assistant is hosted
 *   data-position="left"                        put the bubble on the left
 *   data-label="Ask about official statistics"  the bubble tooltip
 */
(function () {
  "use strict";
  if (window.__statbridgeWidget) return;
  window.__statbridgeWidget = true;

  var script = document.currentScript || (function () {
    var all = document.getElementsByTagName("script");
    return all[all.length - 1];
  })();

  var origin = script.getAttribute("data-origin") || new URL(script.src, location.href).origin;
  var side = script.getAttribute("data-position") === "left" ? "left" : "right";
  var label = script.getAttribute("data-label") || "Ask about official statistics";

  var open = false;
  var expanded = false;

  var root = document.createElement("div");
  root.setAttribute("data-statbridge-root", "");
  root.style.cssText = "position:fixed;z-index:2147483000;bottom:0;" + side + ":0;";

  var panel = document.createElement("div");
  panel.style.cssText = [
    "position:fixed",
    "bottom:88px",
    side + ":20px",
    "width:400px",
    "height:620px",
    "max-width:calc(100vw - 32px)",
    "max-height:calc(100vh - 120px)",
    "border-radius:18px",
    "overflow:hidden",
    "box-shadow:0 24px 60px rgba(8,12,20,.32)",
    "background:#fff",
    "opacity:0",
    "transform:translateY(12px) scale(.98)",
    "transform-origin:bottom " + side,
    "transition:opacity .18s ease, transform .18s ease",
    "pointer-events:none",
    "display:none",
  ].join(";");

  var frame = document.createElement("iframe");
  frame.title = "Naledi by AddressDox assistant";
  frame.allow = "microphone; autoplay";
  frame.style.cssText = "width:100%;height:100%;border:0;display:block;background:#fff;";
  panel.appendChild(frame);

  var bubble = document.createElement("button");
  bubble.type = "button";
  bubble.setAttribute("aria-label", label);
  bubble.title = label;
  bubble.style.cssText = [
    "position:fixed",
    "bottom:20px",
    side + ":20px",
    "width:60px",
    "height:60px",
    "border-radius:999px",
    "border:0",
    "cursor:pointer",
    "background:#0b3b53",
    "color:#fff",
    "box-shadow:0 12px 30px rgba(8,12,20,.30)",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "transition:transform .16s ease, box-shadow .16s ease",
  ].join(";");
  bubble.innerHTML =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  bubble.addEventListener("mouseenter", function () {
    bubble.style.transform = "scale(1.06)";
  });
  bubble.addEventListener("mouseleave", function () {
    bubble.style.transform = "scale(1)";
  });

  function sizePanel() {
    var small = window.innerWidth < 640;
    if (expanded || small) {
      panel.style.width = expanded ? "min(1100px, calc(100vw - 32px))" : "calc(100vw - 20px)";
      panel.style.height = expanded ? "calc(100vh - 40px)" : "calc(100vh - 100px)";
      panel.style.bottom = expanded ? "20px" : "80px";
      panel.style[side] = expanded ? "16px" : "10px";
      panel.style.borderRadius = expanded ? "18px" : "16px";
    } else {
      panel.style.width = "400px";
      panel.style.height = "620px";
      panel.style.bottom = "88px";
      panel.style[side] = "20px";
      panel.style.borderRadius = "18px";
    }
  }

  function setOpen(next) {
    open = next;
    if (frame.contentWindow && frame.src) {
      frame.contentWindow.postMessage({ source: "statbridge-host", type: "visibility", open: open }, origin);
    }
    if (open) {
      if (!frame.src) frame.src = origin + "/embed";
      panel.style.display = "block";
      sizePanel();
      requestAnimationFrame(function () {
        panel.style.opacity = "1";
        panel.style.transform = "translateY(0) scale(1)";
        panel.style.pointerEvents = "auto";
      });
      bubble.setAttribute("aria-expanded", "true");
    } else {
      expanded = false;
      panel.style.opacity = "0";
      panel.style.transform = "translateY(12px) scale(.98)";
      panel.style.pointerEvents = "none";
      bubble.setAttribute("aria-expanded", "false");
      setTimeout(function () {
        if (!open) panel.style.display = "none";
      }, 200);
    }
  }

  bubble.addEventListener("click", function () {
    setOpen(!open);
  });

  window.addEventListener("resize", function () {
    if (open) sizePanel();
  });

  window.addEventListener("message", function (event) {
    if (event.origin !== origin || event.source !== frame.contentWindow) return;
    var data = event.data || {};
    if (data.source !== "statbridge") return;
    if (data.type === "ready") {
      frame.contentWindow.postMessage({ source: "statbridge-host", type: "visibility", open: open }, origin);
    }
    if (data.type === "close") setOpen(false);
    if (data.type === "expand") {
      expanded = !expanded;
      sizePanel();
    }
    if (data.type === "open-app") {
      setOpen(false);
      window.open(origin + "/ask", "_blank", "noopener");
    }
  });

  root.appendChild(panel);
  root.appendChild(bubble);

  function mount() {
    document.body.appendChild(root);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();

  window.Naledi = window.StatBridge = {
    open: function () {
      setOpen(true);
    },
    close: function () {
      setOpen(false);
    },
    toggle: function () {
      setOpen(!open);
    },
  };
})();
