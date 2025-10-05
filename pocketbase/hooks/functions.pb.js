console.log("HOOKS: RoutersAdded loading");



// register "POST /api/myapp/settings" route (allowed only for authenticated users)
routerAdd("POST", "/api/competitions/start/{compId}", (e) => {

function startCompetition(competitionId) {
    console.log(`Starting competition: ${competitionId}`)
    try {
        const competition = $app.findRecordById("competitions", competitionId)
        if (!competition) {
            console.error(`Competition not found: ${competitionId}`)
            return { success: false, message: "Competition not found" }
        }

        if (competition.get("is_active")) {
            return { success: false, message: "Competition is already active" }
        }

        // Activate the competition
        competition.set("is_active", true)
        competition.set("status", "started")
        competition.set("start_date", new Date().toISOString())
        $app.save(competition)

        // Activate all participants
        const participants = $app.findRecordsByFilter(
            "competition_participants",
            `competition_id = '${competitionId}'`
        )

        participants.forEach((participant) => {
            participant.set("is_active", true)
            $app.save(participant)
        })

        console.log(`Competition started: ${competitionId} with ${participants.length} participants`)
        return { success: true, message: "Competition started successfully" }

    } catch (error) {
        console.error(`Error starting competition ${competitionId}:`, error)
        return { success: false, message: "Error starting competition" }
    }
}
    try {
        console.log("Received request to start competition");
        let compId = e.request.pathValue("compId")
        let result = startCompetition(compId)
        return e.json(200, result)
    } catch (error) {
        console.error("Error in /api/competition/start/{compId} route:", error);
        return e.json(500, { success: false, message: "Internal server error" });
    }


}, $apis.requireAuth())


console.log("HOOKS: RoutersAdded loaded");
