# Spec: UI Tabs — Heatmap + Tax Breakdown Views

## Overview

Add two new views to the results section (Heatmap and Tax Breakdown) alongside the
existing fund table, accessed via a three-tab nav bar. No new pages, no scroll changes —
just a tab switcher that swaps content panels while the recommendation card and historical
chart remain always visible.

**Design decisions already approved during brainstorming:**
- Layout: tabbed views (Table / Heatmap / Tax Breakdown)
- Tax Breakdown style: stacked horizontal bars (green = tax saved, blue = net yield, amber = expense)
- Heatmap style: color bubble grid — each fund is a tile with large TEY, ticker, fund category, color-intensity by yield; top fund gets a star

---

## Files to Modify

| File | Action | Est. lines |
|------|--------|-----------|
| `public/index.html` | Add tab bar HTML + 3 panel wrappers, bump `?v=7` | +22, ~10 moved |
| `public/css/styles.css` | Add tab, heatmap, breakdown CSS rules | +130 |
| `public/js/app.js` | Add tab state, switchTab, renderHeatmap, renderBreakdown, wire events | +130 |

**No changes to:** `data-utils.js`, `tax-calculator.js`, `chart-handler.js`, `server.js`, `tests/`.

---

## Approach

### Why tabs (not scroll sections)?
Tabs keep the page height stable. The table already has a scroll container; adding two more
long sections would push the historical chart way down and hurt UX on mobile.

### Why client-side only?
All data for the new tabs (`calculatedResults`) is already computed and stored in `state`
inside `app.js`. No new API calls, no new data transforms — just two new rendering functions.

---

## Phase 1: HTML changes (`public/index.html`)

### Current structure (condensed)

```html
<section id="results-section">
  <div class="loading" id="loading">…</div>
  <div class="recommendation-card hidden" id="recommendation-card">…</div>
  <div class="table-wrapper hidden" id="table-wrapper">…</div>  <!-- table + scroll + footer -->
  <div class="error-state hidden" id="error-state">…</div>
</section>
```

### Target structure

```html
<section id="results-section">
  <div class="loading" id="loading">…</div>
  <div class="recommendation-card hidden" id="recommendation-card">…</div>

  <!-- NEW: tab bar -->
  <div class="results-tabs hidden" id="results-tabs">
    <button class="tab-btn active" data-tab="table">Table</button>
    <button class="tab-btn" data-tab="heatmap">Heatmap</button>
    <button class="tab-btn" data-tab="breakdown">Tax Breakdown</button>
  </div>

  <!-- Table panel: wraps the existing table-wrapper -->
  <div class="tab-panel" id="panel-table">
    <div class="table-wrapper" id="table-wrapper">…</div>  <!-- unchanged interior -->
  </div>

  <!-- NEW: Heatmap panel -->
  <div class="tab-panel hidden" id="panel-heatmap"></div>

  <!-- NEW: Tax Breakdown panel -->
  <div class="tab-panel hidden" id="panel-breakdown"></div>

  <div class="error-state hidden" id="error-state">…</div>
</section>
```

**Key constraint:** `#table-wrapper` currently has `class="table-wrapper hidden"` and is
shown/hidden directly by `app.js` (lines 246, 258). We move it inside `#panel-table` and
keep all existing show/hide logic — `panel-table` is shown when Table tab is active, and
`table-wrapper`'s `hidden` class toggle from `displayResultsTable` continues to work.

**Bump cache busters:**
- Line 20: `css/styles.css?v=5` → `css/styles.css?v=7`
- Lines 389–392: all `?v=6` → `?v=7`

---

## Phase 2: CSS additions (`public/css/styles.css`)

Append to end of file (~line 1413). Uses existing CSS variables throughout.

### Tab bar

```css
/* ==============================
   Results Tabs
   ============================== */
.results-tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1rem;
  border-bottom: 2px solid var(--border-light);
  padding-bottom: 0;
}

.tab-btn {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  padding: 0.5rem 1.25rem;
  font-family: var(--font-family);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-light);
  cursor: pointer;
  transition: color var(--transition-fast), border-color var(--transition-fast);
}

.tab-btn:hover { color: var(--text-dark); }

.tab-btn.active {
  color: var(--primary-blue);
  border-bottom-color: var(--primary-blue);
}

.tab-panel { display: block; }
.tab-panel.hidden { display: none; }
```

