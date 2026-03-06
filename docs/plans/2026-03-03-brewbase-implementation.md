# BrewBase Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build BrewBase — a data-governed coffee shop kiosk + ops dashboard that showcases ContextKit's full metadata governance capabilities.

**Architecture:** New repo at `~/Desktop/brewbase/`. HTML/CSS/JS app (no framework) with Chart.js via CDN. ContextKit `context/` directory provides the governance layer. Mock data in JSON files.

**Tech Stack:** HTML5, CSS3, Vanilla JS, Chart.js (CDN), ContextKit CLI (`@runcontext/cli`)

**Design doc:** `../2026-03-03-brewbase-coffee-app-design.md`

---

## Task 1: Scaffold the Repo

**Files:**
- Create: `~/Desktop/brewbase/package.json`
- Create: `~/Desktop/brewbase/.gitignore`
- Create: `~/Desktop/brewbase/contextkit.config.yaml`

**Step 1: Create the repo directory and initialize git**

```bash
mkdir -p ~/Desktop/brewbase
cd ~/Desktop/brewbase
git init
```

**Step 2: Create package.json**

```json
{
  "name": "brewbase",
  "version": "0.1.0",
  "private": true,
  "description": "BrewBase — a data-governed coffee shop platform showcasing ContextKit",
  "author": "Eric Kittelson",
  "license": "MIT",
  "scripts": {
    "lint": "contextkit lint",
    "tier": "contextkit tier",
    "build": "contextkit build",
    "site": "contextkit site",
    "serve": "npx serve .",
    "mcp": "contextkit serve --stdio"
  },
  "devDependencies": {
    "@runcontext/cli": "^0.2.1"
  }
}
```

**Step 3: Create .gitignore**

```
node_modules/
dist/
.contextkit/
```

**Step 4: Create contextkit.config.yaml**

```yaml
context_dir: context
output_dir: dist
site:
  title: "BrewBase Data Governance"
```

**Step 5: Create directory structure**

```bash
mkdir -p css js data context/{models,governance,rules,lineage,glossary,owners}
```

**Step 6: Install dependencies**

```bash
cd ~/Desktop/brewbase && npm install
```

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold brewbase repo with contextkit config"
```

---

## Task 2: Create Owner Files

**Files:**
- Create: `~/Desktop/brewbase/context/owners/brewbase-data-team.owner.yaml`
- Create: `~/Desktop/brewbase/context/owners/brewbase-ops-team.owner.yaml`

**Step 1: Create brewbase-data-team.owner.yaml**

```yaml
id: brewbase-data-team
display_name: "BrewBase Data Team"
email: data@brewbase.io
description: "Owns transactional and customer data models"
```

**Step 2: Create brewbase-ops-team.owner.yaml**

```yaml
id: brewbase-ops-team
display_name: "BrewBase Operations Team"
email: ops@brewbase.io
description: "Owns product catalog and ingredient supply chain data"
```

**Step 3: Commit**

```bash
git add context/owners/
git commit -m "feat: add owner files for data and ops teams"
```

---

## Task 3: Create Glossary Terms

**Files:**
- Create: `~/Desktop/brewbase/context/glossary/revenue.term.yaml`
- Create: `~/Desktop/brewbase/context/glossary/average-order-value.term.yaml`
- Create: `~/Desktop/brewbase/context/glossary/cost-of-goods-sold.term.yaml`
- Create: `~/Desktop/brewbase/context/glossary/allergen.term.yaml`

**Step 1: Create revenue.term.yaml**

```yaml
id: revenue
definition: "Total monetary value of completed, non-test customer orders. Calculated as SUM(total_amount) WHERE is_test_order = false."
synonyms: [sales, gross revenue, top-line]
owner: brewbase-data-team
tags: [finance, kpi]
```

**Step 2: Create average-order-value.term.yaml**

```yaml
id: average-order-value
definition: "Mean transaction value across completed orders. Calculated as total revenue divided by order count, excluding test orders."
synonyms: [AOV, avg order, basket size]
owner: brewbase-data-team
tags: [finance, kpi]
```

**Step 3: Create cost-of-goods-sold.term.yaml**

```yaml
id: cost-of-goods-sold
definition: "Sum of ingredient costs for all items sold. Used to calculate gross margin."
synonyms: [COGS, cost of sales, direct costs]
owner: brewbase-ops-team
tags: [finance, supply-chain]
```

**Step 4: Create allergen.term.yaml**

```yaml
id: allergen
definition: "Any ingredient that may cause an allergic reaction. Must be disclosed on all food and drink products per food safety regulations."
synonyms: [allergy, dietary restriction]
owner: brewbase-ops-team
tags: [safety, compliance]
```

**Step 5: Commit**

```bash
git add context/glossary/
git commit -m "feat: add glossary terms (revenue, AOV, COGS, allergen)"
```

---

## Task 4: Create Products OSI Model + Governance (Gold Target)

**Files:**
- Create: `~/Desktop/brewbase/context/models/products.osi.yaml`
- Create: `~/Desktop/brewbase/context/governance/products.governance.yaml`
- Create: `~/Desktop/brewbase/context/rules/products.rules.yaml`
- Create: `~/Desktop/brewbase/context/lineage/products.lineage.yaml`

**Step 1: Create products.osi.yaml**

```yaml
version: "1.0"

