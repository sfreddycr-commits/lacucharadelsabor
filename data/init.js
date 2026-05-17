const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, 'data', 'pos.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// ======================
// SCHEMA CREATION
// ======================

// Users table
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'cajero',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

// Categories table
db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '🍽️',
  sort_order INTEGER DEFAULT 0
)
`);

// Products table
db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  description TEXT,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
)
`);

// Sales table
db.exec(`
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  total REAL NOT NULL,
  payment_method TEXT,
  cash_received REAL DEFAULT 0,
  change_given REAL DEFAULT 0,
  card_amount REAL DEFAULT 0,
  cash_amount REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
)
`);

// Sale items table
db.exec(`
CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER,
  product_id INTEGER,
  product_name TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price REAL,
  subtotal REAL,
  FOREIGN KEY (sale_id) REFERENCES sales(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
)
`);

// Cash closures table
db.exec(`
CREATE TABLE IF NOT EXISTS cash_closures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  opening_balance REAL DEFAULT 0,
  cash_sales REAL DEFAULT 0,
  card_sales REAL DEFAULT 0,
  total_sales REAL DEFAULT 0,
  closing_balance REAL DEFAULT 0,
  opened_at DATETIME,
  closed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'open',
  FOREIGN KEY (user_id) REFERENCES users(id)
)
`);

