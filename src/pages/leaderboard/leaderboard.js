import { supabase } from '../../js/supabase.js';

// ===== ESTADO LOCAL DEL LEADERBOARD =====
let listaCompletaJugadores = [];

// ===== AL CARGAR LA PÁGINA =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🏆 Iniciando Expediente del Salón de la Fama...");
    await inicializarLeaderboard();

    // Registrar evento de búsqueda
    const txtBuscador = document.getElementById('search-input');
    if (txtBuscador) {
        txtBuscador.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            filtrarYRenderizar(query);
        });
    }
});

// ===== MOTOR PRINCIPAL DE DATOS =====
async function inicializarLeaderboard() {
    try {
        // 1. Descargar TODOS los perfiles ordenados por MMR
        const { data: profiles, error: profErr } = await supabase
            .from('profiles')
            .select('*')
            .order('mmr', { ascending: false });

        if (profErr) throw profErr;
        if (!profiles) return;

        // 2. Descargar todas las partidas FINALIZADAS para procesar estadísticas de rendimiento
        const { data: matches, error: matchErr } = await supabase
            .from('matches')
            .select('id, created_at, team_alfa, team_bravo, winner_team')
            .eq('status', 'finished')
            .order('created_at', { ascending: false }); // Orden cronológico inverso para rachas

        if (matchErr) throw matchErr;
        const activeMatches = matches || [];

        // 3. Procesar Estadísticas Avanzadas del Salón de la Fama
        listaCompletaJugadores = profiles.map((profile) => {
            const id = profile.id;
            
            // Filtrar todas las partidas en las que participó este jugador
            const misPartidas = activeMatches.filter(partida => {
                const enAlfa = (partida.team_alfa || []).some(j => j.id === id);
                const enBravo = (partida.team_bravo || []).some(j => j.id === id);
                return enAlfa || enBravo;
            });

            let victorias = 0;
            let derrotas = 0;
            let empates = 0;
            let rachaActual = 0;
            let rompimientoDeRacha = false;

            // Procesar cada partida en orden cronológico (del más nuevo al más viejo)
            misPartidas.forEach((partida, idx) => {
                const enAlfa = (partida.team_alfa || []).some(j => j.id === id);
                const enBravo = (partida.team_bravo || []).some(j => j.id === id);

                const gano = (enAlfa && partida.winner_team === 'Supervivientes') || 
                             (enBravo && partida.winner_team === 'Infectados');
                
                const empato = partida.winner_team === 'empate';

                if (gano) {
                    victorias++;
                    // Si la racha sigue intacta, sumar 1
                    if (!rompimientoDeRacha) {
                        rachaActual++;
                    }
                } else if (empato) {
                    empates++;
                    // El empate corta la racha ganadora
                    rompimientoDeRacha = true;
                } else {
                    derrotas++;
                    // La derrota rompe la racha
                    rompimientoDeRacha = true;
                }
            });

            const totalJugadasReal = misPartidas.length;
            const winRate = totalJugadasReal > 0 ? Math.round((victorias / totalJugadasReal) * 100) : 0;

            return {
                ...profile,
                victorias,
                derrotas,
                empates,
                rachaActual,
                winRate,
                totalJugadasReal
            };
        });

        // 4. Actualizar contador general
        const lblTotal = document.getElementById('total-players-badge');
        if (lblTotal) {
            lblTotal.innerText = listaCompletaJugadores.length;
        }

        // 5. Renderizar tabla completa
        filtrarYRenderizar('');

    } catch (error) {
        console.error("Error en inicialización de Leaderboard:", error);
        mostrarErrorEnTabla();
    }
}

