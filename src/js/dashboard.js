import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verificación de Seguridad Obligatoria
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        // Si intenta entrar sin loguearse, lo pateamos al login
        window.location.href = '/src/pages/auth/login.html';
        return;
    }

    // Cargamos los elementos del DOM que vamos a actualizar
    const navUser = document.getElementById('nav-username');
    const dashUser = document.getElementById('dash-username');
    const mmrBig = document.getElementById('mmr-big');
    const calBadge = document.getElementById('calibration-badge');
    const statGames = document.getElementById('stat-games');
    const btnLogout = document.getElementById('btn-logout');
    const btnLaunch = document.getElementById('btn-launch');
    const inputIp = document.getElementById('game-ip');

    let userMmrCache = 1000; // Caché local para inicializar gráficos y cálculos

    // 2. Descargar perfil del usuario
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

        if (error) throw error;

        if (profile) {
            userMmrCache = profile.mmr || 1000;
            // Rellenar UI con datos reales
            navUser.textContent = profile.username;
            dashUser.textContent = profile.username;
            statGames.textContent = profile.games_played;

            // Lógica de Calibración visual
            if (profile.games_played < 10) {
                mmrBig.textContent = '???';
                calBadge.textContent = `Calibrando (${profile.games_played}/10)`;
                calBadge.className = 'badge bg-warning text-dark px-3 py-2';
            } else {
                mmrBig.textContent = profile.mmr;
                calBadge.textContent = 'CLASIFICADO';
                calBadge.className = 'badge bg-success px-3 py-2';
            }
        }
    } catch (err) {
        console.error("Error al cargar el Dashboard:", err);
    }

    // ===== 📟 SISTEMA DE PAGINACIÓN Y DETALLE DE PARTIDAS (PRO) =====
    let chartInstancia = null; // Referencia única al gráfico oficial
    let misPartidasGlobal = [];
    let mapasDictCache = {};
    let paginaActual = 1;
    const partidasPorPagina = 10;

    // Elementos de control del DOM para Paginación
    const pageIndicator = document.getElementById('page-indicator');
    const paginationContainer = document.getElementById('historial-pagination');
    const btnPrev = document.getElementById('btn-prev-page');
    const btnNext = document.getElementById('btn-next-page');

    // Cargar el historial PERSONAL completo del usuario autenticado
    async function cargarHistorialPersonal(userId, currentMmr) {
        const container = document.getElementById('dashboard-historial-grid');
        if (!container) return;

        try {
            // 1. Descargar historial extendido (Últimas 100 partidas para tener paginación rica)
            const { data: allMatches, error: matchError } = await supabase
                .from('matches')
                .select('*')
                .eq('status', 'finished')
                .order('created_at', { ascending: false })
                .limit(100);

            if (matchError) throw matchError;

            // Filtrar localmente solo donde este usuario participó
            misPartidasGlobal = (allMatches || []).filter(partida => {
                const enAlfa = (partida.team_alfa || []).some(p => p.id === userId);
                const enBravo = (partida.team_bravo || []).some(p => p.id === userId);
                return enAlfa || enBravo;
            });

            if (misPartidasGlobal.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-5 text-muted">
                        <i class="fas fa-ghost fa-3x opacity-25 mb-3"></i>
                        <p class="mb-0">Aún no has participado en batallas competitivas.</p>
                        <small>¡Vuelve al Inicio y únete a la cola para empezar!</small>
                    </div>
                `;
                if (paginationContainer) paginationContainer.style.setProperty('display', 'none', 'important');
                return;
            }

            // 2. Descargar mapas para la caché local (Blindado de RLS)
            try {
                const { data: mapsList } = await supabase.from('maps').select('id, name, image_url');
                if (mapsList) {
                    mapsList.forEach(m => mapasDictCache[m.id] = m);
                }
            } catch (mapErr) {
                console.warn("🛡️ RLS interceptado en mapas, usando caché local estática.");
            }

            // 3. Renderizar la primera página de 10 elementos
            paginaActual = 1;
            renderizarPartidasPagina(paginaActual, userId);

            // 🚀 NUEVO: Dibujar Gráfico Animado de Curva de Rendimiento (MMR)
            dibujarGraficoCurvaMMR(misPartidasGlobal, currentMmr, userId);

            // 4. Calcular Winrate Real basado en TODO el historial completo descargado
            const totalJugadas = misPartidasGlobal.length;
            const totalGanadas = misPartidasGlobal.filter(partida => {
                const enAlfa = (partida.team_alfa || []).some(p => p.id === userId);
                const miRol = enAlfa ? 'Supervivientes' : 'Infectados';
                return partida.winner_team === miRol;
            }).length;

            const winrateHud = document.getElementById('stat-winrate');
            if (winrateHud && totalJugadas > 0) {
                const rate = Math.round((totalGanadas / totalJugadas) * 100);
                winrateHud.textContent = `${rate}%`;
            }

        } catch (err) {
            console.error("Error en motor de historial paginado:", err);
            container.innerHTML = `<div class="alert alert-danger p-2 text-center small m-2 text-danger"><i class="fas fa-exclamation-circle me-2"></i>Error cargando base de datos extendida.</div>`;
        }
    }

    // Dibuja la página especificada de partidas y actualiza controles visuales
    function renderizarPartidasPagina(pagina, userId) {
        const container = document.getElementById('dashboard-historial-grid');
        if (!container) return;

        // Calcular cortes de slicing
        const inicio = (pagina - 1) * partidasPorPagina;
        const fin = inicio + partidasPorPagina;
        const paginaData = misPartidasGlobal.slice(inicio, fin);

        if (paginaData.length === 0) return;

        // Renderizamos HTML estilizado
        container.innerHTML = paginaData.map(partida => {
            const mapData = mapasDictCache[partida.map_id] || { name: 'Campaña Desconocida', image_url: 'https://images.alphacoders.com/105/thumb-1920-105187.jpg' };
            
            const enAlfa = (partida.team_alfa || []).some(p => p.id === userId);
            const miRol = enAlfa ? 'Supervivientes' : 'Infectados';
            const ganoYo = partida.winner_team === miRol;

            const badgeColor = ganoYo ? 'bg-success' : 'bg-danger';
            const borderAccent = ganoYo ? '#2e7d32' : '#c62828';
            const labelResultado = ganoYo ? 'VICTORIA' : 'DERROTA';

            const timeFormat = new Date(partida.created_at).toLocaleString('es-ES', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            });

            return `
                <div class="d-flex flex-wrap flex-md-nowrap align-items-center justify-content-between p-3 bg-black bg-opacity-25 rounded border-start border-4 shadow-sm mb-2 animate__animated animate__fadeIn" 
                     style="border-left-color: ${borderAccent} !important; transition: all 0.2s; background: linear-gradient(90deg, rgba(20,20,20,0.7) 0%, rgba(5,5,5,0.9) 100%) !important;">
                    
                    <div class="d-flex align-items-center flex-grow-1 min-width-0 me-2">
                        <!-- Mini Foto Mapa -->
                        <div class="flex-shrink-0 me-3">
                            <img src="${mapData.image_url}" 
                                 class="rounded-circle object-fit-cover border border-secondary border-opacity-30 shadow-sm" 
                                 style="width: 36px; height: 36px;" />
                        </div>

                        <!-- Info Corta Misión -->
                        <div class="flex-grow-1 min-width-0">
                            <h6 class="mb-0 text-white fw-bold text-truncate" style="font-family: 'Oswald', sans-serif; letter-spacing: 0.5px; font-size: 0.9rem;">${mapData.name}</h6>
                            <div class="d-flex gap-2 align-items-center">
                                <small class="text-white-50" style="font-size: 0.65rem;">Bando: <strong>${miRol}</strong></small>
                                <span class="text-muted d-none d-sm-inline" style="font-size: 0.65rem;">• ${timeFormat}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Estado y Botón de Acción -->
                    <div class="d-flex align-items-center gap-2 flex-shrink-0">
                        <span class="badge ${badgeColor} border border-white border-opacity-10 py-1.5" 
                              style="min-width: 75px; font-family: 'Russo One', sans-serif; letter-spacing: 0.5px; font-size: 0.65rem;">
                            ${labelResultado}
                        </span>
                        <button class="btn btn-xs btn-outline-light py-1 px-2 btn-ver-detalle-partida" data-match-id="${partida.id}" style="font-size: 0.6rem; font-family: 'Russo One'; letter-spacing: 0.5px; border-color: rgba(255,255,255,0.15);">
                            <i class="fas fa-eye"></i> VER
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Manejo lógico de botones de Paginación
        const totalPaginas = Math.ceil(misPartidasGlobal.length / partidasPorPagina);
        
        if (totalPaginas > 1) {
            if (paginationContainer) paginationContainer.style.setProperty('display', 'flex', 'important');
            if (pageIndicator) pageIndicator.textContent = `PÁG ${pagina} DE ${totalPaginas}`;
            
            if (btnPrev) btnPrev.disabled = (pagina === 1);
            if (btnNext) btnNext.disabled = (pagina === totalPaginas);
        } else {
            if (paginationContainer) paginationContainer.style.setProperty('display', 'none', 'important');
        }

        // Registrar clics dinámicos para botones de detalle recién creados
        document.querySelectorAll('.btn-ver-detalle-partida').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idStr = e.currentTarget.getAttribute('data-match-id');
                mostrarDetallePartida(parseInt(idStr, 10), userId);
            });
        });
    }

    // Renderiza el Versus detallado en el Modal Global
    function mostrarDetallePartida(matchId, userId) {
        const partida = misPartidasGlobal.find(m => m.id === matchId);
        if (!partida) return;

        const mapData = mapasDictCache[partida.map_id] || { name: 'Campaña Desconocida', image_url: 'https://images.alphacoders.com/105/thumb-1920-105187.jpg' };
        const modalBody = document.getElementById('modal-detalle-body');
        if (!modalBody) return;

        // Sub-función para imprimir listas de jugadores formateadas
        const renderRoster = (listaJugadores) => {
            if (!listaJugadores || listaJugadores.length === 0) {
                return `<div class="text-muted text-center py-3" style="font-style:italic; font-size:0.75rem;">Sin registros de escuadrón.</div>`;
            }
            return listaJugadores.map(p => {
                const esYo = p.id === userId;
                return `
                    <div class="d-flex justify-content-between align-items-center p-2 bg-black bg-opacity-50 rounded border mb-1 ${esYo ? 'border-warning shadow-sm bg-opacity-75' : 'border-secondary border-opacity-10'}">
                        <div class="d-flex align-items-center min-width-0">
                            ${esYo ? '<i class="fas fa-star text-warning me-1.5" style="font-size:0.7rem;"></i>' : '<i class="far fa-circle text-muted me-1.5 opacity-50" style="font-size:0.55rem;"></i>'}
                            <span class="fw-bold text-truncate ${esYo ? 'text-warning' : 'text-white'}" style="font-size:0.8rem; max-width:140px;">
                                ${p.nombre || 'Combatiente'}
                            </span>
                        </div>
                        <span class="badge bg-dark border border-secondary border-opacity-20 text-white-50 fw-normal" style="font-size:0.6rem; letter-spacing:0.5px;">
                            ${p.nivel || 1000} MMR
                        </span>
                    </div>
                `;
            }).join('');
        };

        const alfaGano = partida.winner_team === 'Supervivientes';
        const bravoGano = partida.winner_team === 'Infectados';

        modalBody.innerHTML = `
            <!-- Banner de Campaña con Blurry Background Overlay -->
            <div class="position-relative text-center py-4 bg-dark overflow-hidden" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <div class="position-absolute top-0 start-0 w-100 h-100" style="background: linear-gradient(rgba(0,0,0,0.85), rgba(0,0,0,0.95)), url('${mapData.image_url}') center/cover no-repeat; transform: scale(1.05); filter: blur(2px);"></div>
                
                <div class="position-relative z-1 px-3 animate__animated animate__fadeIn">
                    <span class="badge bg-danger border border-danger border-opacity-50 py-1 px-2.5 mb-2 text-uppercase fw-bold shadow-lg" style="font-size:0.55rem; font-family: 'Russo One'; letter-spacing:1.5px;">
                        Campaña Sobrevivida
                    </span>
                    <h3 class="fw-bold text-white text-uppercase m-0" style="font-family: 'Oswald', sans-serif; letter-spacing:2px; text-shadow: 0 2px 8px #000;">
                        ${mapData.name}
                    </h3>
                    <small class="text-white-50 mt-1 d-block fw-bold" style="font-size:0.65rem; font-family: 'Russo One'; letter-spacing:0.5px;">REPORTE MILITAR #${partida.id}</small>
                </div>
            </div>

            <!-- Contenedor de Enfrentamiento Versus -->
            <div class="p-3" style="background: rgba(10,10,10,0.4);">
                <div class="row g-3 animate__animated animate__fadeInUp" style="animation-delay: 0.1s;">
                    <!-- Supervivientes -->
                    <div class="col-md-6">
                        <div class="card h-100 border-0 bg-black bg-opacity-25">
                            <div class="card-header border-bottom border-secondary border-opacity-10 py-2 d-flex justify-content-between align-items-center" style="background: rgba(46, 125, 50, 0.12) !important;">
                                <h6 class="mb-0 text-success fw-bold" style="font-family: 'Oswald', sans-serif; font-size:0.8rem; letter-spacing:1px;">
                                    🛡️ SUPERVIVIENTES (ALFA)
                                </h6>
                                ${alfaGano ? '<span class="badge bg-success border border-success border-opacity-50 py-1 px-2 text-uppercase fw-bold shadow-sm" style="font-size:0.55rem; font-family: Russo One;">GANADORES</span>' : ''}
                            </div>
                            <div class="card-body p-2 bg-black bg-opacity-10">
                                ${renderRoster(partida.team_alfa)}
                            </div>
                        </div>
                    </div>

                    <!-- Infectados -->
                    <div class="col-md-6">
                        <div class="card h-100 border-0 bg-black bg-opacity-25">
                            <div class="card-header border-bottom border-secondary border-opacity-10 py-2 d-flex justify-content-between align-items-center" style="background: rgba(198, 40, 40, 0.12) !important;">
                                <h6 class="mb-0 text-danger fw-bold" style="font-family: 'Oswald', sans-serif; font-size:0.8rem; letter-spacing:1px;">
                                    🧟‍♂️ INFECTADOS (BRAVO)
                                </h6>
                                ${bravoGano ? '<span class="badge bg-danger border border-danger border-opacity-50 py-1 px-2 text-uppercase fw-bold shadow-sm" style="font-size:0.55rem; font-family: Russo One;">GANADORES</span>' : ''}
                            </div>
                            <div class="card-body p-2 bg-black bg-opacity-10">
                                ${renderRoster(partida.team_bravo)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Disparar Modal de Bootstrap
        const modalEl = document.getElementById('modal-detalle-partida');
        if (modalEl) {
            let instance = bootstrap.Modal.getInstance(modalEl);
            if (!instance) instance = new bootstrap.Modal(modalEl);
            instance.show();
        }
    }

    // 🚀 MAESTRO: Constructor y Configuración Avanzada de Chart.js para Curva MMR
    function dibujarGraficoCurvaMMR(misPartidas, userCurrentMmr, userId) {
        const canvas = document.getElementById('mmr-chart');
        if (!canvas) return;

        // Prevenir solapamientos destruyendo instancia previa en recargas calientes
        if (chartInstancia) {
            chartInstancia.destroy();
        }

        // Invertir orden: De la más antigua a la más reciente. 
        // Tomamos ventana de últimas 15 partidas para un trazo de curva perfecto y limpio
        const historicoCronologico = [...misPartidas].slice(0, 15).reverse();

        const datasetMMR = [];
        const labelsFechas = [];

        historicoCronologico.forEach((p) => {
            // Extraer el nodo exacto del jugador dentro del Snapshot JSON guardado en la base
            const totalParticipantes = [...(p.team_alfa || []), ...(p.team_bravo || [])];
            const miRegistro = totalParticipantes.find(u => u.id === userId);

            if (miRegistro) {
                datasetMMR.push(miRegistro.nivel || 1000);
                
                // Formatear día y mes corto
                const d = new Date(p.created_at);
                labelsFechas.push(d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }));
            }
        });

        // 🛡️ AGREGADO CLAVE: Insertamos el MMR Actual como broche final en la derecha del gráfico
        datasetMMR.push(userCurrentMmr);
        labelsFechas.push("AHORA 🔥");

        // Si el usuario no ha jugado nada aún (cuenta virgen), forzamos punto de arranque en 1000
        if (datasetMMR.length === 1 && datasetMMR[0] === userCurrentMmr) {
            datasetMMR.unshift(1000);
            labelsFechas.unshift("Alineación");
        }

        // Crear un contexto 2D para inyectar un degradado CSS-in-JS elegante al fondo
        const ctx2d = canvas.getContext('2d');
        const gradientBg = ctx2d.createLinearGradient(0, 0, 0, 220);
        gradientBg.addColorStop(0, 'rgba(13, 202, 240, 0.35)');  // Cyan glow intenso arriba
        gradientBg.addColorStop(0.6, 'rgba(13, 202, 240, 0.05)'); // Desvanecimiento
        gradientBg.addColorStop(1, 'rgba(0, 0, 0, 0)');          // Transparente absoluto

        // Lanzar Chart.js
        chartInstancia = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labelsFechas,
                datasets: [{
                    label: 'Tu MMR',
                    data: datasetMMR,
                    borderColor: '#0dcaf0', // Cyber Cyan
                    borderWidth: 3.5,
                    backgroundColor: gradientBg,
                    fill: true,
                    tension: 0.4, // Suavizado cúbico ultra moderno (estilo TradingView/Esports)
                    pointBackgroundColor: '#0dcaf0',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4.5,
                    pointHoverRadius: 7,
                    pointHoverBackgroundColor: '#ffffff',
                    pointHoverBorderColor: '#0dcaf0',
                    pointHoverBorderWidth: 3,
                    shadowColor: 'rgba(13, 202, 240, 0.5)',
                    shadowBlur: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1200,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(10, 10, 10, 0.95)',
                        titleFont: { family: 'Oswald', size: 12, weight: 'bold' },
                        bodyFont: { family: 'Russo One', size: 13 },
                        titleColor: '#888',
                        bodyColor: '#0dcaf0',
                        borderColor: 'rgba(13, 202, 240, 0.3)',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            label: function(tooltipItem) {
                                return `⚡ ${tooltipItem.parsed.y} PUNTOS MMR`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.35)',
                            font: { family: 'Inter', size: 9, weight: 'bold' }
                        }
                    },
                    y: {
                        position: 'right', // Escala a la derecha para no molestar el inicio del trazo
                        grid: {
                            color: 'rgba(255, 255, 255, 0.04)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.3)',
                            font: { family: 'Russo One', size: 9 },
                            precision: 0,
                            stepSize: 50
                        }
                    }
                }
            }
        });
    }

    // Configurar Listeners de los Botones de Paginación
    btnPrev?.addEventListener('click', () => {
        if (paginaActual > 1) {
            paginaActual--;
            renderizarPartidasPagina(paginaActual, session.user.id);
        }
    });

    btnNext?.addEventListener('click', () => {
        const total = Math.ceil(misPartidasGlobal.length / partidasPorPagina);
        if (paginaActual < total) {
            paginaActual++;
            renderizarPartidasPagina(paginaActual, session.user.id);
        }
    });

    // Lanzar carga inicial al abrir sesión pasando la caché de MMR
    await cargarHistorialPersonal(session.user.id, userMmrCache);

    // 3. Lógica del Lanzador Steam Connect (POR IP)
    btnLaunch?.addEventListener('click', () => {
        const ip = inputIp.value.trim();
        if (!ip) {
            alert('⚠️ Por favor, ingresa la IP del servidor para conectar.');
            return;
        }

        // Asegurarnos que tiene puerto por defecto si no lo ingresan
        const finalUrl = ip.includes(':') ? ip : `${ip}:27015`;
        
        // Generamos la URI mágica de Steam
        const steamUri = `steam://connect/${finalUrl}`;
        
        // Abrimos el enlace, Windows detectará que es de Steam automáticamente
        window.location.href = steamUri;
    });

    // 4. Botón de Salida
    btnLogout?.addEventListener('click', async () => {
        if (confirm('¿Estás seguro de que quieres salir al exterior?')) {
            await supabase.auth.signOut();
            window.location.href = '/';
        }
    });
});
