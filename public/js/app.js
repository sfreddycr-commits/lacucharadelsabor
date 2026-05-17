// ======================
// STATE
// ======================
let token = localStorage.getItem('pos_token');
let currentUser = null;
let categories = [];
let products = [];
let order = [];
let currentClosure = null;
let storeConfig = { store_name: 'La Cucharada del Sabor', address: '', phone: '', invoice_footer: '¡Gracias por su visita!' };
let paymentMethod = 'efectivo';
let searchQuery = '';
let activeCategory = null;

// ======================
// API HELPERS
// ======================
const API = (method, endpoint, data = null) => {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  };
  if (data) opts.body = JSON.stringify(data);
  return fetch(`/api${endpoint}`, opts).then(r => r.json());
};

// ======================
// UTILITIES
// ======================
const formatCRC = n => `₡${Number(n).toLocaleString('es-CR', { minimumFractionDigits: 0 })}`;
const toast = (msg, type = '') => {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
};
const hideModal = () => document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show'));

// ======================
// INIT
// ======================
document.addEventListener('DOMContentLoaded', () => {
  if (token) {
    API('GET', '/auth/me').then(u => {
      if (u.id) {
        currentUser = u;
        loadApp();
      } else {
        showLogin();
      }
    });
  } else {
    showLogin();
  }
});

function showLogin() {
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('mainApp').style.display = 'none';
}

function loadApp() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('mainApp').style.display = 'flex';
  document.getElementById('userDisplay').textContent = currentUser.username;
  Promise.all([
    API('GET', '/categories'),
    API('GET', '/products'),
    API('GET', '/config'),
    API('GET', '/closures/current'),
  ]).then(([cats, prods, cfg, closure]) => {
    categories = cats;
    products = prods;
    storeConfig = cfg;
    currentClosure = closure;
    renderCategories();
    renderProducts();
    updateClosureUI();
    document.getElementById('storeName').textContent = storeConfig.store_name;
  });
  showPage('pos');
}

// ======================
// AUTH
// ======================
document.getElementById('loginForm').addEventListener('submit', e => {
  e.preventDefault();
  const u = document.getElementById('username').value;
  const p = document.getElementById('password').value;
  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: p }),
  }).then(r => r.json()).then(data => {
    if (data.token) {
      token = data.token;
      localStorage.setItem('pos_token', token);
      currentUser = data.user;
      loadApp();
    } else {
      toast(data.error || 'Error', 'error');
    }
  });
});

function logout() {
  token = null;
  localStorage.removeItem('pos_token');
  location.reload();
}

// ======================
// NAVIGATION
// ======================
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
  const activeLink = document.querySelector(`.sidebar-nav a[onclick*="${page}"]`);
  if (activeLink) activeLink.classList.add('active');

  if (page === 'pos') renderProducts();
  if (page === 'closures') loadClosures();
  if (page === 'users' && currentUser.role === 'admin') loadUsers();
  if (page === 'sales') loadSales();
}

// ======================
// PRODUCTS & POS
// ======================
function renderCategories() {
  const bar = document.getElementById('categoriesBar');
  bar.innerHTML = `<button class="cat-btn active" onclick="filterByCategory(null)">Todos</button>`;
  categories.forEach(c => {
    bar.innerHTML += `<button class="cat-btn" onclick="filterByCategory(${c.id})">${c.icon} ${c.name}</button>`;
  });
}

function filterByCategory(catId) {
  activeCategory = catId;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  renderProducts();
}

function renderProducts() {
  const grid = document.getElementById('productsGrid');
  const q = searchQuery.toLowerCase();
  let filtered = products.filter(p => {
    const matchCat = !activeCategory || p.category_id === activeCategory;
    const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
    return p.active && matchCat && matchSearch;
  });

  grid.innerHTML = filtered.map(p => `
    <div class="product-card" onclick="addToOrder(${p.id})">
      <div class="emoji">${p.category_icon || '🍽️'}</div>
      <div class="name">${p.name}</div>
      <div class="price">${formatCRC(p.price)}</div>
    </div>
  `).join('');
}

function searchProducts(q) {
  searchQuery = q;
  renderProducts();
}

function addToOrder(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  const existing = order.find(o => o.id === productId);
  if (existing) {
    existing.quantity++;
  } else {
    order.push({ ...product, quantity: 1 });
  }
  renderOrder();
  toast(`${product.name} agregado`);
}

