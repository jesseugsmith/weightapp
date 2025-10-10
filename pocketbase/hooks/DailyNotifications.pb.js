// Daily Notifications Cron Hook for FitClash
// This hook sends daily email/push notifications to all competition participants
// Runs every day at 9 AM to remind users to log their weight

/**
 * Send notification via Novu
 * @param {string} userId - The PocketBase user ID
 * @param {string} subscriberId - The Novu subscriber ID (can be same as userId)
 * @param {string} email - User's email
 * @param {object} notificationData - Notification payload
 */
function sendNovuNotification(userId, subscriberId, email, notificationData) {
    try {
        // Get Novu API key from app settings or environment
        const novuApiKey = $app.settings().meta.novuApiKey || process.env.NOVU_API_KEY;
        
        if (!novuApiKey) {
            console.error('Novu API key not configured');
            return false;
        }

        // Novu API endpoint
        const novuUrl = 'https://api.novu.co/v1/events/trigger';
        
        const payload = {
            name: notificationData.workflowId || 'daily-competition-reminder',
            to: {
                subscriberId: subscriberId,
                email: email,
                // Optional: add other subscriber fields
                firstName: notificationData.firstName || '',
                lastName: notificationData.lastName || ''
            },
            payload: {
                title: notificationData.title,
                message: notificationData.message,
                competitionName: notificationData.competitionName || '',
                competitionId: notificationData.competitionId || '',
                rank: notificationData.rank || 0,
                weightChange: notificationData.weightChange || 0,
                daysRemaining: notificationData.daysRemaining || 0,
                actionUrl: notificationData.actionUrl || ''
            }
        };

        // Make HTTP request to Novu
        const res = $http.send({
            url: novuUrl,
            method: 'POST',
            headers: {
                'Authorization': `ApiKey ${novuApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            timeout: 30 // 30 seconds timeout
        });

        if (res.statusCode === 200 || res.statusCode === 201) {
            console.log(`✓ Novu notification sent to ${email} for competition ${notificationData.competitionName}`);
            return true;
        } else {
            console.error(`✗ Novu notification failed for ${email}: ${res.statusCode} - ${res.raw}`);
            return false;
        }
    } catch (error) {
        console.error(`Error sending Novu notification to ${email}:`, error);
        return false;
    }
}

/**
 * Calculate days remaining in competition
 */
function getDaysRemaining(endDate) {
    const now = new Date();
    const end = new Date(endDate);
    const diffTime = end - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
}

/**
 * Get user's current rank in competition
 */
function getUserRank(userId, competitionId) {
    try {
        const participant = $app.dao().findFirstRecordByFilter(
            "competition_participants",
            `user_id = '${userId}' && competition_id = '${competitionId}'`
        );
        
        return participant ? participant.get("rank") || 0 : 0;
    } catch (error) {
        console.error(`Error getting rank for user ${userId}:`, error);
        return 0;
    }
}

/**
 * Get user's weight change in competition
 */
function getWeightChange(userId, competitionId) {
    try {
        const participant = $app.dao().findFirstRecordByFilter(
            "competition_participants",
            `user_id = '${userId}' && competition_id = '${competitionId}'`
        );
        
        return participant ? (participant.get("weight_change") || 0) : 0;
    } catch (error) {
        console.error(`Error getting weight change for user ${userId}:`, error);
        return 0;
    }
}

/**
 * Check if user has logged weight today
 */
function hasLoggedWeightToday(userId) {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();
        
        const entry = $app.dao().findFirstRecordByFilter(
            "weight_entries",
            `user_id = '${userId}' && date >= '${todayISO}'`,
            "-date"
        );
        
        return entry !== null;
    } catch (error) {
        console.error(`Error checking weight log for user ${userId}:`, error);
        return false;
    }
}

/**
 * Main function to send daily notifications
 */
function sendDailyNotifications() {
    console.log('=== Starting Daily Notifications Cron Job ===');
    console.log(`Time: ${new Date().toISOString()}`);
    
    let totalSent = 0;
    let totalFailed = 0;
    let competitionsProcessed = 0;
    
    try {
        // Get all active competitions
        const now = new Date().toISOString();
        const activeCompetitions = $app.dao().findRecordsByFilter(
            "competitions",
            `status = "active" && start_date <= "${now}" && end_date >= "${now}"`
        );
        
        console.log(`Found ${activeCompetitions.length} active competitions`);
        
        activeCompetitions.forEach((competition) => {
            try {
                competitionsProcessed++;
                const competitionId = competition.id;
                const competitionName = competition.get("name") || "Competition";
                const endDate = competition.get("end_date");
                const daysRemaining = getDaysRemaining(endDate);
                
                console.log(`\nProcessing competition: ${competitionName} (${daysRemaining} days remaining)`);
                
                // Get all active participants for this competition
                const participants = $app.dao().findRecordsByFilter(
                    "competition_participants",
                    `competition_id = '${competitionId}' && is_active = true`
                );
                
                console.log(`  Found ${participants.length} participants`);
                
                participants.forEach((participant) => {
                    try {
                        const userId = participant.get("user_id");
                        
                        // Get user details
                        const user = $app.dao().findRecordById("users", userId);
                        if (!user) {
                            console.warn(`  User not found: ${userId}`);
                            return;
                        }
                        
                        const userEmail = user.email();
                        
                        // Get user profile for additional info
                        let firstName = '';
                        let lastName = '';
                        try {
                            const profile = $app.dao().findFirstRecordByFilter(
                                "profiles",
                                `user_id = '${userId}'`
                            );
                            if (profile) {
                                firstName = profile.get("first_name") || '';
                                lastName = profile.get("last_name") || '';
                            }
                        } catch (e) {
                            // Profile might not exist
                        }
                        
                        // Check if user has logged weight today
                        const hasLogged = hasLoggedWeightToday(userId);
                        
                        // Get user's current stats
                        const rank = getUserRank(userId, competitionId);
                        const weightChange = getWeightChange(userId, competitionId);
                        
                        // Determine notification message based on context
                        let title = '';
                        let message = '';
                        let workflowId = 'daily-competition-reminder';
                        
                        if (!hasLogged) {
                            // Reminder to log weight
                            title = `Don't forget to log your weight today! 📊`;
                            message = `Stay on track with "${competitionName}". Log your weight to maintain your progress. ${daysRemaining} days remaining!`;
                        } else {
                            // Daily progress update
                            title = `Your daily progress in ${competitionName} 🏆`;
                            message = `Great job logging your weight today! You're currently ranked #${rank} with ${Math.abs(weightChange).toFixed(1)} lbs ${weightChange < 0 ? 'lost' : 'gained'}. Keep it up!`;
                            workflowId = 'daily-progress-update';
                        }
                        
                        // Add urgency for competitions ending soon
                        if (daysRemaining <= 3 && daysRemaining > 0) {
                            message += ` ⚠️ Only ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left!`;
                        }
                        
                        // Prepare notification data
                        const notificationData = {
                            workflowId: workflowId,
                            title: title,
                            message: message,
                            competitionName: competitionName,
                            competitionId: competitionId,
                            rank: rank,
                            weightChange: weightChange,
                            daysRemaining: daysRemaining,
                            actionUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/competitions/${competitionId}`,
                            firstName: firstName,
                            lastName: lastName
                        };
                        
                        // Send notification via Novu
                        const success = sendNovuNotification(userId, userId, userEmail, notificationData);
                        
                        if (success) {
                            totalSent++;
                            
                            // Also create in-app notification in PocketBase
                            try {
                                const notification = new Record($app.dao().findCollectionByNameOrId("notifications"));
                                notification.set("user_id", userId);
                                notification.set("title", title);
                                notification.set("message", message);
                                notification.set("type", hasLogged ? "general" : "competition_started");
                                notification.set("read", false);
                                notification.set("action_url", notificationData.actionUrl);
                                
                                $app.dao().saveRecord(notification);
                            } catch (notifError) {
                                console.warn(`  Could not create in-app notification: ${notifError}`);
                            }
                        } else {
                            totalFailed++;
                        }
                        
                    } catch (participantError) {
                        console.error(`  Error processing participant:`, participantError);
                        totalFailed++;
                    }
                });
                
            } catch (compError) {
                console.error(`Error processing competition:`, compError);
            }
        });
        
        console.log('\n=== Daily Notifications Summary ===');
        console.log(`Competitions processed: ${competitionsProcessed}`);
        console.log(`Notifications sent: ${totalSent}`);
        console.log(`Notifications failed: ${totalFailed}`);
        console.log('=====================================\n');
        
    } catch (error) {
        console.error('Error in daily notifications cron job:', error);
    }
}

// Register the cron job to run daily at 9:00 AM
// Cron format: "0 9 * * *" = At 09:00 AM every day
// Adjust the time as needed (24-hour format)
cronAdd("daily-notifications", "0 9 * * *", () => {
    sendDailyNotifications();
});

console.log('✓ Daily notifications cron job registered (runs at 9:00 AM daily)');