semantic_model:
  - name: products
    description: "Product catalog for BrewBase coffee shop. Contains all menu items including drinks, food, and merchandise with pricing and nutritional information."

    datasets:
      - name: products
        source: brewbase.public.products
        primary_key: [product_id]
        description: "Master product dimension table containing all current and historical menu items."
        fields:
          - name: product_id
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: product_id
            description: "Unique identifier for each product"
          - name: name
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: name
            description: "Display name of the product"
          - name: category
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: category
            description: "Product category: drink, food, or merch"
          - name: size
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: size
            description: "Product size: S, M, or L (null for non-sized items)"
          - name: base_price
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: base_price
            description: "Current retail price in USD"
          - name: is_active
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: is_active
            description: "Whether the product is currently on the active menu"
          - name: allergens
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: allergens
            description: "Comma-separated list of allergens (dairy, nuts, gluten, soy)"
          - name: calories
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: calories
            description: "Calorie count per serving"
          - name: created_at
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: created_at
            description: "Date the product was added to the catalog"

    metrics:
      - name: average-product-price
        expression:
          dialects:
            - dialect: ANSI_SQL
              expression: "AVG(base_price)"
        description: "Average retail price across active products"
      - name: active-menu-count
        expression:
          dialects:
            - dialect: ANSI_SQL
              expression: "COUNT(*) FILTER (WHERE is_active = true)"
        description: "Number of products currently on the menu"
```

**Step 2: Create products.governance.yaml**

```yaml
model: products
owner: brewbase-ops-team
trust: endorsed
security: internal
tags: [catalog, menu, finance, kpi]

datasets:
  products:
    grain: "One row per product-size combination"
    refresh: "daily"
    table_type: dimension
    security: internal

fields:
  products.product_id:
    semantic_role: identifier
    sample_values: ["prod-001", "prod-002", "prod-003"]
  products.name:
    semantic_role: dimension
    sample_values: ["Oat Milk Latte", "Cold Brew", "Espresso"]
  products.category:
    semantic_role: dimension
    sample_values: ["drink", "food", "merch"]
  products.size:
    semantic_role: dimension
    sample_values: ["S", "M", "L"]
  products.base_price:
    semantic_role: metric
    default_aggregation: AVG
    additive: false
    sample_values: [3.50, 5.00, 4.50]
  products.is_active:
    semantic_role: dimension
    default_filter: "is_active = true"
    sample_values: [true, false]
  products.allergens:
    semantic_role: dimension
    sample_values: ["dairy", "nuts", "gluten,soy"]
  products.calories:
    semantic_role: metric
    default_aggregation: AVG
    additive: false
  products.created_at:
    semantic_role: date
```

**Step 3: Create products.rules.yaml**

```yaml
model: products

golden_queries:
  - question: "What is the average price by product category?"
    sql: |
      SELECT category, AVG(base_price) AS avg_price
      FROM products
      WHERE is_active = true
      GROUP BY category
      ORDER BY avg_price DESC
    tags: [pricing, category]

  - question: "How many active products are on the menu by category?"
    sql: |
      SELECT category, COUNT(*) AS product_count
      FROM products
      WHERE is_active = true
      GROUP BY category
      ORDER BY product_count DESC
    tags: [catalog, category]

  - question: "Which products contain allergens?"
    sql: |
      SELECT name, category, allergens, calories
      FROM products
      WHERE is_active = true
        AND allergens IS NOT NULL
        AND allergens != ''
      ORDER BY category, name
    tags: [safety, allergens]

business_rules:
  - name: prices-must-be-positive
    definition: "All product prices must be greater than zero"
    enforcement:
      - "CHECK constraint: base_price > 0"
      - "Reject any catalog update with non-positive prices"
    tables: [products]
    applied_always: true

  - name: allergens-required-for-consumables
    definition: "All drink and food products must have allergens listed, even if the list is 'none'"
    enforcement:
      - "Require non-null allergens field for category IN ('drink', 'food')"
    avoid:
      - "Leaving allergens blank — always explicitly state 'none' if no allergens"
    tables: [products]
    applied_always: true

guardrail_filters:
  - name: active-products-only
    filter: "is_active = true"
    tables: [products]
    reason: "Menu queries should only show active products. Discontinued items must be excluded from customer-facing results."

hierarchies:
  - name: product-category
    levels: [category, name]
    dataset: products
    field: category
```

**Step 4: Create products.lineage.yaml**

```yaml
model: products

upstream:
  - source: brewbase.staging.raw_products
    type: pipeline
    pipeline: product-catalog-sync
    refresh: daily
    notes: "Synced from POS system nightly"

downstream:
  - target: orders-dashboard
    type: dashboard
    notes: "Product dimension joined to order facts for revenue reporting"
  - target: menu-kiosk
    type: api
    notes: "Active products served to customer ordering kiosk"
