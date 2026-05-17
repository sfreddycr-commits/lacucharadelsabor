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
let isDesktop = window.innerWidth >= 900;

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
  window.addEventListener('resize', () => {
    isDesktop = window.innerWidth >= 900;
    updateLayout();
  });

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

function updateLayout() {
  const panel = document.getElementById('orderPanel');
  const overlay = document.getElementById('orderDetailOverlay');
  if (isDesktop) {
    if (panel) panel.style.display = '';
    if (overlay) overlay.classList.remove('show');
  } else {
    if (panel) panel.style.display = order.length > 0 ? 'flex' : 'none';
  }
}

function showLogin() {
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('orderPanel').style.display = 'none';
}

function loadApp() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('mainApp').style.display = '';
  document.getElementById('userDisplay').textContent = currentUser.username;
  document.getElementById('mobileUser').textContent = currentUser.username;

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
    updateLayout();
    document.getElementById('storeName').textContent = storeConfig.store_name;
    document.getElementById('mobileStoreName').textContent = storeConfig.store_name;

    if (currentUser.role === 'admin') {
      document.getElementById('navAdmin').style.display = 'flex';
    }
  });

  showPage('pos');
}

// ======================
// SIDEBAR (mobile)
// ======================
function toggleSidebar(force) {
  const sidebar = document.getElementById('sidebar');
  const isOpen = sidebar.classList.contains('open');
  if (force === false) {
    sidebar.classList.remove('open');
  } else {
    sidebar.classList.toggle('open', !isOpen);
  }
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
      toast(data.error || 'Usuario o contraseña incorrectos', 'error');
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

  if (page === 'closures') loadClosures();
  if (page === 'sales') loadSales();
  if (page === 'admin') { loadProductsTable(); loadUsers(); }
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
  if (event.target) event.target.classList.add('active');
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

  if (filtered.length === 0) {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#9e9e9e;padding:2rem">No hay productos</p>';
    return;
  }

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

function clearOrder() {
  order = [];
  renderOrder();
}

// ======================
// ORDER RENDERING
// ======================
function renderOrder() {
  const total = order.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = order.reduce((sum, item) => sum + item.quantity, 0);

  // Bottom bar (mobile)
  document.getElementById('orderTotalBar').textContent = formatCRC(total);
  document.getElementById('orderItemCount').textContent = `${itemCount} item${itemCount !== 1 ? 's' : ''}`;

  // Detail panel
  document.getElementById('orderDetailTotal').textContent = formatCRC(total);

  // Order items in detail
  document.getElementById('orderDetailItems').innerHTML = order.length === 0
    ? '<p style="color:#9e9e9e;text-align:center;padding:1rem">Sin productos agregados</p>'
    : order.map((item, i) => `
      <div class="order-item">
        <div class="order-item-info">
          <div class="order-item-name">${item.name}</div>
          <div class="order-item-price">${formatCRC(item.price)} c/u</div>
        </div>
        <div class="order-item-qty">
          <button class="qty-btn" onclick="changeQty(${i}, -1)">−</button>
          <span>${item.quantity}</span>
          <button class="qty-btn" onclick="changeQty(${i}, 1)">+</button>
        </div>
        <div class="order-item-subtotal">${formatCRC(item.price * item.quantity)}</div>
      </div>
    `).join('');

  // Change display for efectivo
  updateChangeDisplay();

  // Mobile panel visibility
  updateLayout();
}

function updateChangeDisplay() {
  const total = order.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const changeEl = document.getElementById('changeDisplay');
  if (paymentMethod === 'efectivo') {
    const received = parseFloat(document.getElementById('cashReceivedDetail')?.value) || 0;
    if (received > 0 && received >= total) {
      changeEl.textContent = `Cambio: ${formatCRC(received - total)}`;
    } else {
      changeEl.textContent = '';
    }
  } else {
    if (changeEl) changeEl.textContent = '';
  }
}

// Listen for cash input changes
document.addEventListener('input', e => {
  if (e.target.id === 'cashReceivedDetail') updateChangeDisplay();
});

// ======================
// ORDER DETAIL (mobile bottom sheet)
// ======================
function openOrderDetail() {
  if (order.length === 0) { toast('Agrega productos primero', 'error'); return; }
  document.getElementById('orderDetailOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeOrderDetail(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('orderDetailOverlay').classList.remove('show');
  document.body.style.overflow = '';
}

// ======================
// PAYMENT
// ======================
function setPaymentMethod(method) {
  paymentMethod = method;
  document.querySelectorAll('.pay-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.method === method);
  });
  document.getElementById('cashInputDetail').style.display = method === 'efectivo' ? 'block' : 'none';
  document.getElementById('splitInputsDetail').style.display = method === 'mixto' ? 'flex' : 'none';
  updateChangeDisplay();
}

// ======================
// PROCESS SALE
// ======================
async function processSale() {
  if (order.length === 0) { toast('Agrega productos primero', 'error'); return; }

  const total = order.reduce((sum, item) => sum + item.price * item.quantity, 0);
  let cashReceived = 0, cashAmount = 0, cardAmount = 0;

  if (paymentMethod === 'efectivo') {
    cashReceived = parseFloat(document.getElementById('cashReceivedDetail')?.value) || 0;
    if (cashReceived < total) { toast('Dinero insuficiente', 'error'); return; }
    cashAmount = total;
  } else if (paymentMethod === 'tarjeta') {
    cardAmount = total;
  } else if (paymentMethod === 'mixto') {
    cashAmount = parseFloat(document.getElementById('cashPartDetail')?.value) || 0;
    cardAmount = parseFloat(document.getElementById('cardPartDetail')?.value) || 0;
    if (cashAmount + cardAmount < total) { toast('La suma no cubre el total', 'error'); return; }
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
    toast('Venta procesada', 'success');
    printTicket(result);
    order = [];
    renderOrder();
    closeOrderDetail();
    document.getElementById('cashReceivedDetail').value = '';
    API('GET', '/closures/current').then(c => { currentClosure = c; updateClosureUI(); });
  } else {
    toast(result.error || 'Error al procesar', 'error');
  }
}

// ======================
// PRINT
// ======================
function printTicket(sale) {
  const total = order.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cashAmount = paymentMethod === 'efectivo' ? total : (parseFloat(document.getElementById('cashPartDetail')?.value) || 0);
  const cardAmount = paymentMethod === 'tarjeta' ? total : (parseFloat(document.getElementById('cardPartDetail')?.value) || 0);
  const cashReceived = paymentMethod === 'efectivo' ? (parseFloat(document.getElementById('cashReceivedDetail')?.value) || 0) : cashAmount;

  const lines = [];
  lines.push('================================');
  lines.push(`  ${storeConfig.store_name.toUpperCase()}`);
  if (storeConfig.address) lines.push(`  ${storeConfig.address}`);
  if (storeConfig.phone) lines.push(`  Tel: ${storeConfig.phone}`);
  lines.push('================================');
  lines.push(`Ticket #${sale.id}`);
  lines.push(new Date().toLocaleString('es-CR'));
  lines.push(`Cajero: ${currentUser.username}`);
  lines.push('--------------------------------');
  lines.push('CANT  DESCRIPCION        IMPORTE');
  lines.push('--------------------------------');
  order.forEach(item => {
    const name = item.name.length > 18 ? item.name.substring(0, 18) : item.name;
    const qty = `x${item.quantity}`;
    const price = formatCRC(item.price * item.quantity);
    lines.push(`${qty.padEnd(4)}${name.padEnd(20)}${price}`);
  });
  lines.push('--------------------------------');
  lines.push(`${'TOTAL:'.padEnd(22)}${formatCRC(total)}`);
  if (paymentMethod === 'efectivo' && cashReceived > 0) {
    lines.push(`${'RECIBIDO:'.padEnd(22)}${formatCRC(cashReceived)}`);
    lines.push(`${'CAMBIO:'.padEnd(22)}${formatCRC(cashReceived - total)}`);
  } else if (paymentMethod === 'tarjeta') {
    lines.push(`${'TARJETA:'.padEnd(22)}${formatCRC(cardAmount)}`);
  } else if (paymentMethod === 'mixto') {
    lines.push(`${'EFECTIVO:'.padEnd(22)}${formatCRC(cashAmount)}`);
    lines.push(`${'TARJETA:'.padEnd(22)}${formatCRC(cardAmount)}`);
  }
  lines.push('--------------------------------');
  lines.push(`  ${storeConfig.invoice_footer}`);
  lines.push('================================');

  document.getElementById('printPreview').textContent = lines.join('\n');
  document.getElementById('printModal').classList.add('show');
}

// ======================
// CASH CLOSURES
// ======================
function updateClosureUI() {
  const status = currentClosure && currentClosure.status === 'open';
  const statusEl = document.getElementById('closureStatusMobile');
  if (statusEl) {
    statusEl.className = status ? 'badge badge-success' : 'badge badge-warning';
    statusEl.textContent = status ? 'Caja Abierta' : 'Caja Cerrada';
  }
}

async function loadClosures() {
  const closures = await API('GET', '/closures');
  const tbody = document.getElementById('closuresBody');
  if (!closures.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#9e9e9e">Sin cierres</td></tr>';
    return;
  }
  tbody.innerHTML = closures.map(c => `
    <tr>
      <td>${c.id}</td>
      <td>${c.username}</td>
      <td>${new Date(c.opened_at).toLocaleString('es-CR')}</td>
      <td>${formatCRC(c.cash_sales)}</td>
      <td>${formatCRC(c.card_sales)}</td>
      <td><strong>${formatCRC(c.total_sales)}</strong></td>
      <td><span class="badge ${c.status === 'open' ? 'badge-success' : 'badge-warning'}">${c.status === 'open' ? 'Abierta' : 'Cerrada'}</span></td>
    </tr>
  `).join('');

  // Show open closure card
  const openCard = document.getElementById('openClosureCard');
  const openInfo = document.getElementById('openClosureInfo');
  if (currentClosure && currentClosure.status === 'open') {
    openCard.style.display = 'block';
    openInfo.textContent = `Abierta por ${currentClosure.username} a las ${new Date(currentClosure.opened_at).toLocaleTimeString('es-CR')}`;
  } else {
    openCard.style.display = 'none';
  }
}

async function openClosure() {
  const result = await API('POST', '/closures/open');
  if (result.id) {
    currentClosure = result;
    updateClosureUI();
    toast('Caja abierta', 'success');
    loadClosures();
  } else {
    toast(result.error || 'Error al abrir caja', 'error');
  }
}

async function confirmOpenClosure() {
  const balance = parseFloat(document.getElementById('openingBalance')?.value) || 0;
  const result = await API('POST', '/closures/open', { opening_balance: balance });
  if (result.id) {
    currentClosure = result;
    updateClosureUI();
    toast('Caja abierta', 'success');
    loadClosures();
    document.getElementById('openingBalance').value = '';
    document.getElementById('openClosureCard').style.display = 'none';
  }
}

async function closeClosure() {
  if (order.length > 0) { toast('Cierra la orden primero', 'error'); return; }
  if (currentClosure && currentClosure.status === 'open') {
    const result = await API('POST', `/closures/${currentClosure.id}/close`);
    if (result.id) {
      currentClosure = null;
      updateClosureUI();
      toast('Caja cerrada', 'success');
      loadClosures();
    } else {
      toast(result.error || 'Error al cerrar caja', 'error');
    }
  } else {
    toast('La caja ya está cerrada', 'error');
  }
}

// ======================
// SALES HISTORY
// ======================
async function loadSales() {
  const sales = await API('GET', '/sales');
  const tbody = document.getElementById('salesBody');
  if (!sales.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#9e9e9e">Sin ventas</td></tr>';
    return;
  }
  tbody.innerHTML = sales.map(s => `
    <tr>
      <td>${s.id}</td>
      <td>${s.username}</td>
      <td>${new Date(s.created_at).toLocaleTimeString('es-CR')}</td>
      <td><strong>${formatCRC(s.total)}</strong></td>
      <td>${s.payment_method === 'efectivo' ? '💵' : s.payment_method === 'tarjeta' ? '💳' : '🔀'}</td>
    </tr>
  `).join('');
}

// ======================
// ADMIN - PRODUCTS
// ======================
function showAdminTab(tab) {
  document.getElementById('adminProducts').style.display = tab === 'products' ? 'block' : 'none';
  document.getElementById('adminUsers').style.display = tab === 'users' ? 'block' : 'none';
  document.getElementById('tabProducts').className = tab === 'products' ? 'btn btn-primary' : 'btn btn-outline';
  document.getElementById('tabUsers').className = tab === 'users' ? 'btn btn-primary' : 'btn btn-outline';
  if (tab === 'products') loadProductsTable();
  if (tab === 'users') loadUsers();
}

function loadProductsTable() {
  const tbody = document.getElementById('productsBody');
  tbody.innerHTML = products.filter(p => p.active).map(p => `
    <tr>
      <td>${p.category_icon} ${p.name}</td>
      <td><strong>${formatCRC(p.price)}</strong></td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="showProductModal(products.find(x=>x.id===${p.id}))">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id})">X</button>
      </td>
    </tr>
  `).join('');
}

function searchProductsAdmin(q) {
  const qlow = q.toLowerCase();
  const filtered = products.filter(p => (p.name.toLowerCase().includes(qlow) || (p.description||'').toLowerCase().includes(qlow)) && p.active);
  const tbody = document.getElementById('productsBody');
  tbody.innerHTML = filtered.map(p => `
    <tr>
      <td>${p.category_icon} ${p.name}</td>
      <td><strong>${formatCRC(p.price)}</strong></td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="showProductModal(products.find(x=>x.id===${p.id}))">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id})">X</button>
      </td>
    </tr>
  `).join('');
}

function showProductModal(product = null) {
  document.getElementById('productId').value = product ? product.id : '';
  document.getElementById('productName').value = product ? product.name : '';
  document.getElementById('productPrice').value = product ? product.price : '';
  document.getElementById('productDesc').value = product ? (product.description || '') : '';
  document.getElementById('productModalTitle').textContent = product ? 'Editar Producto' : 'Agregar Producto';

  const sel = document.getElementById('productCategory');
  sel.innerHTML = categories.map(c => `<option value="${c.id}" ${product && product.category_id === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('');

  document.getElementById('productModal').classList.add('show');
}

async function saveProduct() {
  const id = document.getElementById('productId').value;
  const data = {
    name: document.getElementById('productName').value,
    price: parseFloat(document.getElementById('productPrice').value),
    category_id: parseInt(document.getElementById('productCategory').value),
    description: document.getElementById('productDesc').value,
  };

  let result;
  if (id) {
    result = await API('PUT', `/products/${id}`, data);
  } else {
    result = await API('POST', '/products', data);
  }

  if (result.id) {
    toast('Producto guardado', 'success');
    hideModal();
    const prods = await API('GET', '/products');
    products = prods;
    renderProducts();
    loadProductsTable();
  } else {
    toast(result.error || 'Error', 'error');
  }
}

async function deleteProduct(id) {
  if (!confirm('Eliminar este producto?')) return;
  const result = await API('DELETE', `/products/${id}`);
  if (result.ok) {
    toast('Producto eliminado', 'success');
    products = products.filter(p => p.id !== id);
    renderProducts();
    loadProductsTable();
  } else {
    toast(result.error || 'Error', 'error');
  }
}

// ======================
// ADMIN - USERS
// ======================
function loadUsers() {
  API('GET', '/users').then(users => {
    const tbody = document.getElementById('usersBody');
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${u.username}</td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-success' : 'badge-warning'}">${u.role}</span></td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="showUserModal(${u.id})">Editar</button>
        </td>
      </tr>
    `).join('');
  });
}

