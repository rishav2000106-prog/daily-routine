const fs = require('fs');
const https = require('https');
const path = require('path');

// ==========================================
// CONFIGURATION
// Change this to the topic name you created in the ntfy app!
const NTFY_TOPIC = 'my_routineos_alerts_123'; 
// ==========================================

const DATA_FILE = path.join(__dirname, 'routineOS-data.json');

console.log('=============================================');
console.log('🚀 RoutineOS Background Notifier is running!');
console.log('📡 Sending notifications to ntfy.sh/' + NTFY_TOPIC);
console.log('=============================================');
console.log('Waiting for routines...');

// Keep track of what we have already notified for today to avoid spamming
const notifiedToday = new Set();

function checkRoutines() {
    if (!fs.existsSync(DATA_FILE)) {
        return;
    }

    try {
        const rawData = fs.readFileSync(DATA_FILE, 'utf8');
        const state = JSON.parse(rawData);
        
        const now = new Date();
        const currentDay = now.getDay();
        const currentHour = String(now.getHours()).padStart(2, '0');
        const currentMinute = String(now.getMinutes()).padStart(2, '0');
        const currentTimeStr = `${currentHour}:${currentMinute}`;
        const todayDateStr = now.toISOString().slice(0, 10);

        state.routines.forEach(routine => {
            // Check if routine is scheduled for today and the current minute
            if (routine.days.includes(currentDay) && routine.time === currentTimeStr && routine.reminder) {
                
                const uniqueId = `${routine.id}-${todayDateStr}`;
                
                // If we haven't already sent a notification for this specific routine today
                if (!notifiedToday.has(uniqueId)) {
                    
                    // Also check if it's already marked as completed in history
                    const historyForToday = state.history[todayDateStr] || [];
                    if (historyForToday.includes(routine.id)) {
                        return; // Already done, don't notify
                    }

                    sendNotification(routine);
                    notifiedToday.add(uniqueId);
                }
            }
        });

    } catch (err) {
        console.error('Error reading data file:', err.message);
    }
}

function sendNotification(routine) {
    console.log(`⏰ Sending notification for: ${routine.name}`);
    
    const message = `Time for: ${routine.icon} ${routine.name}\n${routine.notes ? 'Notes: ' + routine.notes : ''}`;
    
    const options = {
        hostname: 'ntfy.sh',
        path: `/${NTFY_TOPIC}`,
        method: 'POST',
        headers: {
            'Title': 'RoutineOS Reminder',
            'Tags': 'alarm_clock'
        }
    };

    const req = https.request(options, (res) => {
        if (res.statusCode === 200) {
            console.log(`✅ Notification sent successfully!`);
        } else {
            console.log(`⚠️ Failed to send notification. Status: ${res.statusCode}`);
        }
    });

    req.on('error', (e) => {
        console.error(`❌ Error sending notification: ${e.message}`);
    });

    req.write(message);
    req.end();
}

// Check every 30 seconds
setInterval(checkRoutines, 30000);
checkRoutines();

// Clear the "already notified" list at midnight
setInterval(() => {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
        notifiedToday.clear();
    }
}, 60000);
