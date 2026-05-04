const express = require('express');
const webpush = require('web-push');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const crypto = require('crypto');
const https = require('https');

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(bodyParser.json({ limit: '10mb' })); 
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Set up VAPID details
const publicVapidKey = 'BAhHvsSqeYPU3FBqSCn0lfMNn_yeBpWBTzbb3HYLE8Pd-zld_PT7ypy5dWf72KbBgo6t6hsNcDf2LhLlEI37PrA';
const privateVapidKey = 'nDctB51wOtpCa7BGR9nF0GVY7G-HBw6eROCQigMgZPo';
webpush.setVapidDetails('mailto:test@example.com', publicVapidKey, privateVapidKey);

// --- MONGODB SETUP ---
const MONGODB_URI = 'mongodb+srv://admin:routine123@cluster0.dihuxwr.mongodb.net/routineos?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

const userSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    timezone: { type: String, default: 'UTC' },
    subscription: { type: Object, default: null },
    state: { type: Object, default: {} }
});

const User = mongoose.model('User', userSchema);

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Routes
app.get('/', (req, res) => res.send('RoutineOS Backend is Live!'));

app.post('/signup', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ error: 'User already exists' });
        const user = new User({ email, password: hashPassword(password) });
        await user.save();
        res.status(201).json({ message: 'User created' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || user.password !== hashPassword(password)) return res.status(401).json({ error: 'Invalid credentials' });
        res.status(200).json({ message: 'Login successful', state: user.state, timezone: user.timezone });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/subscribe', async (req, res) => {
    try {
        const { subscription, email } = req.body;
        await User.findOneAndUpdate({ email }, { subscription }, { upsert: true });
        res.status(201).json({});
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/sync', async (req, res) => {
    try {
        const { email, password, state, timezone } = req.body;
        const user = await User.findOne({ email });
        if (user && user.password !== hashPassword(password)) return res.status(401).json({ error: 'Auth failed' });
        const update = { state };
        if (timezone) update.timezone = timezone;
        await User.findOneAndUpdate({ email }, update, { upsert: true });
        res.status(200).json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/test-push', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user || !user.subscription) return res.status(400).json({ error: 'Not subscribed' });
        const payload = JSON.stringify({ title: 'RoutineOS Test!', body: 'Notifications are working! 🎉' });
        await webpush.sendNotification(user.subscription, payload);
        res.status(200).json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Self-ping to stay awake
setInterval(() => {
    const url = process.env.RENDER_EXTERNAL_URL;
    if (url) https.get(url, (res) => {}).on('error', () => {});
}, 14 * 60 * 1000);

// Background loop
setInterval(async () => {
    try {
        const now = new Date();
        const users = await User.find({ subscription: { $ne: null } });
        users.forEach(user => {
            const state = user.state || {};
            const routines = state.routines || [];
            const tz = user.timezone || 'UTC';
            let timeStr = "";
            let currentDay = 0;
            try {
                timeStr = now.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
                const dayName = now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' });
                const daysMap = { 'Sun':0, 'Mon':1, 'Tue':2, 'Wed':3, 'Thu':4, 'Fri':5, 'Sat':6 };
                currentDay = daysMap[dayName];
            } catch(e) { return; }

            routines.forEach(routine => {
                if (routine.reminder && routine.time === timeStr && routine.days.includes(currentDay)) {
                    const payload = JSON.stringify({
                        title: `RoutineOS: ${routine.name}`,
                        body: `It's time for ${routine.icon} ${routine.name}!`,
                        icon: 'icon.svg'
                    });
                    webpush.sendNotification(user.subscription, payload).catch(() => {});
                }
            });
        });
    } catch (e) { console.error("Interval error:", e); }
}, 60000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 RoutineOS Backend running on port ${PORT}`));
