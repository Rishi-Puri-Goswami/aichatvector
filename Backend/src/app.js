const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');



const authRoutes = require('./routes/auth.routes');
const chatRoutes = require("./routes/chat.routes");
const dotenv = require("dotenv");

const app = express();

// dotenv.config({
//     path : "./.env"
// })


console.log(process.env.PINECONE_API_KEY)

app.use(cors({
    origin: true ,
    credentials: true
}))
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);


app.get("*name", (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

module.exports = app;