// Config table (for store name, time, etc.)
db.exec(`
CREATE TABLE IF NOT EXISTS config (
  id INTEGER PRIMARY KEY,
  store_name TEXT DEFAULT 'La Cucharada del Sabor',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  invoice_footer TEXT DEFAULT '¡Gracias por su visita!',
  system_time TEXT DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

// Insert default config
db.exec(`INSERT OR IGNORE INTO config (id, store_name) VALUES (1, 'La Cucharada del Sabor')`);

// ======================
// SEED USERS
// ======================
const defaultUsers = [
  { username: 'admin', password: 'admin123', role: 'admin' },
  { username: 'caja', password: 'caja123', role: 'cajero' },
];

const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)');
defaultUsers.forEach(u => {
  const hash = bcrypt.hashSync(u.password, 10);
  insertUser.run(u.username, hash, u.role);
});

// ======================
// SEED CATEGORIES
// ======================
const categories = [
  { name: 'Desayunos', icon: '🌅', sort_order: 1 },
  { name: 'Antojos', icon: '🌮', sort_order: 2 },
  { name: 'Comida Corrida', icon: '🍱', sort_order: 3 },
  { name: 'Bebidas Calientes', icon: '☕', sort_order: 4 },
  { name: 'Bebidas Frías', icon: '🥤', sort_order: 5 },
  { name: 'Postres', icon: '🍰', sort_order: 6 },
  { name: 'Extras', icon: '➕', sort_order: 7 },
  { name: 'Combos', icon: '🎁', sort_order: 8 },
  { name: 'Jugos y Batidos', icon: '🍹', sort_order: 9 },
  { name: 'Ensaladas', icon: '🥗', sort_order: 10 },
];

const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (name, icon, sort_order) VALUES (?, ?, ?)');
categories.forEach(c => insertCategory.run(c.name, c.icon, c.sort_order));

// ======================
// SEED PRODUCTS (100+)
// Prices in COLONES
// ======================
const products = [
  // DESAYUNOS (10)
  { name: 'Huevos Revueltos con Frijoles', price: 2500, category: 'Desayunos', desc: 'Huevos revueltos, frijoles negros, tortilla' },
  { name: 'Gallo de Queso', price: 1500, category: 'Desayunos', desc: 'Tortilla suave con queso y huevo' },
  { name: 'Gallo de Chorizo', price: 1800, category: 'Desayunos', desc: 'Tortilla suave con chorizo' },
  { name: 'Huevos Estrellados', price: 2200, category: 'Desayunos', desc: 'Huevos fritos con tortillas' },
  { name: 'Omelette de Queso', price: 2800, category: 'Desayunos', desc: 'Omelette con queso, champiñones y hierbas' },
  { name: 'Hot Cakes', price: 2000, category: 'Desayunos', desc: '3 hot cakes con mantequilla y miel' },
  { name: 'Chilaquiles Rojos', price: 3000, category: 'Desayunos', desc: 'Chilaquiles con salsa roja, crema y queso' },
  { name: 'Chilaquiles Verdes', price: 3000, category: 'Desayunos', desc: 'Chilaquiles con salsa verde, crema y queso' },
  { name: 'Enfrijaldas', price: 2800, category: 'Desayunos', desc: 'Tortillas con salsa de frijol, huevo y queso' },
  { name: 'Molletes', price: 2500, category: 'Desayunos', desc: 'Pan con frijoles, queso fundido y salsa' },

  // ANTOJOS (15)
  { name: 'Taco de Carne Asada', price: 1200, category: 'Antojos', desc: 'Tortilla de maíz, carne asada, cebolla y cilantro' },
  { name: 'Taco de Carnitas', price: 1200, category: 'Antojos', desc: 'Tortilla de maíz, carnitas, cebolla y cilantro' },
  { name: 'Taco de Pollo', price: 1000, category: 'Antojos', desc: 'Tortilla de maíz, pollo deshebrado, cebolla y cilantro' },
  { name: 'Taco de Bisteck', price: 1400, category: 'Antojos', desc: 'Tortilla de maíz, bisteck, cebolla y cilantro' },
  { name: 'Taco de Chorizo', price: 1100, category: 'Antojos', desc: 'Tortilla de maíz, chorizo, cebolla y cilantro' },
  { name: 'Taco de Suadero', price: 1300, category: 'Antojos', desc: 'Tortilla de maíz, suadero, cebolla y cilantro' },
  { name: 'Taco de Pastor', price: 1300, category: 'Antojos', desc: 'Tortilla de maíz, pork al pastor, piña y cilantro' },
  { name: 'Quesadilla de Carne Asada', price: 2500, category: 'Antojos', desc: 'Quesadilla grande con carne asada y queso' },
  { name: 'Quesadilla de Carnitas', price: 2500, category: 'Antojos', desc: 'Quesadilla grande con carnitas y queso' },
  { name: 'Quesadilla de Pollo', price: 2200, category: 'Antojos', desc: 'Quesadilla grande con pollo y queso' },
  { name: 'Sope de Carne Asada', price: 1800, category: 'Antojos', desc: 'Sope con carne asada, frijoles, crema y queso' },
  { name: 'Sope de Pollo', price: 1600, category: 'Antojos', desc: 'Sope con pollo deshebrado, frijoles, crema y queso' },
  { name: 'Sope de Chorizo', price: 1600, category: 'Antojos', desc: 'Sope con chorizo, frijoles, crema y queso' },
  { name: ' gordita de Carne Asada', price: 2000, category: 'Antojos', desc: 'Gordita con carne asada, frijoles y queso' },
  { name: 'Gordita de Chicharrón', price: 1800, category: 'Antojos', desc: 'Gordita con chicharrón, frijoles y queso' },

  // COMIDA CORRIDA (15)
  { name: 'Arroz con Pollo', price: 4500, category: 'Comida Corrida', desc: 'Arroz con pollo, ensalada y frijoles' },
  { name: 'Carne Guisada', price: 4800, category: 'Comida Corrida', desc: 'Carne en salsa roja, arroz, frijoles y ensalada' },
  { name: 'Milanesa con Papas', price: 5000, category: 'Comida Corrida', desc: 'Milanesa de res, papas fritas, ensalada' },
  { name: 'Pollo Enchipelado', price: 4800, category: 'Comida Corrida', desc: 'Pollo en salsa de-chipotle, arroz y frijoles' },
  { name: 'Chile Relleno', price: 4500, category: 'Comida Corrida', desc: 'Chile poblano rellen, arroz y frijoles' },
  { name: 'Enchiladas Rojas', price: 4800, category: 'Comida Corrida', desc: '3 enchiladas rojas con pollo, crema y queso' },
  { name: 'Enchiladas Verdes', price: 4800, category: 'Comida Corrida', desc: '3 enchiladas verdes con pollo, crema y queso' },
  { name: 'Enchiladas de Mole', price: 5000, category: 'Comida Corrida', desc: '3 enchiladas de mole con pollo, queso y cebolla' },
  { name: 'Tamales Rojos', price: 3500, category: 'Comida Corrida', desc: '2 tamales rojos de pollo con salsa' },
  { name: 'Tamales Verdes', price: 3500, category: 'Comida Corrida', desc: '2 tamales verdes de pollo con salsa' },
  { name: 'Pechuga Empanizada', price: 4800, category: 'Comida Corrida', desc: 'Pechuga empanizada, arroz, ensalada' },
  { name: 'Rib Eye Steak', price: 6500, category: 'Comida Corrida', desc: 'Rib eye a la plancha, papas y ensalada' },
  { name: 'Fish Tacos', price: 5000, category: 'Comida Corrida', desc: '3 tacos de pescado con aderezo' },
  { name: 'Paella Valenciana', price: 6000, category: 'Comida Corrida', desc: 'Arroz con mariscos, pollo y chorizo' },
  { name: 'Fajitas de Res', price: 5500, category: 'Comida Corrida', desc: 'Fajitas con cebolla, pimiento y tortillas' },

  // BEBIDAS CALIENTES (10)
  { name: 'Café de Olla', price: 800, category: 'Bebidas Calientes', desc: 'Café tradicional mexicano' },
  { name: 'Café Americano', price: 900, category: 'Bebidas Calientes', desc: 'Café americano solo' },
  { name: 'Cappuccino', price: 1800, category: 'Bebidas Calientes', desc: 'Café con leche espumosa' },
  { name: 'Latte', price: 2000, category: 'Bebidas Calientes', desc: 'Café con leche al vapor' },
  { name: 'Mocaccino', price: 2200, category: 'Bebidas Calientes', desc: 'Café con chocolate y leche' },
  { name: 'Té de Manzanilla', price: 800, category: 'Bebidas Calientes', desc: 'Té de manzanilla natural' },
  { name: 'Té de Menta', price: 800, category: 'Bebidas Calientes', desc: 'Té de menta natural' },
  { name: 'Chocolate Caliente', price: 1500, category: 'Bebidas Calientes', desc: 'Chocolate caliente con leche' },
  { name: 'Atole de Vanilla', price: 1200, category: 'Bebidas Calientes', desc: 'Atole espeso de vainilla' },
  { name: 'Atole de Chocolate', price: 1200, category: 'Bebidas Calientes', desc: 'Atole espeso de chocolate' },

  // BEBIDAS FRIAS (10)
  { name: 'Agua de Horchata', price: 1000, category: 'Bebidas Frías', desc: 'Horchata de arroz con canela' },
  { name: 'Agua de Jamaica', price: 1000, category: 'Bebidas Frías', desc: 'Agua de flor de jamaica' },
  { name: 'Agua de Tamarindo', price: 1000, category: 'Bebidas Frías', desc: 'Agua de tamarindo natural' },
  { name: 'Limonada Natural', price: 1200, category: 'Bebidas Frías', desc: 'Limonada fresca natural' },
  { name: 'Limonada de Coco', price: 1500, category: 'Bebidas Frías', desc: 'Limonada con leche de coco' },
  { name: 'Naranjada', price: 1200, category: 'Bebidas Frías', desc: 'Naranjada natural' },
  { name: 'Refresco', price: 900, category: 'Bebidas Frías', desc: 'Refresco de cola, naranja o limón' },
  { name: 'Coca-Cola Light', price: 1000, category: 'Bebidas Frías', desc: 'Coca-Cola Light bien fría' },
  { name: 'Agua Embotellada', price: 600, category: 'Bebidas Frías', desc: 'Agua purificada 500ml' },
  { name: 'Cerveza', price: 1500, category: 'Bebidas Frías', desc: 'Cerveza nacional bien fría' },

  // POSTRES (10)
  { name: 'Flan Casero', price: 1500, category: 'Postres', desc: 'Flan de vainilla casero' },
  { name: 'Gelatina de Mosaico', price: 1200, category: 'Postres', desc: 'Gelatina de colores varios' },
  { name: 'Arroz con Leche', price: 1200, category: 'Postres', desc: 'Arroz con leche y canela' },
  { name: 'Soplado de蛋黄', price: 1500, category: 'Postres', desc: 'Soplado de naranja' },
  { name: 'Pay de Queso', price: 1800, category: 'Postres', desc: 'Pay de queso frio' },
  { name: 'Brownie con Helado', price: 2000, category: 'Postres', desc: 'Brownie tibio con bola de helado' },
  { name: 'Helado de Vanilla', price: 1500, category: 'Postres', desc: 'Helado artesanal de vainilla' },
  { name: 'Helado de Chocolate', price: 1500, category: 'Postres', desc: 'Helado artesanal de chocolate' },
  { name: 'Crepa de Nutella', price: 2500, category: 'Postres', desc: 'Crepa con Nutella y plátano' },
  { name: 'Churros con Chocolate', price: 2000, category: 'Postres', desc: '4 churros con chocolate caliente' },

  // EXTRAS (10)
  { name: 'Tortillas de Maíz (6)', price: 400, category: 'Extras', desc: '6 tortillas de maíz' },
  { name: 'Tortillas de Harina (3)', price: 400, category: 'Extras', desc: '3 tortillas de harina' },
  { name: 'Frijoles', price: 500, category: 'Extras', desc: 'Porción de frijoles negros' },
  { name: 'Arroz', price: 500, category: 'Extras', desc: 'Porción de arroz blanco' },
  { name: 'Ensalada', price: 600, category: 'Extras', desc: 'Ensalada fresca' },
  { name: 'Crema', price: 300, category: 'Extras', desc: 'Porción de crema' },
  { name: 'Salsa Verde', price: 200, category: 'Extras', desc: 'Salsa verde picosa' },
  { name: 'Salsa Roja', price: 200, category: 'Extras', desc: 'Salsa roja picosa' },
  { name: 'Guacamole', price: 800, category: 'Extras', desc: 'Porción de guacamole' },
  { name: 'Queso Rallado', price: 300, category: 'Extras', desc: 'Queso queso Oaxaca rallado' },

  // COMBOS (10)
  { name: 'Combo Desayuno', price: 4500, category: 'Combos', desc: 'Huevos + Gallo + Café de Olla' },
  { name: 'Combo Antojo', price: 5000, category: 'Combos', desc: '3 Tacos + Refresco' },
  { name: 'Combo Comida Corrida', price: 5500, category: 'Combos', desc: 'Comida + Bebida + Postre' },
  { name: 'Combo Tacos (5pz)', price: 5500, category: 'Combos', desc: '5 tacos mixtos + Refresco' },
  { name: 'Combo Quesadilla', price: 3500, category: 'Combos', desc: 'Quesadilla + Refresco' },
  { name: 'Combo Kids', price: 3000, category: 'Combos', desc: 'Mini hamburger + Papas + Refresco' },
  { name: 'Combo Parrilla', price: 7000, category: 'Combos', desc: 'Rib Eye + Ensalada + Bebida' },
  { name: 'Combo Mariscos', price: 6500, category: 'Combos', desc: 'Paella + Ensalada + Bebida' },
  { name: 'Combo Pozole', price: 4500, category: 'Combos', desc: 'Pozole + Tortillas + Refresco' },
  { name: 'Combo Sope', price: 3500, category: 'Combos', desc: '3 Sopes + Refresco' },

  // JUGOS Y BATIDOS (10)
  { name: 'Jugo de Naranja', price: 1500, category: 'Jugos y Batidos', desc: 'Jugo de naranja natural' },
  { name: 'Jugo de Zanahoria', price: 1200, category: 'Jugos y Batidos', desc: 'Jugo de zanahoria natural' },
  { name: 'Jugo Verde', price: 1800, category: 'Jugos y Batidos', desc: 'Jugo de apio, pepino y manzana' },
  { name: 'Batido de Fresa', price: 2000, category: 'Jugos y Batidos', desc: 'Batido de fresa con leche' },
  { name: 'Batido de Chocolate', price: 2000, category: 'Jugos y Batidos', desc: 'Batido de chocolate con leche' },
  { name: 'Batido de Vanilla', price: 2000, category: 'Jugos y Batidos', desc: 'Batido de vainilla con leche' },
  { name: 'Batido de Mango', price: 2000, category: 'Jugos y Batidos', desc: 'Batido de mango con leche' },
  { name: 'Licuado de Plátano', price: 1800, category: 'Jugos y Batidos', desc: 'Licuado de plátano con leche' },
  { name: 'Smoothie de Berries', price: 2500, category: 'Jugos y Batidos', desc: 'Smoothie mixto de berries' },
  { name: 'Agua de Coco', price: 1500, category: 'Jugos y Batidos', desc: 'Agua de coco natural' },

  // ENSALADAS (5)
  { name: 'Ensalada César', price: 3000, category: 'Ensaladas', desc: 'Lechuga romana, crutones, parmesano y aderezo César' },
  { name: 'Ensalada de Pollo', price: 3500, category: 'Ensaladas', desc: 'Ensalada verde con pollo a la plancha' },
  { name: 'Ensalada de Atún', price: 3200, category: 'Ensaladas', desc: 'Ensalada verde con atún' },
  { name: 'Ensalada Griega', price: 3200, category: 'Ensaladas', desc: 'Tomate, pepino, olivas, queso feta y aceite de oliva' },
  { name: 'Ensalada del Huerto', price: 2500, category: 'Ensaladas', desc: 'Verduras frescas de temporada' },
];

const insertProduct = db.prepare('INSERT INTO products (category_id, name, price, description) VALUES (?, ?, ?, ?)');
const getCatId = db.prepare('SELECT id FROM categories WHERE name = ?');

products.forEach(p => {
  const cat = getCatId.get(p.category);
  if (cat) {
    insertProduct.run(cat.id, p.name, p.price, p.desc);
  }
});

console.log('✅ Base de datos inicializada');
console.log(`   - ${defaultUsers.length} usuarios`);
console.log(`   - ${categories.length} categorías`);
console.log(`   - ${products.length} productos`);