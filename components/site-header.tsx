"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { BioEvidenceLogo } from "@/components/bioevidence-logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";

const navigation = [
  { href: "/", label: "Product" },
  { href: "/ask", label: "Ask" },
  { href: "/ask?mode=examples", label: "Examples" },
  { href: "/docs", label: "Docs" },
];

const menuNavigation = [
  { href: "/results", label: "Results" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/account", label: "Account" },
];

type ColorMode = "paper" | "focus";

const themeStorageKey = "bioevidence-theme";
const themeChangeEvent = "bioevidence-theme-change";

function getClientColorMode(): ColorMode {
  if (typeof window === "undefined") return "paper";
  return window.localStorage.getItem(themeStorageKey) === "focus" ? "focus" : "paper";
}

function getServerColorMode(): ColorMode {
  return "paper";
}

function subscribeColorMode(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(themeChangeEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(themeChangeEvent, onStoreChange);
  };
}

function saveColorMode(nextMode: ColorMode) {
  document.documentElement.dataset.theme = nextMode;
  window.localStorage.setItem(themeStorageKey, nextMode);
  window.dispatchEvent(new Event(themeChangeEvent));
}

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const liveConfigured = hasSupabaseConfig();
  const supabase = useMemo(
    () => (liveConfigured ? createSupabaseBrowserClient() : null),
    [liveConfigured],
  );
  const visibleNavigation = liveConfigured
    ? navigation
    : navigation.filter((item) => item.href !== "/ask");
  const visibleMenuNavigation = liveConfigured
    ? menuNavigation
    : menuNavigation.filter((item) => item.href !== "/account");
  const colorMode = useSyncExternalStore(
    subscribeColorMode,
    getClientColorMode,
    getServerColorMode,
  );

  useEffect(() => {
    document.documentElement.dataset.theme = colorMode;
  }, [colorMode]);

  useEffect(() => {
    if (!supabase) return;
    // Header state is presentational; protected pages verify the user server-side.
    // INITIAL_SESSION supplies the local session without a public-page auth request.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(Boolean(session?.user));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  function toggleColorMode() {
    const nextMode = colorMode === "paper" ? "focus" : "paper";
    saveColorMode(nextMode);
  }

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="site-brand" href="/" aria-label="BioEvidence AI home">
          <BioEvidenceLogo
            className="bio-logo-mark site-brand-wordmark"
            variant="wordmark"
          />
        </Link>

        <nav className="primary-nav" aria-label="Primary BioEvidence AI sections">
          {visibleNavigation.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : item.href.includes("?")
                  ? false
                  : pathname.startsWith(item.href);
            return (
              <Link
                className={active ? "active" : ""}
                href={item.href}
                key={item.href}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="header-actions">
          {!liveConfigured ? (
            <Link className="header-cta" href="/ask?mode=examples">
              Explore examples
            </Link>
          ) : isSignedIn ? (
            <Link className="header-cta" href="/account">
              Account
            </Link>
          ) : (
            <>
              <Link className="header-signin" href="/signin">
                Sign in
              </Link>
              <Link className="header-cta" href="/request-access">
                Request access
              </Link>
            </>
          )}
          <button
            className="theme-toggle"
            type="button"
            onClick={toggleColorMode}
            aria-label={
              colorMode === "paper"
                ? "Switch to focus color mode"
                : "Switch to paper color mode"
            }
            title={
              colorMode === "paper"
                ? "Switch to focus color mode"
                : "Switch to paper color mode"
            }
          >
            {colorMode === "paper" ? (
              <Moon size={14} aria-hidden="true" />
            ) : (
              <Sun size={14} aria-hidden="true" />
            )}
            <span>{colorMode === "paper" ? "Focus" : "Paper"}</span>
          </button>
          <button
            className="mobile-menu-button"
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <X size={17} aria-hidden="true" />
            ) : (
              <Menu size={17} aria-hidden="true" />
            )}
          </button>
        </div>

        {menuOpen ? (
          <div className="mobile-nav-panel">
            <nav aria-label="BioEvidence AI menu">
              {[...visibleNavigation, ...visibleMenuNavigation].map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : item.href.includes("?")
                      ? false
                      : pathname.startsWith(item.href);
                return (
                  <Link
                    className={active ? "active" : ""}
                    href={item.href}
                    key={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div>
              {!liveConfigured ? (
                <Link href="/ask?mode=examples" onClick={() => setMenuOpen(false)}>
                  Explore examples
                </Link>
              ) : isSignedIn ? (
                <Link href="/account" onClick={() => setMenuOpen(false)}>
                  Account
                </Link>
              ) : (
                <>
                  <Link href="/signin" onClick={() => setMenuOpen(false)}>
                    Sign in
                  </Link>
                  <Link href="/request-access" onClick={() => setMenuOpen(false)}>
                    Request access
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
