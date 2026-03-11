import { render } from 'preact';
import { ToastProvider } from '@runcontext/uxd/react';
import { App } from './App';
import { Stepper } from './components/Stepper';
import { PlanesPage } from './pages/PlanesPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { sources } from './state';
import { connectWebSocket } from './ws';
import { api } from './api';

// Detect current page from body data attribute
const currentPage = document.body.dataset.page || 'setup';

// --- Page mounting ---

if (currentPage === 'setup') {
  // Mount wizard app
  const root = document.getElementById('wizard-content');
  if (root) {
    render(<App />, root);
  }

  // Mount stepper
  const stepperEl = document.getElementById('stepper');
  if (stepperEl) {
    render(<Stepper />, stepperEl);
  }
} else {
  // Mount page component
  const root = document.getElementById('page-content');
  if (root) {
    const PageComponent = {
      planes: PlanesPage,
      analytics: AnalyticsPage,
      settings: SettingsPage,
    }[currentPage];

    if (PageComponent) {
      render(
        <ToastProvider>
          <div class="step-fade-in">
            <PageComponent />
          </div>
        </ToastProvider>,
        root
      );
    }
  }
}

// --- Shared: MCP status polling + toggle ---

let mcpRunning = false;

function updateMcpUI(running: boolean) {
  mcpRunning = running;
  const dot = document.getElementById('mcp-status-dot');
  const text = document.getElementById('mcp-status-text');
  const serverDot = document.getElementById('mcp-server-dot');
  const serverText = document.getElementById('mcp-server-text');
  if (running) {
    if (dot) { dot.classList.remove('error'); dot.classList.add('success'); }
    if (text) text.textContent = 'connected';
    if (serverDot) { serverDot.classList.remove('error'); serverDot.classList.add('success'); }
    if (serverText) serverText.textContent = 'MCP running';
  } else {
    if (dot) dot.classList.remove('success');
    if (text) text.textContent = 'offline';
    if (serverDot) serverDot.classList.remove('success');
    if (serverText) serverText.textContent = 'MCP stopped';
  }
}

function pollMcpStatus() {
  async function check() {
    try {
      const res = await fetch('/api/mcp/status');
      const data = await res.json();
      updateMcpUI(data.running === true);
    } catch {
      updateMcpUI(false);
    }
  }
  check();
  setInterval(check, 5000);
}

async function toggleMcp() {
  const serverText = document.getElementById('mcp-server-text');
  if (serverText) serverText.textContent = 'Working...';
  try {
    if (mcpRunning) {
      await fetch('/api/mcp/stop', { method: 'POST' });
      updateMcpUI(false);
    } else {
      await fetch('/api/mcp/start', { method: 'POST' });
      updateMcpUI(true);
    }
  } catch {
    // poll will correct the state
  }
}

function setupMcpToggle() {
  document.querySelectorAll('.mcp-toggle').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      toggleMcp();
    });
  });
}

// --- Shared: DB status restoration ---

function restoreDbStatus() {
  if (sources.value.length > 0) {
    const src = sources.value[0];
    const dot = document.getElementById('db-status-dot');
    const text = document.getElementById('db-status-text');
    if (dot && text) {
      dot.classList.remove('error'); dot.classList.add('success');
      text.textContent = (src.name || src.adapter) + ' connected';
    }
  }
}

// --- Init ---

function init() {
  pollMcpStatus();
  setupMcpToggle();
  restoreDbStatus();

  if (currentPage === 'setup') {
    // Setup-only: locked tooltip interactions
    const tooltip = document.getElementById('locked-tooltip');
    if (tooltip) {
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

    // Setup-only: WebSocket session
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
}

document.addEventListener('DOMContentLoaded', init);
