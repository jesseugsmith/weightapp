-- Add current_weight column to competition_participants table
ALTER TABLE competition_participants 
ADD COLUMN IF NOT EXISTS current_weight decimal;

-- Update existing competition_participants with their current weights
WITH latest_weights AS (
  SELECT DISTINCT ON (cp.user_id, cp.competition_id) 
    cp.user_id,
    cp.competition_id,
    w.weight,
    w.date
  FROM competition_participants cp
  JOIN competitions c ON c.id = cp.competition_id
  LEFT JOIN weight_entries w ON w.user_id = cp.user_id
  WHERE w.date <= LEAST(c.end_date, NOW())
  AND w.date >= c.start_date
  ORDER BY cp.user_id, cp.competition_id, w.date DESC
)
UPDATE competition_participants cp
SET current_weight = lw.weight
FROM latest_weights lw
WHERE cp.user_id = lw.user_id
AND cp.competition_id = lw.competition_id;
