import english from "./en.js";

export function resolveLanguage(search, saved) {
  const requested = new URLSearchParams(search).get("lang");
  return ["en", "zh-Hant"].includes(requested) ? requested : saved === "en" ? "en" : "zh-Hant";
}
let saved = null;
try { saved = globalThis.localStorage?.getItem("moon.language"); } catch { /* URL switching still works. */ }
export const language = resolveLanguage(globalThis.location?.search || "", saved);
export const locale = language === "en" ? "en-US" : "zh-TW";

// Supports plain messages and tagged templates. Substitutions stay in their
// original positions even when the English sentence uses a different order.
export function tr(message, ...values) {
  if (typeof message === "string") return language === "en" ? english[message] ?? message : message;
  const key = message.reduce((text, part, i) => text + part + (i < values.length ? `{${i}}` : ""), "");
  const translated = language === "en" ? english[key] ?? key : key;
  return translated.replace(/\{(\d+)\}/g, (_, i) => String(values[+i]));
}

export function initializeLanguage() {
  document.documentElement.lang = language;
  // Translate the initial HTML once. Dynamic content uses tr() at render time.
  if (language === "en") {
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (["SCRIPT", "STYLE"].includes(node.parentElement?.tagName)) continue;
      const key = node.textContent.trim();
      if (Object.hasOwn(english, key)) node.textContent = node.textContent.replace(key, () => english[key]);
    }
    for (const element of document.querySelectorAll("[aria-label], [placeholder], [alt], meta[content]")) {
      for (const attr of ["aria-label", "placeholder", "alt", "content"]) {
        if (element.hasAttribute(attr)) element.setAttribute(attr, tr(element.getAttribute(attr)));
      }
    }
  }
  document.getElementById("languageSelect").value = language;
}
