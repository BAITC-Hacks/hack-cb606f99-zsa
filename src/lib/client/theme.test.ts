import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getServerTheme,
  getTheme,
  setTheme,
  subscribeToTheme,
  THEME_STORAGE_KEY,
  themeInitScript,
} from "./theme";

afterEach(() => vi.unstubAllGlobals());

function browserState() {
  const documentElement = { dataset: { theme: "dark" } };
  const storage = new Map<string, string>();
  const browser = Object.assign(new EventTarget(), {
    localStorage: {
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
  vi.stubGlobal("document", { documentElement });
  vi.stubGlobal("window", browser);
  return { browser, documentElement, storage };
}

describe("theme preference", () => {
  it.each(["light", "dark"])("restores %s before the page paints", (theme) => {
    const documentElement = { dataset: { theme: "dark" } };
    runInNewContext(themeInitScript, {
      document: { documentElement },
      localStorage: { getItem: (key: string) => key === THEME_STORAGE_KEY ? theme : null },
    });
    expect(documentElement.dataset.theme).toBe(theme);
  });

  it.each([null, "system", "invalid-value"])('uses the original dark theme for preference "%s"', (value) => {
    const documentElement = { dataset: { theme: "dark" } };
    runInNewContext(themeInitScript, {
      document: { documentElement },
      localStorage: { getItem: () => value },
    });
    expect(documentElement.dataset.theme).toBe("dark");
    expect(getServerTheme()).toBe("dark");
  });

  it("renders safely when the browser blocks reading storage", () => {
    const documentElement = { dataset: { theme: "dark" } };
    expect(() => runInNewContext(themeInitScript, {
      document: { documentElement },
      localStorage: { getItem: () => { throw new Error("Storage unavailable"); } },
    })).not.toThrow();
    expect(documentElement.dataset.theme).toBe("dark");
  });

  it("changes and saves the theme while notifying subscribers", () => {
    const { storage } = browserState();
    const onChange = vi.fn();
    const unsubscribe = subscribeToTheme(onChange);
    setTheme("light");
    expect(getTheme()).toBe("light");
    expect(storage.get(THEME_STORAGE_KEY)).toBe("light");
    expect(onChange).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("still switches the page when writing storage is blocked", () => {
    const { browser } = browserState();
    browser.localStorage.setItem = () => { throw new Error("Storage unavailable"); };
    expect(() => setTheme("light")).not.toThrow();
    expect(getTheme()).toBe("light");
  });

  it("syncs theme changes from another tab and removes listeners on cleanup", () => {
    const { browser } = browserState();
    const onChange = vi.fn();
    const unsubscribe = subscribeToTheme(onChange);
    const storageEvent = (key: string | null, newValue: string | null) =>
      Object.assign(new Event("storage"), { key, newValue });

    browser.dispatchEvent(storageEvent("unrelated", "light"));
    expect(getTheme()).toBe("dark");
    browser.dispatchEvent(storageEvent(THEME_STORAGE_KEY, "light"));
    expect(getTheme()).toBe("light");
    browser.dispatchEvent(storageEvent(null, null));
    expect(getTheme()).toBe("dark");
    expect(onChange).toHaveBeenCalledTimes(2);

    unsubscribe();
    browser.dispatchEvent(storageEvent(THEME_STORAGE_KEY, "light"));
    expect(getTheme()).toBe("dark");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("ignores a same-named session storage preference", () => {
    const { browser } = browserState();
    const onChange = vi.fn();
    const unsubscribe = subscribeToTheme(onChange);
    browser.dispatchEvent(Object.assign(new Event("storage"), {
      key: THEME_STORAGE_KEY,
      newValue: "light",
      storageArea: {},
    }));
    expect(getTheme()).toBe("dark");
    expect(onChange).not.toHaveBeenCalled();

    browser.dispatchEvent(Object.assign(new Event("storage"), {
      key: THEME_STORAGE_KEY,
      newValue: "light",
      storageArea: browser.localStorage,
    }));
    expect(getTheme()).toBe("light");
    expect(onChange).toHaveBeenCalledOnce();
    unsubscribe();
  });
});
