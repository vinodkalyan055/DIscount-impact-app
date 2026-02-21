require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const { shopify, storeSession } = require("./shopify");

const simulateRouter = require("./routes/simulate");
const applyRouter = require("./routes/apply");
const trackRouter = require("./routes/track");
const productsRouter = require("./routes/products");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());

// ─── Shopify OAuth ───────────────────────────────────────────────

app.get("/auth", async (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.status(400).send("Missing shop parameter");

  const authRoute = await shopify.auth.begin({
    shop: shopify.utils.sanitizeShop(shop, true),
    callbackPath: "/auth/callback",
    isOnline: false,
    rawRequest: req,
    rawResponse: res,
  });
});

app.get("/auth/callback", async (req, res) => {
  try {
    const callback = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });
    await storeSession(callback.session);

    const host = req.query.host;
    const redirectUrl = `/?shop=${callback.session.shop}&host=${host}`;
    res.redirect(redirectUrl);
  } catch (err) {
    console.error("Auth callback error:", err.message);
    res.status(500).send("Authentication failed");
  }
});

// ─── API Routes ──────────────────────────────────────────────────

app.use("/simulate", simulateRouter);
app.use("/apply", applyRouter);
app.use("/track", trackRouter);
app.use("/api/products", productsRouter);

// ─── Health Check ────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Root / Embedded App UI ──────────────────────────────────────

