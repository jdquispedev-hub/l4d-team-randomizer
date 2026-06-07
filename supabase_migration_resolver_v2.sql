-- ==========================================
-- FUNCIÓN: resolver_partida (v2.2 - Calibración 3 partidas - Robusto)
-- 
-- Ejecuta este SQL COMPLETO en el SQL Editor de Supabase (supabase.com -> Tu proyecto -> SQL Editor)
-- Reemplazará la función anterior con la nueva lógica corregida y libre de errores de asignación.
--
-- LÓGICA DE MMR:
--   - Partidas 1, 2 y 3 (calibración): +60 MMR al ganar / -60 al perder
--   - Partida 4 en adelante (clasificado): entre +20 y +30 al ganar / entre -20 y -30 al perder
--     (el valor exacto varía según la diferencia de MMR de los equipos)
-- ==========================================

-- Eliminar funciones previas para evitar el error de ambigüedad (PGRST203)
DROP FUNCTION IF EXISTS resolver_partida(INT, TEXT);
DROP FUNCTION IF EXISTS resolver_partida(BIGINT, TEXT);

CREATE OR REPLACE FUNCTION resolver_partida(
    match_id_param BIGINT,
    ganador_param TEXT  -- 'Supervivientes' o 'Infectados'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    partida         RECORD;
    jugador         RECORD;
    delta           INT;
    nuevo_mmr       INT;
    es_ganador      BOOLEAN;

    -- Variables locales para evitar asignar sobre el record loop variable y resolver conflictos de nombres
    v_games_played  INT;
    v_nivel         INT;

    -- ===========================
    -- CONSTANTES DE MMR
    -- ===========================
    PARTIDAS_CALIBRACION  CONSTANT INT := 3;   -- Cuántas partidas dura la calibración
    MMR_CALIBRACION       CONSTANT INT := 60;  -- Delta fijo durante calibración
    MMR_CLASIFICADO_MIN   CONSTANT INT := 20;  -- Delta mínimo post-calibración
    MMR_CLASIFICADO_MAX   CONSTANT INT := 30;  -- Delta máximo post-calibración
BEGIN
    -- 1. Obtener la partida activa
    SELECT * INTO partida FROM matches WHERE id = match_id_param;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Partida % no encontrada', match_id_param;
    END IF;

    -- 2. Marcar la partida como finalizada con el ganador
    UPDATE matches
    SET status      = 'finished',
        winner_team = ganador_param
    WHERE id = match_id_param;

    -- 3. Procesar equipo ALFA (Supervivientes)
    FOR jugador IN SELECT * FROM jsonb_to_recordset(partida.team_alfa) AS t(id UUID, nombre TEXT, nivel INT, games_played INT, personaje TEXT, is_ready BOOLEAN)
    LOOP
        -- Determinar si este jugador ganó
        es_ganador := (ganador_param = 'Supervivientes');

        -- Leer games_played y mmr REALES desde profiles con fallback seguro
        SELECT COALESCE(games_played, 0), COALESCE(mmr, 1000) INTO v_games_played, v_nivel
        FROM profiles WHERE id = jugador.id;

        -- Evitar procesar si por alguna razón no se halló el perfil
        IF v_games_played IS NULL OR v_nivel IS NULL THEN
            CONTINUE;
        END IF;

        -- Calcular el delta según fase de calibración
        IF v_games_played < PARTIDAS_CALIBRACION THEN
            delta := MMR_CALIBRACION;
        ELSE
            -- Delta aleatorio entre MIN y MAX para clasificados
            delta := MMR_CLASIFICADO_MIN + floor(random() * (MMR_CLASIFICADO_MAX - MMR_CLASIFICADO_MIN + 1))::INT;
        END IF;

        -- Aplicar el delta (positivo si ganó, negativo si perdió)
        IF es_ganador THEN
            nuevo_mmr := GREATEST(0, v_nivel + delta);
        ELSE
            nuevo_mmr := GREATEST(0, v_nivel - delta);
        END IF;

        -- Actualizar el perfil del jugador incrementando sus partidas reales
        UPDATE profiles
        SET mmr          = nuevo_mmr,
            games_played = v_games_played + 1
        WHERE id = jugador.id;
    END LOOP;

    -- 4. Procesar equipo BRAVO (Infectados)
    FOR jugador IN SELECT * FROM jsonb_to_recordset(partida.team_bravo) AS t(id UUID, nombre TEXT, nivel INT, games_played INT, personaje TEXT, is_ready BOOLEAN)
    LOOP
        -- Determinar si este jugador ganó
        es_ganador := (ganador_param = 'Infectados');

        -- Leer games_played y mmr REALES desde profiles con fallback seguro
        SELECT COALESCE(games_played, 0), COALESCE(mmr, 1000) INTO v_games_played, v_nivel
        FROM profiles WHERE id = jugador.id;

        -- Evitar procesar si por alguna razón no se halló el perfil
        IF v_games_played IS NULL OR v_nivel IS NULL THEN
            CONTINUE;
        END IF;

        -- Calcular el delta según fase de calibración
        IF v_games_played < PARTIDAS_CALIBRACION THEN
            delta := MMR_CALIBRACION;
        ELSE
            delta := MMR_CLASIFICADO_MIN + floor(random() * (MMR_CLASIFICADO_MAX - MMR_CLASIFICADO_MIN + 1))::INT;
        END IF;

        -- Aplicar el delta
        IF es_ganador THEN
            nuevo_mmr := GREATEST(0, v_nivel + delta);
        ELSE
            nuevo_mmr := GREATEST(0, v_nivel - delta);
        END IF;

        -- Actualizar el perfil del jugador incrementando sus partidas reales
        UPDATE profiles
        SET mmr          = nuevo_mmr,
            games_played = v_games_played + 1
        WHERE id = jugador.id;
    END LOOP;

END;
$$;

-- Confirmar que se creó correctamente
SELECT 'Función resolver_partida v2.2 (Robusto) instalada correctamente. Calibración: 3 partidas +/-60 MMR. Clasificados: +/-20 a 30 MMR.' AS resultado;


-- ==========================================
-- FUNCIÓN: marcar_jugador_listo (Atomic ready check update)
-- Evita condiciones de carrera cuando múltiples jugadores confirman a la vez.
-- ==========================================
CREATE OR REPLACE FUNCTION marcar_jugador_listo(
    match_id_param BIGINT,
    user_id_param UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE matches
    SET 
        team_alfa = COALESCE(
            (
                SELECT jsonb_agg(
                    CASE 
                        WHEN (elem->>'id')::UUID = user_id_param THEN elem || '{"is_ready": true}'::jsonb
                        ELSE elem
                    END
                )
                FROM jsonb_array_elements(team_alfa) AS elem
            ),
            team_alfa
        ),
        team_bravo = COALESCE(
            (
                SELECT jsonb_agg(
                    CASE 
                        WHEN (elem->>'id')::UUID = user_id_param THEN elem || '{"is_ready": true}'::jsonb
                        ELSE elem
                    END
                )
                FROM jsonb_array_elements(team_bravo) AS elem
            ),
            team_bravo
        )
    WHERE id = match_id_param;
END;
$$;
