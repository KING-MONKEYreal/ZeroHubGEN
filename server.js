const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = path.join(__dirname, "data.json");
const ADMIN_PASSWORD = "adminwrld";
const FREE_COOLDOWN = 60; // seconds
const PAID_COOLDOWN = 60; // seconds

/* ===== LOAD / SAVE DATA ===== */
function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({
            freeStock: [],
            paidStock: [],
            used: [],
            cooldowns: {}
        }, null, 2));
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/* ===== HELPER ===== */
function checkCooldown(ip, type) {
    const data = loadData();
    if (!data.cooldowns[ip]) data.cooldowns[ip] = { free: 0, paid: 0 };
    const now = Math.floor(Date.now() / 1000);
    const lastTime = data.cooldowns[ip][type] || 0;
    const cooldown = type === "free" ? FREE_COOLDOWN : PAID_COOLDOWN;
    return now - lastTime >= cooldown;
}

function updateCooldown(ip, type) {
    const data = loadData();
    if (!data.cooldowns[ip]) data.cooldowns[ip] = { free: 0, paid: 0 };
    data.cooldowns[ip][type] = Math.floor(Date.now() / 1000);
    saveData(data);
}

/* ===== STATUS ===== */
app.get("/api/status", (req, res) => {
    const data = loadData();
    res.json({
        online: true,
        freeStock: data.freeStock.length,
        paidStock: data.paidStock.length,
        totalGenerated: data.used.length
    });
});

/* ===== GENERATE ===== */
app.post("/api/generate/:type", (req, res) => {
    const type = req.params.type;
    const ip = req.socket.remoteAddress;

    const data = loadData();
    const stock = type === "free" ? data.freeStock : data.paidStock;

    if (!["free","paid"].includes(type)) return res.status(400).json({success:false,error:"Invalid type"});
    if (!checkCooldown(ip,type)) return res.json({success:false,error:"Cooldown active"});
    if (stock.length === 0) return res.json({success:false,error:"No accounts available"});

    const account = stock.shift();
    data.used.push({ account, ip, type, time: new Date().toISOString() });
    updateCooldown(ip, type);
    saveData(data);

    res.json({success:true, account});
});

/* ===== ADMIN RESET / RESTOCK ===== */
app.post("/api/admin/reset-all", (req, res) => {
    const { password, freeStock, paidStock } = req.body;

    if(password !== ADMIN_PASSWORD) return res.status(401).json({error:"Unauthorized"});

    const data = loadData();
    data.freeStock = Array.isArray(freeStock) ? freeStock.filter(a => a.username && a.password) : [];
    data.paidStock = Array.isArray(paidStock) ? paidStock.filter(a => a.username && a.password) : [];
    data.used = [];
    data.cooldowns = {};
    saveData(data);

    res.json({
        success:true,
        freeStock: data.freeStock.length,
        paidStock: data.paidStock.length
    });
});

/* ===== ADMIN VIEW ===== */
app.post("/api/admin/data", (req,res)=>{
    const { password } = req.body;
    if(password !== ADMIN_PASSWORD) return res.status(401).json({error:"Unauthorized"});
    const data = loadData();
    res.json(data);
});

/* ===== START SERVER ===== */
const PORT = 3000;
app.listen(PORT, ()=>console.log(`✅ Backend running at http://localhost:${PORT}`));







