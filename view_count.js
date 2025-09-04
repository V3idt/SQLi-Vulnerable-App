const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const app = express();

app.use(cookieParser());
app.use(session({
    secret: 'abdul',
    resave: false,
    saveUninitialized: true
}));

app.get('/view_count', (req, res) => {
    if(req.session.views) {
        req.session.views++;
        res.send(`Number of views: ${req.session.views}`);
    } else {
        req.session.views = 1;
        res.send(`first view`);
    }
});


app.listen(3001, () => {
    console.log("Server is running on port 3001");
});
