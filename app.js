/* ================================================================
   BUDGETBUDDY – app.js
   Interactive Nav + Expense Tracker + Full Save Features:
   1. localStorage persistence (expenses, budget, savings goal)
   2. Monthly budget limit with live gauge
   3. CSV + PDF (print) export
   4. Savings goal with target amount & deadline
   ================================================================ */

'use strict';

// ── Toast System ─────────────────────────────────────────────────
const toastContainer = document.createElement('div');
toastContainer.className = 'toast-container';
toastContainer.setAttribute('aria-live', 'polite');
document.body.appendChild(toastContainer);

const TOAST_ICONS = { success: '✅', error: '❌', info: '💡', warning: '⚠️' };

function showToast(message, type = 'success', duration = 3200) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `<span class="toast-icon" aria-hidden="true">${TOAST_ICONS[type]}</span><span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

// ── localStorage Helpers ─────────────────────────────────────────
const LS = {
  get: (key, fallback) => {
    try {
      let v = localStorage.getItem('budgetbuddy_' + key);
      if (v === null) {
        v = localStorage.getItem('budgetu_' + key);
      }
      return v !== null ? JSON.parse(v) : fallback;
    }
    catch { return fallback; }
  },
  set: (key, value) => {
    try { localStorage.setItem('budgetbuddy_' + key, JSON.stringify(value)); } catch {}
  },
  remove: (key) => {
    try {
      localStorage.removeItem('budgetbuddy_' + key);
      localStorage.removeItem('budgetu_' + key);
    } catch {}
  }
};

// ── Navbar Scroll & Active Link ──────────────────────────────────
const navbar    = document.getElementById('navbar');
const scrollBar = document.getElementById('scroll-progress');
const navLinks  = document.querySelectorAll('.nav-link');
const sections  = document.querySelectorAll('.section');
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobile-menu');

let ticking = false;

function onScroll() {
  if (!ticking) { requestAnimationFrame(updateNavOnScroll); ticking = true; }
}

function updateNavOnScroll() {
  const scrollY = window.scrollY;
  navbar.classList.toggle('scrolled', scrollY > 40);

  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  scrollBar.style.width = (docHeight > 0 ? (scrollY / docHeight) * 100 : 0) + '%';

  let current = 'hero';
  sections.forEach(sec => { if (scrollY >= sec.offsetTop - 100) current = sec.id; });
  navLinks.forEach(link => link.classList.toggle('active', link.dataset.section === current));

  ticking = false;
}

window.addEventListener('scroll', onScroll, { passive: true });

// Nav ripple
navLinks.forEach(link => {
  link.addEventListener('click', function (e) {
    const r = document.createElement('span');
    r.classList.add('ripple');
    const rect = this.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    r.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px;`;
    this.appendChild(r);
    setTimeout(() => r.remove(), 550);
  });
});

// Hamburger
function closeMobileMenu() {
  hamburger.classList.remove('open');
  mobileMenu.classList.remove('open');
  mobileMenu.setAttribute('aria-hidden', 'true');
  hamburger.setAttribute('aria-expanded', 'false');
}
hamburger.addEventListener('click', () => {
  const open = mobileMenu.classList.toggle('open');
  hamburger.classList.toggle('open', open);
  mobileMenu.setAttribute('aria-hidden', String(!open));
  hamburger.setAttribute('aria-expanded', String(open));
});
document.addEventListener('click', e => { if (!navbar.contains(e.target)) closeMobileMenu(); });
window.closeMobileMenu = closeMobileMenu;

// ── Scroll Reveal ────────────────────────────────────────────────
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('visible'); revealObserver.unobserve(entry.target); }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.dash-card, .tracker-form-card, .expense-list-card, .analytics-card, .tip-card')
  .forEach(el => { el.classList.add('reveal'); revealObserver.observe(el); });

// ── Dashboard Animations ─────────────────────────────────────────
const dashObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const bar = document.getElementById('balance-bar');
    if (bar) bar.style.width = '69%';
    updateSavingsRing();
    dashObserver.disconnect();
  });
}, { threshold: 0.3 });

