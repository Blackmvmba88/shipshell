export const annotationModes = new Set(["off", "underline", "circle", "glow"]);

function annotationClient(mode) {
  const KEY = "__shipshellVisualAnchorsV2";
  const ROOT_ID = "__shipshell-anchor-root";
  const STYLE_ID = "__shipshell-anchor-style";
  let state = window[KEY];

  const compactText = (value, max = 500) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
  const rectOf = (element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  };
  const metadataOf = (element) => ({
    text: compactText(element.innerText || element.textContent || element.getAttribute("value")),
    tag: element.tagName.toLowerCase().slice(0, 40),
    role: compactText(element.getAttribute("role"), 80),
    ariaLabel: compactText(element.getAttribute("aria-label"), 300),
    href: compactText(element instanceof HTMLAnchorElement ? element.href : "", 2000),
    elementId: compactText(element.id, 200),
    testId: compactText(element.getAttribute("data-testid") || element.getAttribute("data-test-id"), 200),
    name: compactText(element.getAttribute("name"), 200),
  });

  const scoreCandidate = (element, anchor) => {
    const meta = metadataOf(element);
    let score = 0;
    if (anchor.elementId && meta.elementId === anchor.elementId) score += 10;
    if (anchor.testId && meta.testId === anchor.testId) score += 9;
    if (anchor.name && meta.name === anchor.name) score += 6;
    if (anchor.ariaLabel && meta.ariaLabel === anchor.ariaLabel) score += 6;
    if (anchor.href && meta.href === anchor.href) score += 6;
    if (anchor.text && meta.text === anchor.text) score += 5;
    if (anchor.role && meta.role === anchor.role) score += 2;
    if (anchor.tag && meta.tag === anchor.tag) score += 1;
    return score;
  };

  const findElement = (anchor) => {
    if (anchor.elementId) {
      const byId = document.getElementById(anchor.elementId);
      if (byId && scoreCandidate(byId, anchor) >= 6) return byId;
    }
    const tag = /^[a-z][a-z0-9-]*$/i.test(anchor.tag || "") ? anchor.tag : "*";
    const candidates = Array.from(document.querySelectorAll(tag)).slice(0, 4000);
    let best = null;
    let bestScore = 0;
    for (const candidate of candidates) {
      const score = scoreCandidate(candidate, anchor);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    return bestScore >= 6 ? best : null;
  };

  if (!state) {
    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("aria-hidden", "true");
    Object.assign(root.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483646",
      pointerEvents: "none",
      overflow: "hidden",
    });
    document.documentElement.appendChild(root);

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID} .ss-anchor { position: fixed; box-sizing: border-box; pointer-events: none; }
      #${ROOT_ID} .ss-anchor-label { position: absolute; left: -8px; top: -12px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 999px; background: #07120d; color: #d7ffe9; border: 1px solid #7effbd; box-shadow: 0 0 14px rgba(126,255,189,.75); font: 700 11px/18px ui-monospace, SFMono-Regular, Menlo, monospace; text-align: center; }
      #${ROOT_ID} .ss-underline { border-bottom: 4px solid #7effbd; filter: drop-shadow(0 0 5px rgba(126,255,189,.9)); }
      #${ROOT_ID} .ss-circle { border: 3px solid #7edfff; border-radius: 999px; box-shadow: 0 0 16px rgba(126,223,255,.55), inset 0 0 12px rgba(126,223,255,.16); }
      #${ROOT_ID} .ss-glow { border: 2px solid #d987ff; border-radius: 10px; box-shadow: 0 0 8px rgba(217,135,255,.95), 0 0 28px rgba(217,135,255,.72), inset 0 0 18px rgba(217,135,255,.18); }
    `;
    document.documentElement.appendChild(style);

    const anchors = [];
    const elements = new Map();
    const exportAnchors = () => anchors.slice(-24).map((anchor) => {
      const element = elements.get(anchor.id);
      const resolved = Boolean(element?.isConnected);
      return {
        ...anchor,
        rect: resolved ? rectOf(element) : anchor.rect,
        resolved,
      };
    });
    const render = () => {
      root.replaceChildren();
      anchors.forEach((anchor, index) => {
        const element = elements.get(anchor.id);
        if (!element?.isConnected) return;
        const rect = rectOf(element);
        anchor.rect = rect;
        if (rect.width <= 0 || rect.height <= 0) return;
        const mark = document.createElement("div");
        mark.className = `ss-anchor ss-${anchor.kind}`;
        mark.dataset.anchorNumber = String(index + 1);
        Object.assign(mark.style, {
          left: `${Math.max(0, rect.x - (anchor.kind === "circle" ? 6 : 3))}px`,
          top: `${Math.max(0, rect.y - (anchor.kind === "circle" ? 6 : 3))}px`,
          width: `${Math.max(8, rect.width + (anchor.kind === "circle" ? 12 : 6))}px`,
          height: `${Math.max(anchor.kind === "underline" ? 6 : 8, rect.height + (anchor.kind === "circle" ? 12 : 6))}px`,
        });
        const label = document.createElement("span");
        label.className = "ss-anchor-label";
        label.textContent = String(index + 1);
        mark.appendChild(label);
        root.appendChild(mark);
      });
    };
    const clear = () => {
      anchors.splice(0);
      elements.clear();
      render();
    };
    const restore = (saved) => {
      anchors.splice(0);
      elements.clear();
      for (const raw of Array.isArray(saved) ? saved.slice(0, 24) : []) {
        const anchor = {
          ...raw,
          note: compactText(raw?.note, 500),
        };
        anchors.push(anchor);
        const element = findElement(anchor);
        if (element) elements.set(anchor.id, element);
      }
      render();
      return exportAnchors();
    };
    const setNote = (number, note) => {
      const anchor = anchors[Number(number) - 1];
      if (!anchor) return exportAnchors();
      anchor.note = compactText(note, 500);
      return exportAnchors();
    };
    const focus = (numbers) => {
      render();
      const requested = Array.isArray(numbers)
        ? [...new Set(numbers.map(Number).filter((value) => Number.isInteger(value) && value >= 1 && value <= anchors.length))]
        : [];
      const focused = [];
      for (const number of requested) {
        const mark = root.querySelector(`[data-anchor-number="${number}"]`);
        const element = elements.get(anchors[number - 1]?.id);
        if (!mark || !element?.isConnected) continue;
        focused.push(number);
        mark.animate([
          { opacity: 1, transform: "scale(1)", filter: "brightness(1)" },
          { opacity: 1, transform: "scale(1.045)", filter: "brightness(1.9)" },
          { opacity: 1, transform: "scale(1)", filter: "brightness(1)" },
        ], { duration: 850, iterations: 2, easing: "ease-in-out" });
      }
      return { focused, anchors: exportAnchors() };
    };
    const onClick = (event) => {
      if (!state || state.mode === "off") return;
      const target = event.target instanceof Element
        ? event.target.closest("button,a,input,select,textarea,[role],label,[tabindex],summary,[contenteditable=true],*")
        : null;
      if (!target || target.id === ROOT_ID || target.closest(`#${ROOT_ID}`)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const id = `anchor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const anchor = {
        id,
        kind: state.mode,
        ...metadataOf(target),
        note: "",
        rect: rectOf(target),
        createdAt: new Date().toISOString(),
      };
      anchors.push(anchor);
      if (anchors.length > 24) {
        const removed = anchors.shift();
        if (removed) elements.delete(removed.id);
      }
      elements.set(id, target);
      render();
    };
    const onKey = (event) => {
      if (event.key === "Escape" && state?.mode !== "off") {
        state.mode = "off";
        render();
      }
    };
    state = { mode: "off", anchors, elements, root, render, clear, restore, setNote, focus, exportAnchors, onClick, onKey };
    window[KEY] = state;
    window.addEventListener("click", onClick, true);
    window.addEventListener("scroll", render, true);
    window.addEventListener("resize", render, true);
    window.addEventListener("keydown", onKey, true);
  }

  state.mode = mode;
  state.render();
  return { mode: state.mode, anchors: state.exportAnchors() };
}

export function annotationBootstrap(mode) {
  return `(${annotationClient.toString()})(${JSON.stringify(mode)})`;
}