function changeQty(index, delta) {
  order[index].quantity += delta;
  if (order[index].quantity <= 0) order.splice(index, 1);
  renderOrder();
}

function removeItem(index) {
  order.splice(index, 1);
  renderOrder();
}

function renderOrder() {
  const itemsEl = document.getElementById('orderItems');
  const totalEl = document.getElementById('orderTotal');
  const emptyEl = document.getElementById('orderEmpty');

  if (order.length === 0) {
    itemsEl.innerHTML = '';
    emptyEl.style.display = 'flex';
  } else {
    emptyEl.style.display = 'none';
    itemsEl.innerHTML = order.map((item, i) => `
      <div class="order-item">
        <div class="order-item-info">
          <div class="order-item-name">${item.name}</div>
          <div class="order-item-price">${formatCRC(item.price)} c/u</div>
        </div>
        <div class="order-item-qty">
          <button class="qty-btn" onclick="changeQty(${i}, -1)">-</button>
          <span>${item.quantity}</span>
          <button class="qty-btn" onclick="changeQty(${i}, 1)">+</button>
        </div>
        <div class="order-item-subtotal">${formatCRC(item.price * item.quantity)}</div>
      </div>
    `).join('');
  }

  const total = order.reduce((sum, item) => sum + item.price * item.quantity, 0);
  totalEl.textContent = formatCRC(total);
}

function setPaymentMethod(method) {
  paymentMethod = method;
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
  event.target.closest('.pay-btn').classList.add('active');
  document.getElementById('cashInput').style.display = method === 'efectivo' ? 'block' : 'none';
  document.getElementById('splitInputs').style.display = method === 'mixto' ? 'flex' : 'none';
  if (method === 'efectivo') {
    document.getElementById('cashReceived').value = '';
  }
}

async function processSale() {
  if (order.length === 0) { toast('Agrega productos primero', 'error'); return; }

  const total = order.reduce((sum, item) => sum + item.price * item.quantity, 0);
  let cashReceived = 0, cashAmount = 0, cardAmount = 0;

  if (paymentMethod === 'efectivo') {
    cashReceived = parseFloat(document.getElementById('cashReceived').value) || 0;
    if (cashReceived < total) { toast('Efectivo insuficiente', 'error'); return; }
    cashAmount = total;
  } else if (paymentMethod === 'tarjeta') {
    cardAmount = total;
  } else if (paymentMethod === 'mixto') {
    cashAmount = parseFloat(document.getElementById('cashPart').value) || 0;
    cardAmount = parseFloat(document.getElementById('cardPart').value) || 0;
    if (cashAmount + cardAmount < total) { toast('La suma de pago no cubre el total', 'error'); return; }
    cashReceived = cashAmount;
  }

  const saleData = {
    items: order.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
    payment_method: paymentMethod,
    cash_received: cashReceived,
    cash_amount: cashAmount,
    card_amount: cardAmount,
  };

  const result = await API('POST', '/sales', saleData);
  if (result.id) {
    toast('Venta procesada');
    // Print ticket
    const ticketData = {
      store_name: storeConfig.store_name,
      address: storeConfig.address,
      phone: storeConfig.phone,
      footer: storeConfig.invoice_footer,
      ticket_number: result.id,
      date: new Date().toLocaleString('es-CR'),
      cashier: currentUser.username,
      items: result.items,
      total: result.total,
      payment_method: paymentMethod,
      cash_received: cashReceived,
      change: result.change_given,
      cash_amount: cashAmount,
      card_amount: cardAmount,
    };
    printTicket(ticketData);
    order = [];
    renderOrder();
    // Update closure
    API('GET', '/closures/current').then(c => { currentClosure = c; updateClosureUI(); });
  } else {
    toast(result.error || 'Error al procesar', 'error');
  }
}

