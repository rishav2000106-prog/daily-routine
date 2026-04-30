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
    const { email, routines } = req.body;
    if (users[email]) {
        users[email].routines = routines;
        saveDB();
    }
    res.status(200).json({});
});

// Background loop checking every minute
setInterval(() => {
    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = String(now.getHours()).padStart(2, '0');
    const currentMinute = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${currentHour}:${currentMinute}`;

    Object.keys(users).forEach(email => {
        const user = users[email];
        if (!user.subscription || !user.routines) return;

        user.routines.forEach(routine => {
            if (routine.reminder && routine.time === timeStr && routine.days.includes(currentDay)) {
                const payload = JSON.stringify({
                    title: `RoutineOS: ${routine.name}`,
                    body: `It's time for ${routine.icon} ${routine.name}!`,
                    icon: 'icon.svg'
                });
                console.log(`Sending push to ${email} for routine: ${routine.name}`);
                webpush.sendNotification(user.subscription, payload).catch(err => console.error(err));
            }
        });
    });
}, 60000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 RoutineOS Backend Push Server running on port ${PORT}`);
});