```

**Step 5: Run contextkit lint to validate products model**

```bash
cd ~/Desktop/brewbase && npx contextkit lint
```

Expected: products model should pass most checks. Note any failures and fix.

**Step 6: Run contextkit tier to check products score**

```bash
npx contextkit tier products
```

Expected: Gold tier (or close — fix any gaps).

**Step 7: Commit**

```bash
git add context/models/products.osi.yaml context/governance/products.governance.yaml context/rules/products.rules.yaml context/lineage/products.lineage.yaml
git commit -m "feat: add products model with full Gold-tier governance"
```

---

## Task 5: Create Orders OSI Model + Governance (Gold Target)

**Files:**
- Create: `~/Desktop/brewbase/context/models/orders.osi.yaml`
- Create: `~/Desktop/brewbase/context/governance/orders.governance.yaml`
- Create: `~/Desktop/brewbase/context/rules/orders.rules.yaml`
- Create: `~/Desktop/brewbase/context/lineage/orders.lineage.yaml`

**Step 1: Create orders.osi.yaml**

```yaml
version: "1.0"

semantic_model:
  - name: orders
    description: "Order transaction data for BrewBase. Each row represents a line item in a customer order, tracking products purchased, quantities, and revenue."

    datasets:
      - name: order_lines
        source: brewbase.public.order_lines
        primary_key: [order_id, product_id]
        description: "Fact table of order line items. One row per product per order."
        fields:
          - name: order_id
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: order_id
            description: "Unique order identifier"
          - name: customer_id
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: customer_id
            description: "Foreign key to customers dimension"
          - name: product_id
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: product_id
            description: "Foreign key to products dimension"
          - name: quantity
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: quantity
            description: "Number of units ordered"
          - name: unit_price
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: unit_price
            description: "Price per unit at time of order"
          - name: total_amount
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: total_amount
            description: "Line item total (quantity * unit_price)"
          - name: order_date
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: order_date
            description: "Date and time the order was placed"
          - name: payment_method
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: payment_method
            description: "Payment type: credit, debit, cash, mobile"
          - name: is_test_order
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: is_test_order
            description: "Flag for test/QA orders that should be excluded from reporting"

    relationships:
      - name: order-to-product
        from: order_lines
        to: products
        from_columns: [product_id]
        to_columns: [product_id]
      - name: order-to-customer
        from: order_lines
        to: customers
        from_columns: [customer_id]
        to_columns: [customer_id]

    metrics:
      - name: total-revenue
        expression:
          dialects:
            - dialect: ANSI_SQL
              expression: "SUM(total_amount)"
        description: "Total revenue from non-test orders"
      - name: average-order-value
        expression:
          dialects:
            - dialect: ANSI_SQL
              expression: "AVG(order_total)"
        description: "Average transaction value across completed orders"
      - name: order-count
        expression:
          dialects:
            - dialect: ANSI_SQL
              expression: "COUNT(DISTINCT order_id)"
        description: "Number of unique orders placed"
```

**Step 2: Create orders.governance.yaml**

```yaml
model: orders
owner: brewbase-data-team
trust: endorsed
security: internal
tags: [transactions, revenue, finance, kpi]

datasets:
  order_lines:
    grain: "One row per product per order (order line item)"
    refresh: "hourly"
    table_type: fact
    security: internal

fields:
  order_lines.order_id:
    semantic_role: identifier
    sample_values: ["ord-1001", "ord-1002", "ord-1003"]
  order_lines.customer_id:
    semantic_role: identifier
    sample_values: ["cust-001", "cust-002", "cust-003"]
  order_lines.product_id:
    semantic_role: identifier
    sample_values: ["prod-001", "prod-010", "prod-025"]
  order_lines.quantity:
    semantic_role: metric
    default_aggregation: SUM
    additive: true
  order_lines.unit_price:
    semantic_role: metric
    default_aggregation: AVG
    additive: false
  order_lines.total_amount:
    semantic_role: metric
    default_aggregation: SUM
    additive: true
    default_filter: "is_test_order = false"
    sample_values: [3.50, 10.00, 15.75]
  order_lines.order_date:
    semantic_role: date
    sample_values: ["2026-01-15", "2026-02-20", "2026-03-01"]
  order_lines.payment_method:
    semantic_role: dimension
    sample_values: ["credit", "debit", "cash", "mobile"]
  order_lines.is_test_order:
    semantic_role: dimension
    sample_values: [false, true]
```

**Step 3: Create orders.rules.yaml**

```yaml
model: orders