// ======================
// PRINT TICKET
// ======================
async function printTicket(data) {
  // Try ESC/POS via browser print dialog
  const printWindow = window.open('', '_blank', 'width=300,height=600');
  printWindow.document.write(`
    <html><head><title>Ticket</title>
    <style>
      body { font-family: 'Courier New', monospace; font-size: 12px; width: 280px; margin: 0 auto; padding: 8px; }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .divider { border-top: 1px dashed #000; margin: 4px 0; }
      .row { display: flex; justify-content: space-between; }
      .right { text-align: right; }
      @media print { body { border: none; } }
    </style></head><body>
    <div class="center bold" style="font-size:14px">${data.store_name}</div>
    <div class="center">${data.address || ''}</div>
    <div class="center">${data.phone || ''}</div>
    <div class="divider"></div>
    <div>Ticket #: ${data.ticket_number}</div>
    <div>Fecha: ${data.date}</div>
    <div>Cajero: ${data.cashier}</div>
    <div class="divider"></div>
    <div class="bold">CANT  DESCRIPCION        IMPORTE</div>
    <div class="divider"></div>
    ${data.items.map(i => `
      <div>${i.quantity}x ${i.product_name.substring(0,18).padEnd(18)} ${formatCRC(i.subtotal)}</div>
    `).join('')}
    <div class="divider"></div>
    <div class="row bold"><span>TOTAL:</span><span>${formatCRC(data.total)}</span></div>
    ${data.payment_method === 'efectivo' ? `
      <div class="row"><span>EFECTIVO:</span><span>${formatCRC(data.cash_received)}</span></div>
      <div class="row"><span>CAMBIO:</span><span>${formatCRC(data.change)}</span></div>
    ` : ''}
    ${data.payment_method === 'tarjeta' ? '<div>TARJETA</div>' : ''}
    ${data.payment_method === 'mixto' ? `
      <div class="row"><span>EFECTIVO:</span><span>${formatCRC(data.cash_amount)}</span></div>
      <div class="row"><span>TARJETA:</span><span>${formatCRC(data.card_amount)}</span></div>
    ` : ''}
    <div class="divider"></div>
    <div class="center">${data.footer || '¡Gracias por su visita!'}</div>
    </body></html>
  `);
  printWindow.document.close();
  printWindow.print();
  printWindow.close();
}

// ======================
// CASH CLOSURES
// ======================
function updateClosureUI() {
  const el = document.getElementById('closureStatus');
  if (currentClosure) {
    el.innerHTML = `<span class="badge badge-success">Caja Abierta</span>
      <span style="font-size:0.8rem;color:#757575;margin-left:0.5rem">
        Efectivo: ${formatCRC(currentClosure.cash_sales || 0)} | Tarjeta: ${formatCRC(currentClosure.card_sales || 0)}
      </span>`;
  } else {
    el.innerHTML = `<span class="badge badge-warning">Caja Cerrada</span>`;
  }
}

async function openClosure() {
  const balance = parseFloat(prompt('Monto de apertura de caja:') || '0');
  const result = await API('POST', '/closures/open', { opening_balance: balance });
  if (result.id) {
    currentClosure = result;
    updateClosureUI();
    toast('Caja abierta');
  }
}

async function closeClosure() {
  if (!currentClosure) { toast('No hay caja abierta', 'error'); return; }
  if (!confirm('¿Cerrar caja?')) return;
  const result = await API('POST', `/closures/${currentClosure.id}/close`);
  if (result.id) {
    toast(`Caja cerrada. Total: ${formatCRC(result.closing_balance)}`);
    currentClosure = null;
    updateClosureUI();
    loadClosures();
  }
}

function loadClosures() {
  API('GET', '/closures').then(closures => {
    const tbody = document.getElementById('closuresBody');
    tbody.innerHTML = closures.map(c => `
      <tr>
        <td>${c.id}</td>
        <td>${c.username}</td>
        <td>${c.opened_at ? new Date(c.opened_at).toLocaleString('es-CR') : '-'}</td>
        <td>${formatCRC(c.opening_balance)}</td>
        <td>${formatCRC(c.cash_sales)}</td>
        <td>${formatCRC(c.card_sales)}</td>
        <td><strong>${formatCRC(c.closing_balance || c.total_sales)}</strong></td>
        <td><span class="badge ${c.status === 'open' ? 'badge-warning' : 'badge-success'}">${c.status === 'open' ? 'Abierta' : 'Cerrada'}</span></td>
      </tr>
    `).join('');
  });
}

// ======================
// SALES HISTORY
// ======================
function loadSales() {
  API('GET', '/sales').then(sales => {
    const tbody = document.getElementById('salesBody');
    tbody.innerHTML = sales.map(s => `
      <tr>
        <td>${s.id}</td>
        <td>${s.username}</td>
        <td>${new Date(s.created_at).toLocaleString('es-CR')}</td>
        <td>${formatCRC(s.total)}</td>
        <td>${s.payment_method === 'efectivo' ? '💵 Efectivo' : s.payment_method === 'tarjeta' ? '💳 Tarjeta' : '🔀 Mixto'}</td>
        <td>${s.change_given > 0 ? formatCRC(s.change_given) : '-'}</td>
      </tr>
    `).join('');
  });
}

