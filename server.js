const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3020;
const JWT_SECRET = process.env.JWT_SECRET || 'lacucharadelsabor-secret-2024';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database
const db = new Database(path.join(__dirname, 'data', 'pos.db'));
db.pragma('foreign_keys = ON');

// ======================
// MIDDLEWARE
// ======================
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
};

// ======================
// AUTH
// ======================
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// ======================
// PRODUCTS
// ======================
app.get('/api/products', authenticate, (req, res) => {
  const products = db.prepare(`
    SELECT p.*, c.name as category_name, c.icon as category_icon
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.active = 1
    ORDER BY c.sort_order, p.name
  `).all();
  res.json(products);
});

app.get('/api/categories', authenticate, (req, res) => {
  const cats = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  res.json(cats);
});

app.post('/api/products', authenticate, adminOnly, (req, res) => {
  const { name, price, category_id, description } = req.body;
  const result = db.prepare('INSERT INTO products (name, price, category_id, description) VALUES (?, ?, ?, ?)').run(name, price, category_id, description || '');
  res.json({ id: result.lastInsertRowid, name, price, category_id, description });
});

app.put('/api/products/:id', authenticate, adminOnly, (req, res) => {
  const { name, price, category_id, description, active } = req.body;
  db.prepare('UPDATE products SET name=?, price=?, category_id=?, description=?, active=? WHERE id=?').run(name, price, category_id, description || '', active ?? 1, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/products/:id', authenticate, adminOnly, (req, res) => {
  db.prepare('UPDATE products SET active=0 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ======================
// SALES
// ======================
app.post('/api/sales', authenticate, (req, res) => {
  const { items, payment_method, cash_received, cash_amount, card_amount } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'No items' });

  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const change = payment_method === 'efectivo' && cash_received ? cash_received - total : 0;

  // Get current open closure
  const closure = db.prepare("SELECT * FROM cash_closures WHERE user_id=? AND status='open' ORDER BY opened_at DESC LIMIT 1").get(req.user.id);
  const isFirstSaleOfDay = !closure;

  const saleResult = db.prepare(`
    INSERT INTO sales (user_id, total, payment_method, cash_received, change_given, cash_amount, card_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, total, payment_method, cash_received || 0, change, cash_amount || (payment_method === 'efectivo' ? total : 0), card_amount || (payment_method === 'tarjeta' ? total : 0));

  const saleId = saleResult.lastInsertRowid;

  // Insert sale items
  const insertItem = db.prepare('INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)');
  items.forEach(item => {
    insertItem.run(saleId, item.id, item.name, item.quantity, item.price, item.price * item.quantity);
  });

  // Update cash closure if exists
  if (closure) {
    const newCash = closure.cash_sales + (cash_amount || (payment_method === 'efectivo' ? total : 0));
    const newCard = closure.card_sales + (card_amount || (payment_method === 'tarjeta' ? total : 0));
    db.prepare('UPDATE cash_closures SET cash_sales=?, card_sales=?, total_sales=? WHERE id=?').run(newCash, newCard, newCash + newCard, closure.id);
  }

  // Get sale with items for ticket
  const sale = db.prepare('SELECT * FROM sales WHERE id=?').get(saleId);
  const saleItems = db.prepare('SELECT * FROM sale_items WHERE sale_id=?').all(saleId);
  const config = db.prepare('SELECT * FROM config WHERE id=1').get();

  res.json({ ...sale, items: saleItems, config, ticket_number: saleId });
});

app.get('/api/sales', authenticate, (req, res) => {
  const { date, user_id } = req.query;
  let query = 'SELECT s.*, u.username FROM sales s LEFT JOIN users u ON s.user_id=u.id WHERE 1=1';
  const params = [];
  if (date) { query += ' AND DATE(s.created_at)=?'; params.push(date); }
  if (user_id) { query += ' AND s.user_id=?'; params.push(user_id); }
  query += ' ORDER BY s.created_at DESC LIMIT 100';
  res.json(db.prepare(query).all(...params));
});

// ======================
// CASH CLOSURES
// ======================
app.get('/api/closures', authenticate, (req, res) => {
  const closures = db.prepare(`
    SELECT cc.*, u.username
    FROM cash_closures cc
    LEFT JOIN users u ON cc.user_id=u.id
    ORDER BY cc.closed_at DESC LIMIT 50
  `).all();
  res.json(closures);
});

app.post('/api/closures/open', authenticate, (req, res) => {
  const { opening_balance } = req.body;
  // Close any open closures for this user
  db.prepare("UPDATE cash_closures SET status='closed', closed_at=CURRENT_TIMESTAMP WHERE user_id=? AND status='open'").run(req.user.id);
  // Open new
  const result = db.prepare('INSERT INTO cash_closures (user_id, opening_balance, opened_at, status) VALUES (?, ?, CURRENT_TIMESTAMP, ?)').run(req.user.id, opening_balance || 0, 'open');
  res.json({ id: result.lastInsertRowid });
});

app.post('/api/closures/:id/close', authenticate, (req, res) => {
  const closure = db.prepare('SELECT * FROM cash_closures WHERE id=? AND status=?').get(req.params.id, 'open');
  if (!closure) return res.status(404).json({ error: 'No open closure found' });

  db.prepare('UPDATE cash_closures SET closing_balance=?, status=?, closed_at=CURRENT_TIMESTAMP WHERE id=?').run(
    closure.opening_balance + closure.cash_sales + closure.card_sales,
    'closed',
    closure.id
  );
  const updated = db.prepare('SELECT * FROM cash_closures WHERE id=?').get(closure.id);
  res.json(updated);
});

app.get('/api/closures/current', authenticate, (req, res) => {
  const closure = db.prepare("SELECT * FROM cash_closures WHERE user_id=? AND status='open' ORDER BY opened_at DESC LIMIT 1").get(req.user.id);
  res.json(closure || null);
});

// ======================
// CONFIG
// ======================
app.get('/api/config', (req, res) => {
  const config = db.prepare('SELECT * FROM config WHERE id=1').get();
  res.json(config);
});

app.put('/api/config', authenticate, adminOnly, (req, res) => {
  const { store_name, address, phone, invoice_footer, system_time } = req.body;
  db.prepare(`
    UPDATE config SET store_name=?, address=?, phone=?, invoice_footer=?, system_time=?, updated_at=CURRENT_TIMESTAMP WHERE id=1
  `).run(store_name || '', address || '', phone || '', invoice_footer || '', system_time || '');
  const config = db.prepare('SELECT * FROM config WHERE id=1').get();
  res.json(config);
});

// ======================
// USERS (admin only)
// ======================
app.get('/api/users', authenticate, adminOnly, (req, res) => {
  res.json(db.prepare('SELECT id, username, role, created_at FROM users').all());
});

app.post('/api/users', authenticate, adminOnly, (req, res) => {
  const { username, password, role } = req.body;
  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, hash, role || 'cajero');
  res.json({ id: result.lastInsertRowid, username, role });
});

app.put('/api/users/:id', authenticate, adminOnly, (req, res) => {
  const { password, role } = req.body;
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password=? WHERE id=?').run(hash, req.params.id);
  }
  if (role) {
    db.prepare('UPDATE users SET role=? WHERE id=?').run(role, req.params.id);
  }
  res.json({ ok: true });
});

// ======================
// PRINTER (ESC/POS)
// ======================
app.post('/api/print/ticket', authenticate, (req, res) => {
  const { ticket_data } = req.body;
  // Returns ESC/POS commands for thermal printer
  // This endpoint returns the raw bytes - frontend sends to printer via USB/Bluetooth
  const esc = '\x1B';
  const commands = {
    init: esc + '@',
    alignCenter: esc + 'a\x01',
    alignLeft: esc + 'a\x00',
    boldOn: esc + 'E\x01',
    boldOff: esc + 'E\x00',
    doubleHeight: esc + '!\x10',
    normal: esc + '!\x00',
    cut: esc + 'd\x03',
    cashDrawer: esc + 'p\x00\x19\xFA',
  };

  let output = commands.init;
  output += commands.alignCenter;
  output += commands.boldOn + commands.doubleHeight + (ticket_data.store_name || 'LA CUCHARADA DEL SABOR') + '\n';
  output += commands.normal;
  output += (ticket_data.address || '') + '\n';
  output += (ticket_data.phone || '') + '\n';
  output += commands.alignLeft;
  output += '--------------------------------\n';
  output += `Ticket #: ${ticket_data.ticket_number}\n`;
  output += `Fecha: ${ticket_data.date}\n`;
  output += `Cajero: ${ticket_data.cashier}\n`;
  output += '--------------------------------\n';
  output += 'CANT  DESCRIPCION        IMPORTE\n';
  output += '--------------------------------\n';

  ticket_data.items.forEach(item => {
    const line = `${item.quantity}x ${item.name.substring(0, 18)}`.padEnd(20) + `₡${item.subtotal.toLocaleString('es-CR')}`;
    output += line.substring(0, 32) + '\n';
  });

  output += '--------------------------------\n';
  output += `${'TOTAL:'.padEnd(20)} ₡${ticket_data.total.toLocaleString('es-CR')}\n`;
  if (ticket_data.payment_method === 'efectivo' && ticket_data.cash_received) {
    output += `${'EFECTIVO:'.padEnd(20)} ₡${ticket_data.cash_received.toLocaleString('es-CR')}\n`;
    output += `${'CAMBIO:'.padEnd(20)} ₡${ticket_data.change.toLocaleString('es-CR')}\n`;
  } else if (ticket_data.payment_method === 'tarjeta') {
    output += 'TARJETA\n';
  } else if (ticket_data.payment_method === 'mixto') {
    output += `${'EFECTIVO:'.padEnd(20)} ₡${ticket_data.cash_amount.toLocaleString('es-CR')}\n`;
    output += `${'TARJETA:'.padEnd(20)} ₡${ticket_data.card_amount.toLocaleString('es-CR')}\n`;
  }
  output += '--------------------------------\n';
  output += commands.alignCenter;
  output += (ticket_data.footer || '¡Gracias por su visita!') + '\n';
  output += '\n\n\n' + commands.cut;

  res.json({ commands, text: output });
});

// ======================
// INIT DB IF NEEDED
// ======================
const { execSync } = require('child_process');
try {
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (count === 0) {
    console.log('Initializing database...');
    execSync('node data/init.js', { cwd: __dirname });
  }
} catch (e) {
  console.log('Running init...');
  try { execSync('node data/init.js', { cwd: __dirname }); } catch (e2) { /* ignore */ }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🍴 La Cucharada del Sabor POS en puerto ${PORT}`);
});