function showUserModal(userId = null) {
  document.getElementById('editUserId').value = userId || '';
  document.getElementById('newUsername').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('newUserRole').value = 'cajero';
  document.getElementById('userModal').classList.add('show');
}

async function saveUser() {
  const id = document.getElementById('editUserId').value;
  const data = {
    username: document.getElementById('newUsername').value,
    password: document.getElementById('newPassword').value,
    role: document.getElementById('newUserRole').value,
  };
  if (!data.username) { toast('Usuario requerido', 'error'); return; }
  if (!id && data.password.length < 4) { toast('Contraseña mínimo 4 caracteres', 'error'); return; }

  let result;
  if (id) {
    result = await API('PUT', `/users/${id}`, data);
  } else {
    result = await API('POST', '/users', data);
  }

  if (result.id || result.ok) {
    toast('Usuario guardado', 'success');
    hideModal();
    loadUsers();
  } else {
    toast(result.error || 'Error', 'error');
  }
}

// ======================
// CONFIG
// ======================
function showConfigModal() {
  document.getElementById('cfgStoreName').value = storeConfig.store_name;
  document.getElementById('cfgAddress').value = storeConfig.address || '';
  document.getElementById('cfgPhone').value = storeConfig.phone || '';
  document.getElementById('cfgFooter').value = storeConfig.invoice_footer || '';
  document.getElementById('configModal').classList.add('show');
}

async function saveConfig() {
  const data = {
    store_name: document.getElementById('cfgStoreName').value,
    address: document.getElementById('cfgAddress').value,
    phone: document.getElementById('cfgPhone').value,
    invoice_footer: document.getElementById('cfgFooter').value,
  };
  const result = await API('PUT', '/config', data);
  if (result.id) {
    storeConfig = result;
    document.getElementById('storeName').textContent = result.store_name;
    document.getElementById('mobileStoreName').textContent = result.store_name;
    toast('Configuración guardada', 'success');
    hideModal();
  } else {
    toast(result.error || 'Error', 'error');
  }
}