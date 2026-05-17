-- ==========================================
-- FUNCIÓN: resolver_partida (v2.1 - Calibración 3 partidas)
-- 
-- Ejecuta este SQL COMPLETO en el SQL Editor de Supabase (supabase.com -> Tu proyecto -> SQL Editor)
-- Reemplazará la función anterior con la nueva lógica de calibración.
--
-- LÓGICA DE MMR:
--   - Partidas 1, 2 y 3 (calibración): +60 MMR al ganar / -60 al perder
--   - Partida 4 en adelante (clasificado): entre +20 y +30 al ganar / entre -20 y -30 al perder
--     (el valor exacto varía según la diferencia de MMR de los equipos)
-- ==========================================

CREATE OR REPLACE FUNCTION resolver_partida(
    match_id_param INT,
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

        -- Leer games_played REAL desde profiles (no desde el snapshot del match)
        SELECT games_played, mmr INTO jugador.games_played, jugador.nivel
        FROM profiles WHERE id = jugador.id;

        -- Calcular el delta según fase de calibración
        IF jugador.games_played < PARTIDAS_CALIBRACION THEN
            delta := MMR_CALIBRACION;
        ELSE
            -- Delta aleatorio entre MIN y MAX para clasificados
            delta := MMR_CLASIFICADO_MIN + floor(random() * (MMR_CLASIFICADO_MAX - MMR_CLASIFICADO_MIN + 1))::INT;
        END IF;

        -- Aplicar el delta (positivo si ganó, negativo si perdió)
        IF es_ganador THEN
            nuevo_mmr := GREATEST(0, jugador.nivel + delta);
        ELSE
            nuevo_mmr := GREATEST(0, jugador.nivel - delta);
        END IF;

        -- Actualizar el perfil del jugador
        UPDATE profiles
        SET mmr          = nuevo_mmr,
            games_played = games_played + 1
        WHERE id = jugador.id;
    END LOOP;

    -- 4. Procesar equipo BRAVO (Infectados)
    FOR jugador IN SELECT * FROM jsonb_to_recordset(partida.team_bravo) AS t(id UUID, nombre TEXT, nivel INT, games_played INT, personaje TEXT, is_ready BOOLEAN)
    LOOP
        -- Determinar si este jugador ganó
        es_ganador := (ganador_param = 'Infectados');

        -- Leer games_played REAL desde profiles
        SELECT games_played, mmr INTO jugador.games_played, jugador.nivel
        FROM profiles WHERE id = jugador.id;

        -- Calcular el delta según fase de calibración
        IF jugador.games_played < PARTIDAS_CALIBRACION THEN
            delta := MMR_CALIBRACION;
        ELSE
            delta := MMR_CLASIFICADO_MIN + floor(random() * (MMR_CLASIFICADO_MAX - MMR_CLASIFICADO_MIN + 1))::INT;
        END IF;

        -- Aplicar el delta
        IF es_ganador THEN
            nuevo_mmr := GREATEST(0, jugador.nivel + delta);
        ELSE
            nuevo_mmr := GREATEST(0, jugador.nivel - delta);
        END IF;

        -- Actualizar el perfil del jugador
        UPDATE profiles
        SET mmr          = nuevo_mmr,
            games_played = games_played + 1
        WHERE id = jugador.id;
    END LOOP;

END;
$$;

-- Confirmar que se creó correctamente
SELECT 'Función resolver_partida v2.1 instalada correctamente. Calibración: 3 partidas +/-60 MMR. Clasificados: +/-20 a 30 MMR.' AS resultado;