const dashSection = document.getElementById('dashboard');
if (dashSection) dashObserver.observe(dashSection);

// SVG ring gradient
document.querySelectorAll('.savings-ring').forEach(svg => {
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `<linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#6c63ff"/>
    <stop offset="100%" stop-color="#00d4ff"/>
  </linearGradient>`;
  svg.prepend(defs);
});

// ── FEATURE 1: localStorage – Expense Data ───────────────────────
const CATEGORY_ICONS = {
  food: '🍕', transport: '🚌', study: '📚',
  entertainment: '🎬', health: '💊', shopping: '🛍️', other: '📦',
};

const DATA_VERSION = 'v3';

const DEFAULT_EXPENSES = [
  // ── July 17 (today) ──
  { id: 1,  name: 'Chai & Biscuits',         amount: 30,  category: 'food',          date: '2026-07-17' },
  { id: 2,  name: 'Printed Assignment',       amount: 45,  category: 'study',         date: '2026-07-17' },

  // ── July 16 (Thu) ──
  { id: 33, name: 'Canteen Snacks',          amount: 45,  category: 'food',          date: '2026-07-16' },
  { id: 34, name: 'Auto to College',          amount: 60,  category: 'transport',     date: '2026-07-16' },

  // ── July 15 ──
  { id: 3,  name: 'Canteen Lunch',            amount: 85,  category: 'food',          date: '2026-07-15' },
  { id: 4,  name: 'Metro Card Recharge',      amount: 200, category: 'transport',     date: '2026-07-15' },
  { id: 5,  name: 'Evening Vada Pav',         amount: 30,  category: 'food',          date: '2026-07-15' },

  // ── July 14 ──
  { id: 6,  name: 'Organic Chemistry Book',   amount: 450, category: 'study',         date: '2026-07-14' },
  { id: 7,  name: 'Netflix Split',            amount: 60,  category: 'entertainment', date: '2026-07-14' },

  // ── July 13 ──
  { id: 8,  name: 'Paracetamol Strip',        amount: 30,  category: 'health',        date: '2026-07-13' },
  { id: 9,  name: 'Auto to Hospital',         amount: 80,  category: 'transport',     date: '2026-07-13' },

  // ── July 12 ──
  { id: 10, name: 'Hoodie (sale)',             amount: 750, category: 'shopping',      date: '2026-07-12' },
  { id: 11, name: 'Evening Snacks',            amount: 45,  category: 'food',          date: '2026-07-12' },

  // ── July 11 (Sat) ──
  { id: 35, name: 'Weekend Market Veg',       amount: 85,  category: 'food',          date: '2026-07-11' },
  { id: 36, name: 'Bus to Mall',              amount: 30,  category: 'transport',     date: '2026-07-11' },
  { id: 37, name: 'Bubble Tea (treat)',        amount: 110, category: 'food',          date: '2026-07-11' },

  // ── July 10 ──
  { id: 12, name: 'Masala Maggi',             amount: 30,  category: 'food',          date: '2026-07-10' },
  { id: 13, name: 'Bus Pass Top-up',          amount: 120, category: 'transport',     date: '2026-07-10' },
  { id: 14, name: 'Highlighters Pack',        amount: 65,  category: 'study',         date: '2026-07-10' },

  // ── July 09 ──
  { id: 15, name: 'Pizza with friends',       amount: 180, category: 'food',          date: '2026-07-09' },
  { id: 16, name: 'Movie (OTT rent)',         amount: 45,  category: 'entertainment', date: '2026-07-09' },

  // ── July 08 ──
  { id: 17, name: 'Protein Powder (split)',   amount: 350, category: 'health',        date: '2026-07-08' },
  { id: 18, name: 'Chai at Stall',            amount: 15,  category: 'food',          date: '2026-07-08' },

  // ── July 07 ──
  // (lazy Sunday, cooked at hostel — ₹0)

  // ── July 06 ──
  { id: 19, name: 'Samosa + Chai',            amount: 30,  category: 'food',          date: '2026-07-06' },
  { id: 20, name: 'Cab to Airport Drop',      amount: 320, category: 'transport',     date: '2026-07-06' },

  // ── July 05 ──
  { id: 21, name: 'Data Structure Notes PDF', amount: 99,  category: 'study',         date: '2026-07-05' },
  { id: 22, name: 'Juice at Canteen',         amount: 45,  category: 'food',          date: '2026-07-05' },
  { id: 23, name: 'Headache Tablet',          amount: 30,  category: 'health',        date: '2026-07-05' },

  // ── July 04 ──
  { id: 24, name: 'Birthday Dinner (share)',  amount: 220, category: 'food',          date: '2026-07-04' },
  { id: 25, name: 'Gift for Rohan',           amount: 150, category: 'shopping',      date: '2026-07-04' },

  // ── July 03 ──
  // (college closed, spent nothing)

  // ── July 02 ──
  { id: 26, name: 'Morning Idli',             amount: 30,  category: 'food',          date: '2026-07-02' },
  { id: 27, name: 'Spotify Student Plan',     amount: 59,  category: 'entertainment', date: '2026-07-02' },
  { id: 28, name: 'Auto to PG',               amount: 45,  category: 'transport',     date: '2026-07-02' },

  // ── July 01 ──
  { id: 29, name: 'Stationery (pens + files)',amount: 85,  category: 'study',         date: '2026-07-01' },
  { id: 30, name: 'Evening Cold Coffee',      amount: 45,  category: 'food',          date: '2026-07-01' },

  // ── June 30 ──
  { id: 31, name: 'Dhobi / Laundry',          amount: 120, category: 'other',         date: '2026-06-30' },
  { id: 32, name: 'Bread + Jam',              amount: 30,  category: 'food',          date: '2026-06-30' },
];

