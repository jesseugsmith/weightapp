// PocketBase JavaScript hooks for FitClash weight tracking app
// This file contains event hooks that automatically handle profile creation
// and other user-related setup when records are created.
console.log("PocketBase hooks loading...")
// Hook to automatically create user profile and assign default role when a new user is created
onRecordAfterCreateSuccess((e) => {
    // Only process user records from the auth collection
    if (e.record.collection().name !== "users") {
        return
    }

    console.log(`New user created: ${e.record.id} - ${e.record.email()}`)

    try {
        // Get the default user role (assuming "user" role exists)
        const userRole = $app.dao().findFirstRecordByFilter(
            "roles", 
            "name = 'user'"
        )


        if (userRole) {
            // Create user role assignment
            const userRoleRecord = new Record($app.dao().findCollectionByNameOrId("user_roles"))
            userRoleRecord.set("user_id", e.record.id)
            userRoleRecord.set("role_id", userRole.id)
            userRoleRecord.set("created_by", e.record.id) // Self-assigned for new users
            
            $app.dao().saveRecord(userRoleRecord)
            console.log(`Assigned default role to user: ${e.record.id}`)
        } else {
            console.warn("Default 'user' role not found. User role assignment skipped.")
        }

        // You can add additional profile setup here, such as:
        // - Creating initial notification preferences
        // - Setting up default user settings
        // - Creating welcome notifications

        const profile = new Record($app.dao().findCollectionByNameOrId("Profiles"))
        profile.set("user_id", e.record.id)
        profile.set("display_name", e.record.email().split("@")[0]) // Default display name from email
        profile.set("bio", "")
        profile.set("avatar_url", "")
        profile.set("created_by", e.record.id) // Self-created
        
        $app.dao().saveRecord(profile)
        console.log(`User profile created for user: ${e.record.id}`)



        // Example: Create a welcome notification
        const welcomeNotification = new Record($app.dao().findCollectionByNameOrId("notifications"))
        welcomeNotification.set("user_id", e.record.id)
        welcomeNotification.set("title", "Welcome to FitClash!")
        welcomeNotification.set("message", "Welcome to FitClash! Start your fitness journey by logging your first weight entry and joining competitions.")
        welcomeNotification.set("type", "general")
        welcomeNotification.set("read", false)
        
        $app.dao().saveRecord(welcomeNotification)
        console.log(`Welcome notification created for user: ${e.record.id}`)

    } catch (error) {
        console.error(`Error setting up profile for user ${e.record.id}:`, error)
        // Don't throw the error to avoid blocking user creation
        // The user will be created even if profile setup fails
    }
}, "users")

// Hook to handle user profile updates and maintain data consistency
onRecordAfterUpdateSuccess((e) => {
    if (e.record.collection().name !== "users") {
        return
    }

    console.log(`User updated: ${e.record.id} - ${e.record.email()}`)

    // You can add logic here to handle profile updates
    // For example, updating related records when user email changes
}, "users")

// Hook to clean up user-related data when a user is deleted
onRecordAfterDeleteSuccess((e) => {
    if (e.record.collection().name !== "users") {
        return
    }

    console.log(`User deleted: ${e.record.id}`)

    // Note: Most cleanup should be handled by cascade delete rules in the schema
    // This hook can be used for additional cleanup that can't be handled by cascading
    
    try {
        // Example: Log the user deletion for audit purposes
        console.log(`All related data for user ${e.record.id} should be cleaned up by cascade delete rules`)
    } catch (error) {
        console.error(`Error during user deletion cleanup:`, error)
    }
}, "users")

// Hook to automatically update competition participant statistics when weight entries are created
onRecordAfterCreateSuccess((e) => {
    if (e.record.collection().name !== "weight_entries") {
        return
    }

    console.log(`New weight entry created for user: ${e.record.get("user_id")}`)

    try {
        // Find active competition participations for this user
        const participations = $app.dao().findRecordsByFilter(
            "competition_participants",
            `user_id = '${e.record.get("user_id")}' && is_active = true`
        )

        participations.forEach((participation) => {
            // Update current weight in the participation record
            participation.set("current_weight", e.record.get("weight"))
            
            // Calculate weight change
            const startingWeight = participation.get("starting_weight")
            if (startingWeight && startingWeight > 0) {
                const currentWeight = e.record.get("weight")
                const weightChange = startingWeight - currentWeight
                const weightLossPercentage = (weightChange / startingWeight) * 100
                
                participation.set("weight_change", weightChange)
                participation.set("weight_change_percentage", weightLossPercentage)
            }

            $app.dao().saveRecord(participation)
            console.log(`Updated competition participation: ${participation.id}`)
            
            // Recalculate standings for this competition
            recalculateCompetitionStandings(participation.get("competition_id"))
        })

    } catch (error) {
        console.error(`Error updating competition participations:`, error)
    }
}, "weight_entries")

