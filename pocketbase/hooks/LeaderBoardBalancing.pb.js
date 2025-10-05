console.log("LeaderBoardBalancing.pb.js loading");

// Cron job to run every 10 minutes and update all active competition rankings
cronAdd("Leaderboard Balancing", "*/10 * * * *", () => {
    console.log("🏆 Starting leaderboard balancing cron job...")
    
    // Function to calculate rankings based on competition type (defined inside handler)
    function calculateRankings(participants, competitionType) {
        console.log(`Calculating rankings for competition type: ${competitionType}`)
        console.log(`Participants count: ${participants.length}`)
        const validParticipants = participants;
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

    // Function to recalculate standings for a specific competition (defined inside handler)
    function recalculateCompetitionStandings(competitionId) {
        try {
            console.log(`Recalculating standings for competition: ${competitionId}`)
            
            // Get the competition details to determine ranking logic
            const competition = $app.findRecordById("competitions", competitionId)
            if (!competition) {
                console.error(`Competition not found: ${competitionId}`)
                return false
            }

            // Get all active participants for this competition
            const participants = $app.findRecordsByFilter(
                "competition_participants",
                `competition_id = '${competitionId}' && is_active = true`
            )


            if (participants.length === 0) {
                console.log(`No active participants found for competition: ${competitionId}`)
                return false
            }

            // Calculate rankings based on competition type
            const competitionType = competition.get("competition_type") || "weight_loss"
            const rankedParticipants = calculateRankings(participants, competitionType)
            console.log(`Ranked ${rankedParticipants.length} participants for competition: ${competitionId}`)
            // Update rank in participant records
            rankedParticipants.forEach((participant, index) => {
                participant.set("rank", index + 1)
                console.log(`Updating participant ${participant.id} to rank ${index}`)
                $app.save(participant)
            })

            console.log(`Successfully updated standings for competition: ${competitionId} (${rankedParticipants.length} participants ranked)`)
            return true

        } catch (error) {
            console.error(`Error recalculating standings for competition ${competitionId}:`, error)
            return false
        }
    }

    // Main cron job logic
    try {
        // Get all active competitions (started status)
        const activeCompetitions = $app.findRecordsByFilter(
            "competitions",
            `status = 'started'`
        )

        console.log(`Found ${activeCompetitions.length} active competitions to process`)

        if (activeCompetitions.length === 0) {
            console.log("No active competitions found - skipping ranking update")
            return
        }

        let successCount = 0
        let errorCount = 0

        // Loop through each active competition and recalculate rankings
        activeCompetitions.forEach((competition) => {
            console.log(`Processing competition: ${competition.get("name")} (${competition.id})`)
            
            const success = recalculateCompetitionStandings(competition.id)
            if (success) {
                successCount++
            } else {
                errorCount++
            }
        })

        console.log(`🏁 Leaderboard balancing completed: ${successCount} successful, ${errorCount} errors`)

    } catch (error) {
        console.error("❌ Error in leaderboard balancing cron job:", error)
    }
})

console.log("LeaderBoardBalancing.pb.js loaded");