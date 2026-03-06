# BrewBase: Data-Governed Coffee Shop Platform

**Date**: 2026-03-03
**Author**: Eric Kittelson
**Status**: Approved

## Purpose

BrewBase is a coffee shop kiosk + operations dashboard built to showcase ContextKit's metadata governance capabilities. It's the entry for an internal AI challenge: build a coffee app, demo it in a video with PRD elements (personas, problems, MLP, KPIs), and publish the code to GitHub.

The unique angle: ContextKit governs every piece of data in the app, and the video walks through the full journey from raw data to AI-ready.

## Product Concept

**BrewBase** is a fictional specialty coffee chain's digital platform with two surfaces:

1. **Kiosk** (`index.html`) — Customer-facing ordering screen. Menu browse, drink customization, cart, checkout.
2. **Dashboard** (`dashboard.html`) — Ops analytics. Sales KPIs, top sellers, inventory, customer trends. Every metric is backed by ContextKit golden queries with visible source attribution.

Mock data (JSON): ~50 products, ~200 orders, ~30 ingredients, ~30 customers. No real database.

## Architecture

```
~/Desktop/brewbase/
├── index.html              # Kiosk ordering
├── dashboard.html          # Ops dashboard
├── css/
│   └── style.css           # Dark theme design system
├── js/
│   ├── kiosk.js            # Ordering logic
│   ├── dashboard.js        # Charts + KPIs
│   └── data.js             # Mock data loader
├── data/
│   ├── products.json
│   ├── orders.json
│   ├── ingredients.json
│   └── customers.json
├── context/                # ContextKit governance layer
│   ├── models/
│   │   ├── products.osi.yaml
│   │   ├── orders.osi.yaml
│   │   ├── ingredients.osi.yaml
│   │   └── customers.osi.yaml
│   ├── governance/
│   │   ├── products.governance.yaml
│   │   ├── orders.governance.yaml
│   │   ├── ingredients.governance.yaml
│   │   └── customers.governance.yaml
│   ├── rules/
│   │   ├── products.rules.yaml
│   │   ├── orders.rules.yaml
│   │   └── ingredients.rules.yaml
│   ├── lineage/
│   │   ├── orders.lineage.yaml
│   │   └── products.lineage.yaml
│   ├── glossary/
│   │   ├── revenue.term.yaml
│   │   ├── average-order-value.term.yaml
│   │   ├── cost-of-goods-sold.term.yaml
│   │   └── allergen.term.yaml
│   └── owners/
│       ├── brewbase-data-team.owner.yaml
│       └── brewbase-ops-team.owner.yaml
├── contextkit.config.yaml
└── package.json
```

**Key decisions:**
- HTML/CSS/JS only — no framework, no bundler
- Chart.js via CDN for dashboard charts
- `@runcontext/cli` as devDependency for governance workflow
- `context/` directory is the ContextKit showcase

## Data Model

### products (dimension)
- Fields: `product_id` (identifier), `name`, `category` (drink/food/merch), `size` (S/M/L), `base_price` (metric, SUM), `is_active` (boolean), `allergens` (array), `calories`, `created_at`
- Metrics: `average_product_price`, `active_menu_count`

### orders (fact)
- Fields: `order_id` (identifier), `customer_id` (FK), `product_id` (FK), `quantity`, `unit_price`, `total_amount` (metric, SUM), `order_date` (date dimension), `payment_method`, `is_test_order` (boolean)
- Metrics: `total_revenue`, `average_order_value`, `order_count`
- Grain: one row per order line item

### ingredients (dimension)
- Fields: `ingredient_id` (identifier), `name`, `unit_cost` (metric), `unit`, `supplier`, `is_allergen` (boolean), `category`
- Metrics: `total_ingredient_cost`, `unique_ingredient_count`

### customers (dimension)
- Fields: `customer_id` (identifier), `name`, `email`, `favorite_category`, `lifetime_orders` (metric, SUM), `lifetime_spend` (metric, SUM), `first_order_date`, `last_order_date`
- Metrics: `customer_count`, `average_lifetime_value`

## Governance Design

- **Ownership**: `brewbase-data-team` owns orders + customers; `brewbase-ops-team` owns products + ingredients
- **Trust**: Products = endorsed, Orders = endorsed, Ingredients = verified, Customers = verified
- **Security**: Customers = confidential (PII), everything else = internal
- **Business rules**: Revenue excludes test orders; allergens must be listed for all food/drink; prices must be > 0
- **Guardrails**: `is_test_order = false` for revenue queries; `is_active = true` for menu queries
- **Golden queries**: 3+ per Gold model (revenue by category, top products, AOV trend, customer LTV, ingredient costs)
- **Hierarchies**: Product (category → subcategory), Time (year → quarter → month → day)
- **Glossary**: Revenue, AOV, COGS, Allergen

### Tier Targets
- Products: Gold
- Orders: Gold
- Ingredients: Silver
- Customers: Silver

## UI Design

### Design System — "Data-Forward Dark"
- Background: `#0a0a0a`, cards: `#141414`
- Accent: `#00d4aa` (teal/mint)
- Text: `#e0e0e0` primary, `#808080` secondary
- Fonts: JetBrains Mono (data/labels), Inter (body)
- Cards: 1px border `#222`, slight radius, no shadows
- Tier badges: Bronze (amber), Silver (white), Gold (yellow)

### Kiosk
- Category tabs (Drinks / Food / Merch)
- Product cards: name, price, calories, allergen icons
- Sticky cart footer: item count, total, checkout button
- Checkout confirmation with order ID

### Dashboard
- KPI cards at top: Revenue, Orders, AOV — each with tier badge
- Charts: Revenue by category (bar), Top 5 products (ranked list)
- Each metric shows `src: golden-query/...` attribution
- Governance status panel: all model tiers at a glance
- Nav links to kiosk and ContextKit docs site

## Video Script (~5 min)

### Act 1: The App (1 min)
Show kiosk and dashboard. "Every metric is backed by governed data."

### Act 2: PRD Framing (1 min)
- **Personas**: Data engineer, ops manager, AI agent
- **Problems**: How do you trust AI is using the right revenue calculation? How do you prevent test data leaking? How does a new hire learn what "AOV" means?
- **MLP**: A governed data layer that makes coffee shop analytics trustworthy and AI-safe

### Act 3: ContextKit in Action (2 min)
1. Show `context/` directory
2. `contextkit lint` — all green (or catch/fix issues)
3. `contextkit tier products` — Gold scorecard
4. `contextkit tier ingredients` — Silver (realistic, not everything is Gold)
5. `contextkit site` — browse generated docs
6. `contextkit explain revenue` — glossary lookup

### Act 4: AI Agent (1 min)
1. Start MCP server
2. Ask Claude: "What's our best-selling category?"
3. Claude uses golden queries + guardrails to answer correctly
4. "The AI knows the rules because ContextKit told it."

### Act 5: KPIs & Close (30 sec)
- KPIs: % models at Gold, # golden queries for AI, guardrail incidents prevented, analyst onboarding time
- "ContextKit turns 'it probably works' into 'it's provably governed.'"

## Deliverables

1. PRD text document (explaining the app)
2. Design principles document (should feel / should not feel)
3. BrewBase app (HTML/CSS/JS kiosk + dashboard)
4. ContextKit governance layer (context/ directory achieving Bronze → Gold)
5. Video recording walking through the demo script
6. Published to GitHub