// Hook to set starting weight when a user joins a competition
onRecordAfterCreateSuccess((e) => {
    if (e.record.collection().name !== "competition_participants") {
        return
    }

    console.log(`User ${e.record.get("user_id")} joined competition ${e.record.get("competition_id")}`)

    try {
        // Get the user's most recent weight entry to set as starting weight
        const latestWeightEntry = $app.dao().findFirstRecordByFilter(
            "weight_entries",
            `user_id = '${e.record.get("user_id")}'`,
            "-created"
        )

        if (latestWeightEntry) {
            e.record.set("starting_weight", latestWeightEntry.get("weight"))
            e.record.set("current_weight", latestWeightEntry.get("weight"))
            $app.dao().saveRecord(e.record)
            console.log(`Set starting weight for competition participant: ${e.record.id}`)
        }

        // Create notification for successful competition join
        const notification = new Record($app.dao().findCollectionByNameOrId("notifications"))
        notification.set("user_id", e.record.get("user_id"))
        notification.set("title", "Competition Joined!")
        notification.set("message", "You've successfully joined a competition. Good luck!")
        notification.set("type", "competition_invite")
        notification.set("read", false)
        
        $app.dao().saveRecord(notification)

        // Recalculate standings for this competition since a new participant joined
        recalculateCompetitionStandings(e.record.get("competition_id"))

    } catch (error) {
        console.error(`Error setting up competition participation:`, error)
    }
}, "competition_participants")

// Function to recalculate competition standings
function recalculateCompetitionStandings(competitionId) {
    try {
        console.log(`Recalculating standings for competition: ${competitionId}`)
        
        // Get the competition details to determine ranking logic
        const competition = $app.dao().findRecordById("competitions", competitionId)
        if (!competition) {
            console.error(`Competition not found: ${competitionId}`)
            return
        }

        // Get all active participants for this competition
        const participants = $app.dao().findRecordsByFilter(
            "competition_participants",
            `competition_id = '${competitionId}' && is_active = true`
        )

        if (participants.length === 0) {
            console.log(`No active participants found for competition: ${competitionId}`)
            return
        }

        // Calculate rankings based on competition type
        const competitionType = competition.get("competition_type") || "weight_loss"
        const rankedParticipants = calculateRankings(participants, competitionType)

        // Update rank in participant records (since we're not using separate standings table)
        rankedParticipants.forEach((participant, index) => {
            participant.set("rank", index + 1)
            $app.dao().saveRecord(participant)
        })

        console.log(`Successfully updated standings for competition: ${competitionId}`)

    } catch (error) {
        console.error(`Error recalculating standings for competition ${competitionId}:`, error)
    }
}

// Function to calculate rankings based on competition type
function calculateRankings(participants, competitionType) {
    const validParticipants = participants.filter(p => {
        const startWeight = p.get("starting_weight")
        const currentWeight = p.get("current_weight")
        return startWeight && currentWeight && startWeight > 0
    })

    switch (competitionType) {
        case "weight_loss":
            // Higher weight loss percentage = better rank
            return validParticipants.sort((a, b) => {
                const aChange = a.get("weight_change_percentage") || 0
                const bChange = b.get("weight_change_percentage") || 0
                return bChange - aChange
            })
            
        case "weight_gain":
            // Higher weight gain percentage = better rank (negative weight loss)
            return validParticipants.sort((a, b) => {
                const aChange = a.get("weight_change_percentage") || 0
                const bChange = b.get("weight_change_percentage") || 0
                return aChange - bChange
            })
            
        case "body_fat_loss":
            // For now, same as weight loss - could be enhanced with body fat tracking
            return validParticipants.sort((a, b) => {
                const aChange = a.get("weight_change_percentage") || 0
                const bChange = b.get("weight_change_percentage") || 0
                return bChange - aChange
            })
            
        case "muscle_gain":
            // For now, same as weight gain - could be enhanced with muscle mass tracking
            return validParticipants.sort((a, b) => {
                const aChange = a.get("weight_change_percentage") || 0
                const bChange = b.get("weight_change_percentage") || 0
                return aChange - bChange
            })
            
        default:
            // Default to weight loss ranking
            return validParticipants.sort((a, b) => {
                const aChange = a.get("weight_change_percentage") || 0
                const bChange = b.get("weight_change_percentage") || 0
                return bChange - aChange
            })
    }
}

// Hook to recalculate standings when competition participants are updated
onRecordAfterUpdateSuccess((e) => {
    if (e.record.collection().name !== "competition_participants") {
        return
    }

    console.log(`Competition participant updated: ${e.record.id}`)

    try {
        // Recalculate standings for this competition
        recalculateCompetitionStandings(e.record.get("competition_id"))
    } catch (error) {
        console.error(`Error recalculating standings after participant update:`, error)
    }
}, "competition_participants")