golden_queries:
  - question: "What is total revenue by product category?"
    sql: |
      SELECT p.category, SUM(o.total_amount) AS revenue
      FROM order_lines o
      JOIN products p ON o.product_id = p.product_id
      WHERE o.is_test_order = false
      GROUP BY p.category
      ORDER BY revenue DESC
    tags: [revenue, category]

  - question: "What are the top 10 best-selling products by quantity?"
    sql: |
      SELECT p.name, p.category, SUM(o.quantity) AS units_sold, SUM(o.total_amount) AS revenue
      FROM order_lines o
      JOIN products p ON o.product_id = p.product_id
      WHERE o.is_test_order = false
      GROUP BY p.name, p.category
      ORDER BY units_sold DESC
      LIMIT 10
    tags: [products, ranking]

  - question: "What is the average order value trend by month?"
    sql: |
      SELECT DATE_TRUNC('month', order_date) AS month,
             COUNT(DISTINCT order_id) AS orders,
             SUM(total_amount) / COUNT(DISTINCT order_id) AS avg_order_value
      FROM order_lines
      WHERE is_test_order = false
      GROUP BY DATE_TRUNC('month', order_date)
      ORDER BY month
    tags: [aov, trends]

  - question: "What is revenue by payment method?"
    sql: |
      SELECT payment_method, SUM(total_amount) AS revenue, COUNT(DISTINCT order_id) AS order_count
      FROM order_lines
      WHERE is_test_order = false
      GROUP BY payment_method
      ORDER BY revenue DESC
    tags: [revenue, payments]

business_rules:
  - name: exclude-test-orders
    definition: "All revenue and order metrics MUST exclude test orders (is_test_order = true). Test orders are created by QA and do not represent real transactions."
    enforcement:
      - "Always include WHERE is_test_order = false in revenue queries"
      - "Dashboard filters must default to excluding test orders"
    avoid:
      - "Counting test orders in any KPI or report"
      - "Using unfiltered order counts for business decisions"
    tables: [order_lines]
    applied_always: true

  - name: revenue-uses-total-amount
    definition: "Revenue must be calculated using SUM(total_amount), never by multiplying quantity * unit_price at query time, to avoid rounding discrepancies."
    enforcement:
      - "Use the pre-computed total_amount column for all revenue aggregations"
    avoid:
      - "Computing quantity * unit_price in queries — use total_amount instead"
    tables: [order_lines]
    applied_always: true

guardrail_filters:
  - name: exclude-test-orders
    filter: "is_test_order = false"
    tables: [order_lines]
    reason: "Test orders must be excluded from all revenue reporting, KPIs, and analytics to prevent data quality issues."

hierarchies:
  - name: time-hierarchy
    levels: [year, quarter, month, day]
    dataset: order_lines
    field: order_date
```

**Step 4: Create orders.lineage.yaml**

```yaml
model: orders

upstream:
  - source: brewbase.staging.raw_orders
    type: pipeline
    pipeline: order-ingestion
    refresh: hourly
    notes: "Real-time order feed from POS terminals, landed hourly"
  - source: brewbase.public.products
    type: pipeline
    notes: "Product dimension joined for category enrichment"

downstream:
  - target: revenue-dashboard
    type: dashboard
    notes: "Primary revenue and sales performance dashboard"
  - target: customer-ltv-model
    type: ml_model
    notes: "Customer lifetime value prediction model"
```

**Step 5: Run lint and tier check**

```bash
cd ~/Desktop/brewbase && npx contextkit lint && npx contextkit tier orders
```

Expected: Gold tier for orders.

**Step 6: Commit**

```bash
git add context/models/orders.osi.yaml context/governance/orders.governance.yaml context/rules/orders.rules.yaml context/lineage/orders.lineage.yaml
git commit -m "feat: add orders model with full Gold-tier governance"
```

---

## Task 6: Create Ingredients OSI Model + Governance (Silver Target)

**Files:**
- Create: `~/Desktop/brewbase/context/models/ingredients.osi.yaml`
- Create: `~/Desktop/brewbase/context/governance/ingredients.governance.yaml`
- Create: `~/Desktop/brewbase/context/rules/ingredients.rules.yaml`
- Create: `~/Desktop/brewbase/context/lineage/ingredients.lineage.yaml`

**Step 1: Create ingredients.osi.yaml**

```yaml
version: "1.0"

semantic_model:
  - name: ingredients
    description: "Ingredient inventory and cost data for BrewBase. Tracks raw materials used in drink and food preparation, including supplier and allergen information."

    datasets:
      - name: ingredients
        source: brewbase.public.ingredients
        primary_key: [ingredient_id]
        description: "Dimension table of all ingredients used in BrewBase products."
        fields:
          - name: ingredient_id
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: ingredient_id
            description: "Unique identifier for each ingredient"
          - name: name
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: name
            description: "Ingredient name"
          - name: unit_cost
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: unit_cost
            description: "Cost per unit in USD"
          - name: unit
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: unit
            description: "Unit of measure (oz, lb, each)"
          - name: supplier
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: supplier
            description: "Primary supplier name"
          - name: is_allergen
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: is_allergen
            description: "Whether this ingredient is a common allergen"
          - name: category
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: category
            description: "Ingredient category (dairy, grain, sweetener, etc.)"

    metrics:
      - name: total-ingredient-cost
        expression:
          dialects:
            - dialect: ANSI_SQL
              expression: "SUM(unit_cost)"
        description: "Total cost across all ingredients"
      - name: unique-ingredient-count
        expression:
          dialects:
            - dialect: ANSI_SQL
              expression: "COUNT(DISTINCT ingredient_id)"
        description: "Number of distinct ingredients in the catalog"
