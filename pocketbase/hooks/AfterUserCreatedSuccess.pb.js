console.log("HOOKS: AfterUserCreatedSuccess.js loading");



onRecordAfterCreateSuccess((e) => {
    // Only process user records from the auth collection
    if (e.record.collection().name !== "users") {
        return
    }
    


    console.log(`New user created: ${e.record.id} - ${e.record.email()}`)

    try {
        console.log("HOOKS: Assigning default role to new user");
        // Get the default user role (assuming "user" role exists)
        const userRole = $app.findFirstRecordByFilter(
            "roles", 
            "name = 'user'"
        )
        console.log(`HOOKS: Default user role found: ${userRole ? userRole.id : 'none'}`);
        if (userRole) {
            // Create user role assignment
            const userRoleRecord = new Record($app.findCollectionByNameOrId("user_roles"))
            userRoleRecord.set("user_id", e.record.id)
            userRoleRecord.set("role_id", userRole.id)
            userRoleRecord.set("created_by", e.record.id)
            
            $app.save(userRoleRecord)
            console.log(`Assigned default role to user: ${e.record.id}`)
        }
        console.log("HOOKS: Creating profile for new users");
        const profile = new Record($app.findCollectionByNameOrId("profiles"))
        profile.set("user_id", e.record.id)
        
        $app.save(profile)
        console.log(`User profile created for user: ${e.record.id}`)

    } catch (error) {
        console.error(`Error setting up profile for user ${e.record.id}:`, error)
    }
}, "users")


console.log("HOOKS: AfterUserCreatedSuccess.js loaded");