// Force fresh defaults when data version changes
if (LS.get('dataVersion', null) !== DATA_VERSION) {
  LS.set('dataVersion', DATA_VERSION);
  LS.remove('expenses');
  LS.remove('nextId');
}

let expenses = LS.get('expenses', DEFAULT_EXPENSES);
let nextId   = LS.get('nextId',   38);

function saveExpenses() {
  LS.set('expenses', expenses);
  LS.set('nextId', nextId);
}

function renderExpenses() {
  const list  = document.getElementById('expense-list');
  const count = document.getElementById('expense-count');
  if (!list) return;
  count.textContent = `${expenses.length} item${expenses.length !== 1 ? 's' : ''}`;
  list.innerHTML = expenses.map(exp => `
    <li class="expense-item" id="exp-${exp.id}" role="listitem" aria-label="${exp.name}: ₹${exp.amount}">
      <span class="expense-icon" aria-hidden="true">${CATEGORY_ICONS[exp.category] || '📦'}</span>
      <div class="expense-details">
        <div class="expense-name">${exp.name}</div>
        <div class="expense-meta">${exp.date} · ${exp.category.charAt(0).toUpperCase() + exp.category.slice(1)}</div>
      </div>
      <span class="expense-amount" aria-label="Amount: ₹${exp.amount}">-₹${exp.amount}</span>
      <button class="expense-delete" id="del-${exp.id}" onclick="deleteExpense(${exp.id})"
        aria-label="Delete ${exp.name}" title="Delete">✕</button>
    </li>
  `).join('');
}

function deleteExpense(id) {
  const item = document.getElementById(`exp-${id}`);
  const name = expenses.find(e => e.id === id)?.name || 'Expense';
  if (item) {
    item.style.transition = 'opacity 0.25s, transform 0.25s';
    item.style.opacity    = '0';
    item.style.transform  = 'translateX(20px)';
    setTimeout(() => {
      expenses = expenses.filter(e => e.id !== id);
      saveExpenses();
      renderExpenses();
      renderAnalytics();
      updateBudgetGauge();
      updateBalanceCard();
      showToast(`"${name}" deleted`, 'info', 2400);
    }, 260);
  }
}
window.deleteExpense = deleteExpense;

// Set default date
const dateInput = document.getElementById('expense-date');
if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

