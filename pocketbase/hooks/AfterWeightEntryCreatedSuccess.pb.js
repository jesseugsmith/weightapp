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

    // --- Novu email notification ---
    try {
        const userId = e.record.get("user_id") || e.record.get("user");
        const weight = e.record.get("weight");
        const date = e.record.get("date");
        const unit = e.record.get("unit") || "lbs";

        // Get user profile for first/last name (optional)
        let firstName = "";
        let lastName = "";
        try {
            const profile = $app.findFirstRecordByFilter(
                "profiles",
                `user = "${userId}"`
            );
            if (profile) {
                firstName = profile.get("firstName") || "";
                lastName = profile.get("lastName") || "";
            }
        } catch (err) {
            // Profile lookup failed, continue without names
        }

        const novuApiKey = process.env.NOVU_API_KEY || "";
        const response = $http.send({
            url: "https://api.novu.co/v2/events/trigger",
            method: "POST",
            headers: {
                "Authorization": `ApiKey ${novuApiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                workflowId: "weight-entry-logged",
                to: { subscriberId: userId },
                payload: {
                    weight,
                    date,
                    unit,
                    firstName,
                    lastName
                }
            })
        });

        if (response.statusCode === 200 || response.statusCode === 201) {
            console.log("✅ Email notification sent for weight entry:", userId);
        } else {
            console.error("❌ Failed to send email notification:", response.raw);
        }
    } catch (err) {
        console.error("❌ Error sending Novu email notification:", err);
    }
}, "weight_entries")





console.log("HOOKS: AfterWeightEntryCreatedSuccess.js loaded");
