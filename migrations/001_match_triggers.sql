-- Migration: Add triggers for setting current_turn_player_id on matches table
-- This replaces the JavaScript logic in match-lifecycle.ts

-- Function to get current player ID from game state
CREATE OR REPLACE FUNCTION get_current_player_id_for_match(match_id TEXT)
RETURNS TEXT AS $$
DECLARE
    current_player TEXT;
    player0_id TEXT;
    player1_id TEXT;
    result_player_id TEXT;
BEGIN
    -- Get the current player from the game state
    SELECT ctx->>'currentPlayer' INTO current_player
    FROM "Games"
    WHERE match_id = $1;
    
    -- Get player IDs from matches table
    SELECT m.player0_id, m.player1_id INTO player0_id, player1_id
    FROM matches m
    WHERE m.id = $1;
    
    -- Map current player to actual player ID
    IF current_player = '0' THEN
        result_player_id := player0_id;
    ELSIF current_player = '1' THEN
        result_player_id := player1_id;
    ELSE
        result_player_id := NULL;
    END IF;
    
    RETURN result_player_id;
END;
$$ LANGUAGE plpgsql;

-- Function to set current_turn_player_id on match insert
CREATE OR REPLACE FUNCTION set_current_turn_player_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- Set current_turn_player_id to player0_id by default (player 0 starts first)
    NEW.current_turn_player_id := NEW.player0_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update current_turn_player_id when game state changes
CREATE OR REPLACE FUNCTION update_current_turn_player_id_on_state_change()
RETURNS TRIGGER AS $$
DECLARE
    new_current_player_id TEXT;
BEGIN
    -- Only update if this is a state change (not metadata or other changes)
    IF NEW.state IS NOT NULL AND OLD.state IS NOT NULL THEN
        -- Get the new current player ID based on the updated state
        new_current_player_id := get_current_player_id_for_match(NEW.match_id);
        
        -- Update the matches table with the new current turn player
        IF new_current_player_id IS NOT NULL THEN
            UPDATE matches 
            SET current_turn_player_id = new_current_player_id
            WHERE id = NEW.match_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for match insert
DROP TRIGGER IF EXISTS trigger_set_current_turn_player_id_on_insert ON matches;
CREATE TRIGGER trigger_set_current_turn_player_id_on_insert
    BEFORE INSERT ON matches
    FOR EACH ROW
    EXECUTE FUNCTION set_current_turn_player_id_on_insert();

-- Create trigger for game state changes
DROP TRIGGER IF EXISTS trigger_update_current_turn_player_id_on_state_change ON "Games";
CREATE TRIGGER trigger_update_current_turn_player_id_on_state_change
    AFTER UPDATE ON "Games"
    FOR EACH ROW
    EXECUTE FUNCTION update_current_turn_player_id_on_state_change(); 
