/**
 * Shared layout for the ContextKit metadata catalog site.
 *
 * Redesigned with sidebar navigation, top bar with docs link,
 * and a clean dark theme matching the Starlight docs site.
 */

// ---------------------------------------------------------------------------
// HEAD — doctype, meta, fonts, full CSS design system
// ---------------------------------------------------------------------------

export const HEAD = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= pageTitle %> — <%= siteTitle %></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@300;400;500;600&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --accent: #c9a55a;
      --accent-light: #e0be6a;
      --accent-dim: rgba(201, 165, 90, 0.12);
      --accent-border: rgba(201, 165, 90, 0.25);
      --bg: #0a0908;
      --bg-sidebar: #0f0e0d;
      --bg-card: #141312;
      --bg-hover: #1a1918;
      --bg-code: #111010;
      --text: #e8e6e1;
      --text-secondary: #a09d94;
      --text-dim: #6a675e;
      --border: #252320;
      --border-light: #302d28;
      --green: #4aba6a;
      --green-dim: rgba(74, 186, 106, 0.1);
      --red: #d45050;
      --red-dim: rgba(212, 80, 80, 0.08);
      --blue: #5b9cf5;
      --blue-dim: rgba(91, 156, 245, 0.1);
      --purple: #a78bfa;
      --cyan: #22d3ee;
      --orange: #f59e0b;
      --sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      --mono: 'Geist Mono', 'SF Mono', 'Consolas', monospace;
      --sidebar-w: 260px;
      --topbar-h: 48px;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; }

    body {
      font-family: var(--sans);
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }

    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* === TOPBAR === */
    .topbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: var(--topbar-h);
      background: var(--bg-sidebar);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1.25rem;
      z-index: 200;
    }
    .topbar-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .topbar-logo {
      font-family: var(--sans);
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--accent);
      text-decoration: none;
      letter-spacing: -0.02em;
    }
    .topbar-logo:hover { text-decoration: none; }
    .topbar-sep {
      color: var(--border-light);
      font-size: 1.1rem;
      font-weight: 300;
    }
    .topbar-page {
      font-size: 0.8rem;
      color: var(--text-secondary);
    }
    .topbar-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .topbar-link {
      font-size: 0.78rem;
      color: var(--text-dim);
      text-decoration: none;
      transition: color 0.15s;
    }
    .topbar-link:hover { color: var(--text); text-decoration: none; }
    .topbar-docs {
      font-size: 0.72rem;
      font-weight: 500;
      color: var(--accent);
      border: 1px solid var(--accent-border);
      padding: 0.3rem 0.65rem;
      border-radius: 5px;
      text-decoration: none;
      transition: background 0.15s;
    }
    .topbar-docs:hover { background: var(--accent-dim); text-decoration: none; }

    .menu-toggle {
      display: none;
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: 1.3rem;
      cursor: pointer;
      padding: 0.25rem;
    }

    /* === SIDEBAR === */
    .sidebar {
      position: fixed;
      top: var(--topbar-h);
      left: 0;
      bottom: 0;
      width: var(--sidebar-w);
      background: var(--bg-sidebar);
      border-right: 1px solid var(--border);
      overflow-y: auto;
      padding: 1rem 0;
      z-index: 100;
    }
    .sidebar::-webkit-scrollbar { width: 4px; }
    .sidebar::-webkit-scrollbar-track { background: transparent; }
    .sidebar::-webkit-scrollbar-thumb { background: var(--border-light); border-radius: 2px; }

    .sidebar-section {
      padding: 0 0.75rem;
      margin-bottom: 1.25rem;
    }
    .sidebar-heading {
      font-family: var(--mono);
      font-size: 0.6rem;
      font-weight: 600;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--text-dim);
      padding: 0 0.5rem;
      margin-bottom: 0.4rem;
    }
    .sidebar-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.5rem;
      border-radius: 5px;
      font-size: 0.82rem;
      color: var(--text-secondary);
      text-decoration: none;
      transition: background 0.12s, color 0.12s;
    }
    .sidebar-item:hover {
      background: var(--bg-hover);
      color: var(--text);
      text-decoration: none;
    }
    .sidebar-item.active {
      background: var(--accent-dim);
      color: var(--accent-light);
    }
    .sidebar-badge {
      font-family: var(--mono);
      font-size: 0.55rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 0.1rem 0.35rem;
      border-radius: 3px;
      margin-left: auto;
    }
    .sidebar-badge-bronze { color: #b87a4a; background: rgba(184, 122, 74, 0.12); }
    .sidebar-badge-silver { color: #a0a8b8; background: rgba(160, 168, 184, 0.1); }
    .sidebar-badge-gold { color: var(--accent); background: var(--accent-dim); }
    .sidebar-badge-none { color: var(--text-dim); background: rgba(106, 103, 94, 0.1); }

    /* === MAIN CONTENT === */
    .main {
      margin-left: var(--sidebar-w);
      margin-top: var(--topbar-h);
      min-height: calc(100vh - var(--topbar-h));
      padding: 2rem 2.5rem 4rem;
      max-width: calc(900px + var(--sidebar-w));
    }

    /* === BREADCRUMB === */
    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.78rem;
      color: var(--text-dim);
      margin-bottom: 1.5rem;
    }
    .breadcrumb a {
      color: var(--text-secondary);
      text-decoration: none;
    }
    .breadcrumb a:hover { color: var(--text); text-decoration: none; }
    .breadcrumb-sep { color: var(--border-light); }

    /* === PAGE HEADER === */
    .page-header { margin-bottom: 2rem; }
    .page-header h1 {
      font-size: clamp(1.5rem, 3vw, 2rem);
      font-weight: 700;
      letter-spacing: -0.025em;
      color: var(--text);
      line-height: 1.2;
    }
    .page-header .subtitle {
      font-size: 0.95rem;
      color: var(--text-secondary);
      margin-top: 0.4rem;
      font-weight: 300;
      max-width: 600px;
    }

    /* === STATS ROW === */
    .stats-row {
      display: flex;
      gap: 1px;
      background: var(--border);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 2rem;
    }
    .stat-item {
      flex: 1;
      background: var(--bg-card);
      padding: 1rem 1.25rem;
      text-align: center;
      min-width: 80px;
    }
    .stat-val {
      font-family: var(--mono);
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--accent);
      line-height: 1;
    }
    .stat-lbl {
      font-size: 0.65rem;
      color: var(--text-dim);
      margin-top: 0.3rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    /* === SECTION === */
    .section { margin-bottom: 2.5rem; }
    .section-label {
      font-family: var(--mono);
      font-size: 0.6rem;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--text-dim);
      margin-bottom: 0.5rem;
    }
    .section-title {
      font-size: 1.15rem;
      font-weight: 600;
      letter-spacing: -0.015em;
      margin-bottom: 1rem;
      color: var(--text);
    }

    /* === CARDS === */
    .card {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem 1.25rem;
      background: var(--bg-card);
      transition: border-color 0.15s;
    }
    .card:hover { border-color: var(--border-light); }
    .card-link {
      text-decoration: none;
      display: block;
    }
    .card-link:hover { text-decoration: none; }
    .card-link:hover .card { border-color: var(--accent-border); }
    .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.75rem; }

    /* === TAGS === */
    .tag {
      display: inline-flex;
      align-items: center;
      font-family: var(--mono);
      font-size: 0.6rem;
      font-weight: 500;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 0.15rem 0.45rem;
      border-radius: 3px;
      background: rgba(106, 103, 94, 0.1);
      color: var(--text-dim);
      border: 1px solid transparent;
    }
    .tag-gold { color: var(--accent); background: var(--accent-dim); }
    .tag-silver { color: #a0a8b8; background: rgba(160, 168, 184, 0.08); }
    .tag-bronze { color: #b87a4a; background: rgba(184, 122, 74, 0.1); }
    .tag-green { color: var(--green); background: var(--green-dim); }
    .tag-red { color: var(--red); background: var(--red-dim); }
    .tag-blue { color: var(--blue); background: var(--blue-dim); }
    .tag-purple { color: var(--purple); background: rgba(167, 139, 250, 0.1); }

    /* === TABLES === */
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th {
      font-family: var(--mono);
      font-size: 0.6rem;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--text-dim);
      text-align: left;
      padding: 0.6rem 0.75rem;
      border-bottom: 1px solid var(--border);
    }
    .data-table td {
      padding: 0.55rem 0.75rem;
      border-bottom: 1px solid rgba(37, 35, 32, 0.6);
      font-size: 0.82rem;
      vertical-align: top;
    }
    .data-table tr:hover td { background: rgba(201, 165, 90, 0.02); }
    .mono { font-family: var(--mono); }

    /* === SEMANTIC ROLE TAGS === */
    .role-identifier { color: var(--accent); background: var(--accent-dim); }
    .role-metric { color: var(--cyan); background: rgba(34, 211, 238, 0.08); }
    .role-dimension { color: var(--purple); background: rgba(167, 139, 250, 0.08); }
    .role-date { color: var(--green); background: var(--green-dim); }
    .role-attribute { color: var(--text-dim); background: rgba(106, 103, 94, 0.08); }

    /* === DS TYPE TAGS === */
    .ds-fact { color: var(--purple); background: rgba(167, 139, 250, 0.08); }
    .ds-dimension { color: var(--green); background: var(--green-dim); }
    .ds-event { color: var(--orange); background: rgba(245, 158, 11, 0.08); }
    .ds-view { color: var(--blue); background: var(--blue-dim); }

    /* === GOV GRID === */
    .gov-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 1px;
      background: var(--border);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }
    .gov-cell {
      background: var(--bg-card);
      padding: 0.75rem 1rem;
    }
    .gov-label {
      font-family: var(--mono);
      font-size: 0.55rem;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--text-dim);
      margin-bottom: 0.2rem;
    }
    .gov-value { font-size: 0.85rem; color: var(--text); }

    /* === EXPANDABLE === */
    .expandable-header {
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      user-select: none;
    }
    .expand-icon {
      font-family: var(--mono);
      font-size: 0.85rem;
      color: var(--text-dim);
      width: 18px;
      text-align: center;
      transition: transform 0.15s;
    }
    .expandable-content {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.25s ease;
    }

    /* === QUERY CARD === */
    .query-card {
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      background: var(--bg-card);
      margin-bottom: 1rem;
      transition: border-color 0.15s;
    }
    .query-card:hover { border-color: var(--border-light); }
    .query-q {
      padding: 1rem 1.25rem;
      font-size: 0.95rem;
      font-weight: 500;
      font-style: italic;
      color: var(--text);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
    }
    .query-q-badge {
      font-family: var(--mono);
      font-size: 0.55rem;
      font-style: normal;
      font-weight: 600;
      color: var(--accent);
      background: var(--accent-dim);
      border: 1px solid var(--accent-border);
      padding: 0.1rem 0.3rem;
      border-radius: 3px;
      flex-shrink: 0;
      margin-top: 0.2rem;
    }
    .query-sql {
      padding: 0.85rem 1.25rem;
      font-family: var(--mono);
      font-size: 0.75rem;
      color: var(--text-secondary);
      line-height: 1.7;
      background: var(--bg-code);
      overflow-x: auto;
      white-space: pre-wrap;
    }
    .query-meta {
      padding: 0.5rem 1.25rem;
      display: flex;
      gap: 0.75rem;
      font-size: 0.65rem;
      color: var(--text-dim);
      border-top: 1px solid var(--border);
    }

    /* === GUARDRAIL === */
    .guardrail {
      border: 1px solid rgba(212, 80, 80, 0.15);
      border-radius: 8px;
      padding: 1rem 1.25rem;
      background: var(--red-dim);
      margin-bottom: 0.75rem;
    }
    .guardrail-name {
      font-family: var(--mono);
      font-size: 0.8rem;
      color: var(--red);
      margin-bottom: 0.35rem;
      font-weight: 500;
    }
    .guardrail-filter {
      font-family: var(--mono);
      font-size: 0.75rem;
      color: var(--text);
      background: var(--bg-code);
      padding: 0.35rem 0.6rem;
      border-radius: 4px;
      border: 1px solid var(--border);
      display: inline-block;
      margin-bottom: 0.4rem;
    }
    .guardrail-reason {
      font-size: 0.8rem;
      color: var(--text-secondary);
      font-weight: 300;
    }

    /* === LINEAGE === */
    .lineage-flow {
      display: flex;
      align-items: stretch;
      gap: 0;
      overflow-x: auto;
      padding: 1rem 0;
    }
    .lineage-col { display: flex; flex-direction: column; gap: 0.5rem; min-width: 200px; }
    .lineage-col-label {
      font-family: var(--mono);
      font-size: 0.55rem;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--text-dim);
      margin-bottom: 0.15rem;
      padding-left: 0.5rem;
    }
    .lineage-node {
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.6rem 0.85rem;
      background: var(--bg-card);
    }
    .lineage-node-name { font-family: var(--mono); font-size: 0.75rem; color: var(--text); }
    .lineage-node-detail { font-size: 0.65rem; color: var(--text-dim); margin-top: 0.1rem; }
    .lineage-arrow {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 40px;
      color: var(--text-dim);
      font-size: 1rem;
    }

    /* === SCORECARD === */
    .scorecard {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1px;
      background: var(--border);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }
    @media (max-width: 768px) { .scorecard { grid-template-columns: 1fr; } }
    .sc-tier { background: var(--bg-card); padding: 1.25rem; }
    .sc-tier-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;
    }
    .sc-tier-name { font-size: 0.9rem; font-weight: 600; text-transform: capitalize; }
    .sc-tier-name.bronze { color: #b87a4a; }
    .sc-tier-name.silver { color: #a0a8b8; }
    .sc-tier-name.gold { color: var(--accent); }
    .sc-status {
      font-family: var(--mono);
      font-size: 0.55rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 0.12rem 0.4rem;
      border-radius: 3px;
    }
    .sc-status.pass { color: var(--green); background: var(--green-dim); }
    .sc-status.fail { color: var(--red); background: var(--red-dim); }
    .check-list { list-style: none; }
    .check-item {
      display: flex;
      align-items: flex-start;
      gap: 0.35rem;
      padding: 0.2rem 0;
      font-size: 0.72rem;
      color: var(--text-secondary);
      line-height: 1.4;
    }
    .check-icon { flex-shrink: 0; margin-top: 1px; font-size: 0.75rem; }
    .check-icon.pass { color: var(--green); }
    .check-icon.fail { color: var(--red); }

    /* === GLOSSARY === */
    .glossary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 0.75rem;
    }
    .glossary-card { position: relative; overflow: hidden; }
    .glossary-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      background: linear-gradient(90deg, var(--accent-border), transparent);
    }
    .glossary-term {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.35rem;
      color: var(--text);
    }
    .glossary-def {
      font-size: 0.82rem;
      color: var(--text-secondary);
      line-height: 1.6;
      font-weight: 300;
    }

    /* === SEARCH INPUT === */
    .search-input {
      width: 100%;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.6rem 1rem;
      font-family: var(--sans);
      font-size: 0.9rem;
      color: var(--text);
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .search-input::placeholder { color: var(--text-dim); }
    .search-input:focus {
      border-color: var(--accent-border);
      box-shadow: 0 0 0 3px var(--accent-dim);
    }

    /* === SQL HIGHLIGHT === */
    .sql-kw { color: var(--purple); }
    .sql-fn { color: var(--green); }
    .sql-str { color: var(--orange); }
    .sql-num { color: var(--orange); }

    /* === METRIC === */
    .metric-name {
      font-family: var(--mono);
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--accent-light);
      margin-bottom: 0.35rem;
    }
    .metric-desc { color: var(--text-secondary); font-size: 0.82rem; line-height: 1.6; margin-bottom: 0.75rem; }
    .metric-formula {
      font-family: var(--mono);
      font-size: 0.7rem;
      color: var(--text-dim);
      background: var(--bg-code);
      border: 1px solid var(--border);
      border-radius: 5px;
      padding: 0.5rem 0.7rem;
      overflow-x: auto;
    }

    /* === FOOTER === */
    .site-footer {
      margin-left: var(--sidebar-w);
      text-align: center;
      padding: 2rem 1.5rem;
      color: var(--text-dim);
      font-size: 0.72rem;
      border-top: 1px solid var(--border);
    }
    .site-footer a { color: var(--text-dim); }
    .site-footer a:hover { color: var(--accent); }

    /* === RESPONSIVE === */
    @media (max-width: 860px) {
      .sidebar {
        transform: translateX(-100%);
        transition: transform 0.25s ease;
        z-index: 300;
      }
      .sidebar.open { transform: translateX(0); }
      .main { margin-left: 0; padding: 1.5rem 1.25rem 3rem; }
      .site-footer { margin-left: 0; }
      .menu-toggle { display: block; }
      .stats-row { flex-wrap: wrap; }
      .stat-item { min-width: 60px; }
      .overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        z-index: 250;
        display: none;
      }
      .overlay.open { display: block; }
    }
  </style>