function shake(el) {
  el.style.borderColor = 'var(--clr-red)';
  el.style.boxShadow   = '0 0 0 3px rgba(244,63,94,0.25)';
  setTimeout(() => { el.style.borderColor = ''; el.style.boxShadow = ''; }, 1200);
}

document.getElementById('btn-add-expense')?.addEventListener('click', () => {
  const nameEl = document.getElementById('expense-name');
  const amtEl  = document.getElementById('expense-amount');
  const catEl  = document.getElementById('expense-category');
  const dateEl = document.getElementById('expense-date');

  const name   = nameEl.value.trim();
  const amount = parseFloat(amtEl.value);
  const cat    = catEl.value;
  const date   = dateEl.value || new Date().toISOString().split('T')[0];

  if (!name)           { shake(nameEl); showToast('Please enter an expense name', 'error'); return; }
  if (!amount || amount <= 0) { shake(amtEl); showToast('Please enter a valid amount', 'error'); return; }

  expenses.unshift({ id: nextId++, name, amount, category: cat, date });
  saveExpenses();
  renderExpenses();
  renderAnalytics();
  updateBudgetGauge();
  updateBalanceCard();

  nameEl.value = '';
  amtEl.value  = '';
  nameEl.focus();
  showToast(`"${name}" saved ₹${amount}`, 'success');
});

// ── FEATURE 3: CSV Export ────────────────────────────────────────
document.getElementById('btn-export-csv')?.addEventListener('click', () => {
  if (!expenses.length) { showToast('No expenses to export', 'warning'); return; }

  const headers = ['ID', 'Date', 'Name', 'Category', 'Amount (₹)'];
  const rows    = expenses.map(e => [e.id, e.date, `"${e.name}"`, e.category, e.amount]);
  const csv     = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob    = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  const today   = new Date().toISOString().split('T')[0];

  a.href     = url;
  a.download = `budgetbuddy_expenses_${today}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Exported ${expenses.length} expenses as CSV`, 'success');
});