```

**Step 2: Create ingredients.governance.yaml**

Silver target — has trust, tags, lineage, refresh, but fewer field-level semantics than Gold.

```yaml
model: ingredients
owner: brewbase-ops-team
trust: endorsed
security: internal
tags: [supply-chain, inventory, safety, compliance]

datasets:
  ingredients:
    grain: "One row per ingredient"
    refresh: "weekly"
    table_type: dimension

fields:
  ingredients.ingredient_id:
    semantic_role: identifier
    sample_values: ["ing-001", "ing-002", "ing-003"]
  ingredients.name:
    semantic_role: dimension
    sample_values: ["Whole Milk", "Oat Milk", "Espresso Beans"]
  ingredients.unit_cost:
    semantic_role: metric
    default_aggregation: AVG
    additive: false
  ingredients.unit:
    semantic_role: dimension
  ingredients.supplier:
    semantic_role: dimension
  ingredients.is_allergen:
    semantic_role: dimension
  ingredients.category:
    semantic_role: dimension
    sample_values: ["dairy", "grain", "sweetener", "coffee"]
```

**Step 3: Create ingredients.rules.yaml**

Minimal rules for Silver (not aiming for Gold).

```yaml
model: ingredients

golden_queries:
  - question: "What is the cost breakdown by ingredient category?"
    sql: |
      SELECT category, COUNT(*) AS ingredient_count, AVG(unit_cost) AS avg_cost
      FROM ingredients
      GROUP BY category
      ORDER BY avg_cost DESC
    tags: [costs, category]

  - question: "Which ingredients are allergens?"
    sql: |
      SELECT name, category, supplier
      FROM ingredients
      WHERE is_allergen = true
      ORDER BY category, name
    tags: [safety, allergens]

business_rules:
  - name: allergen-tracking
    definition: "All ingredients must have is_allergen accurately flagged for food safety compliance"
    enforcement:
      - "Review allergen flag on every new ingredient addition"
    tables: [ingredients]
    applied_always: true
```

**Step 4: Create ingredients.lineage.yaml**

```yaml
model: ingredients

upstream:
  - source: brewbase.staging.supplier_feed
    type: pipeline
    pipeline: ingredient-catalog-sync
    refresh: weekly
    notes: "Weekly sync from supplier management system"
```

**Step 5: Lint and tier check**

```bash
cd ~/Desktop/brewbase && npx contextkit lint && npx contextkit tier ingredients
```

Expected: Silver tier.

**Step 6: Commit**

```bash
git add context/models/ingredients.osi.yaml context/governance/ingredients.governance.yaml context/rules/ingredients.rules.yaml context/lineage/ingredients.lineage.yaml
git commit -m "feat: add ingredients model with Silver-tier governance"
```

---

## Task 7: Create Customers OSI Model + Governance (Silver Target)

**Files:**
- Create: `~/Desktop/brewbase/context/models/customers.osi.yaml`
- Create: `~/Desktop/brewbase/context/governance/customers.governance.yaml`
- Create: `~/Desktop/brewbase/context/lineage/customers.lineage.yaml`

**Step 1: Create customers.osi.yaml**

```yaml
version: "1.0"

semantic_model:
  - name: customers
    description: "Customer dimension for BrewBase. Contains profile data, preferences, and lifetime value metrics. PII-sensitive — classified as confidential."

    datasets:
      - name: customers
        source: brewbase.public.customers
        primary_key: [customer_id]
        description: "Customer dimension table with profile and lifetime aggregates."
        fields:
          - name: customer_id
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: customer_id
            description: "Unique customer identifier"
          - name: name
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: name
            description: "Customer full name (PII)"
          - name: email
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: email
            description: "Customer email address (PII)"
          - name: favorite_category
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: favorite_category
            description: "Most frequently ordered product category"
          - name: lifetime_orders
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: lifetime_orders
            description: "Total number of orders placed by customer"
          - name: lifetime_spend
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: lifetime_spend
            description: "Total USD spent by customer across all orders"
          - name: first_order_date
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: first_order_date
            description: "Date of customer's first order"
          - name: last_order_date
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: last_order_date
            description: "Date of customer's most recent order"

    metrics:
      - name: customer-count
        expression:
          dialects:
            - dialect: ANSI_SQL
              expression: "COUNT(DISTINCT customer_id)"
        description: "Total number of unique customers"
      - name: average-lifetime-value
        expression:
          dialects:
            - dialect: ANSI_SQL
              expression: "AVG(lifetime_spend)"
        description: "Average lifetime spend per customer"
```

**Step 2: Create customers.governance.yaml**

```yaml
model: customers
owner: brewbase-data-team
trust: endorsed
security: confidential
tags: [customers, pii, finance, kpi]

datasets:
  customers:
    grain: "One row per customer"
    refresh: "daily"
    table_type: dimension
    security: confidential

fields:
  customers.customer_id:
    semantic_role: identifier
    sample_values: ["cust-001", "cust-002", "cust-003"]
  customers.name:
    semantic_role: dimension
  customers.email:
    semantic_role: dimension
  customers.favorite_category:
    semantic_role: dimension
    sample_values: ["drink", "food"]
  customers.lifetime_orders:
    semantic_role: metric
    default_aggregation: SUM
    additive: true
  customers.lifetime_spend:
    semantic_role: metric
    default_aggregation: SUM
    additive: true
  customers.first_order_date:
    semantic_role: date
  customers.last_order_date:
    semantic_role: date