<% if (typeof studioMode !== 'undefined' && studioMode) { %>
  <style>
    .edit-btn { background: none; border: 1px solid #c9a55a; color: #c9a55a; border-radius: 4px; padding: 2px 8px; font-size: 12px; cursor: pointer; margin-left: 8px; opacity: 0.6; transition: opacity 0.2s; }
    .edit-btn:hover { opacity: 1; }
    .editable { cursor: text; border-bottom: 1px dashed #c9a55a40; transition: border-color 0.2s; }
    .editable:hover { border-bottom-color: #c9a55a; }
    .editable:focus { outline: none; border-bottom: 2px solid #c9a55a; background: #c9a55a10; }
    .staged-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #1a1a2e; border-top: 2px solid #c9a55a; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; z-index: 1000; box-shadow: 0 -4px 12px rgba(0,0,0,0.3); }
    .staged-btn { border: none; border-radius: 6px; padding: 8px 20px; font-size: 14px; cursor: pointer; font-weight: 500; }
    .staged-btn.primary { background: #c9a55a; color: #0a0a0f; }
    .staged-btn.primary:hover { background: #d4b06a; }
    .staged-btn.secondary { background: transparent; border: 1px solid #666; color: #999; }
    .staged-btn.secondary:hover { border-color: #999; color: #fff; }
    .diff-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 2000; display: flex; align-items: center; justify-content: center; }
    .diff-modal-content { background: #1a1a2e; border: 1px solid #333; border-radius: 12px; padding: 24px; max-width: 800px; width: 90%; max-height: 80vh; overflow-y: auto; }
    .diff-modal-content h2 { margin: 0 0 16px; color: #c9a55a; }
    .diff-file { margin: 12px 0; padding: 12px; background: #0a0a0f; border-radius: 8px; font-family: monospace; font-size: 13px; white-space: pre-wrap; }
    .diff-file-name { color: #888; font-size: 12px; margin-bottom: 8px; }
    .diff-add { color: #4ade80; }
    .diff-del { color: #f87171; }
    .diff-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 16px; }
    .toast { position: fixed; top: 20px; right: 20px; background: #1a1a2e; border: 1px solid #c9a55a; color: #e0e0e0; padding: 12px 20px; border-radius: 8px; z-index: 3000; animation: toast-in 0.3s ease-out; }
    @keyframes toast-in { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .studio-add-btn { background: none; border: 1px dashed #c9a55a60; color: #c9a55a; border-radius: 8px; padding: 12px; width: 100%; cursor: pointer; font-size: 14px; transition: all 0.2s; }
    .studio-add-btn:hover { border-color: #c9a55a; background: #c9a55a10; }
  </style>
<% } %>
</head>`;

// ---------------------------------------------------------------------------
// SIDEBAR_DATA — EJS logic to build sidebar model list
// ---------------------------------------------------------------------------

export const SIDEBAR_DATA = `<%
  var _sidebarModels = typeof models !== 'undefined' ? Object.keys(models) : (typeof model !== 'undefined' ? [model.name] : []);
  var _sidebarTiers = typeof tiers !== 'undefined' ? tiers : (typeof tier !== 'undefined' && typeof model !== 'undefined' ? (function(){ var t = {}; t[model.name] = tier; return t; })() : {});
%>`;

// ---------------------------------------------------------------------------
// TOPBAR
// ---------------------------------------------------------------------------

export const TOPBAR = `<div class="topbar">
  <div class="topbar-left">
    <button class="menu-toggle" onclick="toggleSidebar()" aria-label="Toggle menu">&#9776;</button>
    <a href="<%= basePath %>/index.html" class="topbar-logo"><%- siteTitle %></a>
    <span class="topbar-sep">/</span>
    <span class="topbar-page"><%= pageTitle %></span>
  </div>
  <div class="topbar-right">
    <a href="<%= basePath %>/search.html" class="topbar-link">Search</a>
    <a href="https://contextkit.dev" class="topbar-docs" target="_blank" rel="noopener">Docs &nearr;</a>
  </div>
</div>`;

// ---------------------------------------------------------------------------
// SIDEBAR
// ---------------------------------------------------------------------------

export const SIDEBAR = `<div class="overlay" id="sidebar-overlay" onclick="toggleSidebar()"></div>
<nav class="sidebar" id="sidebar">
  <div class="sidebar-section">
    <div class="sidebar-heading">Navigation</div>
    <a href="<%= basePath %>/index.html" class="sidebar-item<%= pageTitle === 'Home' ? ' active' : '' %>">
      <span>Home</span>
    </a>
    <a href="<%= basePath %>/glossary.html" class="sidebar-item<%= pageTitle === 'Glossary' ? ' active' : '' %>">
      <span>Glossary</span>
    </a>
    <a href="<%= basePath %>/search.html" class="sidebar-item<%= pageTitle === 'Search' ? ' active' : '' %>">
      <span>Search</span>
    </a>
  </div>
  <% if (_sidebarModels.length > 0) { %>
  <div class="sidebar-section">
    <div class="sidebar-heading">Models</div>
    <% for (var _sm of _sidebarModels) { %>
      <a href="<%= basePath %>/models/<%= _sm %>.html" class="sidebar-item<%= (typeof model !== 'undefined' && model.name === _sm) ? ' active' : '' %>">
        <span class="mono" style="font-size:0.78rem;"><%= _sm %></span>
        <% if (_sidebarTiers[_sm]) { %>
          <span class="sidebar-badge sidebar-badge-<%= _sidebarTiers[_sm].tier || 'none' %>"><%= _sidebarTiers[_sm].tier || '\\u2014' %></span>
        <% } %>
      </a>
    <% } %>
  </div>
  <% } %>
</nav>`;

// ---------------------------------------------------------------------------
// FOOTER
// ---------------------------------------------------------------------------

export const FOOTER = `<footer class="site-footer">
  Generated by <a href="https://github.com/erickittelson/ContextKit">ContextKit</a>
  &nbsp;&middot;&nbsp;
  <a href="https://contextkit.dev" target="_blank" rel="noopener">Documentation</a>
</footer>`;

// ---------------------------------------------------------------------------
// TIER_BADGE
// ---------------------------------------------------------------------------

export const TIER_BADGE = `<% function tierBadge(tier) {
  var cls = { none: '', bronze: 'tag-bronze', silver: 'tag-silver', gold: 'tag-gold' };
  var c = cls[tier] || '';
  return '<span class="tag ' + c + '">' + (tier || 'none') + '</span>';
} %>`;

// ---------------------------------------------------------------------------
// SCRIPTS
// ---------------------------------------------------------------------------

export const SCRIPTS = `<script>
(function() {
  // Sidebar toggle (mobile)
  window.toggleSidebar = function() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('open');
  };

  // Expandable sections
  window.toggleExpand = function(id) {
    var el = document.getElementById(id);
    var icon = document.getElementById(id + '-icon');
    if (!el) return;
    if (el.style.maxHeight && el.style.maxHeight !== '0px') {
      el.style.maxHeight = '0px';
      if (icon) icon.textContent = '+';
    } else {
      el.style.maxHeight = el.scrollHeight + 'px';
      if (icon) icon.textContent = '\\u2212';
    }
  };

  // SQL syntax highlighter — operates on trusted, template-rendered content only.
  // The SQL blocks contain server-rendered code snippets from the user's own
  // golden queries / business rules, not arbitrary user input.
  window.highlightSQL = function() {
    var blocks = document.querySelectorAll('.sql-highlight');
    var kw = /\\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|ON|AND|OR|NOT|IN|AS|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|UNION|ALL|DISTINCT|CASE|WHEN|THEN|ELSE|END|IS|NULL|BETWEEN|LIKE|EXISTS|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|SET|VALUES|INTO|WITH|DESC|ASC|OVER|PARTITION|WINDOW|FILTER|LATERAL|UNNEST|TRUE|FALSE)\\b/gi;
    var fn = /\\b(SUM|COUNT|AVG|MIN|MAX|ROUND|COALESCE|CAST|NULLIF|ABS|UPPER|LOWER|LENGTH|TRIM|SUBSTRING|CONCAT|ROW_NUMBER|RANK|DENSE_RANK|LAG|LEAD|FIRST_VALUE|LAST_VALUE|NTILE|PERCENTILE_CONT|STRING_AGG|ARRAY_AGG|LIST|STRUCT_PACK)\\b/gi;
    var str = /('(?:[^'\\\\]|\\\\.)*')/g;
    blocks.forEach(function(block) {
      var text = block.textContent || '';
      // Escape HTML entities first to prevent injection
      var div = document.createElement('div');
      div.appendChild(document.createTextNode(text));
      text = div.textContent || '';
      text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      text = text.replace(str, '<span class="sql-str">$1</span>');
      text = text.replace(kw, '<span class="sql-kw">$&</span>');
      text = text.replace(fn, '<span class="sql-fn">$&</span>');
      // Safe: content is from trusted template-rendered golden queries
      block.innerHTML = text;
    });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.highlightSQL);
  } else {
    window.highlightSQL();
  }
})();
</script>
<% if (typeof studioMode !== 'undefined' && studioMode) { %>
<div class="staged-bar" id="staged-bar" style="display:none;">
  <span id="staged-count" style="color:#c9a55a;font-weight:500;">0 changes staged</span>
  <div>
    <button onclick="previewAndSave()" class="staged-btn primary">Preview &amp; Save</button>
    <button onclick="discardEdits()" class="staged-btn secondary" style="margin-left:8px;">Discard</button>
  </div>
</div>
<div class="diff-modal" id="diff-modal" style="display:none;">
  <div class="diff-modal-content">
    <h2>Review Changes</h2>
    <div id="diff-container"></div>
    <div class="diff-actions">
      <button onclick="confirmSave()" class="staged-btn primary">Save All</button>
      <button onclick="closeDiffModal()" class="staged-btn secondary">Cancel</button>
    </div>
  </div>
</div>
<script>
window.studioState = { edits: [] };

function stageEdit(file, path, value, label) {
  window.studioState.edits = window.studioState.edits.filter(
    e => !(e.file === file && e.path === path)
  );
  window.studioState.edits.push({ file, path, value, label });
  updateStagedBar();
}

function updateStagedBar() {
  const bar = document.getElementById('staged-bar');
  const count = document.getElementById('staged-count');
  if (!bar || !count) return;
  const n = window.studioState.edits.length;
  bar.style.display = n > 0 ? 'flex' : 'none';
  count.textContent = n + ' change' + (n !== 1 ? 's' : '') + ' staged';
}

function discardEdits() {
  window.studioState.edits = [];
  updateStagedBar();
  document.querySelectorAll('.editable[contenteditable="true"]').forEach(el => {
    el.contentEditable = 'false';
    if (el.dataset.original) el.textContent = el.dataset.original;
  });
}

async function previewAndSave() {
  const edits = window.studioState.edits;
  if (edits.length === 0) return;

  const fileGroups = {};
  for (const edit of edits) {
    if (!fileGroups[edit.file]) fileGroups[edit.file] = [];
    fileGroups[edit.file].push(edit);
  }

  const previews = [];
  for (const [file, fileEdits] of Object.entries(fileGroups)) {
    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: fileEdits[0].file, path: fileEdits[0].path, value: fileEdits[0].value }),
      });
      const data = await res.json();
      previews.push({ file, edits: fileEdits, ...data });
    } catch (err) {
      previews.push({ file, edits: fileEdits, error: err.message });
    }
  }

  showDiffModal(previews);
}

function showDiffModal(previews) {
  const modal = document.getElementById('diff-modal');
  const container = document.getElementById('diff-container');
  if (!modal || !container) return;

  container.innerHTML = previews.map(p => {
    if (p.error) {
      return '<div class="diff-file"><div class="diff-file-name">' + p.file + '</div><span class="diff-del">Error: ' + p.error + '</span></div>';
    }
    const editList = p.edits.map(e => '<div class="diff-add">  ' + e.label + ': ' + JSON.stringify(e.value) + '</div>').join('');
    return '<div class="diff-file"><div class="diff-file-name">' + p.file + '</div>' + editList + '</div>';
  }).join('');

  modal.style.display = 'flex';
}

function closeDiffModal() {
  const modal = document.getElementById('diff-modal');
  if (modal) modal.style.display = 'none';
}

async function confirmSave() {
  const edits = window.studioState.edits;
  if (edits.length === 0) return;

  try {
    const res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ edits }),
    });
    const data = await res.json();
    const ok = data.results.filter(r => r.ok).length;
    showToast(ok + ' file(s) saved');
    window.studioState.edits = [];
    updateStagedBar();
    closeDiffModal();
  } catch (err) {
    showToast('Save failed: ' + err.message);
  }
}

function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function initSSE() {
  const es = new EventSource('/api/events');
  es.addEventListener('update', function(e) {
    try {
      const data = JSON.parse(e.data);
      showToast('Recompiled — ' + data.diagnosticCount + ' diagnostics');
      setTimeout(() => location.reload(), 500);
    } catch {}
  });
}

function makeEditable(el) {
  el.addEventListener('click', function() {
    if (el.contentEditable === 'true') return;
    el.dataset.original = el.textContent;
    el.contentEditable = 'true';
    el.focus();
  });
  el.addEventListener('blur', function() {
    el.contentEditable = 'false';
    const newVal = el.textContent.trim();
    if (newVal !== el.dataset.original) {
      stageEdit(el.dataset.file, el.dataset.path, newVal, el.dataset.label || el.dataset.path);
      el.style.borderBottomColor = '#4ade80';
      setTimeout(() => { el.style.borderBottomColor = ''; }, 1000);
    }
  });
  el.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      el.blur();
    }
    if (e.key === 'Escape') {
      el.textContent = el.dataset.original;
      el.contentEditable = 'false';
    }
  });
}

function makeDropdown(el) {
  el.addEventListener('click', function(e) {
    document.querySelectorAll('.studio-dropdown').forEach(d => d.remove());

    const options = (el.dataset.options || '').split(',');
    const dropdown = document.createElement('div');
    dropdown.className = 'studio-dropdown';
    dropdown.style.cssText = 'position:absolute;background:#1a1a2e;border:1px solid #c9a55a;border-radius:6px;padding:4px 0;z-index:500;min-width:120px;box-shadow:0 4px 12px rgba(0,0,0,0.4);';

    options.forEach(opt => {
      const item = document.createElement('div');
      item.textContent = opt.trim();
      item.style.cssText = 'padding:6px 16px;cursor:pointer;color:#e0e0e0;font-size:13px;';
      item.addEventListener('mouseenter', () => { item.style.background = '#c9a55a20'; });
      item.addEventListener('mouseleave', () => { item.style.background = 'none'; });
      item.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const val = opt.trim();
        el.textContent = val;
        stageEdit(el.dataset.file, el.dataset.path, val, el.dataset.label || el.dataset.path);
        dropdown.remove();
        el.style.borderBottomColor = '#4ade80';
        setTimeout(() => { el.style.borderBottomColor = ''; }, 1000);
      });
      dropdown.appendChild(item);
    });

    const rect = el.getBoundingClientRect();
    dropdown.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    dropdown.style.left = (rect.left + window.scrollX) + 'px';
    document.body.appendChild(dropdown);

    setTimeout(() => {
      document.addEventListener('click', function closer() {
        dropdown.remove();
        document.removeEventListener('click', closer);
      }, { once: true });
    }, 0);
  });
}

