/**
 * SiteHeader — the persistent top navigation.
 *
 * Lives in a layout component that wraps EVERY route, so the navbar never
 * unmounts on route transitions. The logo + nav + theme/lang/profile chip
 * stay rendered while React Router swaps the inner page via <Outlet />.
 *
 * Per the request: "replace the full main menu with headless menu (so
 * always visible, does not reload on pages)".
 *
 * If you ever need a route to NOT show this header (e.g. /writing/[slug]
 * uses a different chrome), wrap that route in a sibling layout that
 * doesn't include this component.
 */

import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

const THEME_KEY = "hvl-theme";
const LANG_KEY = "hvl-lang";

type Lang = "nl" | "en";

export default function SiteHeader() {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    (localStorage.getItem(THEME_KEY) as "light" | "dark") || "light",
  );
  const [lang, setLang] = useState<Lang>(() =>
    (localStorage.getItem(LANG_KEY) as Lang) || "nl",
  );
  const location = useLocation();
  const inPortal = location.pathname.startsWith("/portal") ||
                   location.pathname.startsWith("/write") ||
                   location.pathname.startsWith("/blog-cms");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem(LANG_KEY, lang);
  }, [lang]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <header className="site-header">
      <Link to="/" className="site-header-brand" aria-label="Hans van Leeuwen — home">
        <img src="/h-logo.png" alt="" className="site-header-logo" />
        <span className="site-header-brand-word">Hans van Leeuwen</span>
      </Link>

      <nav className="site-header-nav" aria-label="Main">
        <NavLink to="/" end className={({ isActive }) => isActive ? "current" : ""}>Home</NavLink>
        <NavLink to="/work" className={({ isActive }) => isActive ? "current" : ""}>Werk</NavLink>
        <NavLink to="/writing" className={({ isActive }) => isActive ? "current" : ""}>Artikelen</NavLink>
        <NavLink to="/about" className={({ isActive }) => isActive ? "current" : ""}>Over Hans</NavLink>
        {inPortal && (
          <span className="current" aria-current="page">Command Center</span>
        )}
        {!inPortal && (
          <NavLink to="/portal/blog" className={({ isActive }) => isActive ? "current" : ""}>Command Center</NavLink>
        )}
      </nav>

      <div className="site-header-end">
        <button className="site-icon-btn" title="Search" aria-label="Search">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
        <button className="site-icon-btn" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
          {theme === "dark" ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M13 9.5A5.5 5.5 0 016.5 3 5.5 5.5 0 1013 9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
        <div className="site-lang-toggle" role="tablist" aria-label="Language">
          <button onClick={() => setLang("nl")} className={lang === "nl" ? "active" : ""}>NL</button>
          <button onClick={() => setLang("en")} className={lang === "en" ? "active" : ""}>EN</button>
        </div>
        <button className="site-profile-chip" aria-label="Profile">
          <span className="avatar">H</span>
          <span>Hans</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </header>
  );
}
