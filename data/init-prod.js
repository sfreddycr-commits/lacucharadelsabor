const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database('/opt/projects/lacucharadelsabor/data/pos.db');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT DEFAULT 'cajero', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, icon TEXT DEFAULT '?', sort_order INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER, name TEXT NOT NULL, price REAL NOT NULL, description TEXT, active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (category_id) REFERENCES categories(id));
CREATE TABLE IF NOT EXISTS sales (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, total REAL NOT NULL, payment_method TEXT, cash_received REAL DEFAULT 0, change_given REAL DEFAULT 0, cash_amount REAL DEFAULT 0, card_amount REAL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS sale_items (id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER, product_id INTEGER, product_name TEXT, quantity INTEGER DEFAULT 1, unit_price REAL, subtotal REAL, FOREIGN KEY (sale_id) REFERENCES sales(id), FOREIGN KEY (product_id) REFERENCES products(id));
CREATE TABLE IF NOT EXISTS cash_closures (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, opening_balance REAL DEFAULT 0, cash_sales REAL DEFAULT 0, card_sales REAL DEFAULT 0, total_sales REAL DEFAULT 0, closing_balance REAL DEFAULT 0, opened_at DATETIME, closed_at DATETIME DEFAULT CURRENT_TIMESTAMP, status TEXT DEFAULT 'open', FOREIGN KEY (user_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS config (id INTEGER PRIMARY KEY, store_name TEXT DEFAULT 'La Cucharada del Sabor', address TEXT DEFAULT '', phone TEXT DEFAULT '', invoice_footer TEXT DEFAULT 'Gracias por su visita!', system_time TEXT DEFAULT '', updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO config (id, store_name) VALUES (1, 'La Cucharada del Sabor');
`);

const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (count === 0) {
  const insertUser = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)');
  insertUser.run('admin', bcrypt.hashSync('admin123', 10), 'admin');
  insertUser.run('caja', bcrypt.hashSync('caja123', 10), 'cajero');

  const cats = [
    ['Desayunos','D',1],['Antojos','A',2],['Comida Corrida','C',3],
    ['Bebidas Calientes','BC',4],['Bebidas Frias','BF',5],['Postres','P',6],
    ['Extras','E',7],['Combos','CO',8],['Jugos y Batidos','JB',9],['Ensaladas','EN',10]
  ];
  const insertCat = db.prepare('INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)');
  cats.forEach(c => insertCat.run(c[0], c[1], c[2]));

  const products = [
    ['Huevos Revueltos con Frijoles',2500,'Desayunos','Huevos revueltos, frijoles negros, tortilla'],
    ['Gallo de Queso',1500,'Desayunos','Tortilla suave con queso y huevo'],
    ['Gallo de Chorizo',1800,'Desayunos','Tortilla suave con chorizo'],
    ['Huevos Estrellados',2200,'Desayunos','Huevos fritos con tortillas'],
    ['Omelette de Queso',2800,'Desayunos','Omelette con queso, champiñones y hierbas'],
    ['Hot Cakes',2000,'Desayunos','3 hot cakes con mantequilla y miel'],
    ['Chilaquiles Rojos',3000,'Desayunos','Chilaquiles con salsa roja, crema y queso'],
    ['Chilaquiles Verdes',3000,'Desayunos','Chilaquiles con salsa verde, crema y queso'],
    ['Enfrijaldas',2800,'Desayunos','Tortillas con salsa de frijol, huevo y queso'],
    ['Molletes',2500,'Desayunos','Pan con frijoles, queso fundido y salsa'],
    ['Taco de Carne Asada',1200,'Antojos','Tortilla de maiz, carne asada, cebolla y cilantro'],
    ['Taco de Carnitas',1200,'Antojos','Tortilla de maiz, carnitas, cebolla y cilantro'],
    ['Taco de Pollo',1000,'Antojos','Tortilla de maiz, pollo deshebrado, cebolla y cilantro'],
    ['Taco de Bisteck',1400,'Antojos','Tortilla de maiz, bisteck, cebolla y cilantro'],
    ['Taco de Chorizo',1100,'Antojos','Tortilla de maiz, chorizo, cebolla y cilantro'],
    ['Taco de Suadero',1300,'Antojos','Tortilla de maiz, suadero, cebolla y cilantro'],
    ['Taco de Pastor',1300,'Antojos','Tortilla de maiz, pork al pastor, pina y cilantro'],
    ['Quesadilla de Carne Asada',2500,'Antojos','Quesadilla grande con carne asada y queso'],
    ['Quesadilla de Carnitas',2500,'Antojos','Quesadilla grande con carnitas y queso'],
    ['Quesadilla de Pollo',2200,'Antojos','Quesadilla grande con pollo y queso'],
    ['Sope de Carne Asada',1800,'Antojos','Sope con carne asada, frijoles, crema y queso'],
    ['Sope de Pollo',1600,'Antojos','Sope con pollo deshebrado, frijoles, crema y queso'],
    ['Sope de Chorizo',1600,'Antojos','Sope con chorizo, frijoles, crema y queso'],
    ['Gordita de Carne Asada',2000,'Antojos','Gordita con carne asada, frijoles y queso'],
    ['Gordita de Chicharron',1800,'Antojos','Gordita con chicharron, frijoles y queso'],
    ['Arroz con Pollo',4500,'Comida Corrida','Arroz con pollo, ensalada y frijoles'],
    ['Carne Guisada',4800,'Comida Corrida','Carne en salsa roja, arroz, frijoles y ensalada'],
    ['Milanesa con Papas',5000,'Comida Corrida','Milanesa de res, papas fritas, ensalada'],
    ['Pollo Enchipelado',4800,'Comida Corrida','Pollo en salsa de chipotle, arroz y frijoles'],
    ['Chile Relleno',4500,'Comida Corrida','Chile poblano rellen, arroz y frijoles'],
    ['Enchiladas Rojas',4800,'Comida Corrida','3 enchiladas rojas con pollo, crema y queso'],
    ['Enchiladas Verdes',4800,'Comida Corrida','3 enchiladas verdes con pollo, crema y queso'],
    ['Enchiladas de Mole',5000,'Comida Corrida','3 enchiladas de mole con pollo, queso y cebolla'],
    ['Tamales Rojos',3500,'Comida Corrida','2 tamales rojos de pollo con salsa'],
    ['Tamales Verdes',3500,'Comida Corrida','2 tamales verdes de pollo con salsa'],
    ['Pechuga Empanizada',4800,'Comida Corrida','Pechuga empanizada, arroz, ensalada'],
    ['Rib Eye Steak',6500,'Comida Corrida','Rib eye a la plancha, papas y ensalada'],
    ['Fish Tacos',5000,'Comida Corrida','3 tacos de pescado con aderezo'],
    ['Paella Valenciana',6000,'Comida Corrida','Arroz con mariscos, pollo y chorizo'],
    ['Fajitas de Res',5500,'Comida Corrida','Fajitas con cebolla, pimiento y tortillas'],
    ['Café de Olla',800,'Bebidas Calientes','Café tradicional mexicano'],
    ['Café Americano',900,'Bebidas Calientes','Café americano solo'],
    ['Cappuccino',1800,'Bebidas Calientes','Café con leche espumosa'],
    ['Latte',2000,'Bebidas Calientes','Café con leche al vapor'],
    ['Mocaccino',2200,'Bebidas Calientes','Café con chocolate y leche'],
    ['Té de Manzanilla',800,'Bebidas Calientes','Té de manzanilla natural'],
    ['Té de Menta',800,'Bebidas Calientes','Té de menta natural'],
    ['Chocolate Caliente',1500,'Bebidas Calientes','Chocolate caliente con leche'],
    ['Atole de Vainilla',1200,'Bebidas Calientes','Atole espeso de vainilla'],
    ['Atole de Chocolate',1200,'Bebidas Calientes','Atole espeso de chocolate'],
    ['Agua de Horchata',1000,'Bebidas Frias','Horchata de arroz con canela'],
    ['Agua de Jamaica',1000,'Bebidas Frias','Agua de flor de jamaica'],
    ['Agua de Tamarindo',1000,'Bebidas Frias','Agua de tamarindo natural'],
    ['Limonada Natural',1200,'Bebidas Frias','Limonada fresca natural'],
    ['Limonada de Coco',1500,'Bebidas Frias','Limonada con leche de coco'],
    ['Naranjada',1200,'Bebidas Frias','Naranjada natural'],
    ['Refresco',900,'Bebidas Frias','Refresco de cola, naranja o limon'],
    ['Coca-Cola Light',1000,'Bebidas Frias','Coca-Cola Light bien fria'],
    ['Agua Embotellada',600,'Bebidas Frias','Agua purificada 500ml'],
    ['Cerveza',1500,'Bebidas Frias','Cerveza nacional bien fria'],
    ['Flan Casero',1500,'Postres','Flan de vainilla casero'],
    ['Gelatina de Mosaico',1200,'Postres','Gelatina de colores varios'],
    ['Arroz con Leche',1200,'Postres','Arroz con leche y canela'],
    ['Pay de Queso',1800,'Postres','Pay de queso frio'],
    ['Brownie con Helado',2000,'Postres','Brownie tibio con bola de helado'],
    ['Helado de Vainilla',1500,'Postres','Helado artesanal de vainilla'],
    ['Helado de Chocolate',1500,'Postres','Helado artesanal de chocolate'],
    ['Crepa de Nutella',2500,'Postres','Crepa con Nutella y platano'],
    ['Churros con Chocolate',2000,'Postres','4 churros con chocolate caliente'],
    ['Soplado de Naranja',1500,'Postres','Soplado de naranja'],
    ['Tortillas de Maiz (6)',400,'Extras','6 tortillas de maiz'],
    ['Tortillas de Harina (3)',400,'Extras','3 tortillas de harina'],
    ['Frijoles',500,'Extras','Porcion de frijoles negros'],
    ['Arroz',500,'Extras','Porcion de arroz blanco'],
    ['Ensalada',600,'Extras','Ensalada fresca'],
    ['Crema',300,'Extras','Porcion de crema'],
    ['Salsa Verde',200,'Extras','Salsa verde picosa'],
    ['Salsa Roja',200,'Extras','Salsa roja picosa'],
    ['Guacamole',800,'Extras','Porcion de guacamole'],
    ['Queso Rallado',300,'Extras','Queso Oaxaca rallado'],
    ['Combo Desayuno',4500,'Combos','Huevos + Gallo + Cafe de Olla'],
    ['Combo Antojo',5000,'Combos','3 Tacos + Refresco'],
    ['Combo Comida Corrida',5500,'Combos','Comida + Bebida + Postre'],
    ['Combo Tacos (5pz)',5500,'Combos','5 tacos mixtos + Refresco'],
    ['Combo Quesadilla',3500,'Combos','Quesadilla + Refresco'],
    ['Combo Kids',3000,'Combos','Mini hamburger + Papas + Refresco'],
    ['Combo Parrilla',7000,'Combos','Rib Eye + Ensalada + Bebida'],
    ['Combo Mariscos',6500,'Combos','Paella + Ensalada + Bebida'],
    ['Combo Pozole',4500,'Combos','Pozole + Tortillas + Refresco'],
    ['Combo Sope',3500,'Combos','3 Sopes + Refresco'],
    ['Jugo de Naranja',1500,'Jugos y Batidos','Jugo de naranja natural'],
    ['Jugo de Zanahoria',1200,'Jugos y Batidos','Jugo de zanahoria natural'],
    ['Jugo Verde',1800,'Jugos y Batidos','Jugo de apio, pepino y manzana'],
    ['Batido de Fresa',2000,'Jugos y Batidos','Batido de fresa con leche'],
    ['Batido de Chocolate',2000,'Jugos y Batidos','Batido de chocolate con leche'],
    ['Batido de Vainilla',2000,'Jugos y Batidos','Batido de vainilla con leche'],
    ['Batido de Mango',2000,'Jugos y Batidos','Batido de mango con leche'],
    ['Licuado de Platano',1800,'Jugos y Batidos','Licuado de platano con leche'],
    ['Smoothie de Berries',2500,'Jugos y Batidos','Smoothie mixto de berries'],
    ['Agua de Coco',1500,'Jugos y Batidos','Agua de coco natural'],
    ['Ensalada Cesar',3000,'Ensaladas','Lechuga romana, crutones, parmesano y aderezo Cesar'],
    ['Ensalada de Pollo',3500,'Ensaladas','Ensalada verde con pollo a la plancha'],
    ['Ensalada de Atun',3200,'Ensaladas','Ensalada verde con atun'],
    ['Ensalada Griega',3200,'Ensaladas','Tomate, pepino, olivas, queso feta y aceite de oliva'],
    ['Ensalada del Huerto',2500,'Ensaladas','Verduras frescas de temporada'],
  ];

  const getCatId = db.prepare('SELECT id FROM categories WHERE name = ?');
  const insertProduct = db.prepare('INSERT INTO products (category_id, name, price, description) VALUES (?, ?, ?, ?)');
  products.forEach(p => {
    const cat = getCatId.get(p[2]);
    if (cat) insertProduct.run(cat.id, p[0], p[1], p[3]);
  });
}

const u = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
const p = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
const c = db.prepare('SELECT COUNT(*) as c FROM categories').get().c;
console.log('DB OK:', u, 'usuarios,', c, 'categorias,', p, 'productos');