// ===== MOTOR DE FILTRADO Y RENDERIZADO =====
function filtrarYRenderizar(query) {
    const contenedor = document.getElementById('leaderboard-body');
    if (!contenedor) return;

    const filtro = query.toLowerCase().trim();

    // Aplicar filtro de texto reactivo
    const filtrados = listaCompletaJugadores.filter(j => 
        (j.username || '').toLowerCase().includes(filtro)
    );

    if (filtrados.length === 0) {
        contenedor.innerHTML = `
            <tr>
                <td colspan="7" class="py-5 text-center text-white-50">
                    <i class="fas fa-search fa-3x mb-3 opacity-25"></i>
                    <div class="fs-5 fw-bold" style="font-family: 'Oswald', sans-serif;">NO SE HALLARON SUPERVIVIENTES O INFECTADOS</div>
                    <div class="small text-muted">Intenta escribir el nombre con otras letras o borra la búsqueda.</div>
                </td>
            </tr>
        `;
        return;
    }

    // Generar HTML de la tabla dinámicamente
    contenedor.innerHTML = filtrados.map((j, idx) => {
        // La posición original se calcula buscando su índice exacto en la lista completa ordenada
        const posOriginal = listaCompletaJugadores.findIndex(orig => orig.id === j.id) + 1;
        
        // Asignar Medallas visuales premium a los primeros 3 puestos
        let medalHTML = `<span class="fw-bold text-white-50" style="font-family: 'Russo One'; font-size: 1.1rem;">${posOriginal}</span>`;
        if (posOriginal === 1) medalHTML = '<span class="medal-container animate__animated animate__bounce animate__infinite animate__slower">🥇</span>';
        else if (posOriginal === 2) medalHTML = '<span class="medal-container">🥈</span>';
        else if (posOriginal === 3) medalHTML = '<span class="medal-container">🥉</span>';

        // Definir Insignia de Rango por MMR
        const liga = j.games_played < 3 ? null : calcularRangoLiga(j.mmr);
        const badgeRangoHTML = liga
            ? `
            <span class="badge-rango" style="background: rgba(${liga.rgb}, 0.1); border: 1.5px solid rgba(${liga.rgb}, 0.4); color: rgb(${liga.rgb}); text-shadow: 0 0 8px rgba(${liga.rgb}, 0.3);">
                <i class="fas ${liga.icon} me-1"></i> ${liga.titulo}
            </span>
            `
            : `
            <span class="badge bg-dark text-white-50 border border-secondary border-opacity-25 py-1 px-2.5" style="font-size:0.65rem; letter-spacing:0.5px; font-weight:bold; border-radius: 4px; font-family: 'Russo One', sans-serif;">
                <i class="fas fa-spinner fa-spin me-1"></i>CALIBRANDO
            </span>
            `;

        const mmrDisplay = j.games_played < 3 ? '???' : j.mmr;

        // Colores y clases dinámicas para el Win Rate
        let wrColor = '#ff4444'; // Rojo por defecto
        if (j.winRate >= 58) wrColor = '#2ecc71'; // Verde esmeralda premium
        else if (j.winRate >= 45) wrColor = '#ffc107'; // Dorado

        const winRateHTML = j.totalJugadasReal > 0 
            ? `<div class="winrate-circle" style="color: ${wrColor}; border-color: ${wrColor}; text-shadow: 0 0 5px ${wrColor}40; background: ${wrColor}0a;">${j.winRate}%</div>`
            : `<span class="text-white-50 opacity-50" style="font-family: 'Oswald'; font-size: 0.9rem;">N/A</span>`;

        // Dibujar la Racha con efecto de fuego vivo!
        let rachaHTML = `<span class="text-white-50 opacity-50">-</span>`;
        if (j.rachaActual >= 2) {
            rachaHTML = `
                <span class="fw-bold fire-streak text-warning animate__animated animate__pulse animate__infinite" style="font-family: 'Russo One'; font-size: 1rem;">
                    <i class="fas fa-fire-alt text-danger"></i> ${j.rachaActual}
                </span>
            `;
        }

        // Estilo visual premium para filas del TOP 3
        const trStyle = posOriginal <= 3 ? 'border-left: 4px solid rgba(255, 193, 7, 0.5) !important;' : '';

        return `
            <tr class="animate__animated animate__fadeInUp animate__faster" style="${trStyle}">
                <td class="py-3 text-center">
                    ${medalHTML}
                </td>
                <td class="py-3 text-start ps-4">
                    <div class="d-flex align-items-center gap-3">
                        <div class="rounded-circle bg-dark d-flex align-items-center justify-content-center border border-secondary border-opacity-25" style="width: 40px; height: 40px; font-size: 1.1rem; background: linear-gradient(135deg, #222, #0a0a0a) !important;">
                            <i class="fas ${posOriginal === 1 ? 'fa-user-shield text-warning' : 'fa-user text-white-50'}"></i>
                        </div>
                        <div>
                            <div class="fw-bold text-white" style="font-family: 'Oswald', sans-serif; font-size: 1.15rem; letter-spacing: 0.5px;">
                                ${j.username}
                            </div>
                            <div class="small text-muted" style="font-size: 0.75rem;">
                                Miembro desde: ${new Date(j.created_at).toLocaleDateString()}
                            </div>
                        </div>
                    </div>
                </td>
                <td class="py-3">
                    ${badgeRangoHTML}
                </td>
                <td class="py-3">
                    <span class="mmr-text text-warning" style="text-shadow: 0 0 10px rgba(255, 193, 7, 0.25);">
                        ${mmrDisplay}
                    </span>
                </td>
                <td class="py-3" style="font-family: 'Oswald'; font-size: 1.1rem; color: #bbb;">
                    ${j.games_played}
                </td>
                <td class="py-3">
                    ${rachaHTML}
                </td>
                <td class="py-3">
                    ${winRateHTML}
                </td>
            </tr>
        `;
    }).join('');
}

// ===== CREADOR DE LIGAS E INSIGNIAS (GAMIFICATION) =====
function calcularRangoLiga(mmr) {
    // Formato: { titulo, icon, rgb (RED,GREEN,BLUE para iluminaciones) }
    if (mmr < 800) {
        return { titulo: 'Infectado Común', icon: 'fa-biohazard', rgb: '133, 92, 51' }; // Marrón Bronce
    } else if (mmr < 1100) {
        return { titulo: 'Hunter Acechante', icon: 'fa-crosshairs', rgb: '160, 160, 160' }; // Plateado
    } else if (mmr < 1350) {
        return { titulo: 'Boomer Master', icon: 'fa-radiation', rgb: '212, 175, 55' }; // Dorado
    } else if (mmr < 1600) {
        return { titulo: 'Charger Elite', icon: 'fa-bolt', rgb: '0, 195, 227' }; // Cyan Platino
    } else {
        return { titulo: 'Tank Legendario', icon: 'fa-crown', rgb: '255, 62, 62' }; // Rojo Legendario
    }
}

// ===== MANIPULACIÓN DE VISTAS ANTE ERRORES =====
function mostrarErrorEnTabla() {
    const contenedor = document.getElementById('leaderboard-body');
    if (contenedor) {
        contenedor.innerHTML = `
            <tr>
                <td colspan="7" class="py-5 text-center text-danger">
                    <i class="fas fa-exclamation-triangle fa-3x mb-3 animate__animated animate__shakeX"></i>
                    <div class="fs-5 fw-bold" style="font-family: 'Oswald', sans-serif;">ERROR AL SINCRONIZAR EXPEDIENTES</div>
                    <div class="small text-white-50">No pudimos conectarnos con Supabase. Revisa tu conexión a internet.</div>
                </td>
            </tr>
        `;
    }
}
