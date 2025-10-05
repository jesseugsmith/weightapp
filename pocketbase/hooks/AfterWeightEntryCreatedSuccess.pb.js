console.log("HOOKS: AfterWeightEntryCreatedSuccess.js loading");
onRecordAfterCreateSuccess((e) => {

    console.log(`New weight entry created for users: ${e.record.get("user_id")}`)
    try {
        // Find active competition participations for this user
        const participations = $app.findRecordsByFilter(
            "competition_participants",
            `user_id = '${e.record.get("user_id")}' && is_active = true`
        )

        participations.forEach((participation) => {
            // Update current weight in the participation record
            participation.get("starting_weight") || participation.set("starting_weight", e.record.get("weight"))
            participation.set("current_weight", e.record.get("weight"))
            
            // Calculate weight change
            const startingWeight = participation.get("starting_weight")
            if (startingWeight && startingWeight > 0) {
                const currentWeight = e.record.get("weight")
                const weightChange = startingWeight - currentWeight
                const weightLossPercentage = (weightChange / startingWeight) * 100
                console.log(`User ${participation.get("user_id")} - Starting Weight: ${startingWeight}, Current Weight: ${currentWeight}, Weight Change: ${weightChange}, Weight Loss %: ${weightLossPercentage.toFixed(2)}%`)
                participation.set("weight_change", weightChange)
                participation.set("weight_change_percentage", weightLossPercentage)
            }

            $app.save(participation)
            console.log(`Updated competition participation: ${participation.id}`)
        })

    } catch (error) {
        console.error(`Error updating competition participations:`, error)
    }
}, "weight_entries")





console.log("HOOKS: AfterWeightEntryCreatedSuccess.js loaded");