document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.editable').forEach(makeEditable);
  document.querySelectorAll('.dropdown-editable').forEach(makeDropdown);
  initSSE();
});
</script>
<% } %>`;

// ---------------------------------------------------------------------------
// Studio mode constants — exported for use in page-specific templates
// ---------------------------------------------------------------------------

export const STUDIO_CSS = `
.edit-btn { background: none; border: 1px solid #c9a55a; color: #c9a55a; border-radius: 4px; padding: 2px 8px; font-size: 12px; cursor: pointer; margin-left: 8px; opacity: 0.6; transition: opacity 0.2s; }
.edit-btn:hover { opacity: 1; }
.editable { cursor: text; border-bottom: 1px dashed #c9a55a40; transition: border-color 0.2s; }
.editable:hover { border-bottom-color: #c9a55a; }
.editable:focus { outline: none; border-bottom: 2px solid #c9a55a; background: #c9a55a10; }
.staged-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #1a1a2e; border-top: 2px solid #c9a55a; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; z-index: 1000; box-shadow: 0 -4px 12px rgba(0,0,0,0.3); }
.staged-btn { border: none; border-radius: 6px; padding: 8px 20px; font-size: 14px; cursor: pointer; font-weight: 500; }
.staged-btn.primary { background: #c9a55a; color: #0a0a0f; }
.staged-btn.primary:hover { background: #d4b06a; }
.staged-btn.secondary { background: transparent; border: 1px solid #666; color: #999; }
.staged-btn.secondary:hover { border-color: #999; color: #fff; }
.diff-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 2000; display: flex; align-items: center; justify-content: center; }
.diff-modal-content { background: #1a1a2e; border: 1px solid #333; border-radius: 12px; padding: 24px; max-width: 800px; width: 90%; max-height: 80vh; overflow-y: auto; }
.diff-modal-content h2 { margin: 0 0 16px; color: #c9a55a; }
.diff-file { margin: 12px 0; padding: 12px; background: #0a0a0f; border-radius: 8px; font-family: monospace; font-size: 13px; white-space: pre-wrap; }
.diff-file-name { color: #888; font-size: 12px; margin-bottom: 8px; }
.diff-add { color: #4ade80; }
.diff-del { color: #f87171; }
.diff-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 16px; }
.toast { position: fixed; top: 20px; right: 20px; background: #1a1a2e; border: 1px solid #c9a55a; color: #e0e0e0; padding: 12px 20px; border-radius: 8px; z-index: 3000; animation: toast-in 0.3s ease-out; }
@keyframes toast-in { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.studio-add-btn { background: none; border: 1px dashed #c9a55a60; color: #c9a55a; border-radius: 8px; padding: 12px; width: 100%; cursor: pointer; font-size: 14px; transition: all 0.2s; }
.studio-add-btn:hover { border-color: #c9a55a; background: #c9a55a10; }
`;

export const STAGED_BAR = `<div class="staged-bar" id="staged-bar" style="display:none;">
  <span id="staged-count" style="color:#c9a55a;font-weight:500;">0 changes staged</span>
  <div>
    <button onclick="previewAndSave()" class="staged-btn primary">Preview &amp; Save</button>
    <button onclick="discardEdits()" class="staged-btn secondary" style="margin-left:8px;">Discard</button>
  </div>
</div>`;

export const DIFF_MODAL = `<div class="diff-modal" id="diff-modal" style="display:none;">
  <div class="diff-modal-content">
    <h2>Review Changes</h2>
    <div id="diff-container"></div>
    <div class="diff-actions">
      <button onclick="confirmSave()" class="staged-btn primary">Save All</button>
      <button onclick="closeDiffModal()" class="staged-btn secondary">Cancel</button>
    </div>
  </div>
</div>`;