// Function to recalculate competition standings
function recalculateCompetitionStandings(competitionId) {
    try {
        console.log(`Recalculating standings for competition: ${competitionId}`)
        
        // Get the competition details to determine ranking logic
        const competition = $app.dao().findRecordById("competitions", competitionId)
        if (!competition) {
            console.error(`Competition not found: ${competitionId}`)
            return
        }

        // Get all active participants for this competition
        const participants = $app.dao().findRecordsByFilter(
            "competition_participants",
            `competition_id = '${competitionId}' && is_active = true`
        )

        if (participants.length === 0) {
            console.log(`No active participants found for competition: ${competitionId}`)
            return
        }

        // Calculate rankings based on competition type
        const competitionType = competition.get("competition_type") || "weight_loss"
        const rankedParticipants = calculateRankings(participants, competitionType)

        // Clear existing current standings
        const existingStandings = $app.dao().findRecordsByFilter(
            "competition_standings",
            `competition_id = '${competitionId}' && is_current = true`
        )
        
        existingStandings.forEach((standing) => {
            standing.set("is_current", false)
            $app.dao().saveRecord(standing)
        })

        // Create new current standings
        rankedParticipants.forEach((participant, index) => {
            const standing = new Record($app.dao().findCollectionByNameOrId("competition_standings"))
            standing.set("competition_id", competitionId)
            standing.set("user_id", participant.get("user_id"))
            standing.set("rank", index + 1)
            standing.set("weight_change", participant.get("weight_change") || 0)
            standing.set("weight_change_percentage", participant.get("weight_change_percentage") || 0)
            standing.set("calculated_at", new Date().toISOString())
            standing.set("is_current", true)
            
            // Get the user's last weight entry date
            try {
                const lastWeightEntry = $app.dao().findFirstRecordByFilter(
                    "weight_entries",
                    `user_id = '${participant.get("user_id")}'`,
                    "-created"
                )
                if (lastWeightEntry) {
                    standing.set("last_weight_entry", lastWeightEntry.get("date"))
                }
            } catch (error) {
                console.warn(`Could not find last weight entry for user: ${participant.get("user_id")}`)
            }

            $app.dao().saveRecord(standing)
        })

        console.log(`Successfully updated standings for competition: ${competitionId}`)

    } catch (error) {
        console.error(`Error recalculating standings for competition ${competitionId}:`, error)
    }
}

// Function to calculate rankings based on competition type
function calculateRankings(participants, competitionType) {
    const validParticipants = participants.filter(p => {
        const startWeight = p.get("starting_weight")
        const currentWeight = p.get("current_weight")
        return startWeight && currentWeight && startWeight > 0
    })

    switch (competitionType) {
        case "weight_loss":
            // Higher weight loss percentage = better rank
            return validParticipants.sort((a, b) => {
                const aChange = a.get("weight_change_percentage") || 0
                const bChange = b.get("weight_change_percentage") || 0
                return bChange - aChange
            })
            
        case "weight_gain":
            // Higher weight gain percentage = better rank (negative weight loss)
            return validParticipants.sort((a, b) => {
                const aChange = a.get("weight_change_percentage") || 0
                const bChange = b.get("weight_change_percentage") || 0
                return aChange - bChange
            })
            
        case "body_fat_loss":
            // For now, same as weight loss - could be enhanced with body fat tracking
            return validParticipants.sort((a, b) => {
                const aChange = a.get("weight_change_percentage") || 0
                const bChange = b.get("weight_change_percentage") || 0
                return bChange - aChange
            })
            
        case "muscle_gain":
            // For now, same as weight gain - could be enhanced with muscle mass tracking
            return validParticipants.sort((a, b) => {
                const aChange = a.get("weight_change_percentage") || 0
                const bChange = b.get("weight_change_percentage") || 0
                return aChange - bChange
            })
            
        default:
            // Default to weight loss ranking
            return validParticipants.sort((a, b) => {
                const aChange = a.get("weight_change_percentage") || 0
                const bChange = b.get("weight_change_percentage") || 0
                return bChange - aChange
            })
    }
}

// Hook to recalculate standings when competition participants are updated
onRecordAfterUpdateSuccess((e) => {
    if (e.record.collection().name !== "competition_participants") {
        return
    }

    console.log(`Competition participant updated: ${e.record.id}`)

    try {
        // Recalculate standings for this competition
        recalculateCompetitionStandings(e.record.get("competition_id"))
    } catch (error) {
        console.error(`Error recalculating standings after participant update:`, error)
    }
}, "competition_participants")

console.log("PocketBase hooks loaded successfully!")
