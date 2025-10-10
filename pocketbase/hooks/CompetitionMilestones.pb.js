// Additional Notification Hooks for Competition Events
// This file adds notifications for competition milestones

/**
 * Send notification when competition is ending soon (3 days before)
 * This runs as part of the daily cron
 */
function sendCompetitionEndingNotifications() {
    console.log('Checking for competitions ending soon...');
    
    try {
        const now = new Date();
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(now.getDate() + 3);
        threeDaysFromNow.setHours(23, 59, 59, 999);
        
        const fourDaysFromNow = new Date();
        fourDaysFromNow.setDate(now.getDate() + 4);
        fourDaysFromNow.setHours(0, 0, 0, 0);
        
        // Find competitions ending in exactly 3 days (give or take)
        const endingCompetitions = $app.dao().findRecordsByFilter(
            "competitions",
            `status = "active" && end_date >= "${threeDaysFromNow.toISOString()}" && end_date < "${fourDaysFromNow.toISOString()}"`
        );
        
        console.log(`Found ${endingCompetitions.length} competitions ending in 3 days`);
        
        endingCompetitions.forEach((competition) => {
            const competitionId = competition.id;
            const competitionName = competition.get("name") || "Competition";
            
            // Get all participants
            const participants = $app.dao().findRecordsByFilter(
                "competition_participants",
                `competition_id = '${competitionId}' && is_active = true`
            );
            
            console.log(`  Notifying ${participants.length} participants of ${competitionName}`);
            
            participants.forEach((participant) => {
                try {
                    const userId = participant.get("user_id");
                    const user = $app.dao().findRecordById("users", userId);
                    
                    if (!user) return;
                    
                    const rank = participant.get("rank") || 0;
                    const weightChange = participant.get("weight_change") || 0;
                    
                    // Get Novu API key
                    const novuApiKey = $app.settings().meta.novuApiKey || process.env.NOVU_API_KEY;
                    
                    if (novuApiKey) {
                        // Get user profile for name
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
                        } catch (e) {}
                        
                        // Send via Novu
                        const payload = {
                            name: 'competition-ending-soon',
                            to: {
                                subscriberId: userId,
                                email: user.email(),
                                firstName: firstName,
                                lastName: lastName
                            },
                            payload: {
                                title: `⚠️ ${competitionName} ends in 3 days!`,
                                message: `Final push! ${competitionName} ends in 3 days. You're currently ranked #${rank}. Make every day count!`,
                                competitionName: competitionName,
                                competitionId: competitionId,
                                rank: rank,
                                weightChange: weightChange,
                                daysRemaining: 3,
                                actionUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/competitions/${competitionId}`
                            }
                        };
                        
                        const res = $http.send({
                            url: 'https://api.novu.co/v1/events/trigger',
                            method: 'POST',
                            headers: {
                                'Authorization': `ApiKey ${novuApiKey}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(payload),
                            timeout: 30
                        });
                        
                        if (res.statusCode === 200 || res.statusCode === 201) {
                            console.log(`    ✓ Sent ending notification to ${user.email()}`);
                        }
                    }
                    
                    // Create in-app notification
                    const notification = new Record($app.dao().findCollectionByNameOrId("notifications"));
                    notification.set("user_id", userId);
                    notification.set("title", `⚠️ ${competitionName} ends in 3 days!`);
                    notification.set("message", `Final push! Make every day count. You're currently ranked #${rank}.`);
                    notification.set("type", "competition_ended");
                    notification.set("read", false);
                    notification.set("action_url", `/competitions/${competitionId}`);
                    
                    $app.dao().saveRecord(notification);
                    
                } catch (error) {
                    console.error(`    Error notifying participant:`, error);
                }
            });
        });
        
    } catch (error) {
        console.error('Error in competition ending notifications:', error);
    }
}

/**
 * Send notification when competition starts
 * This hook triggers when a competition status changes to "active"
 */
onRecordAfterUpdateSuccess((e) => {
    if (e.record.collection().name !== "competitions") {
        return;
    }
    
    // Check if status changed to "active"
    const newStatus = e.record.get("status");
    let oldStatus = null;
    
    try {
        oldStatus = e.record.originalCopy().get("status");
    } catch (error) {
        // If originalCopy is not available, we can't determine if status changed
        // so we'll just check if current status is "active" and proceed cautiously
        console.log("Could not get original status, proceeding with current status check");
    }
    
    // Only proceed if status is now "active" AND it wasn't before (or if we can't tell)
    if (newStatus === "active" && oldStatus !== "active") {
        console.log(`Competition "${e.record.get('name')}" just started!`);
        
        const competitionId = e.record.id;
        const competitionName = e.record.get("name") || "Competition";
        const endDate = e.record.get("end_date");
        
        try {
            // Get all participants
            const participants = $app.dao().findRecordsByFilter(
                "competition_participants",
                `competition_id = '${competitionId}' && is_active = true`
            );
            
            console.log(`Notifying ${participants.length} participants that competition started`);
            
            participants.forEach((participant) => {
                try {
                    const userId = participant.get("user_id");
                    const user = $app.dao().findRecordById("users", userId);
                    
                    if (!user) return;
                    
                    // Get Novu API key
                    const novuApiKey = $app.settings().meta.novuApiKey || process.env.NOVU_API_KEY;
                    
                    if (novuApiKey) {
                        // Get user profile
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
                        } catch (e) {}
                        
                        // Calculate duration
                        const start = new Date();
                        const end = new Date(endDate);
                        const durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
                        
                        // Send via Novu
                        const payload = {
                            name: 'competition-started',
                            to: {
                                subscriberId: userId,
                                email: user.email(),
                                firstName: firstName,
                                lastName: lastName
                            },
                            payload: {
                                title: `🚀 ${competitionName} has started!`,
                                message: `The competition has officially begun! You have ${durationDays} days to reach your goals. Log your starting weight now!`,
                                competitionName: competitionName,
                                competitionId: competitionId,
                                daysRemaining: durationDays,
                                actionUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/competitions/${competitionId}`
                            }
                        };
                        
                        $http.send({
                            url: 'https://api.novu.co/v1/events/trigger',
                            method: 'POST',
                            headers: {
                                'Authorization': `ApiKey ${novuApiKey}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(payload),
                            timeout: 30
                        });
                    }
                    
                    // Create in-app notification
                    const notification = new Record($app.dao().findCollectionByNameOrId("notifications"));
                    notification.set("user_id", userId);
                    notification.set("title", `🚀 ${competitionName} has started!`);
                    notification.set("message", "The competition has officially begun! Log your starting weight now and let's get started!");
                    notification.set("type", "competition_started");
                    notification.set("read", false);
                    notification.set("action_url", `/competitions/${competitionId}`);
                    
                    $app.dao().saveRecord(notification);
                    
                } catch (error) {
                    console.error(`Error notifying participant about competition start:`, error);
                }
            });
            
        } catch (error) {
            console.error('Error in competition started notifications:', error);
        }
    }
}, "competitions");