```

**Step 3: Create customers.lineage.yaml**

```yaml
model: customers

upstream:
  - source: brewbase.staging.raw_customers
    type: pipeline
    pipeline: customer-profile-builder
    refresh: daily
    notes: "Aggregated from order history and registration data"

downstream:
  - target: customer-segments
    type: ml_model
    notes: "Customer segmentation model for targeted promotions"
```

**Step 4: Lint and tier check**

```bash
cd ~/Desktop/brewbase && npx contextkit lint && npx contextkit tier customers
```

Expected: Silver tier (confidential security + no rules file keeps it below Gold).

**Step 5: Commit**

```bash
git add context/models/customers.osi.yaml context/governance/customers.governance.yaml context/lineage/customers.lineage.yaml
git commit -m "feat: add customers model with Silver-tier governance"
```

---

## Task 8: Validate Full Governance Layer

**Step 1: Run full lint**

```bash
cd ~/Desktop/brewbase && npx contextkit lint
```

Expected: Zero errors. Fix any issues that appear.

**Step 2: Run tier for all models**

```bash
npx contextkit tier
```

Expected: products=Gold, orders=Gold, ingredients=Silver, customers=Silver.

**Step 3: Run build**

```bash
npx contextkit build
```

Expected: Manifest compiles successfully to `dist/`.

**Step 4: Generate docs site**

```bash
npx contextkit site
```

Expected: Static site generated to `dist/site/` (or similar).

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve lint warnings and verify all tier targets"
```

---

## Task 9: Create Mock Data (JSON)

**Files:**
- Create: `~/Desktop/brewbase/data/products.json`
- Create: `~/Desktop/brewbase/data/orders.json`
- Create: `~/Desktop/brewbase/data/ingredients.json`
- Create: `~/Desktop/brewbase/data/customers.json`

**Step 1: Create products.json**

Generate ~50 realistic coffee shop products. Include a mix of drinks (espresso, latte, cold brew, tea, etc. in S/M/L), food (pastries, sandwiches), and merch (mugs, beans). Each product:

```json
{
  "product_id": "prod-001",
  "name": "Espresso",
  "category": "drink",
  "size": "S",
  "base_price": 3.00,
  "is_active": true,
  "allergens": "none",
  "calories": 5,
  "created_at": "2025-06-01"
}
```

Include 2-3 products with `is_active: false` (discontinued) to make the guardrail demo realistic.

**Step 2: Create orders.json**

Generate ~200 order line items spanning Jan-Mar 2026. Each order:

```json
{
  "order_id": "ord-1001",
  "customer_id": "cust-001",
  "product_id": "prod-005",
  "quantity": 2,
  "unit_price": 5.00,
  "total_amount": 10.00,
  "order_date": "2026-01-15T08:30:00Z",
  "payment_method": "credit",
  "is_test_order": false
}
```

Include 5-8 test orders (`is_test_order: true`) to demonstrate the guardrail.

**Step 3: Create ingredients.json**

Generate ~30 ingredients:

```json
{
  "ingredient_id": "ing-001",
  "name": "Whole Milk",
  "unit_cost": 0.45,
  "unit": "oz",
  "supplier": "Local Dairy Co",
  "is_allergen": true,
  "category": "dairy"
}
```

**Step 4: Create customers.json**

Generate ~30 customers:

```json
{
  "customer_id": "cust-001",
  "name": "Alex Rivera",
  "email": "alex.r@email.com",
  "favorite_category": "drink",
  "lifetime_orders": 47,
  "lifetime_spend": 285.50,
  "first_order_date": "2025-07-12",
  "last_order_date": "2026-03-01"
}
```

**Step 5: Commit**

```bash
git add data/
git commit -m "feat: add mock data (50 products, 200 orders, 30 ingredients, 30 customers)"
```

---

## Task 10: Build the Design System (CSS)

**Files:**
- Create: `~/Desktop/brewbase/css/style.css`

**Step 1: Create style.css**

Implement the "Data-Forward Dark" design system:

```css
/* Design tokens */
:root {
  --bg-primary: #0a0a0a;
  --bg-card: #141414;
  --bg-hover: #1a1a1a;
  --border: #222;
  --accent: #00d4aa;
  --accent-dim: #00d4aa33;
  --text-primary: #e0e0e0;
  --text-secondary: #808080;
  --text-accent: #00d4aa;
  --tier-gold: #fbbf24;
  --tier-silver: #d1d5db;
  --tier-bronze: #d97706;
  --danger: #ef4444;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --font-body: 'Inter', -apple-system, sans-serif;
  --radius: 6px;
}
```