### Heatmap bubble grid

```css
/* ==============================
   Heatmap Tab
   ============================== */
.bubble-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.75rem;
  padding: 0.5rem 0 1rem;
}

.bubble {
  border-radius: var(--radius-md);
  padding: 0.75rem;
  cursor: pointer;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  position: relative;
}

.bubble:hover {
  transform: scale(1.04);
  box-shadow: var(--shadow-md);
}

.bubble-ticker {
  font-size: 0.7rem;
  font-weight: 700;
  margin-bottom: 0.2rem;
}

.bubble-tey {
  font-size: 1.15rem;
  font-weight: 800;
  line-height: 1.1;
}

.bubble-category {
  font-size: 0.6rem;
  margin-top: 0.2rem;
  opacity: 0.8;
}

.bubble-star {
  position: absolute;
  top: 0.4rem;
  right: 0.5rem;
  font-size: 0.75rem;
}

/* Yield intensity colours — applied inline via JS */
/* high:   bg #a7f3d0 / text #064e3b / border #10b981  (≥ ~90th pctile) */
/* mid-hi: bg #d1fae5 / text #065f46                   (≥ ~65th) */
/* mid:    bg #fef9c3 / text #713f12                   (≥ ~35th) */
/* low:    bg #fee2e2 / text #991b1b                   (below)  */

.tey-scale-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}

.tey-scale-gradient {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(to right, #fee2e2, #fef9c3, #d1fae5, #a7f3d0);
}
```

### Tax Breakdown stacked bars

```css
/* ==============================
   Tax Breakdown Tab
   ============================== */
.breakdown-legend {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
  font-size: 0.75rem;
  color: var(--text-light);
}

.breakdown-legend-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.breakdown-legend-swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
}

.breakdown-rows {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding-bottom: 1rem;
}

.breakdown-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.78rem;
  cursor: pointer;
}

.breakdown-row:hover .stacked-bar { box-shadow: var(--shadow-xs); }

.breakdown-ticker {
  width: 48px;
  font-weight: 700;
  font-size: 0.7rem;
  color: var(--text-light);
  flex-shrink: 0;
}

.stacked-bar {
  display: flex;
  height: 18px;
  border-radius: 4px;
  overflow: hidden;
  flex: 1;
  background: var(--bg-gray);
}

.seg-tax  { background: #10b981; }
.seg-net  { background: #3b82f6; opacity: 0.85; }
.seg-exp  { background: #f59e0b; opacity: 0.9; }

.breakdown-tey {
  width: 44px;
  text-align: right;
  font-weight: 700;
  font-size: 0.75rem;
  flex-shrink: 0;
  color: var(--text-dark);
}

.breakdown-tey.top { color: var(--primary-blue); }
```

---

## Phase 3: JavaScript additions (`public/js/app.js`)

### 3a. New state field

In the `state` object (near the top of the IIFE, before `init`):

```js
// existing fields:
// state.funds, state.userProfile, state.calculatedResults, state.sortConfig
// ADD:
currentTab: 'table',
```

### 3b. Cache new elements in `cacheElements()`

```js
resultsTabs:      document.getElementById('results-tabs'),
panelTable:       document.getElementById('panel-table'),
panelHeatmap:     document.getElementById('panel-heatmap'),
panelBreakdown:   document.getElementById('panel-breakdown'),
tabBtns:          document.querySelectorAll('.tab-btn'),
```

### 3c. Wire tab clicks in `setupEventListeners()`

```js
elements.tabBtns.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});
```

### 3d. `switchTab(tabName)` — new function

```js
function switchTab(tabName) {
  state.currentTab = tabName;

  // update button active state
  elements.tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // show/hide panels
  elements.panelTable.classList.toggle('hidden', tabName !== 'table');
  elements.panelHeatmap.classList.toggle('hidden', tabName !== 'heatmap');
  elements.panelBreakdown.classList.toggle('hidden', tabName !== 'breakdown');
}
```

### 3e. `renderHeatmap(results)` — new function

Inputs: `results` — the same `state.calculatedResults` array (already sorted by TEY desc).

