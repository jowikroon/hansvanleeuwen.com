/**
 * RootLayout — the single layout that wraps EVERY route in the app.
 *
 * The <SiteHeader /> rendered inside this component does NOT unmount when
 * the user navigates between pages — React Router swaps only what's
 * inside <Outlet />. That's the "headless menu, doesn't reload on pages"
 * the spec called for.
 *
 * Usage in App.tsx:
 *
 *   <BrowserRouter>
 *     <Routes>
 *       <Route element={<RootLayout />}>
 *         <Route path="/" element={<Home />} />
 *         <Route path="/work" element={<Work />} />
 *         <Route path="/writing" element={<Writing />} />
 *         <Route path="/about" element={<About />} />
 *         <Route path="/portal/blog" element={<Write />} />   // future: split into 4 routes (write/manage/analytics/voice)
 *         <Route path="/write" element={<Write />} />
 *       </Route>
 *     </Routes>
 *   </BrowserRouter>
 *
 * See LAYOUT_MIGRATION.md for the full restructure.
 */

import { Outlet } from "react-router-dom";
import SiteHeader from "./SiteHeader";
import "@/styles/site-header.css";

export default function RootLayout() {
  return (
    <>
      <SiteHeader />
      <main className="site-main">
        <Outlet />
      </main>
    </>
  );
}