Include:
- Reset/base styles (dark background, font imports)
- Layout: header, main content grid, footer
- Card component (`.card`) with border, bg, padding
- KPI card variant (`.kpi-card`) with large number + label
- Tier badges (`.tier-badge.gold`, `.tier-badge.silver`, `.tier-badge.bronze`)
- Category tabs (`.tab-bar`, `.tab.active`)
- Product card (`.product-card`) for kiosk
- Cart footer (`.cart-bar`)
- Chart containers
- Source attribution label (`.source-label`) — small monospace text under metrics
- Button styles (`.btn`, `.btn-accent`)
- Responsive: works on desktop, doesn't need mobile

**Step 2: Commit**

```bash
git add css/
git commit -m "feat: add data-forward dark design system"
```

---

## Task 11: Build the Kiosk Page

**Files:**
- Create: `~/Desktop/brewbase/index.html`
- Create: `~/Desktop/brewbase/js/data.js`
- Create: `~/Desktop/brewbase/js/kiosk.js`

**Step 1: Create data.js**

Shared data loading module:

```javascript
const Data = {
  products: [],
  orders: [],
  ingredients: [],
  customers: [],

  async load() {
    const [products, orders, ingredients, customers] = await Promise.all([
      fetch('data/products.json').then(r => r.json()),
      fetch('data/orders.json').then(r => r.json()),
      fetch('data/ingredients.json').then(r => r.json()),
      fetch('data/customers.json').then(r => r.json()),
    ]);
    this.products = products;
    this.orders = orders;
    this.ingredients = ingredients;
    this.customers = customers;
    return this;
  }
};
```

**Step 2: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BrewBase | Order</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <header>
    <div class="logo">☕ BREWBASE</div>
    <nav>
      <a href="dashboard.html">Dashboard</a>
      <button class="btn cart-toggle" id="cartToggle">Cart (<span id="cartCount">0</span>)</button>
    </nav>
  </header>

  <main>
    <div class="tab-bar" id="categoryTabs">
      <button class="tab active" data-category="all">All</button>
      <button class="tab" data-category="drink">Drinks</button>
      <button class="tab" data-category="food">Food</button>
      <button class="tab" data-category="merch">Merch</button>
    </div>

    <div class="product-grid" id="productGrid">
      <!-- Populated by JS -->
    </div>
  </main>

  <div class="cart-bar" id="cartBar">
    <span id="cartSummary">0 items</span>
    <span id="cartTotal">$0.00</span>
    <button class="btn btn-accent" id="checkoutBtn" disabled>Place Order</button>
  </div>

  <script src="js/data.js"></script>
  <script src="js/kiosk.js"></script>
</body>
</html>
```

**Step 3: Create kiosk.js**

Implement:
- Load products from data.js, filter to `is_active: true` (respecting the guardrail)
- Render product cards with name, price, calories, allergen badges
- Category tab filtering
- Cart state (add/remove items, count, total)
- Checkout button → show confirmation overlay with generated order ID
- All prices formatted as USD

**Step 4: Test manually**

```bash
cd ~/Desktop/brewbase && npx serve .
```

Open http://localhost:3000 — verify kiosk loads, tabs filter, cart works, checkout shows confirmation.

**Step 5: Commit**

```bash
git add index.html js/data.js js/kiosk.js
git commit -m "feat: add kiosk ordering page"
```

---

## Task 12: Build the Dashboard Page

**Files:**
- Create: `~/Desktop/brewbase/dashboard.html`
- Create: `~/Desktop/brewbase/js/dashboard.js`

**Step 1: Create dashboard.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BrewBase | Ops Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
</head>
<body>
  <header>
    <div class="logo">📊 BREWBASE OPS</div>
    <nav>
      <a href="index.html">Kiosk</a>
      <a href="dist/site/index.html">Docs</a>
    </nav>
  </header>

  <main>
    <!-- KPI Cards -->
    <div class="kpi-row" id="kpiRow">
      <!-- Populated by JS -->
    </div>

    <!-- Charts Row -->
    <div class="chart-row">
      <div class="card chart-card">
        <h3>Revenue by Category</h3>
        <canvas id="revenueChart"></canvas>
        <span class="source-label">src: golden-query/revenue-by-category</span>
      </div>
      <div class="card chart-card">
        <h3>Top 5 Products</h3>
        <div id="topProducts"></div>
        <span class="source-label">src: golden-query/top-products</span>
      </div>
    </div>

    <!-- Governance Status -->
    <div class="card governance-panel">
      <h3>Governance Status</h3>
      <div class="tier-grid" id="tierGrid">
        <!-- Populated by JS -->
      </div>
    </div>
  </main>

  <script src="js/data.js"></script>
  <script src="js/dashboard.js"></script>
</body>
</html>
```

**Step 2: Create dashboard.js**

Implement:
- Load data, compute KPIs (respecting guardrails: filter `is_test_order = false`):
  - Total Revenue = SUM(total_amount) WHERE is_test_order = false
  - Order Count = COUNT(DISTINCT order_id) WHERE is_test_order = false
  - Average Order Value = Revenue / Order Count
- Render KPI cards with tier badges (Gold for revenue/orders, Silver for ingredients/customers)
- Revenue by Category bar chart (Chart.js) — computed the same way as the golden query
- Top 5 products ranked list — matches golden query logic
- Governance status panel showing all 4 models with their tier badges
- Each metric has a `.source-label` showing which golden query backs it

