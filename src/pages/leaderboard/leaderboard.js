import { supabase } from '../../js/supabase.js';

// ===== ESTADO LOCAL DEL LEADERBOARD =====
let listaCompletaJugadores = [];
let listaCompletaPartidas = [];

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
            .select('id, created_at, team_alfa, team_bravo, winner_team, map_id, maps:map_id(name, image_url)')
            .eq('status', 'finished')
            .order('created_at', { ascending: false }); // Orden cronológico inverso para rachas

        if (matchErr) throw matchErr;
        const activeMatches = matches || [];
        listaCompletaPartidas = activeMatches;

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
            <tr style="${trStyle}" onclick="abrirDetalleJugador('${j.id}')">
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

// ===== EXPEDIENTE DE COMBATE DETALLADO (MODAL PLAYER CARD) =====
function abrirDetalleJugador(idJugador) {
    const jugador = listaCompletaJugadores.find(j => j.id === idJugador);
    if (!jugador) return;

    // Filtrar partidas jugadas por este sobreviviente/infectado
    const misPartidas = listaCompletaPartidas.filter(partida => {
        const enAlfa = (partida.team_alfa || []).some(j => j.id === idJugador);
        const enBravo = (partida.team_bravo || []).some(j => j.id === idJugador);
        return enAlfa || enBravo;
    });

    const partidasOrdenadas = [...misPartidas].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const ultimasPartidas = partidasOrdenadas.slice(0, 5);

    const posOriginal = listaCompletaJugadores.findIndex(orig => orig.id === jugador.id) + 1;
    const liga = jugador.games_played < 3 ? null : calcularRangoLiga(jugador.mmr);

    let avatarIcon = 'fa-user text-white-50';
    if (posOriginal === 1) avatarIcon = 'fa-crown text-warning';
    else if (posOriginal === 2) avatarIcon = 'fa-shield-halved text-white-50';
    else if (posOriginal === 3) avatarIcon = 'fa-award text-white-50';
    else if (liga) {
        if (liga.titulo.includes('Tank')) avatarIcon = 'fa-crown text-danger';
        else if (liga.titulo.includes('Charger')) avatarIcon = 'fa-bolt text-info';
        else if (liga.titulo.includes('Boomer')) avatarIcon = 'fa-radiation text-warning';
        else if (liga.titulo.includes('Hunter')) avatarIcon = 'fa-crosshairs text-secondary';
    }

    const badgeRangoHTML = liga
        ? `
        <span class="badge-rango" style="background: rgba(${liga.rgb}, 0.1); border: 1.5px solid rgba(${liga.rgb}, 0.4); color: rgb(${liga.rgb}); text-shadow: 0 0 8px rgba(${liga.rgb}, 0.3); font-size: 0.85rem;">
            <i class="fas ${liga.icon} me-1"></i> ${liga.titulo}
        </span>
        `
        : `
        <span class="badge bg-dark text-white-50 border border-secondary border-opacity-25 py-1.5 px-3" style="font-size:0.75rem; letter-spacing:0.5px; font-weight:bold; border-radius: 4px; font-family: 'Russo One', sans-serif;">
            <i class="fas fa-spinner fa-spin me-1"></i>CALIBRANDO
        </span>
        `;

    let historyHTML = `
        <div class="text-center py-4 text-white-50" style="background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px dashed rgba(255,255,255,0.05);">
            <i class="fas fa-ghost fa-2x mb-2 opacity-50 text-danger"></i>
            <div class="fw-bold" style="font-family: 'Oswald', sans-serif;">SIN REGISTROS DE BATALLA</div>
            <div class="small text-muted">Aún no ha participado en partidas finalizadas.</div>
        </div>
    `;

    if (ultimasPartidas.length > 0) {
        historyHTML = ultimasPartidas.map(partida => {
            const enAlfa = (partida.team_alfa || []).some(j => j.id === idJugador);
            const enBravo = (partida.team_bravo || []).some(j => j.id === idJugador);

            const gano = (enAlfa && partida.winner_team === 'Supervivientes') || 
                         (enBravo && partida.winner_team === 'Infectados');
            
            const empato = partida.winner_team === 'empate';

            let statusHTML = '';
            if (gano) {
                statusHTML = '<span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25 px-2.5 py-1 text-uppercase fw-bold" style="font-size: 0.7rem; font-family: \'Russo One\'; letter-spacing: 0.5px;">¡VICTORIA!</span>';
            } else if (empato) {
                statusHTML = '<span class="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-25 px-2.5 py-1 text-uppercase fw-bold" style="font-size: 0.7rem; font-family: \'Russo One\'; letter-spacing: 0.5px;">EMPATE</span>';
            } else {
                statusHTML = '<span class="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25 px-2.5 py-1 text-uppercase fw-bold" style="font-size: 0.7rem; font-family: \'Russo One\'; letter-spacing: 0.5px;">DERROTA</span>';
            }

            const bandoHTML = enAlfa 
                ? '<span class="text-info fw-bold" style="font-size: 0.85rem; font-family: \'Oswald\';"><i class="fas fa-shield-virus me-1"></i> Supervivientes</span>' 
                : '<span class="text-success fw-bold" style="font-size: 0.85rem; font-family: \'Oswald\';"><i class="fas fa-biohazard me-1"></i> Infectados</span>';

            const mapName = partida.maps?.name || 'Campaña Desconocida';
            const mapImage = partida.maps?.image_url || 'https://images.alphacoders.com/105/thumb-1920-105187.jpg';

            return `
                <div class="d-flex align-items-center justify-content-between history-match-item">
                    <div class="d-flex align-items-center gap-3">
                        <img src="${mapImage}" class="map-thumbnail-mini" alt="${mapName}" onerror="this.src='https://images.alphacoders.com/105/thumb-1920-105187.jpg'">
                        <div>
                            <div class="fw-bold text-white" style="font-size: 0.95rem; font-family: 'Oswald', sans-serif;">${mapName}</div>
                            <div class="text-white-50" style="font-size: 0.72rem;">${new Date(partida.created_at).toLocaleDateString()} • ${new Date(partida.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                        </div>
                    </div>
                    <div class="text-end">
                        <div class="mb-1">${bandoHTML}</div>
                        <div>${statusHTML}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    const bodyContainer = document.getElementById('modal-detalle-body');
    if (bodyContainer) {
        bodyContainer.innerHTML = `
            <!-- PARTE SUPERIOR: CABECERA Y AVATAR -->
            <div class="row align-items-center g-4 mb-4 pb-4 border-bottom border-secondary border-opacity-10">
                <div class="col-md-auto text-center text-md-start">
                    <div class="avatar-huge-container mx-auto">
                        <i class="fas ${avatarIcon}"></i>
                    </div>
                </div>
                <div class="col-md text-center text-md-start">
                    <div class="d-flex flex-wrap align-items-center justify-content-center justify-content-md-start gap-2 mb-2">
                        <h2 class="fw-bold text-white mb-0" style="font-family: 'Oswald', sans-serif; font-size: 2.2rem; letter-spacing: 0.5px;">${jugador.username}</h2>
                        <span class="badge bg-warning text-dark fw-bold px-2 py-1" style="font-family: 'Russo One'; font-size: 0.7rem; letter-spacing: 0.5px;">POS # ${posOriginal}</span>
                    </div>
                    <div class="d-flex flex-wrap align-items-center justify-content-center justify-content-md-start gap-3 mb-2">
                        ${badgeRangoHTML}
                        <span class="text-warning fw-bold fs-5" style="font-family: 'Oswald', sans-serif;">🏆 ${jugador.games_played < 3 ? '???' : jugador.mmr} MMR</span>
                    </div>
                    <div class="small text-muted" style="font-family: 'Oswald', sans-serif;">
                        <i class="fas fa-calendar-alt me-1 text-danger"></i> Miembro desde: ${new Date(jugador.created_at).toLocaleDateString()}
                    </div>
                </div>
            </div>

            <!-- CUADROS DE ESTADÍSTICAS RÁPIDAS -->
            <div class="row g-3 mb-4">
                <div class="col-sm-3 col-6">
                    <div class="card-stat-box">
                        <div class="card-stat-value text-white">${jugador.totalJugadasReal}</div>
                        <div class="card-stat-label">Partidas</div>
                    </div>
                </div>
                <div class="col-sm-3 col-6">
                    <div class="card-stat-box">
                        <div class="card-stat-value text-success">${jugador.victorias}</div>
                        <div class="card-stat-label">Victorias</div>
                    </div>
                </div>
                <div class="col-sm-3 col-6">
                    <div class="card-stat-box">
                        <div class="card-stat-value text-danger">${jugador.derrotas}</div>
                        <div class="card-stat-label">Derrotas</div>
                    </div>
                </div>
                <div class="col-sm-3 col-6">
                    <div class="card-stat-box">
                        <div class="card-stat-value" style="color: #ffc107;">${jugador.winRate}%</div>
                        <div class="card-stat-label">Win Rate</div>
                    </div>
                </div>
            </div>

            <!-- HISTORIAL DE PARTIDAS RECIENTES -->
            <div>
                <h5 class="fw-bold text-uppercase mb-3 text-warning d-flex align-items-center gap-2" style="font-family: 'Oswald', sans-serif; letter-spacing: 0.5px;">
                    <i class="fas fa-clock text-danger"></i> Historial Reciente (Últimas 5)
                </h5>
                <div class="history-list">
                    ${historyHTML}
                </div>
            </div>
        `;

        const modalEl = document.getElementById('modal-detalle-jugador');
        if (modalEl) {
            let modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (!modalInstance) {
                modalInstance = new bootstrap.Modal(modalEl);
            }
            modalInstance.show();
        }
    }
}

// Exponer globalmente en window para que el onclick en línea funcione sin problemas
window.abrirDetalleJugador = abrirDetalleJugador;