// ── FEATURE 3: PDF (Print) Export ───────────────────────────────
document.getElementById('btn-export-pdf')?.addEventListener('click', () => {
  if (!expenses.length) { showToast('No expenses to export', 'warning'); return; }

  const total   = expenses.reduce((s, e) => s + e.amount, 0);
  const today   = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
  const rows    = expenses.map(e => `
    <tr>
      <td>${e.date}</td>
      <td>${CATEGORY_ICONS[e.category]} ${e.name}</td>
      <td>${e.category.charAt(0).toUpperCase() + e.category.slice(1)}</td>
      <td style="text-align:right;font-weight:700;color:#f43f5e;">₹${e.amount}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>BudgetBuddy – Expense Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
    .logo { font-size: 1.8rem; font-weight: 900; color: #6c63ff; }
    .logo span { color: #00d4ff; }
    .meta { font-size: 0.85rem; color: #64748b; text-align: right; }
    h2 { font-size: 1.2rem; margin-bottom: 16px; color: #334155; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th { background: #6c63ff; color: #fff; padding: 12px 16px; text-align: left; font-weight: 700; }
    td { padding: 10px 16px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) td { background: #f1f5f9; }
    .total-row td { font-weight: 900; font-size: 1rem; background: #ede9fe; border-top: 2px solid #6c63ff; }
    .footer { margin-top: 32px; text-align: center; font-size: 0.78rem; color: #94a3b8; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Budget<span>Buddy</span></div>
    <div class="meta"><strong>Expense Report</strong><br/>Generated: ${today}</div>
  </div>
  <h2>📋 All Expenses (${expenses.length} items)</h2>
  <table>
    <thead><tr><th>Date</th><th>Expense</th><th>Category</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
    <tr class="total-row"><td colspan="3"><strong>Total Spent</strong></td><td style="text-align:right">₹${total.toLocaleString('en-IN')}</td></tr>
  </table>
  <div class="footer">BudgetBuddy – Smart Student Budget Analyser · budgetbuddy.app</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
    showToast('PDF preview opened — press Ctrl+P to save', 'info', 4000);
  } else {
    showToast('Pop-up blocked — please allow pop-ups and try again', 'error');
  }
});

// Clear all
document.getElementById('btn-clear-all')?.addEventListener('click', () => {
  if (!expenses.length) { showToast('Nothing to clear', 'info'); return; }
  if (!confirm(`Delete all ${expenses.length} expenses? This cannot be undone.`)) return;
  expenses = [];
  nextId   = 1;
  saveExpenses();
  renderExpenses();
  renderAnalytics();
  updateBudgetGauge();
  updateBalanceCard();
  showToast('All expenses cleared', 'warning');
});

// ── FEATURE 2: Budget Limit ──────────────────────────────────────
let budgetLimit = LS.get('budgetLimit', 0);

function getCurrentMonthTotal() {
  const now = new Date();
  const ym  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return expenses
    .filter(e => e.date && e.date.startsWith(ym))
    .reduce((s, e) => s + e.amount, 0);
}

function updateBudgetGauge() {
  const sub  = document.getElementById('budget-banner-sub');
  const wrap = document.querySelector('.budget-gauge-wrap');
  const inp  = document.getElementById('budget-limit-input');

  if (!budgetLimit) {
    if (sub)  sub.textContent = 'Set a limit to track overspending';
    if (wrap) wrap.classList.remove('visible');
    return;
  }

  const spent  = getCurrentMonthTotal();
  const pct    = Math.min((spent / budgetLimit) * 100, 100);
  const over   = spent > budgetLimit;

  if (!wrap) return;
  if (!wrap.innerHTML) {
    wrap.innerHTML = `
      <div class="budget-gauge-labels">
        <span class="spent-label${over ? ' over' : ''}" id="gauge-spent"></span>
        <span id="gauge-limit"></span>
      </div>
      <div class="budget-gauge-track"><div class="budget-gauge-fill" id="gauge-fill"></div></div>`;
  }

  wrap.classList.add('visible');
  const spentEl = document.getElementById('gauge-spent');
  const limitEl = document.getElementById('gauge-limit');
  const fillEl  = document.getElementById('gauge-fill');

  if (spentEl) { spentEl.className = `spent-label${over ? ' over' : ''}`; spentEl.textContent = `Spent ₹${spent.toLocaleString('en-IN')}`; }
  if (limitEl) limitEl.textContent = `Limit ₹${budgetLimit.toLocaleString('en-IN')}`;
  if (fillEl)  {
    fillEl.style.width = pct + '%';
    fillEl.className = 'budget-gauge-fill' + (pct >= 100 ? ' danger' : pct >= 75 ? ' warning' : '');
  }
  if (sub) sub.textContent = over
    ? `⚠️ Over budget by ₹${(spent - budgetLimit).toLocaleString('en-IN')}!`
    : `₹${(budgetLimit - spent).toLocaleString('en-IN')} remaining this month`;
  if (inp) inp.value = budgetLimit;
}

document.getElementById('btn-save-budget')?.addEventListener('click', () => {
  const inp = document.getElementById('budget-limit-input');
  const val = parseFloat(inp?.value || '0');
  if (!val || val <= 0) { shake(inp); showToast('Enter a valid budget amount', 'error'); return; }
  budgetLimit = val;
  LS.set('budgetLimit', budgetLimit);
  updateBudgetGauge();
  showToast(`Monthly budget set to ₹${val.toLocaleString('en-IN')} 🎯`, 'success');
});

// ── FEATURE 5: Monthly Income ────────────────────────────────────
const SOURCE_LABELS = {
  stipend: '🎓 Stipend', freelance: '💻 Freelance', parttime: '🏪 Part-time',
  allowance: '👨‍👩‍👧 Allowance', scholarship: '🏅 Scholarship', other: '📦 Other',
};

let monthlyIncome = LS.get('monthlyIncome', { amount: 0, source: 'stipend' });

function updateIncomeDisplay() {
  const display = document.getElementById('income-display');
  const trend   = document.getElementById('income-trend');

  if (display) display.textContent = `₹${monthlyIncome.amount.toLocaleString('en-IN')}`;
  if (trend) {
    if (monthlyIncome.amount > 0) {
      trend.textContent = SOURCE_LABELS[monthlyIncome.source] || 'Income set';
      trend.className   = 'dash-trend positive';
    } else {
      trend.textContent = 'Set your monthly income';
      trend.className   = 'dash-trend positive';
    }
  }

  updateBalanceCard();
}

function updateBalanceCard() {
  const balVal = document.getElementById('balance-value');
  const balBar = document.getElementById('balance-bar');
  const spent  = getCurrentMonthTotal();
  const balance = monthlyIncome.amount - spent;

  if (balVal) balVal.textContent = `₹${balance.toLocaleString('en-IN')}`;

  // Update trend
  const trendEl = document.querySelector('.balance-card .dash-trend');
  if (trendEl) {
    if (monthlyIncome.amount > 0) {
      const pctUsed = Math.round((spent / monthlyIncome.amount) * 100);
      const pctLeft = 100 - pctUsed;
      if (balance >= 0) {
        trendEl.className = 'dash-trend positive';
        trendEl.textContent = `${pctLeft}% remaining`;
      } else {
        trendEl.className = 'dash-trend negative';
        trendEl.textContent = `Over budget by ₹${Math.abs(balance).toLocaleString('en-IN')}`;
      }
    } else {
      trendEl.className = 'dash-trend positive';
      trendEl.textContent = 'Set income to see balance';
    }
  }

  // Update balance bar
  if (balBar && monthlyIncome.amount > 0) {
    const pct = Math.min(Math.max(((monthlyIncome.amount - spent) / monthlyIncome.amount) * 100, 0), 100);
    balBar.style.width = pct + '%';
  }

  // Update expenses card value
  const expVal = document.querySelector('.expense-card .dash-card-value');
  if (expVal) expVal.textContent = `₹${spent.toLocaleString('en-IN')}`;
}

document.getElementById('btn-save-income')?.addEventListener('click', () => {
  const inp    = document.getElementById('income-input');
  const srcSel = document.getElementById('income-source');
  const amount = parseFloat(inp?.value || '0');

  if (!amount || amount <= 0) { shake(inp); showToast('Enter a valid income amount', 'error'); return; }

  monthlyIncome = { amount, source: srcSel?.value || 'other' };
  LS.set('monthlyIncome', monthlyIncome);
  updateIncomeDisplay();
  showToast(`Monthly income set to ₹${amount.toLocaleString('en-IN')} 💰`, 'success');
});

// ── FEATURE 4: Savings Goal ──────────────────────────────────────
let savingsGoal = LS.get('savingsGoal', { target: 3000, deadline: '', saved: 2160 });

function updateSavingsRing() {
  const display    = document.getElementById('savings-goal-display');
  const ringFill   = document.getElementById('savings-ring-fill');
  const ringPct    = document.getElementById('savings-ring-pct');
  const deadlineEl = document.querySelector('.savings-deadline');

  if (!savingsGoal.target) return;

  const pct         = Math.min((savingsGoal.saved / savingsGoal.target) * 100, 100);
  const circumf     = 2 * Math.PI * 24;
  const offset      = circumf - (pct / 100) * circumf;

  if (display)   display.textContent = `₹${savingsGoal.target.toLocaleString('en-IN')}`;
  if (ringFill)  ringFill.style.strokeDashoffset = offset;
  if (ringPct)   ringPct.textContent = Math.round(pct) + '%';

  if (deadlineEl && savingsGoal.deadline) {
    const d    = new Date(savingsGoal.deadline);
    const diff = Math.ceil((d - new Date()) / 86400000);
    deadlineEl.textContent = diff > 0 ? `🗓 ${diff} days left` : diff === 0 ? '🗓 Due today!' : '🗓 Deadline passed';
  } else if (deadlineEl) {
    deadlineEl.textContent = '';
  }
}

document.getElementById('btn-save-savings')?.addEventListener('click', () => {
  const targetInp   = document.getElementById('savings-target-input');
  const deadlineInp = document.getElementById('savings-date-input');
  const target      = parseFloat(targetInp?.value || '0');

  if (!target || target <= 0) { shake(targetInp); showToast('Enter a valid savings goal', 'error'); return; }

  savingsGoal = { ...savingsGoal, target, deadline: deadlineInp?.value || '' };
  LS.set('savingsGoal', savingsGoal);
  updateSavingsRing();
  showToast(`Savings goal set to ₹${target.toLocaleString('en-IN')} 💰`, 'success');

  // Add deadline label if not already there
  let deadlineEl = document.querySelector('.savings-deadline');
  if (!deadlineEl) {
    deadlineEl = document.createElement('div');
    deadlineEl.className = 'savings-deadline';
    document.getElementById('savings-card')?.appendChild(deadlineEl);
  }
  updateSavingsRing();
});

// Restore saved goal inputs from localStorage
window.addEventListener('DOMContentLoaded', () => {
  const g = LS.get('savingsGoal', null);
  if (g) {
    const t = document.getElementById('savings-target-input');
    const d = document.getElementById('savings-date-input');
    if (t) t.value = g.target || '';
    if (d) d.value = g.deadline || '';
  }
  const bl = LS.get('budgetLimit', 0);
  if (bl) {
    const inp = document.getElementById('budget-limit-input');
    if (inp) inp.value = bl;
  }
  // Restore monthly income
  const mi = LS.get('monthlyIncome', null);
  if (mi) {
    const incInp = document.getElementById('income-input');
    const srcSel = document.getElementById('income-source');
    if (incInp && mi.amount) incInp.value = mi.amount;
    if (srcSel && mi.source) srcSel.value = mi.source;
  }
});

// ── Analytics ─────────────────────────────────────────────────────
const CATEGORY_COLORS = {
  food:          'linear-gradient(90deg,#f59e0b,#f97316)',
  transport:     'linear-gradient(90deg,#6c63ff,#8b5cf6)',
  study:         'linear-gradient(90deg,#10b981,#06b6d4)',
  entertainment: 'linear-gradient(90deg,#ec4899,#f43f5e)',
  health:        'linear-gradient(90deg,#00d4ff,#0ea5e9)',
  shopping:      'linear-gradient(90deg,#f59e0b,#fbbf24)',
  other:         'linear-gradient(90deg,#8892a4,#64748b)',
};

function renderAnalytics() {
  const totals = {};
  expenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + e.amount; });
  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
  const sorted     = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  const catBars = document.getElementById('category-bars');
  if (catBars) {
    catBars.innerHTML = sorted.map(([cat, amt]) => {
      const pct   = Math.round((amt / grandTotal) * 100);
      const label = cat.charAt(0).toUpperCase() + cat.slice(1);
      return `
        <div class="cat-item reveal" role="group" aria-label="${label}: ${pct}%">
          <div class="cat-header">
            <span class="cat-label">${CATEGORY_ICONS[cat] || '📦'} ${label}</span>
            <span class="cat-pct">${pct}%  ₹${amt}</span>
          </div>
          <div class="cat-bar-track" aria-hidden="true">
            <div class="cat-bar-fill" style="background:${CATEGORY_COLORS[cat]};width:0%" data-target="${pct}%"></div>
          </div>
        </div>`;
    }).join('');
    setTimeout(() => {
      catBars.querySelectorAll('.cat-bar-fill').forEach(bar => { bar.style.width = bar.dataset.target; });
      catBars.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
    }, 80);
  }

  const days    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const nowLocal   = new Date();
  const today      = nowLocal.getDay();
  // Build a local-midnight Date for "today" to avoid UTC-parse timezone shift
  const todayMidnight = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate());
  const weekly     = new Array(7).fill(0);
  expenses.forEach(e => {
    // Parse expense date as LOCAL midnight (appending T00:00:00 forces local TZ)
    const expMidnight = new Date(e.date + 'T00:00:00');
    const diff = Math.round((todayMidnight - expMidnight) / 86400000);
    if (diff >= 0 && diff < 7) weekly[(today - diff + 7) % 7] += e.amount;
  });
  const maxVal = Math.max(...weekly, 1);
  const ordDays = [], ordAmts = [];
  for (let i = 0; i < 7; i++) {
    const idx = (today - 6 + i + 7) % 7;
    ordDays.push(days[idx]); ordAmts.push(weekly[idx]);
  }

  const wChart  = document.getElementById('weekly-chart');
  const wLabels = document.getElementById('weekly-labels');
  if (wChart && wLabels) {
    wChart.innerHTML = ordAmts.map((amt, i) => {
      const h = Math.max(4, (amt / maxVal) * 100);
      const isToday = i === 6;
      return `<div class="weekly-bar-wrap"><div class="weekly-bar${isToday ? ' today' : ''}"
        style="height:${h}%" data-amount="₹${amt}" title="${ordDays[i]}: ₹${amt}"
        role="img" aria-label="${ordDays[i]}: ₹${amt}"></div></div>`;
    }).join('');
    wLabels.innerHTML = ordDays.map((d, i) =>
      `<div class="weekly-day${i === 6 ? ' today' : ''}">${d}</div>`).join('');
  }
}

// Analytics observer
const analyticsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.querySelectorAll('.cat-bar-fill').forEach(b => { b.style.width = b.dataset.target; });
    analyticsObserver.disconnect();
  });
}, { threshold: 0.2 });
const analyticsSection = document.getElementById('analytics');
if (analyticsSection) analyticsObserver.observe(analyticsSection);

// ── Tips ─────────────────────────────────────────────────────────
const tips = [
  { emoji: '🍱', title: 'Cook More, Spend Less',      body: 'Preparing meals at home even 3 days a week can save ₹1,500–₹2,000 a month. Batch-cook on Sundays!' },
  { emoji: '🚌', title: 'Smart Commuting',             body: 'Use monthly metro/bus passes over per-ride fares. Combine walking & transit to cut transport costs by 40%.' },
  { emoji: '📚', title: 'Leverage College Resources',  body: 'Library, e-learning portals, and student discounts (Spotify, Adobe) can save ₹3,000+ per semester.' },
  { emoji: '💳', title: 'Use the 50/30/20 Rule',       body: '50% needs, 30% wants, 20% savings. Automate a ₹500–₹1,000 transfer to savings on stipend day.' },
  { emoji: '🎯', title: 'Set Weekly Spend Limits',     body: 'Define a fixed weekly cash envelope per category. When it is gone, it is gone — no overspending.' },
  { emoji: '🔔', title: 'Log Expenses Instantly',      body: 'Add expenses right after spending, not at the end of the day. Accuracy drops by 60% with delayed logging.' },
];

function renderTips() {
  const grid = document.getElementById('tips-grid');
  if (!grid) return;
  grid.innerHTML = tips.map((t, i) => `
    <article class="tip-card reveal" id="tip-${i}" role="listitem" aria-label="${t.title}">
      <span class="tip-emoji" aria-hidden="true">${t.emoji}</span>
      <h3 class="tip-title">${t.title}</h3>
      <p class="tip-body">${t.body}</p>
    </article>`).join('');
  grid.querySelectorAll('.tip-card').forEach(el => revealObserver.observe(el));
}

// ── Smooth CTA scrolls ────────────────────────────────────────────
document.getElementById('btn-get-started')?.addEventListener('click', () => {
  document.getElementById('tracker')?.scrollIntoView({ behavior: 'smooth' });
});
document.getElementById('hero-cta-primary')?.addEventListener('click', () => {
  document.getElementById('tracker')?.scrollIntoView({ behavior: 'smooth' });
});
document.getElementById('hero-cta-demo')?.addEventListener('click', () => {
  document.getElementById('dashboard')?.scrollIntoView({ behavior: 'smooth' });
});

// ── Init ──────────────────────────────────────────────────────────
renderExpenses();
renderAnalytics();
renderTips();
updateBudgetGauge();
updateSavingsRing();
updateIncomeDisplay();
updateNavOnScroll();

// Show persistence welcome back toast
if (LS.get('expenses', null)) {
  setTimeout(() => showToast('Your data was restored from last session 💾', 'info', 3500), 1000);
}