```js
function renderHeatmap(results) {
  if (!results || results.length === 0) return;

  // Colour bands based on TEY rank within the result set
  function bubbleStyle(rank, total) {
    const pct = rank / total;
    if (pct < 0.15) return { bg: '#a7f3d0', fg: '#064e3b', border: '2px solid #10b981' };
    if (pct < 0.4)  return { bg: '#d1fae5', fg: '#065f46', border: '1px solid #6ee7b7' };
    if (pct < 0.7)  return { bg: '#fef9c3', fg: '#713f12', border: '1px solid #fcd34d' };
    return             { bg: '#fee2e2', fg: '#991b1b', border: '1px solid #fca5a5' };
  }

  const total = results.length;
  const grid = document.createElement('div');
  grid.className = 'bubble-grid';

  results.forEach((fund, i) => {
    const style = bubbleStyle(i, total);
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.style.cssText = `background:${style.bg};color:${style.fg};border:${style.border};`;
    bubble.innerHTML = `
      ${i === 0 ? '<span class="bubble-star">★</span>' : ''}
      <div class="bubble-ticker">${fund.symbol}</div>
      <div class="bubble-tey">${TaxCalculator.formatPercent(fund.taxEquivalentYield)}</div>
      <div class="bubble-category">${fund.category}</div>
    `;
    bubble.addEventListener('click', () => showMathExplanation(fund));
    grid.appendChild(bubble);
  });

  const scaleBar = document.createElement('div');
  scaleBar.className = 'tey-scale-bar';
  scaleBar.innerHTML = `
    <span>Low TEY</span>
    <div class="tey-scale-gradient"></div>
    <span>High TEY</span>
  `;

  elements.panelHeatmap.innerHTML = '';
  elements.panelHeatmap.appendChild(grid);
  elements.panelHeatmap.appendChild(scaleBar);
}
```

**Note on `fund.category`:** The result object from `calculateTaxEquivalentYield` has a
`category` field that is the `categorizeFund` short key (e.g. `"municipal"`). For display
in the bubble we want the friendly string. We use the same `typeLabels` map already defined
in `displayResultsTable` — we'll extract it to module scope or duplicate the small map.
The exact display text is short enough to duplicate. See implementation note below.

### 3f. `renderBreakdown(results)` — new function

Segment widths are proportional to their share of TEY (the max visible value = max TEY in
the set, used as 100% width reference):

```js
function renderBreakdown(results) {
  if (!results || results.length === 0) return;

  const maxTey = results[0].taxEquivalentYield; // results already sorted desc

  const legend = document.createElement('div');
  legend.className = 'breakdown-legend';
  legend.innerHTML = `
    <div class="breakdown-legend-item">
      <div class="breakdown-legend-swatch" style="background:#10b981;"></div>Tax saved
    </div>
    <div class="breakdown-legend-item">
      <div class="breakdown-legend-swatch" style="background:#3b82f6;opacity:0.85;"></div>Net yield
    </div>
    <div class="breakdown-legend-item">
      <div class="breakdown-legend-swatch" style="background:#f59e0b;"></div>Expense ratio
    </div>
  `;

  const rows = document.createElement('div');
  rows.className = 'breakdown-rows';

  results.forEach((fund, i) = >{
    const taxSavedYield = fund.taxEquivalentYield - fund.netYield; // gain from tax treatment
    const expPct   = (fund.expenseRatio   / maxTey) * 100;
    const netPct   = (fund.netYield       / maxTey) * 100;
    const taxPct   = (taxSavedYield       / maxTey) * 100;

    const row = document.createElement('div');
    row.className = 'breakdown-row';
    row.innerHTML = `
      <span class="breakdown-ticker">${fund.symbol}</span>
      <div class="stacked-bar">
        <div class="seg-tax" style="width:${Math.max(0, taxPct).toFixed(1)}%"></div>
        <div class="seg-net" style="width:${Math.max(0, netPct).toFixed(1)}%"></div>
        <div class="seg-exp" style="width:${Math.max(0, expPct).toFixed(1)}%"></div>
      </div>
      <span class="breakdown-tey${i === 0 ? ' top' : ''}">${TaxCalculator.formatPercent(fund.taxEquivalentYield)}</span>
    `;
    row.addEventListener('click', () => showMathExplanation(fund));
    rows.appendChild(row);
  });

  elements.panelBreakdown.innerHTML = '';
  elements.panelBreakdown.appendChild(legend);
  elements.panelBreakdown.appendChild(rows);
}
```

