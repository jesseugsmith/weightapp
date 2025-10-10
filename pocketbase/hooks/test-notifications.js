// Manual Test Script for Daily Notifications
// This script can be run from PocketBase admin console to test notifications
// Go to: PocketBase Admin -> Logs -> Run JS

/**
 * Test the daily notifications system
 * Usage: Run this in PocketBase admin console
 */

(function testDailyNotifications() {
    console.log('=== Testing Daily Notifications System ===');
    
    try {
        // 1. Check for active competitions
        const now = new Date().toISOString();
        const activeCompetitions = $app.dao().findRecordsByFilter(
            "competitions",
            `status = "active" && start_date <= "${now}" && end_date >= "${now}"`
        );
        
        console.log(`✓ Found ${activeCompetitions.length} active competitions`);
        
        if (activeCompetitions.length === 0) {
            console.log('\n⚠️  No active competitions found.');
            console.log('Create a test competition with:');
            console.log('  - status: "active"');
            console.log('  - start_date: today or earlier');
            console.log('  - end_date: future date');
            return;
        }
        
        // 2. Check first competition's participants
        const testCompetition = activeCompetitions[0];
        console.log(`\n✓ Testing with competition: "${testCompetition.get('name')}"`);
        
        const participants = $app.dao().findRecordsByFilter(
            "competition_participants",
            `competition_id = '${testCompetition.id}' && is_active = true`
        );
        
        console.log(`✓ Found ${participants.length} active participants`);
        
        if (participants.length === 0) {
            console.log('\n⚠️  No participants in this competition.');
            console.log('Join the competition as a test user first.');
            return;
        }
        
        // 3. Test with first participant
        const testParticipant = participants[0];
        const userId = testParticipant.get('user_id');
        
        const user = $app.dao().findRecordById('users', userId);
        console.log(`\n✓ Testing with user: ${user.email()}`);
        
        // 4. Check if user has logged weight today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();
        
        const todayEntry = $app.dao().findFirstRecordByFilter(
            "weight_entries",
            `user_id = '${userId}' && date >= '${todayISO}'`,
            "-date"
        );
        
        const hasLoggedToday = todayEntry !== null;
        console.log(`✓ Has logged weight today: ${hasLoggedToday}`);
        
        // 5. Get user stats
        const rank = testParticipant.get('rank') || 0;
        const weightChange = testParticipant.get('weight_change') || 0;
        
        const endDate = testCompetition.get('end_date');
        const end = new Date(endDate);
        const diffTime = end - new Date();
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        console.log(`✓ User rank: #${rank}`);
        console.log(`✓ Weight change: ${weightChange} lbs`);
        console.log(`✓ Days remaining: ${daysRemaining}`);
        
        // 6. Check Novu configuration
        const novuApiKey = $app.settings().meta.novuApiKey || process.env.NOVU_API_KEY;
        
        if (!novuApiKey) {
            console.log('\n❌ NOVU_API_KEY not configured!');
            console.log('Set it in PocketBase Admin -> Settings -> Meta (novuApiKey)');
            console.log('Or as an environment variable: NOVU_API_KEY');
            return;
        }
        
        console.log('✓ Novu API key is configured');
        
        // 7. Test notification payload
        const notificationTitle = hasLoggedToday 
            ? `Your daily progress in ${testCompetition.get('name')} 🏆`
            : `Don't forget to log your weight today! 📊`;
            
        const notificationMessage = hasLoggedToday
            ? `Great job logging your weight today! You're currently ranked #${rank} with ${Math.abs(weightChange).toFixed(1)} lbs ${weightChange < 0 ? 'lost' : 'gained'}.`
            : `Stay on track with "${testCompetition.get('name')}". Log your weight to maintain your progress. ${daysRemaining} days remaining!`;
        
        console.log('\n=== Test Notification Payload ===');
        console.log(`To: ${user.email()}`);
        console.log(`Workflow: ${hasLoggedToday ? 'daily-progress-update' : 'daily-competition-reminder'}`);
        console.log(`Title: ${notificationTitle}`);
        console.log(`Message: ${notificationMessage}`);
        console.log('===============================\n');
        
        // 8. Create in-app notification (test)
        try {
            const notification = new Record($app.dao().findCollectionByNameOrId("notifications"));
            notification.set("user_id", userId);
            notification.set("title", "[TEST] " + notificationTitle);
            notification.set("message", notificationMessage);
            notification.set("type", hasLoggedToday ? "general" : "competition_started");
            notification.set("read", false);
            notification.set("action_url", `/competitions/${testCompetition.id}`);
            
            $app.dao().saveRecord(notification);
            console.log('✓ Created test in-app notification');
        } catch (error) {
            console.log('❌ Failed to create in-app notification:', error);
        }
        
        console.log('\n=== Test Summary ===');
        console.log('✅ All checks passed!');
        console.log('\nNext steps:');
        console.log('1. Check the test in-app notification in your app');
        console.log('2. Set up Novu workflows (see docs/NOVU_WORKFLOWS.md)');
        console.log('3. The cron will run automatically at 9:00 AM daily');
        console.log('4. To test Novu integration, manually trigger from cron or wait for scheduled run');
        console.log('===================\n');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.log('\nTroubleshooting:');
        console.log('1. Ensure you have at least one active competition');
        console.log('2. Ensure you have joined a competition as a user');
        console.log('3. Check that all collections exist (users, competitions, competition_participants, weight_entries, notifications)');
    }
})();