app.get("/", (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Discount Experiment Engine</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f6f6f7; color: #202223; padding: 20px; }
        h1 { margin-bottom: 8px; }
        .subtitle { color: #6d7175; margin-bottom: 24px; }
        .nav { display: flex; gap: 0; margin-bottom: 24px; border-bottom: 2px solid #e1e3e5; }
        .nav-tab { padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; background: none; color: #6d7175; border-bottom: 2px solid transparent; margin-bottom: -2px; }
        .nav-tab:hover { color: #202223; }
        .nav-tab.active { color: #008060; border-bottom-color: #008060; }
        .page { display: none; }
        .page.active { display: block; }
        .card { background: #fff; border: 1px solid #e1e3e5; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
        .card h2 { margin-bottom: 12px; font-size: 16px; }
        label { display: block; margin-bottom: 4px; font-weight: 500; font-size: 14px; }
        input, select { width: 100%; padding: 8px; border: 1px solid #c9cccf; border-radius: 6px; margin-bottom: 12px; font-size: 14px; }
        button { background: #008060; color: #fff; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; }
        button:hover { background: #006e52; }
        button.secondary { background: #fff; color: #202223; border: 1px solid #c9cccf; }
        button.secondary:hover { background: #f1f2f3; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e1e3e5; }
        th { background: #f6f6f7; font-weight: 600; }
        td img { border-radius: 4px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: 500; }
        .badge.profit, .badge.active { background: #aee9d1; color: #0a5c36; }
        .badge.loss { background: #fed3d1; color: #72231d; }
        .badge.break-even { background: #ffd79d; color: #5a3e00; }
        .badge.draft { background: #e4e5e7; color: #44474a; }
        .badge.archived { background: #e4e5e7; color: #6d7175; }
        .loading { text-align: center; padding: 40px; color: #6d7175; }
        #results, #trackResults { margin-top: 16px; }
        .actions { display: flex; gap: 8px; margin-top: 12px; }
      </style>
    </head>
    <body>
      <h1>Discount Experiment Engine</h1>
      <p class="subtitle">Simulate, apply, and track discount experiments on your products.</p>

      <div class="nav">
        <button class="nav-tab active" onclick="switchTab('experiments')">Experiments</button>
        <button class="nav-tab" onclick="switchTab('products')">Products</button>
      </div>

      <!-- Experiments Page -->
      <div id="page-experiments" class="page active">
        <div class="card">
          <h2>Plan A &mdash; Simulate Discount Impact</h2>
          <label for="simDiscount">Discount %</label>
          <input type="number" id="simDiscount" placeholder="e.g. 15" min="1" max="99" />
          <button onclick="runSimulate()">Simulate</button>
          <div id="results"></div>
        </div>

        <div class="card">
          <h2>Plan B &mdash; Apply Discount</h2>
          <p style="font-size:13px;color:#6d7175;margin-bottom:12px;">Select products from the simulation above, then apply.</p>
          <label for="baselineUnits">Baseline Units (avg sold before discount)</label>
          <input type="number" id="baselineUnits" placeholder="e.g. 50" min="1" />
          <button onclick="runApply()">Apply Discount to Selected</button>
          <div id="applyResults"></div>
        </div>

        <div class="card">
          <h2>Plan C &mdash; Track Performance</h2>
          <button onclick="runTrack()">Refresh Tracking</button>
          <div id="trackResults"></div>
        </div>
      </div>

      <!-- Products Page -->
      <div id="page-products" class="page">
        <div class="card">
          <h2>Products</h2>
          <div id="productsTable"><div class="loading">Loading products...</div></div>
        </div>
      </div>

      <script>
        const params = new URLSearchParams(window.location.search);
        const shop = params.get('shop') || '';
        let simData = [];
        let productsLoaded = false;

        function switchTab(tab) {
          document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
          document.querySelector('[onclick="switchTab(\\'' + tab + '\\')"]').classList.add('active');
          document.getElementById('page-' + tab).classList.add('active');
          if (tab === 'products' && !productsLoaded) loadProducts();
        }

        async function loadProducts() {
          const container = document.getElementById('productsTable');
          container.innerHTML = '<div class="loading">Loading products...</div>';
          try {
            const res = await fetch('/api/products?shop=' + shop);
            const data = await res.json();
            if (data.error) { container.innerHTML = '<p style="color:#d72c0d;">' + data.error + '</p>'; return; }
            if (!data.products || data.products.length === 0) { container.innerHTML = '<p style="color:#6d7175;">No products found.</p>'; return; }
            let html = '<table><tr><th>Image</th><th>Title</th><th>Status</th><th>Vendor</th><th>Type</th><th>Inventory</th><th>Variants</th><th>Price</th></tr>';
            data.products.forEach(p => {
              const img = p.image ? '<img src="' + p.image + '&width=40" alt="' + p.imageAlt + '" width="40" height="40" />' : '<span style="display:inline-block;width:40px;height:40px;background:#e1e3e5;border-radius:4px;"></span>';
              const statusClass = p.status === 'ACTIVE' ? 'active' : p.status === 'DRAFT' ? 'draft' : 'archived';
              html += '<tr><td>' + img + '</td><td>' + p.title + '</td><td><span class="badge ' + statusClass + '">' + p.status.toLowerCase() + '</span></td><td>' + (p.vendor || '-') + '</td><td>' + (p.productType || '-') + '</td><td>' + p.totalInventory + '</td><td>' + p.variantsCount + '</td><td>$' + parseFloat(p.price).toFixed(2) + '</td></tr>';
            });
            html += '</table>';
            container.innerHTML = html;
            productsLoaded = true;
          } catch (err) { container.innerHTML = '<p style="color:#d72c0d;">Failed to load products.</p>'; }
        }

        async function runSimulate() {
          const discount = document.getElementById('simDiscount').value;
          if (!discount) return alert('Enter a discount %');
          const res = await fetch('/simulate?shop=' + shop + '&discount=' + discount);
          const data = await res.json();
          if (data.error) return alert(data.error);
          simData = data.products || [];
          let html = '<table><tr><th><input type="checkbox" id="selectAll" onchange="toggleAll(this)" /></th><th>Product</th><th>Price</th><th>Cost</th><th>New Price</th><th>New Profit</th><th>Break-even +%</th></tr>';
          simData.forEach((p, i) => {
            html += '<tr><td><input type="checkbox" class="sel" data-idx="' + i + '" /></td><td>' + p.title + '</td><td>$' + p.price.toFixed(2) + '</td><td>$' + p.cost.toFixed(2) + '</td><td>$' + p.newPrice.toFixed(2) + '</td><td>$' + p.newProfit.toFixed(2) + '</td><td>' + (p.breakEvenIncrease !== null ? p.breakEvenIncrease.toFixed(1) + '%' : 'N/A') + '</td></tr>';
          });
          html += '</table>';
          document.getElementById('results').innerHTML = html;
        }

        function toggleAll(el) {
          document.querySelectorAll('.sel').forEach(cb => cb.checked = el.checked);
        }

        async function runApply() {
          const baseline = parseInt(document.getElementById('baselineUnits').value);
          if (!baseline) return alert('Enter baseline units');
          const discount = parseFloat(document.getElementById('simDiscount').value);
          if (!discount) return alert('Run simulation first');
          const selected = [];
          document.querySelectorAll('.sel:checked').forEach(cb => {
            const idx = parseInt(cb.dataset.idx);
            selected.push({ productId: simData[idx].productId, variantId: simData[idx].variantId });
          });
          if (selected.length === 0) return alert('Select at least one product');
          const res = await fetch('/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shop, products: selected, discount, baselineUnits: baseline }),
          });
          const data = await res.json();
          if (data.error) return alert(data.error);
          let html = '<p style="margin-top:8px;color:#008060;">Applied ' + data.results.filter(r => r.status === 'applied').length + ' experiment(s).</p>';
          document.getElementById('applyResults').innerHTML = html;
        }

        async function runTrack() {
          const res = await fetch('/track?shop=' + shop);
          const data = await res.json();
          if (data.error) return alert(data.error);
          if (!data.experiments || data.experiments.length === 0) {
            document.getElementById('trackResults').innerHTML = '<p style="margin-top:8px;color:#6d7175;">No experiments yet.</p>';
            return;
          }
          let html = '<table><tr><th>Variant</th><th>Discount</th><th>Units Sold</th><th>Target</th><th>Progress</th><th>Status</th></tr>';
          data.experiments.forEach(e => {
            const badge = e.profitStatus === 'profit' ? 'profit' : e.profitStatus === 'break-even' ? 'break-even' : 'loss';
            html += '<tr><td>' + e.variantId.split('/').pop() + '</td><td>' + e.discount + '%</td><td>' + e.unitsSold + '</td><td>' + (e.targetUnits !== null ? e.targetUnits : 'N/A') + '</td><td>' + (e.progressPercent !== null ? e.progressPercent + '%' : 'N/A') + '</td><td><span class="badge ' + badge + '">' + e.profitStatus + '</span></td></tr>';
          });
          html += '</table>';
          document.getElementById('trackResults').innerHTML = html;
        }
      </script>
    </body>
    </html>
  `);
});

// ─── Start Server ────────────────────────────────────────────────

async function start() {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Discount Experiment Engine running on port ${PORT}`);
  });
}

start();