// ======================
// ADMIN: PRODUCTS CRUD
// ======================
function showProductModal(product = null) {
  const modal = document.getElementById('productModal');
  modal.classList.add('show');
  document.getElementById('productForm').reset();
  document.getElementById('productId').value = product?.id || '';
  document.getElementById('productName').value = product?.name || '';
  document.getElementById('productPrice').value = product?.price || '';
  document.getElementById('productDesc').value = product?.description || '';
  document.getElementById('productCategory').value = product?.category_id || categories[0]?.id || 1;
}

async function saveProduct() {
  const id = document.getElementById('productId').value;
  const data = {
    name: document.getElementById('productName').value,
    price: parseFloat(document.getElementById('productPrice').value),
    category_id: parseInt(document.getElementById('productCategory').value),
    description: document.getElementById('productDesc').value,
  };
  if (!data.name || !data.price) { toast('Nombre y precio requeridos', 'error'); return; }
  let result;
  if (id) {
    result = await API('PUT', `/products/${id}`, data);
  } else {
    result = await API('POST', '/products', data);
  }
  if (result.id || result.ok) {
    toast(id ? 'Producto actualizado' : 'Producto agregado');
    hideModal();
    products = await API('GET', '/products');
    renderProducts();
  }
}

async function deleteProduct(id) {
  if (!confirm('¿Desactivar este producto?')) return;
  await API('DELETE', `/products/${id}`);
  toast('Producto desactivado');
  products = await API('GET', '/products');
  renderProducts();
  loadProductsTable();
}

function loadProductsTable() {
  const tbody = document.getElementById('productsBody');
  tbody.innerHTML = products.map(p => `
    <tr>
      <td>${p.id}</td>
      <td>${p.category_icon} ${p.name}</td>
      <td>${p.category_name}</td>
      <td><strong>${formatCRC(p.price)}</strong></td>
      <td>${p.description || '-'}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="showProductModal(products.find(x=>x.id===${p.id}))">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})">X</button>
      </td>
    </tr>
  `).join('');
}

// ======================
// ADMIN: USERS
// ======================
function loadUsers() {
  API('GET', '/users').then(users => {
    const tbody = document.getElementById('usersBody');
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${u.id}</td>
        <td>${u.username}</td>
        <td>${u.role === 'admin' ? 'Administrador' : 'Cajero'}</td>
        <td>${new Date(u.created_at).toLocaleDateString('es-CR')}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="showUserModal(${u.id})">Editar</button>
        </td>
      </tr>
    `).join('');
  });
}

function showUserModal(userId = null) {
  const modal = document.getElementById('userModal');
  modal.classList.add('show');
  document.getElementById('userForm').reset();
  document.getElementById('editUserId').value = userId || '';
  if (userId) {
    // prefill role only
  }
}

async function saveUser() {
  const id = document.getElementById('editUserId').value;
  const username = document.getElementById('newUsername').value;
  const password = document.getElementById('newPassword').value;
  const role = document.getElementById('newUserRole').value;
  if (!username) { toast('Usuario requerido', 'error'); return; }
  const data = { role };
  if (password) data.password = password;
  let result;
  if (id) {
    result = await API('PUT', `/users/${id}`, data);
  } else {
    result = await API('POST', '/users', { username, password, role });
  }
  if (result.id || result.ok) {
    toast(id ? 'Usuario actualizado' : 'Usuario creado');
    hideModal();
    loadUsers();
  }
}

// ======================
// ADMIN: CONFIG
// ======================
function showConfigModal() {
  const modal = document.getElementById('configModal');
  modal.classList.add('show');
  document.getElementById('cfgStoreName').value = storeConfig.store_name || '';
  document.getElementById('cfgAddress').value = storeConfig.address || '';
  document.getElementById('cfgPhone').value = storeConfig.phone || '';
  document.getElementById('cfgFooter').value = storeConfig.invoice_footer || '';
}

async function saveConfig() {
  const data = {
    store_name: document.getElementById('cfgStoreName').value,
    address: document.getElementById('cfgAddress').value,
    phone: document.getElementById('cfgPhone').value,
    invoice_footer: document.getElementById('cfgFooter').value,
  };
  const result = await API('PUT', '/config', data);
  if (result.store_name) {
    storeConfig = result;
    document.getElementById('storeName').textContent = storeConfig.store_name;
    toast('Configuración guardada');
    hideModal();
  }
}