/**
 * Send notification when competition ends
 */
onRecordAfterUpdateSuccess((e) => {
    if (e.record.collection().name !== "competitions") {
        return;
    }
    
    // Check if status changed to "completed"
    const newStatus = e.record.get("status");
    let oldStatus = null;
    
    try {
        oldStatus = e.record.originalCopy().get("status");
    } catch (error) {
        // If originalCopy is not available, we can't determine if status changed
        console.log("Could not get original status, proceeding with current status check");
    }
    
    // Only proceed if status is now "completed" AND it wasn't before (or if we can't tell)
    if (newStatus === "completed" && oldStatus !== "completed") {
        console.log(`Competition "${e.record.get('name')}" just ended!`);
        
        const competitionId = e.record.id;
        const competitionName = e.record.get("name") || "Competition";
        
        try {
            // Get all participants with their final ranks
            const participants = $app.dao().findRecordsByFilter(
                "competition_participants",
                `competition_id = '${competitionId}' && is_active = true`,
                "+rank"
            );
            
            console.log(`Notifying ${participants.length} participants about competition end`);
            
            participants.forEach((participant, index) => {
                try {
                    const userId = participant.get("user_id");
                    const user = $app.dao().findRecordById("users", userId);
                    
                    if (!user) return;
                    
                    const rank = participant.get("rank") || (index + 1);
                    const weightChange = participant.get("weight_change") || 0;
                    
                    // Get Novu API key
                    const novuApiKey = $app.settings().meta.novuApiKey || process.env.NOVU_API_KEY;
                    
                    if (novuApiKey) {
                        // Get user profile
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
                        } catch (e) {}
                        
                        // Customize message based on rank
                        let congratsMessage = '';
                        if (rank === 1) {
                            congratsMessage = '🏆 Congratulations! You won 1st place! Amazing work!';
                        } else if (rank === 2) {
                            congratsMessage = '🥈 Great job! You finished in 2nd place!';
                        } else if (rank === 3) {
                            congratsMessage = '🥉 Well done! You finished in 3rd place!';
                        } else {
                            congratsMessage = `You finished in ${rank}${getRankSuffix(rank)} place. Great effort!`;
                        }
                        
                        // Send via Novu
                        const payload = {
                            name: 'competition-ended',
                            to: {
                                subscriberId: userId,
                                email: user.email(),
                                firstName: firstName,
                                lastName: lastName
                            },
                            payload: {
                                title: `🏁 ${competitionName} has ended!`,
                                message: `${congratsMessage} Your total change: ${Math.abs(weightChange).toFixed(1)} lbs ${weightChange < 0 ? 'lost' : 'gained'}.`,
                                competitionName: competitionName,
                                competitionId: competitionId,
                                rank: rank,
                                weightChange: weightChange,
                                actionUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/competitions/${competitionId}`
                            }
                        };
                        
                        $http.send({
                            url: 'https://api.novu.co/v1/events/trigger',
                            method: 'POST',
                            headers: {
                                'Authorization': `ApiKey ${novuApiKey}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(payload),
                            timeout: 30
                        });
                    }
                    
                    // Create in-app notification
                    const notification = new Record($app.dao().findCollectionByNameOrId("notifications"));
                    notification.set("user_id", userId);
                    notification.set("title", `🏁 ${competitionName} has ended!`);
                    notification.set("message", `You finished in ${rank}${getRankSuffix(rank)} place! Check out the final results.`);
                    notification.set("type", "competition_ended");
                    notification.set("read", false);
                    notification.set("action_url", `/competitions/${competitionId}`);
                    
                    $app.dao().saveRecord(notification);
                    
                } catch (error) {
                    console.error(`Error notifying participant about competition end:`, error);
                }
            });
            
        } catch (error) {
            console.error('Error in competition ended notifications:', error);
        }
    }
}, "competitions");

/**
 * Helper function to get rank suffix (st, nd, rd, th)
 */
function getRankSuffix(rank) {
    const j = rank % 10;
    const k = rank % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
}

// Add the ending soon check to the daily cron
cronAdd("competition-ending-check", "0 9 * * *", () => {
    sendCompetitionEndingNotifications();
});

console.log('✓ Competition milestone notifications registered');