### 3g. Show `#results-tabs` when results appear

In `displayResultsTable()` after `elements.tableWrapper.classList.remove('hidden')` (currently line ~246):

```js
elements.resultsTabs.classList.remove('hidden');
```

In `showLoading()` and `showError()`, hide tabs again:

```js
elements.resultsTabs.classList.add('hidden');
```

### 3h. Call new renderers from `calculateAndDisplay()`

`calculateAndDisplay()` (line 170) currently calls:
1. `displayRecommendation()`
2. `displayResultsTable()`

Add after line 2:
```js
renderHeatmap(state.calculatedResults);
renderBreakdown(state.calculatedResults);
```

---

## Implementation Sequence

1. **CSS** — add new rules to `styles.css` (no risk; purely additive)
2. **HTML** — restructure `index.html`: wrap table in `#panel-table`, add tab bar + 2 panels
3. **JS** — update `app.js`: state field, cache elements, event wiring, 4 new functions, 3 call-site additions

---

## Considerations & Trade-offs

| Risk | Mitigation |
|------|-----------|
| `#table-wrapper`'s `hidden` class is toggled by `displayResultsTable` — moving it inside a panel wrapper could cause it to be invisible even when Table tab is active | The panel wrapper has no `hidden` class by default; `table-wrapper` hidden toggle is unchanged. Table tab is always the initial active tab. |
| `fund.category` in the result object is the short key from `categorizeFund` (`"taxable"`, `"municipal"`, etc.) — the heatmap wants a friendly string | Either re-use the `typeLabels` map from `displayResultsTable` (extract to module scope) or derive friendly text from `getFundCategory(fundName, csvCategory)`. Simplest: a small inline map in `renderHeatmap`. |
| Stacked bar segments can exceed 100% if expense ratio is unusually high | `Math.max(0, ...)` on each width; total is capped by natural CSS overflow hidden on `.stacked-bar`. |
| Bubble grid wraps on narrow screens — `auto-fill minmax(120px,1fr)` means fewer columns on mobile | Acceptable; each bubble is still readable at 120px. |

---

## Task Breakdown

### Phase 1: CSS
- [ ] Append tab bar rules to `public/css/styles.css`
- [ ] Append heatmap bubble grid rules
- [ ] Append tax breakdown stacked bar rules

### Phase 2: HTML
- [ ] Wrap existing `#table-wrapper` in `<div id="panel-table" class="tab-panel">`
- [ ] Add `#results-tabs` tab bar after recommendation card
- [ ] Add `<div id="panel-heatmap" class="tab-panel hidden">` after `#panel-table`
- [ ] Add `<div id="panel-breakdown" class="tab-panel hidden">` after `#panel-heatmap`
- [ ] Bump cache busters: `?v=5` → `?v=7` (CSS), `?v=6` → `?v=7` (JS x4)

### Phase 3: JavaScript
- [ ] Add `currentTab: 'table'` to `state`
- [ ] Add 5 new elements to `cacheElements()`
- [ ] Add tab click listener loop in `setupEventListeners()`
- [ ] Add `switchTab()` function
- [ ] Add `renderHeatmap()` function
- [ ] Add `renderBreakdown()` function
- [ ] Show `#results-tabs` inside `displayResultsTable()`
- [ ] Hide `#results-tabs` inside `showLoading()` and `showError()`
- [ ] Call `renderHeatmap()` + `renderBreakdown()` from `calculateAndDisplay()`

### Phase 4: Verify
- [ ] Run `npm test` — all 61 tests must pass (no test changes required)
- [ ] Load `http://localhost:3000` — verify tabs appear after data loads
- [ ] Click each tab — verify heatmap grid and breakdown bars render correctly
- [ ] Click a bubble / breakdown row — verify math modal opens
- [ ] Check mobile layout (narrow browser window)

---

## Open Questions

None — all design decisions were made during brainstorming:
- Tab layout: ✅ B (tabbed views)
- Tax Breakdown style: ✅ A (stacked bars)
- Heatmap style: ✅ C (color bubble grid)
