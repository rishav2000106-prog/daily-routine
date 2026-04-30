const express = require('express');
const webpush = require('web-push');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Set up VAPID details
const publicVapidKey = 'BAhHvsSqeYPU3FBqSCn0lfMNn_yeBpWBTzbb3HYLE8Pd-zld_PT7ypy5dWf72KbBgo6t6hsNcDf2LhLlEI37PrA';
const privateVapidKey = 'nDctB51wOtpCa7BGR9nF0GVY7G-HBw6eROCQigMgZPo';
webpush.setVapidDetails('mailto:test@example.com', publicVapidKey, privateVapidKey);

// In-memory database for testing (in production, use a real DB)
const DB_FILE = 'push-database.json';
let users = {};
if (fs.existsSync(DB_FILE)) {
    try { users = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch(e){}
}
function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(users)); }

const crypto = require('crypto');

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Health check route for Render
app.get('/', (req, res) => res.send('RoutineOS Backend is Live!'));

// Authentication Routes
app.post('/signup', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (users[email] && users[email].password) return res.status(400).json({ error: 'User already exists' });
    
    if (!users[email]) users[email] = { routines: [] };
    users[email].password = hashPassword(password);
    saveDB();
    res.status(201).json({ message: 'User created' });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!users[email] || !users[email].password) return res.status(401).json({ error: 'User not found' });
    
    if (users[email].password !== hashPassword(password)) {
        return res.status(401).json({ error: 'Invalid password' });
    }
    res.status(200).json({ message: 'Login successful' });
});

// Route to subscribe to push notifications
app.post('/subscribe', (req, res) => {
    const { subscription, email } = req.body;
    if (!users[email]) users[email] = { routines: [] };
    users[email].subscription = subscription;
    saveDB();
    res.status(201).json({});
});

// Route to sync routines from the frontend to the backend
app.post('/sync', (req, res) => {
    const { email, routines, timezone } = req.body;
    if (users[email]) {
        users[email].routines = routines;
        if (timezone) users[email].timezone = timezone;
        saveDB();
    }
    res.status(200).json({});
});

// Route to test push notifications instantly
app.post('/test-push', (req, res) => {
    const { email } = req.body;
    const user = users[email];
    if (!user || !user.subscription) return res.status(400).json({ error: 'Not subscribed to push' });

    const payload = JSON.stringify({
        title: 'RoutineOS Test!',
        body: 'Background notifications are working perfectly! 🎉',
        icon: 'icon.svg'
    });

    webpush.sendNotification(user.subscription, payload)
        .then(() => res.status(200).json({ success: true }))
        .catch(err => {
            console.error('Push error:', err);
            res.status(500).json({ error: err.message });
        });
});

// Background loop checking every minute
setInterval(() => {
    const now = new Date();

    Object.keys(users).forEach(email => {
        const user = users[email];
        if (!user.subscription || !user.routines) return;

        // Use the user's timezone or default to UTC
        const tz = user.timezone || 'UTC';
        
        let timeStr = "";
        let currentDay = now.getDay();
        try {
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
            });
            // Format gives "24:00" or "14:30"
            let timeParts = formatter.format(now).split(':');
            let hr = timeParts[0];
            if (hr === '24') hr = '00';
            timeStr = `${hr}:${timeParts[1]}`;
            
            // Getting the local day of the week in that timezone
            const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' });
            const dayName = dayFormatter.format(now);
            const daysMap = { 'Sun':0, 'Mon':1, 'Tue':2, 'Wed':3, 'Thu':4, 'Fri':5, 'Sat':6 };
            currentDay = daysMap[dayName] !== undefined ? daysMap[dayName] : currentDay;
        } catch(e) {
            console.error("Timezone error", e);
            return;
        }

        user.routines.forEach(routine => {
            if (routine.reminder && routine.time === timeStr && routine.days.includes(currentDay)) {
                const payload = JSON.stringify({
                    title: `RoutineOS: ${routine.name}`,
                    body: `It's time for ${routine.icon} ${routine.name}!`,
                    icon: 'icon.svg'
                });
                console.log(`Sending push to ${email} for routine: ${routine.name} at local time ${timeStr}`);
                webpush.sendNotification(user.subscription, payload).catch(err => console.error(err));
            }
        });
    });
}, 60000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 RoutineOS Backend Push Server running on port ${PORT}`);
});
