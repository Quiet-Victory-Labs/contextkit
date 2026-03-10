import { render } from 'preact';
import { App } from './App';
import { Stepper } from './components/Stepper';
import { sources } from './state';
import { connectWebSocket } from './ws';
import { api } from './api';

// Mount app into wizard-content
const root = document.getElementById('wizard-content');
if (root) {
  render(<App />, root);
}

// Mount stepper into header
const stepperEl = document.getElementById('stepper');
if (stepperEl) {
  render(<Stepper />, stepperEl);
}

// Sidebar: locked tooltip interactions
function setupSidebarLocked() {
  const tooltip = document.getElementById('locked-tooltip');
  if (!tooltip) return;
  document.querySelectorAll('.nav-item.locked').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = (item as HTMLElement).getBoundingClientRect();
      tooltip.style.display = 'block';
      tooltip.style.left = rect.left + 'px';
      tooltip.style.top = (rect.bottom + 6) + 'px';
    });
  });
  document.addEventListener('click', (e) => {
    if (tooltip.style.display !== 'none') {
      let isLocked = false;
      document.querySelectorAll('.nav-item.locked').forEach(item => {
        if (item.contains(e.target as Node)) isLocked = true;
      });
      if (!isLocked) tooltip.style.display = 'none';
    }
  });
}

// Sidebar: MCP status polling
function pollMcpStatus() {
  async function check() {
    const dot = document.getElementById('mcp-status-dot');
    const text = document.getElementById('mcp-status-text');
    const serverDot = document.getElementById('mcp-server-dot');
    const serverText = document.getElementById('mcp-server-text');
    if (!dot || !text) return;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      await fetch('http://localhost:3333/health', { method: 'GET', mode: 'no-cors', signal: controller.signal });
      clearTimeout(timer);
      dot.classList.remove('error'); dot.classList.add('success');
      text.textContent = 'connected';
      if (serverDot) { serverDot.classList.remove('error'); serverDot.classList.add('success'); }
      if (serverText) serverText.textContent = 'MCP running';
    } catch {
      dot.classList.remove('success');
      text.textContent = 'offline';
      if (serverDot) serverDot.classList.remove('success');
      if (serverText) serverText.textContent = 'MCP stopped';
    }
  }
  check();
  setInterval(check, 10000);
}

// Init
function init() {
  setupSidebarLocked();
  pollMcpStatus();

  // Restore DB status
  if (sources.value.length > 0) {
    const src = sources.value[0];
    const dot = document.getElementById('db-status-dot');
    const text = document.getElementById('db-status-text');
    if (dot && text) {
      dot.classList.remove('error'); dot.classList.add('success');
      text.textContent = (src.name || src.adapter) + ' connected';
    }
  }

  // Check for existing products
  api<any[]>('GET', '/api/products').then(products => {
    if (products.length > 0) {
      const content = document.getElementById('wizard-content');
      if (!content) return;
      const banner = document.createElement('div');
      content.insertBefore(banner, content.firstChild);
      render(
        <div class="existing-products-banner">
          <p class="banner-title">
            Your semantic plane has {products.length} data product{products.length === 1 ? '' : 's'}. Adding another.
          </p>
          <div class="product-chips">
            {products.map((p: any) => <span class="product-chip">{p.name}</span>)}
          </div>
        </div>,
        banner
      );
    }
  }).catch(() => {});

  // Create or resume WebSocket session
  const urlParams = new URLSearchParams(window.location.search);
  const sessionParam = urlParams.get('session');
  if (sessionParam) {
    connectWebSocket(sessionParam);
  } else {
    api<{ sessionId: string }>('POST', '/api/session').then(data => {
      if (data.sessionId) {
        connectWebSocket(data.sessionId);
        const newUrl = window.location.pathname + '?session=' + encodeURIComponent(data.sessionId);
        window.history.replaceState({}, '', newUrl);
      }
    }).catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