**Step 3: Test manually**

```bash
cd ~/Desktop/brewbase && npx serve .
```

Open http://localhost:3000/dashboard.html — verify KPIs calculate correctly, charts render, tier badges show.

**Step 4: Commit**

```bash
git add dashboard.html js/dashboard.js
git commit -m "feat: add ops dashboard with golden-query-backed metrics"
```

---

## Task 13: Write PRD Document

**Files:**
- Create: `~/Desktop/brewbase/docs/PRD.md`

**Step 1: Create the PRD**

Write a product requirements document covering:

- **Overview**: BrewBase — a data-governed coffee shop platform
- **Personas**: (1) Data Engineer — maintains models, runs lint/tier checks; (2) Ops Manager — trusts dashboard numbers, needs to know data is reliable; (3) AI Agent — queries data via MCP, needs guardrails and golden queries
- **Problems**: (1) Dashboards show numbers but nobody knows how they're calculated; (2) AI agents hallucinate metrics when data isn't governed; (3) New team members can't find business definitions; (4) Test data leaks into production reports
- **MLP (Minimum Lovable Product)**: Kiosk + Dashboard backed by ContextKit governance layer achieving Gold/Silver tiers, with AI agent access via MCP
- **KPIs**: % of models at Gold tier (target: 50%), # of golden queries available to AI (target: 10+), governance violations caught by linter (target: 0 in production), time-to-answer for new analyst questions (reduced via glossary + explain command)
- **Non-goals**: Real payment processing, mobile app, user authentication, real database

**Step 2: Commit**

```bash
mkdir -p ~/Desktop/brewbase/docs
git add docs/PRD.md
git commit -m "docs: add product requirements document"
```

---

## Task 14: Write Design Principles Document

**Files:**
- Create: `~/Desktop/brewbase/docs/DESIGN-PRINCIPLES.md`

**Step 1: Create the design principles**

Write what BrewBase should and shouldn't feel like:

**Should feel like:**
- A command center, not a toy — every number has a source
- Data is a first-class citizen, not an afterthought
- Trust is earned and visible — tier badges prove data maturity
- The terminal and the UI are equally important surfaces
- Clean, precise, intentional — like a well-pulled espresso shot

**Should NOT feel like:**
- A generic dashboard template with pretty charts and no substance
- "Just another coffee app" — the data governance IS the product
- Overwhelming or cluttered — dark theme, monospace, minimal decoration
- Disconnected from its data layer — every metric traces back to a golden query
- Finished — Silver-tier models show there's always more governance work to do

**Design tokens recap:** Dark bg, teal accent, JetBrains Mono for data, Inter for body, tier badges throughout.

**Step 2: Commit**

```bash
git add docs/DESIGN-PRINCIPLES.md
git commit -m "docs: add design principles document"
```

---

## Task 15: Final Integration Test & Polish

**Step 1: Run full ContextKit validation**

```bash
cd ~/Desktop/brewbase
npx contextkit lint
npx contextkit tier
npx contextkit build
npx contextkit site
```

All should pass. Fix any issues.

**Step 2: Test kiosk end-to-end**

Open kiosk, browse categories, add items to cart, checkout. Verify:
- Only active products shown (guardrail respected)
- Allergen badges display correctly
- Cart math is correct
- Checkout produces confirmation

**Step 3: Test dashboard end-to-end**

Open dashboard. Verify:
- KPIs exclude test orders (guardrail respected)
- Revenue by category chart renders
- Top 5 products list populated
- Tier badges show correct colors (Gold/Silver)
- Source labels visible under each metric
- Docs link works (points to generated site)

**Step 4: Test ContextKit docs site**

Open the generated site. Verify:
- All 4 models listed with correct tier badges
- Schema browser shows fields
- Golden queries are browsable
- Glossary terms render

**Step 5: Initialize GitHub repo and push**

```bash
cd ~/Desktop/brewbase
gh repo create brewbase --public --source=. --push
```

**Step 6: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "polish: final integration fixes"
```

---

## Summary

| Task | Description | Deliverable |
|------|-------------|-------------|
| 1 | Scaffold repo | Git repo + package.json + config |
| 2 | Owner files | 2 owner YAML files |
| 3 | Glossary terms | 4 term YAML files |
| 4 | Products model | Gold-tier OSI + governance + rules + lineage |
| 5 | Orders model | Gold-tier OSI + governance + rules + lineage |
| 6 | Ingredients model | Silver-tier OSI + governance + rules + lineage |
| 7 | Customers model | Silver-tier OSI + governance + lineage |
| 8 | Validate governance | All tiers verified, lint clean |
| 9 | Mock data | 4 JSON files (~300 records total) |
| 10 | CSS design system | Dark theme + all components |
| 11 | Kiosk page | Ordering UI (HTML + JS) |
| 12 | Dashboard page | Analytics UI (HTML + JS + Chart.js) |
| 13 | PRD document | Product requirements |
| 14 | Design principles | Should/shouldn't feel like |
| 15 | Integration test | Full validation + GitHub push |
