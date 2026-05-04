const express = require('express');
const webpush = require('web-push');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const crypto = require('crypto');

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
    .then(() => console.log('✅ Connected to MongoDB Atlas (Forever Memory)'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

const userSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    timezone: { type: String, default: 'UTC' },
    subscription: { type: Object, default: null },
    state: { type: Object, default: {} } // Upgraded to store FULL state (history, streaks, etc.)
});

const User = mongoose.model('User', userSchema);

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Health check route
app.get('/', (req, res) => res.send('RoutineOS Backend is Live with MongoDB!'));

// Authentication Routes
app.post('/signup', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
        
        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ error: 'User already exists' });
        
        const user = new User({ email, password: hashPassword(password) });
        await user.save();
        res.status(201).json({ message: 'User created' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ error: 'User not found' });
        
        if (user.password !== hashPassword(password)) {
            return res.status(401).json({ error: 'Invalid password' });
        }
        res.status(200).json({ message: 'Login successful', state: user.state, timezone: user.timezone });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Route to get data for a logged in user
app.get('/get-data', async (req, res) => {
    try {
        const email = req.query.email;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.status(200).json({ routines: user.routines, timezone: user.timezone });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Route to subscribe to push notifications
app.post('/subscribe', async (req, res) => {
    try {
        const { subscription, email } = req.body;
        await User.findOneAndUpdate({ email }, { subscription }, { upsert: true });
        res.status(201).json({});
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Route to sync full state
app.post('/sync', async (req, res) => {
    try {
        const { email, password, state, timezone } = req.body;
        if (!email) return res.status(400).json({ error: 'Email required' });
        
        const user = await User.findOne({ email });
        if (user && user.password !== hashPassword(password)) {
            return res.status(401).json({ error: 'Sync failed: Auth required' });
        }

        const update = { state };
        if (timezone) update.timezone = timezone;
        
        await User.findOneAndUpdate({ email }, update, { upsert: true });
        res.status(200).json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Route to change password
app.post('/change-password', async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        if (!email || !newPassword) return res.status(400).json({ error: 'Missing data' });
        
        await User.findOneAndUpdate({ email }, { password: hashPassword(newPassword) });
        res.status(200).json({ message: 'Password updated successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Route to test push
app.post('/test-push', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user || !user.subscription) return res.status(400).json({ error: 'Not subscribed to push' });

        const payload = JSON.stringify({
            title: 'RoutineOS Test!',
            body: 'Background notifications are working perfectly! 🎉',
            icon: 'icon.svg'
        });

        await webpush.sendNotification(user.subscription, payload);
    console.log(`[TEST PUSH] Success for ${email}`);
    res.status(200).json({ success: true });
  } catch (e) {
    console.error(`[TEST PUSH] Failed for ${email}`, e);
    res.status(500).json({ error: e.message });
  }
});

// Self-ping to stay awake on Render Free Tier
const https = require('https');
setInterval(() => {
    const url = process.env.RENDER_EXTERNAL_URL;
    if (url) {
        https.get(url, (res) => {
            console.log(`[HEARTBEAT] Pinged ${url} - Status: ${res.statusCode}`);
        }).on('error', (err) => {
            console.error('[HEARTBEAT] Error:', err.message);
        });
    }
}, 14 * 60 * 1000); // Ping every 14 mins (just before the 15m timeout)

// Background loop checking every minute
setInterval(async () => {
    try {
        const now = new Date();
        const users = await User.find({ subscription: { $ne: null } });

            const state = user.state || {};
            const routines = state.routines || [];
            const tz = user.timezone || 'UTC';
            let timeStr = "";
            let currentDay = 0;

            try {
                timeStr = now.toLocaleTimeString('en-GB', { 
                    timeZone: tz, hour: '2-digit', minute: '2-digit' 
                });
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
                    console.log(`!!! MATCH !!! Sending push to ${user.email} for ${routine.name}`);
                    webpush.sendNotification(user.subscription, payload).catch(err => {
                        console.error("Push failed for", user.email, err);
                    });
                }
            });
        });
    } catch (e) {
        console.error("Interval error:", e);
    }
}, 60000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 RoutineOS Backend Push Server running on port ${PORT}`);
});
