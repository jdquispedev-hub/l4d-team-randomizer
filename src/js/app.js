import { supabase } from './supabase.js';

/* ===== L4D2 TEAM RANDOMIZER - JAVASCRIPT ===== */

// ===== VARIABLES GLOBALES =====
let jugadores = [];
let colaJugadores = [];
let equipos = [];
let estadisticas = {
    totalJugadores: 0,
    partidasTotales: 0,
    rachaActual: 0
};
// ESTADO DE SESIÓN
let usuarioActual = null;

// ESTADO DE VOTACIÓN DE MAPAS
let opcionesMapas = [];
let votosMapas = [0, 0, 0];
let mapaSeleccionado = null;

// 🎮 VARIABLES DE PARTIDA ACTIVA SYNC (GLOBAL EN NUBE)
let partidaActiva = null;
let opcionesMapasCompletas = [];
let votosPartida = [];
let intervalCuentaAtras = null;

// ===== ELEMENTOS DEL DOM =====
const elementos = {
    // Formulario
    formulario: document.getElementById('formulario'),
    inputJugador: document.getElementById('jugador'),
    inputNivel: document.getElementById('nivel'),
    inputPersonaje: document.getElementById('personaje'),
    skillValue: document.getElementById('skill-value'),
    btnAgregar: document.getElementById('agregar'),
    btnLimpiar: document.getElementById('limpiar'),
    
    // Listas
    jugadoresGrid: document.getElementById('jugadores-grid'),
    jugadoresLista: document.getElementById('jugadores-registrados'),
    colaLista: document.getElementById('cola-jugadores'),
    
    // Botones de cola
    btnIngresar: document.getElementById('ingresar'),
    btnSalirCola: document.getElementById('salir-cola'),
    btnVaciarCola: document.getElementById('vaciar-cola'),
    btnSortear: document.getElementById('sortear'),
    btnSortearRapido: document.getElementById('sortear-rapido'),
    
    // Estadísticas
    totalJugadores: document.getElementById('total-jugadores'),
    colaCount: document.getElementById('cola-count'),
    queueCount: document.getElementById('queue-count'),
    partidasTotales: document.getElementById('partidas-totales'),
    rachaActual: document.getElementById('racha-actual'),
    
    // Resultados
    resultadosSection: document.getElementById('resultados-section'),
    equiposResultados: document.getElementById('equipos-resultados'),
    btnNuevoSorteo: document.getElementById('nuevo-sorteo'),
    btnGuardarPartida: document.getElementById('guardar-partida'),
    
    // Votación de Mapas
    modalVotacion: document.getElementById('modal-votacion-mapas'),
    containerMapas: document.getElementById('mapas-votacion-container'),
    btnConfirmarMapa: document.getElementById('btn-confirmar-mapa'),
    containerMapaElegido: document.getElementById('mapa-elegido-contenedor'),
    
    // Configuración
    autoBalance: document.getElementById('auto-balance'),
    soundEffects: document.getElementById('sound-effects'),
    btnExportar: document.getElementById('exportar-jugadores')
};

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', async () => {
    inicializarEventListeners();
    cargarDatosLocalStorage();
    
    // 📡 🚀 NUEVO: Sincronizar y escuchar la cola Realtime desde Supabase
    await cargarColaDesdeSupabase();
    escucharColaEnTiempoReal();
    
    // 🎮 NUEVO: Sincronizar partida activa global y conectar receptores de votos
    await verificarYRestaurarPartidaActiva();
    escucharPartidasEnTiempoReal();
    
    await actualizarInterfaz();
    
    // 🚀 NUEVO: Verificar sesión de Supabase
    await verificarSesionUsuario();
    
    reproducirSonido('inicio');
});

// 🚀 NUEVO: Lógica para detectar quién está conectado
async function verificarSesionUsuario() {
    const container = document.getElementById('auth-container');
    if (!container) return;

    try {
        // Obtenemos sesión actual
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
            // Si hay sesión, buscamos el Nickname real en la tabla de perfiles
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('username, mmr, games_played')
                .eq('id', session.user.id)
                .single();

            if (profile) {
                // Guardamos perfil globalmente para usar en la cola
                usuarioActual = profile;
                usuarioActual.id = session.user.id; // Necesitamos el ID real
                
                // Cambiamos el HTML dinámicamente
                container.innerHTML = `
                    <div class="row align-items-center bg-dark p-4 rounded border border-success" style="background: linear-gradient(135deg, #0a2210 0%, #0a0a0a 100%) !important;">
                        <div class="col-md-8">
                            <h2 class="display-6 fw-bold mb-1 text-success">
                                <i class="fas fa-user-check me-2"></i>
                                ¡Hola de nuevo, ${profile.username}!
                            </h2>
                            <p class="text-white-50 mb-0">
                                MMR Actual: <span class="badge bg-info">${profile.games_played < 10 ? 'Calibrando' : profile.mmr}</span> 
                                | Partidas: ${profile.games_played}/10
                            </p>
                        </div>
                        <div class="col-md-4 text-end">
                            <div class="d-flex gap-2 justify-content-end">
                                <a href="/src/pages/dashboard/index.html" class="btn btn-success fw-bold">
                                    <i class="fas fa-gamepad me-1"></i> IR AL PANEL
                                </a>
                                <button id="btn-logout" class="btn btn-outline-danger btn-sm">
                                    <i class="fas fa-sign-out-alt"></i> Salir
                                </button>
                            </div>
                        </div>
                    </div>
                `;

                // Programar el botón de cerrar sesión
                document.getElementById('btn-logout')?.addEventListener('click', async () => {
                    await supabase.auth.signOut();
                    window.location.reload(); // Refrescar para volver al estado visitante
                });
            }
        }
    } catch (err) {
        console.error("Error detectando sesión:", err);
    }
}

// ===== EVENT LISTENERS =====
function inicializarEventListeners() {
    // Formulario
    elementos.btnAgregar?.addEventListener('click', agregarJugador);
    elementos.btnLimpiar?.addEventListener('click', limpiarFormulario);
    elementos.formulario?.addEventListener('submit', (e) => {
        e.preventDefault();
        agregarJugador();
    });
    
    // Skill slider
    elementos.inputNivel?.addEventListener('input', actualizarSkillDisplay);
    
    // Cola
    elementos.btnIngresar?.addEventListener('click', ingresarACola);
    elementos.btnSalirCola?.addEventListener('click', salirDeCola);
    elementos.btnVaciarCola?.addEventListener('click', vaciarCola);
    elementos.btnSortear?.addEventListener('click', sortearEquipos);
    elementos.btnSortearRapido?.addEventListener('click', sorteoRapido);
    
    // Votación
    elementos.btnConfirmarMapa?.addEventListener('click', finalizarVotacionMapas);
    
    // Resultados
    elementos.btnNuevoSorteo?.addEventListener('click', nuevoSorteo);
    elementos.btnGuardarPartida?.addEventListener('click', guardarPartida);
    
    // Otros
    elementos.btnExportar?.addEventListener('click', exportarJugadores);
}

// ===== FUNCIONES PRINCIPALES =====

// Agregar jugador
function agregarJugador() {
    const nombre = elementos.inputJugador.value.trim();
    const nivel = parseInt(elementos.inputNivel.value);
    const personaje = elementos.inputPersonaje.value;
    
    if (!nombre) {
        mostrarNotificacion('⚠️ Debes ingresar un nombre de jugador', 'warning');
        return;
    }
    
    if (jugadores.some(j => j.nombre.toLowerCase() === nombre.toLowerCase())) {
        mostrarNotificacion('⚠️ Ese jugador ya está registrado', 'warning');
        return;
    }
    
    const jugador = {
        id: Date.now(),
        nombre,
        nivel,
        personaje: personaje || 'No seleccionado',
        fechaRegistro: new Date().toISOString()
    };
    
    jugadores.push(jugador);
    estadisticas.totalJugadores++;
    
    limpiarFormulario();
    actualizarInterfaz();
    guardarDatosLocalStorage();
    
    mostrarNotificacion(`✅ ${nombre} se ha unido a la resistencia!`, 'success');
    reproducirSonido('agregar');
}

// Ingresar a cola global (Supabase)
async function ingresarACola() {
    if (!usuarioActual) {
        mostrarNotificacion('⚠️ Debes iniciar sesión para unirte a la cola', 'warning');
        return;
    }
    
    // Verificar límite localmente
    if (colaJugadores.length >= 8) {
        mostrarNotificacion('⚠️ La cola está llena (máximo 8 jugadores)', 'warning');
        return;
    }

    try {
        // Insertar en la tabla global de Supabase
        const { error } = await supabase
            .from('lobby_queue')
            .insert([{ profile_id: usuarioActual.id }]);

        if (error) {
            // Violación de clave única (ya está en la cola)
            if (error.code === '23505') {
                mostrarNotificacion('⚠️ Ya estás dentro de la cola global', 'warning');
            } else {
                throw error;
            }
        } else {
            mostrarNotificacion('🎯 Te has unido al Lobby global!', 'success');
            reproducirSonido('cola');
        }
    } catch (err) {
        console.error("Error al ingresar a la cola:", err);
        mostrarNotificacion('❌ Error al unirte a la cola en la base de datos', 'danger');
    }
}

// Salir de la cola global (Supabase)
async function salirDeCola() {
    if (!usuarioActual) {
        mostrarNotificacion('⚠️ Debes estar conectado para salir de la cola', 'warning');
        return;
    }

    try {
        const { error } = await supabase
            .from('lobby_queue')
            .delete()
            .eq('profile_id', usuarioActual.id);

        if (error) throw error;
        
        mostrarNotificacion('🚪 Has salido de la cola global', 'info');
    } catch (err) {
        console.error("Error al salir de la cola:", err);
    }
}

// Vaciar cola global (Supabase)
async function vaciarCola() {
    if (colaJugadores.length === 0) {
        mostrarNotificacion('⚠️ La cola ya está vacía', 'warning');
        return;
    }
    
    const cantidad = colaJugadores.length;
    
    try {
        // Condición de borrado total seguro para RLS
        const { error } = await supabase
            .from('lobby_queue')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (error) throw error;
        
        mostrarNotificacion(`🧹 Se vació el lobby (${cantidad} jugadores)`, 'info');
    } catch (err) {
        console.error("Error al vaciar cola en Supabase:", err);
    }
}

// Sortear equipos global en la nube (Supabase Sync)
async function sortearEquipos() {
    if (colaJugadores.length < 4) {
        mostrarNotificacion('⚠️ Se necesitan al menos 4 jugadores para sortear', 'warning');
        return;
    }

    mostrarNotificacion('🎲 Balanceando y creando partida en la nube...', 'info');
    reproducirSonido('sorteo');
    
    const jugadoresEnCola = [...colaJugadores];
    
    // 1. Mezclar jugadores
    for (let i = jugadoresEnCola.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [jugadoresEnCola[i], jugadoresEnCola[j]] = [jugadoresEnCola[j], jugadoresEnCola[i]];
    }
    
    // 2. Dividir en equipos balanceados temporalmente
    const mitad = Math.ceil(jugadoresEnCola.length / 2);
    const equipoAlfa = jugadoresEnCola.slice(0, mitad);
    const equipoBravo = jugadoresEnCola.slice(mitad);

    // Mapear estructura para compatibilidad visual
    equipos = [
        { nombre: 'Supervivientes', jugadores: equipoAlfa },
        { nombre: 'Infectados', jugadores: equipoBravo }
    ];

    try {
        // 3. Obtener mapas candidatos desde Supabase
        const { data: maps, error: mapsErr } = await supabase
            .from('maps')
            .select('*');

        if (mapsErr) throw mapsErr;
        if (!maps || maps.length === 0) throw new Error('No se encontraron mapas');

        // Tomar 3 mapas aleatorios
        const mezclados = [...maps].sort(() => 0.5 - Math.random());
        const chosenMaps = mezclados.slice(0, 3);

        // 4. Crear la Partida Activa en Supabase en estado 'voting'
        const { data: newMatch, error: matchErr } = await supabase
            .from('matches')
            .insert([{
                status: 'voting',
                team_alfa: equipoAlfa,
                team_bravo: equipoBravo,
                map_opt_1: chosenMaps[0].id,
                map_opt_2: chosenMaps[1].id,
                map_opt_3: chosenMaps[2].id,
                recorded_by: usuarioActual ? usuarioActual.id : null
            }])
            .select()
            .single();

        if (matchErr) throw matchErr;

        // Guardar estadísticas básicas locales
        estadisticas.partidasTotales++;
        estadisticas.rachaActual++;
        
        // 5. Limpiar a los jugadores elegidos del Lobby global en Supabase
        const idsSorteados = jugadoresEnCola.map(j => j.id);
        await supabase
            .from('lobby_queue')
            .delete()
            .in('profile_id', idsSorteados);

        mostrarNotificacion('🔥 ¡Lobby cerrado! Votación de mapas iniciada globalmente.', 'success');
        
        // El Realtime propagará la inserción a todas las ventanas automáticamente!

    } catch (err) {
        console.error("Error en sorteo:", err);
        mostrarNotificacion('❌ Error fatal al crear partida en la nube', 'danger');
    }
}

// ===== VOTACIÓN DE MAPAS =====

// Iniciar votación de mapas consultando Supabase
// ===== VOTACIÓN DE MAPAS SINCRONIZADA =====

// Abre el modal de votación para todos los clientes conectados
function abrirModalVotacionPublico() {
    const modalElement = document.getElementById('modal-votacion-mapas');
    if (!modalElement) return;

    // Instanciar el modal de Bootstrap si no existe previamente
    let modalInstance = bootstrap.Modal.getInstance(modalElement);
    if (!modalInstance) {
        modalInstance = new bootstrap.Modal(modalElement);
    }
    
    modalInstance.show();

    // Configurar el botón "Confirmar Mapa" solo para el administrador que lanzó la partida
    if (elementos.btnConfirmarMapa) {
        const esHost = partidaActiva && partidaActiva.recorded_by === (usuarioActual ? usuarioActual.id : null);
        elementos.btnConfirmarMapa.style.display = esHost ? 'block' : 'none';
        elementos.btnConfirmarMapa.disabled = false; 
    }

    renderizarOpcionesVotacionPublica();
}

// Renderiza las cartas de los 3 mapas candidatos bajados de la nube
function renderizarOpcionesVotacionPublica() {
    if (!elementos.containerMapas || !opcionesMapasCompletas.length) return;
    elementos.containerMapas.innerHTML = '';
    
    opcionesMapasCompletas.forEach((mapa, index) => {
        const conteoVotos = votosPartida.filter(v => v.map_id === mapa.id).length;
        
        // Analizamos el estado de voto del usuario actual para dar feedback visual
        const yaVoteEsteMapa = usuarioActual ? votosPartida.some(v => v.profile_id === usuarioActual.id && v.map_id === mapa.id) : false;

        const col = document.createElement('div');
        col.className = 'col-md-4';
        col.innerHTML = `
            <div class="map-vote-card h-100 ${yaVoteEsteMapa ? 'border-success border-3 shadow-pulse animate__animated animate__pulse' : ''}" data-index="${index}">
                <img src="${mapa.image_url || 'https://images.alphacoders.com/105/thumb-1920-105187.jpg'}" class="map-vote-img" alt="${mapa.name}" onerror="this.src='https://images.alphacoders.com/105/thumb-1920-105187.jpg'">
                <div class="map-vote-info">
                    <h6 class="map-vote-name fw-bold">${mapa.name}</h6>
                    <div>
                        <div class="vote-badge mb-2" id="vote-badge-${index}">${conteoVotos}</div>
                    </div>
                    <button class="btn ${yaVoteEsteMapa ? 'btn-success shadow' : 'btn-primary'} w-100 btn-votar" data-index="${index}">
                        <i class="fas ${yaVoteEsteMapa ? 'fa-check-circle' : 'fa-mouse-pointer'} me-1"></i> 
                        ${yaVoteEsteMapa ? 'Tu Voto (Elegido)' : 'Votar / Cambiar'}
                    </button>
                </div>
            </div>
        `;
        
        // Asociar eventos de clic
        const card = col.querySelector('.map-vote-card');
        const btnVotar = col.querySelector('.btn-votar');
        
        const logicVoto = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Si ya votó por este exacto mapa, ignorar click para no saturar.
            // De lo contrario, permitir votar o cambiar el voto al nuevo mapa.
            if (!yaVoteEsteMapa) {
                await registrarVotoEnSupabase(mapa.id);
            }
        };
        
        btnVotar.addEventListener('click', logicVoto);
        card.addEventListener('click', logicVoto);
        
        elementos.containerMapas.appendChild(col);
    });
}

// Envía o ACTUALIZA el voto oficial a la tabla match_votes usando UPSERT
async function registrarVotoEnSupabase(mapId) {
    if (!usuarioActual) {
        mostrarNotificacion('⚠️ Inicia sesión para votar!', 'warning');
        return;
    }
    if (!partidaActiva) return;

    // Opcional: Validar participación activa en los equipos
    const todosLosJugadores = [...equipos[0].jugadores, ...equipos[1].jugadores];
    const soyParticipante = todosLosJugadores.some(p => p.id === usuarioActual.id);
    
    if (!soyParticipante) {
        mostrarNotificacion('⚠️ Espectador: No formas parte de esta partida sorteada', 'warning');
        return;
    }

    try {
        // Cambiamos insert por upsert() permitiendo que cambien el voto en la tabla dinámicamente!
        const { error } = await supabase
            .from('match_votes')
            .upsert([{
                match_id: partidaActiva.id,
                profile_id: usuarioActual.id,
                map_id: mapId
            }], { onConflict: 'match_id,profile_id' });

        if (error) {
            throw error;
        } else {
            mostrarNotificacion('🎯 ¡Voto registrado / actualizado!', 'success');
            reproducirSonido('click');
        }
    } catch (err) {
        console.error("Error registrando o cambiando voto:", err);
        mostrarNotificacion('❌ Error al procesar tu voto', 'danger');
    }
}

// Cierre de votación por parte del Administrador y cálculo de ganador
async function finalizarVotacionMapas() {
    if (!partidaActiva) return;

    mostrarNotificacion('💾 Guardando mapa y cerrando votaciones...', 'info');

    // 1. Sumarizar votos acumulados en caché
    const recuento = {};
    opcionesMapasCompletas.forEach(m => recuento[m.id] = 0);
    
    votosPartida.forEach(v => {
        if (recuento[v.map_id] !== undefined) {
            recuento[v.map_id]++;
        }
    });

    // 2. Evaluar mapa más votado
    let maximoVotos = -1;
    let finalistas = [];

    Object.keys(recuento).forEach(idKey => {
        const currentId = parseInt(idKey);
        const totalVotos = recuento[currentId];
        if (totalVotos > maximoVotos) {
            maximoVotos = totalVotos;
            finalistas = [currentId];
        } else if (totalVotos === maximoVotos) {
            finalistas.push(currentId);
        }
    });

    if (finalistas.length === 0) {
        // Si nadie votó, elegir uno totalmente al azar
        finalistas = opcionesMapasCompletas.map(m => m.id);
    }

    // Desempate totalmente aleatorio si hay colisión
    const finalId = finalistas[Math.floor(Math.random() * finalistas.length)];
    const mapaGanadorObj = opcionesMapasCompletas.find(m => m.id === finalId);

    if (finalistas.length > 1) {
        mostrarNotificacion("🎲 ¡Empate absoluto! Servidor sorteó el mapa.", "info");
    }

    try {
        // 3. Actualizar status a 'playing' y definir el map_id final
        const { error } = await supabase
            .from('matches')
            .update({
                status: 'playing',
                map_id: finalId
            })
            .eq('id', partidaActiva.id);

        if (error) throw error;

        mostrarNotificacion(`🗺️ ¡Mapa definido!: ${mapaGanadorObj.name}`, "success");
        // Todas las demás ventanas captarán el cambio de status a 'playing' vía Realtime!

    } catch (err) {
        console.error("Error en cierre de votación:", err);
        mostrarNotificacion("❌ No se pudo actualizar el servidor", "danger");
    }
}

// ===== SISTEMA DE PERSISTENCIA Y REALTIME DE PARTIDA ACTIVA =====

// Escanea si hay una partida pendiente de votación al cargar la app
async function verificarYRestaurarPartidaActiva() {
    try {
        const { data: active, error } = await supabase
            .from('matches')
            .select('*')
            .eq('status', 'voting')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;

        if (active) {
            partidaActiva = active;
            
            // Reconstruimos el array estructurado clásico para visualización
            equipos = [
                { nombre: 'Supervivientes', jugadores: active.team_alfa || [] },
                { nombre: 'Infectados', jugadores: active.team_bravo || [] }
            ];
            
            // Calcular estadísticas
            equipos.forEach(eq => {
                eq.nivelTotal = eq.jugadores.reduce((sum, j) => sum + (j.nivel || 1000), 0);
                eq.nivelPromedio = eq.nivelTotal / (eq.jugadores.length || 1);
            });

            // Descargar maps candidatos
            const candIds = [active.map_opt_1, active.map_opt_2, active.map_opt_3].filter(Boolean);
            const { data: rawMaps, error: errMaps } = await supabase
                .from('maps')
                .select('*')
                .in('id', candIds);
            
            if (errMaps) throw errMaps;
            opcionesMapasCompletas = rawMaps || [];

            // Descargar votos actuales
            const { data: rawVotes, error: errVotes } = await supabase
                .from('match_votes')
                .select('*')
                .eq('match_id', active.id);

            if (errVotes) throw errVotes;
            votosPartida = rawVotes || [];

            // Lanzar modal sincronizado
            abrirModalVotacionPublico();

            // ⏲️ Activar cuenta atrás sincronizada a milisegundos del servidor!
            iniciarCuentaAtrasVisual();
        } else {
            // 🛡️ CIERRE ABSOLUTO DE EMERGENCIA DEL MODAL PARA TODOS
            forzarCerrarModalVotacion();
            
            if (partidaActiva) {
                partidaActiva = null;
                await cargarUltimaPartidaGanada();
            }
        }
    } catch (err) {
        console.error("Error sincronizando estado de partida:", err);
    }
}

// Actualiza los votos locales consultando el servidor
async function cargarYRefrescarVotos() {
    if (!partidaActiva) return;
    try {
        const { data: votes, error } = await supabase
            .from('match_votes')
            .select('*')
            .eq('match_id', partidaActiva.id);

        if (error) throw error;
        votosPartida = votes || [];
        renderizarOpcionesVotacionPublica(); // Redibujar badges de conteo
    } catch (err) {
        console.error("Error cargando votos en vivo:", err);
    }
}

// Activa la escucha bidireccional para Partidas y Votos
function escucharPartidasEnTiempoReal() {
    // Canal Matches
    supabase
        .channel('live-matches')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, async () => {
            console.log('📡 Señal de partida detectada. Sincronizando...');
            await verificarYRestaurarPartidaActiva();
        })
        .subscribe();

    // Canal Votos - Cambiado a '*' para captar actualizaciones cuando alguien CAMBIA de voto!
    supabase
        .channel('live-votes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'match_votes' }, async (pl) => {
            if (partidaActiva) {
                console.log('📡 Actividad en votos (inserción/actualización) captada...');
                await cargarYRefrescarVotos();
            }
        })
        .subscribe();
}

// ⏲️ TEMPORIZADOR SÚPER PRECIOSO SINCRONIZADO AL TIEMPO DEL SERVIDOR
function iniciarCuentaAtrasVisual() {
    if (intervalCuentaAtras) clearInterval(intervalCuentaAtras);
    
    const spanReloj = document.getElementById('modal-timer-display');
    if (!spanReloj || !partidaActiva) return;

    const duracionTotal = 20; // Duración establecida de 20 segundos
    const timestampCreacion = new Date(partidaActiva.created_at).getTime();

    const tick = async () => {
        const ahora = new Date().getTime();
        // Calculamos exactamente los segundos reales transcurridos desde la base de datos!
        const transcurridos = Math.floor((ahora - timestampCreacion) / 1000);
        const restantes = Math.max(0, duracionTotal - transcurridos);

        spanReloj.innerText = `${restantes}s restantes`;

        // Feedback visual de alerta en los últimos 5 segundos!
        if (restantes <= 5) {
            spanReloj.className = 'badge bg-danger ms-3 fs-6 shadow-pulse animate__animated animate__shakeX animate__infinite';
        } else {
            spanReloj.className = 'badge bg-warning text-dark ms-3 fs-6 shadow-pulse animate__animated animate__pulse animate__infinite';
        }

        if (restantes <= 0) {
            clearInterval(intervalCuentaAtras);
            intervalCuentaAtras = null;
            spanReloj.innerText = "¡TIEMPO CUMPLIDO!";

            // IMPORTANTE: Solo el Host que originó la partida invoca a la API
            // para evitar colisiones o sobreescribir datos si los 8 gatillan a la vez
            const esHost = partidaActiva.recorded_by === (usuarioActual ? usuarioActual.id : null);
            if (esHost) {
                console.log("⏲️ Host disparando cierre automático por tiempo agotado...");
                await finalizarVotacionMapas();
            }
        }
    };

    // Tick inmediato y arranque del intervalo cada segundo
    tick();
    intervalCuentaAtras = setInterval(tick, 1000);
}

// 🛡️ DESTRUCTOR ABSOLUTO DEL MODAL PARA EVITAR BLOQUEOS VISUALES
function forzarCerrarModalVotacion() {
    // Limpiamos timers para liberar memoria
    if (intervalCuentaAtras) {
        clearInterval(intervalCuentaAtras);
        intervalCuentaAtras = null;
    }

    const modalElement = document.getElementById('modal-votacion-mapas');
    if (!modalElement) return;

    // 1. Cerrar vía API oficial de Bootstrap
    const instance = bootstrap.Modal.getInstance(modalElement);
    if (instance) {
        instance.hide();
    }

    // 2. Sanitización profunda del DOM. Los bucles en Realtime a veces dejan huérfanos
    // los backdrops grises de Bootstrap. Esto los barre de raíz para todos los usuarios.
    setTimeout(() => {
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    }, 250);
}

// Carga los resultados del match ganador tras finalizar la votación
async function cargarUltimaPartidaGanada() {
    try {
        const { data: game, error } = await supabase
            .from('matches')
            .select('*, maps:map_id (*)')
            .eq('status', 'playing')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;

        if (game) {
            equipos = [
                { nombre: 'Supervivientes', jugadores: game.team_alfa || [] },
                { nombre: 'Infectados', jugadores: game.team_bravo || [] }
            ];

            equipos.forEach(eq => {
                eq.nivelTotal = eq.jugadores.reduce((sum, j) => sum + (j.nivel || 1000), 0);
                eq.nivelPromedio = eq.nivelTotal / (eq.jugadores.length || 1);
            });

            mapaSeleccionado = game.maps; 
            mostrarResultados();
        }
    } catch (err) {
        console.error("Error cargando resolución final de partida:", err);
    }
}

// ===== FUNCIONES DE TIEMPO REAL (REALTIME) =====

// Cargar la cola de espera desde la base de datos mapeada con sus perfiles
async function cargarColaDesdeSupabase() {
    try {
        const { data, error } = await supabase
            .from('lobby_queue')
            .select(`
                joined_at,
                profiles (
                    id,
                    username,
                    mmr,
                    games_played
                )
            `)
            .order('joined_at', { ascending: true });

        if (error) throw error;

        // Mapear al formato local compatible con la lógica del front
        colaJugadores = (data || [])
            .filter(row => row.profiles) // Evitar filas nulas por seguridad
            .map(row => {
                const p = row.profiles;
                return {
                    id: p.id,
                    nombre: p.username,
                    nivel: p.mmr || 1000,
                    games_played: p.games_played || 0,
                    personaje: 'No seleccionado'
                };
            });

        // Refrescar la interfaz local con los datos recién bajados de la nube
        actualizarEstadisticas();
        actualizarCola();
        actualizarBotones();
    } catch (err) {
        console.error("Error al sincronizar la cola con Supabase:", err);
    }
}

// Suscribirse a los cambios en tiempo real sobre la tabla de cola
function escucharColaEnTiempoReal() {
    supabase
        .channel('lobby-realtime')
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'lobby_queue' }, 
            async (payload) => {
                console.log('📡 Cambio detectado en lobby global:', payload.eventType);
                // Cuando alguien entra, sale o se limpia la cola, recargamos la cola para todos
                await cargarColaDesdeSupabase();
            }
        )
        .subscribe();
}

// Sorteo rápido (DB Realtime adaptive)
async function sorteoRapido() {
    if (jugadores.length < 4) {
        mostrarNotificacion('⚠️ Registra al menos 4 jugadores para probar el sorteo rápido', 'warning');
        return;
    }
    
    mostrarNotificacion('⚡ Rellenando lobby global...', 'info');
    
    try {
        // 1. Identificamos jugadores que NO estén actualmente en la cola
        const disponibles = jugadores.filter(j => !colaJugadores.some(c => c.id === j.id));
        
        // 2. Calculamos cuántos cupos libres quedan (máximo 8)
        const cuposLibres = 8 - colaJugadores.length;
        
        if (cuposLibres <= 0) {
            // Si ya estaba lleno, simplemente sorteamos directamente
            sortearEquipos();
            return;
        }
        
        // 3. Seleccionamos perfiles aleatorios
        const elegidos = [...disponibles]
            .sort(() => 0.5 - Math.random())
            .slice(0, cuposLibres);
            
        if (elegidos.length === 0 && colaJugadores.length < 4) {
            mostrarNotificacion('⚠️ No hay suficientes perfiles en base de datos para completar 4', 'warning');
            return;
        }

        // 4. Los metemos en masa a la tabla lobby_queue en Supabase
        if (elegidos.length > 0) {
            const inserts = elegidos.map(e => ({ profile_id: e.id }));
            const { error } = await supabase
                .from('lobby_queue')
                .insert(inserts);
                
            if (error) throw error;
        }
        
        // 5. Esperamos un brevísimo instante para que el evento realtime actualice e invocamos
        setTimeout(() => sortearEquipos(), 800);

    } catch (err) {
        console.error("Error en sorteo rápido de base de datos:", err);
        mostrarNotificacion('❌ Error al poblar el lobby global', 'danger');
    }
}

// Mostrar resultados en un Layout VERSUS profesional al centro
function mostrarResultados() {
    elementos.resultadosSection.style.display = 'block';
    elementos.equiposResultados.innerHTML = '';
    
    // 1. Limpiamos contenedor clásico de banner (ahora irá al centro en el círculo)
    if (elementos.containerMapaElegido) {
        elementos.containerMapaElegido.innerHTML = '';
    }

    if (!equipos || equipos.length < 2) return;

    // 2. Calcular Predicción / Probabilidades Matemáticas de victoria (Algoritmo Elo simplificado)
    const eq1 = equipos[0];
    const eq2 = equipos[1];
    
    const avg1 = eq1.jugadores.reduce((sum, j) => sum + (j.nivel || 1000), 0) / (eq1.jugadores.length || 1);
    const avg2 = eq2.jugadores.reduce((sum, j) => sum + (j.nivel || 1000), 0) / (eq2.jugadores.length || 1);
    
    // Calculamos el Elo rating probability
    const probA = 1 / (1 + Math.pow(10, (avg2 - avg1) / 400));
    const percentA = Math.round(probA * 100);
    const percentB = 100 - percentA;

    // 3. Fabricar las columnas de los equipos (col-lg-5)
    const colIzq = crearEquipoCard(eq1, 0); // Supervivientes
    const colDer = crearEquipoCard(eq2, 1); // Infectados

    // 4. Fabricar el Centro de Colisión VERSUS (col-lg-2)
    const colCentro = document.createElement('div');
    colCentro.className = 'col-lg-2 d-flex align-items-center justify-content-center py-3';
    
    const urlMapa = mapaSeleccionado ? mapaSeleccionado.image_url : 'https://images.alphacoders.com/105/thumb-1920-105187.jpg';
    const nombreMapa = mapaSeleccionado ? mapaSeleccionado.name : 'Campaña Aleatoria';

    colCentro.innerHTML = `
        <div class="vs-center-container text-center animate__animated animate__zoomIn shadow">
            <div class="vs-badge">VS</div>
            
            <div class="vs-map-circle-wrap">
                <img src="${urlMapa}" class="vs-map-circle-img" onerror="this.src='https://images.alphacoders.com/105/thumb-1920-105187.jpg'" alt="Mapa">
            </div>
            
            <h6 class="text-warning fw-bold text-uppercase letter-spacing-1 mb-3" style="font-size: 0.85rem; text-shadow: 1px 1px 3px #000;">
                ${nombreMapa}
            </h6>

            <!-- Probabilidad de Victoria Inteligente -->
            <div class="prediction-container p-2 rounded shadow-sm">
                <small class="text-white-50 d-block mb-2 fw-bold" style="font-size: 0.6rem; letter-spacing: 1px; font-family: 'Russo One', sans-serif;">PROBABILIDAD</small>
                <div class="d-flex justify-content-between align-items-center gap-1">
                    <span class="badge bg-danger px-1.5" style="font-size: 0.7rem;">${percentA}%</span>
                    <div class="progress bg-secondary flex-grow-1" style="height: 5px;">
                        <div class="progress-bar bg-danger" role="progressbar" style="width: ${percentA}%"></div>
                        <div class="progress-bar bg-success" role="progressbar" style="width: ${percentB}%"></div>
                    </div>
                    <span class="badge bg-success px-1.5" style="font-size: 0.7rem;">${percentB}%</span>
                </div>
            </div>
        </div>
    `;

    // Insertamos en el row en el orden visual exacto: IZQ -> CENTRO -> DER
    elementos.equiposResultados.appendChild(colIzq);
    elementos.equiposResultados.appendChild(colCentro);
    elementos.equiposResultados.appendChild(colDer);
    
    // Scroll fluido a resultados
    elementos.resultadosSection.scrollIntoView({ behavior: 'smooth' });
}

// Crear card de equipo optimizada para el versus lateral
function crearEquipoCard(equipo, index) {
    const col = document.createElement('div');
    col.className = 'col-lg-5'; // Ajustamos de col-lg-6 a col-lg-5 para dejar espacio al centro
    
    const equipoClase = index === 0 ? 'equipo-alfa' : 'equipo-bravo';
    const colorPrimario = index === 0 ? 'var(--sangre-brillante)' : 'var(--verde-bio)';
    const colorSecundario = index === 0 ? 'var(--sangre-oscuro)' : '#006600';
    const icono = index === 0 ? '<i class="fas fa-shield-virus me-2"></i>' : '<i class="fas fa-biohazard me-2"></i>';
    
    col.innerHTML = `
        <div class="equipo-card ${equipoClase} shadow-lg border border-secondary border-opacity-25 h-100">
            <div class="equipo-header d-flex justify-content-between align-items-center" style="background: linear-gradient(135deg, ${colorPrimario}, ${colorSecundario}); padding: 12px 18px;">
                <h3 class="mb-0 text-uppercase fw-bold" style="font-family: 'Russo One', sans-serif; font-size: 1.3rem; letter-spacing: 1px;">
                    ${icono}${equipo.nombre}
                </h3>
                <div class="equipo-stats">
                    <!-- Reemplazamos promedio numérico por badge de calibración real del pug -->
                    <span class="badge bg-warning text-dark px-2 py-1 shadow-sm" style="font-size: 0.65rem; font-weight: 900; letter-spacing: 0.5px;">
                        <i class="fas fa-spinner fa-spin me-1" style="animation-duration: 3s;"></i> CALIBRANDO
                    </span>
                </div>
            </div>
            <div class="equipo-jugadores p-3">
                ${equipo.jugadores.map(jugador => `
                    <div class="equipo-jugador bg-dark bg-opacity-25 rounded border border-secondary border-opacity-10 p-2 mb-2 d-flex align-items-center">
                        <div class="jugador-avatar-small fs-3 me-3">
                            ${getPersonajeEmoji(jugador.personaje)}
                        </div>
                        <div class="jugador-info-small flex-grow-1">
                            <strong class="text-white" style="font-size: 1.1rem; font-family: 'Oswald', sans-serif; letter-spacing: 0.5px;">${jugador.nombre}</strong>
                            <div class="jugador-nivel mt-0.5">
                                <span class="badge bg-dark text-white-50 border border-secondary border-opacity-25 py-0.5 px-1.5" style="font-size: 0.65rem; letter-spacing: 0.5px;">
                                    Rango Provisional
                                </span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    return col;
}

// Nuevo sorteo
function nuevoSorteo() {
    elementos.resultadosSection.style.display = 'none';
    colaJugadores = [];
    mapaSeleccionado = null; // Reseteamos el mapa seleccionado
    if (elementos.containerMapaElegido) elementos.containerMapaElegido.innerHTML = '';
    actualizarInterfaz();
    guardarDatosLocalStorage();
    mostrarNotificacion('🔄 Preparando nuevo sorteo...', 'info');
}

// Guardar partida
function guardarPartida() {
    const partida = {
        id: Date.now(),
        fecha: new Date().toISOString(),
        equipos: equipos,
        estadisticas: estadisticas
    };
    
    let partidas = JSON.parse(localStorage.getItem('l4d2_partidas') || '[]');
    partidas.push(partida);
    localStorage.setItem('l4d2_partidas', JSON.stringify(partidas));
    
    mostrarNotificacion('💾 Partida guardada exitosamente', 'success');
    reproducirSonido('guardar');
}

// Exportar jugadores
function exportarJugadores() {
    const datos = {
        jugadores: jugadores,
        estadisticas: estadisticas,
        fechaExportacion: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `l4d2_jugadores_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    mostrarNotificacion('📥 Lista de jugadores exportada', 'success');
}

// ===== FUNCIONES DE UI =====

// Actualizar interfaz
async function actualizarInterfaz() {
    actualizarEstadisticas();
    await actualizarJugadoresGrid();
    actualizarCola();
    actualizarBotones();
}

// Actualizar estadísticas
function actualizarEstadisticas() {
    elementos.totalJugadores.textContent = jugadores.length;
    elementos.colaCount.textContent = colaJugadores.length;
    elementos.queueCount.textContent = `${colaJugadores.length}/8`;
    elementos.partidasTotales.textContent = estadisticas.partidasTotales;
    elementos.rachaActual.textContent = estadisticas.rachaActual;
}

// Actualizar grid de jugadores desde Supabase
async function actualizarJugadoresGrid() {
    if (!elementos.jugadoresGrid) return;
    
    try {
        // Obtenemos jugadores reales, ordenados por MMR de mayor a menor
        const { data: players, error } = await supabase
            .from('profiles')
            .select('*')
            .order('mmr', { ascending: false });

        if (error) throw error;

        // 🚀 NUEVO: Mapear y sincronizar con la lista global 'jugadores'
        // Esto permite que el botón 'Sorteo Rápido' funcione con los perfiles reales de la base de datos
        jugadores = (players || []).map(p => ({
            id: p.id,
            nombre: p.username,
            nivel: p.mmr || 1000,
            games_played: p.games_played || 0,
            personaje: 'No seleccionado'
        }));

        if (!players || players.length === 0) {
            elementos.jugadoresGrid.innerHTML = `
                <div class="col-lg-4 col-md-6">
                    <div class="player-card">
                        <div class="player-avatar"><i class="fas fa-user-secret"></i></div>
                        <div class="player-info">
                            <h5 class="player-name">Esperando jugadores...</h5>
                            <div class="player-stats">
                                <span class="badge bg-secondary">Sin registros aún</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            return;
        }
        
        // Renderizado real
        elementos.jugadoresGrid.innerHTML = players.map(p => {
            // Lógica de Ocultar MMR si < 10 partidas
            const mmrDisplay = p.games_played < 10 ? 'Calibrando' : p.mmr;
            const badgeColor = p.games_played < 10 ? 'bg-warning text-dark' : 'bg-danger';

            return `
                <div class="col-lg-4 col-md-6">
                    <div class="player-card h-100">
                        <div class="player-avatar">
                            ${getPersonajeEmoji(p.avatar_url || 'No seleccionado')}
                        </div>
                        <div class="player-info">
                            <h5 class="player-name fw-bold">${p.username}</h5>
                            <div class="player-stats">
                                <span class="badge ${badgeColor} fs-6">MMR: ${mmrDisplay}</span>
                                <span class="badge bg-dark small">${p.games_played}/10 PJ</span>
                                ${colaJugadores.some(c => c.id === p.id) ? '<span class="badge bg-success ms-1">EN COLA</span>' : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Error cargando ranking:", err);
        elementos.jugadoresGrid.innerHTML = `<p class="text-danger">Error al conectar con la base de datos.</p>`;
    }
}

// Actualizar cola
function actualizarCola() {
    if (!elementos.colaLista) return;
    
    if (colaJugadores.length === 0) {
        elementos.colaLista.innerHTML = `
            <li class="queue-item empty">
                <i class="fas fa-user-plus me-2"></i>
                No hay jugadores en la cola
            </li>
        `;
        return;
    }
    
    elementos.colaLista.innerHTML = colaJugadores.map((jugador, index) => {
        // Lógica de Ocultar MMR en Cola si está calibrando
        const mmrCola = jugador.games_played < 10 ? 'Calibrando' : jugador.nivel;
        return `
            <li class="queue-item">
                <strong>#${index + 1}</strong> ${jugador.nombre} - 
                <span class="text-warning">${mmrCola}</span>
            </li>
        `;
    }).join('');
}

// Actualizar botones
function actualizarBotones() {
    if (elementos.btnSortear) {
        elementos.btnSortear.disabled = colaJugadores.length < 4;
    }
    
    if (elementos.btnSalirCola) {
        elementos.btnSalirCola.disabled = colaJugadores.length === 0;
    }
    
    if (elementos.btnVaciarCola) {
        elementos.btnVaciarCola.disabled = colaJugadores.length === 0;
    }
}

// Actualizar display de skill
function actualizarSkillDisplay() {
    const valor = elementos.inputNivel.value;
    elementos.skillValue.textContent = valor;
    
    // Cambiar color según nivel
    elementos.skillValue.className = 'skill-value badge fs-6';
    if (valor <= 3) {
        elementos.skillValue.classList.add('bg-success');
    } else if (valor <= 7) {
        elementos.skillValue.classList.add('bg-warning');
    } else {
        elementos.skillValue.classList.add('bg-danger');
    }
}

// Limpiar formulario
function limpiarFormulario() {
    elementos.formulario.reset();
    elementos.inputNivel.value = 5;
    actualizarSkillDisplay();
}

// ===== FUNCIONES AUXILIARES =====

// Obtener emoji de personaje
function getPersonajeEmoji(personaje) {
    const emojis = {
        'coach': '🏋️',
        'ellis': '👨‍🌾',
        'nick': '🕵️',
        'rochelle': '💁',
        'No seleccionado': '🎮'
    };
    return emojis[personaje] || '🎮';
}

// Mostrar notificación
function mostrarNotificacion(mensaje, tipo = 'info') {
    // Crear elemento de notificación
    const notificacion = document.createElement('div');
    notificacion.className = `notificacion notificacion-${tipo}`;
    notificacion.innerHTML = `
        <div class="notificacion-content">
            ${mensaje}
        </div>
    `;
    
    // Estilos
    notificacion.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${getNotificacionColor(tipo)};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 9999;
        font-family: 'Oswald', sans-serif;
        font-size: 1rem;
        max-width: 300px;
        animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(notificacion);
    
    // Remover después de 3 segundos
    setTimeout(() => {
        notificacion.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (notificacion.parentNode) {
                notificacion.parentNode.removeChild(notificacion);
            }
        }, 300);
    }, 3000);
}

// Obtener color de notificación
function getNotificacionColor(tipo) {
    const colores = {
        success: 'var(--verde-bio)',
        warning: 'var(--naranja-alarma)',
        info: 'var(--sangre-brillante)',
        error: '#8B0000'
    };
    return colores[tipo] || colores.info;
}

// Reproducir sonido (simulado)
function reproducirSonido(tipo) {
    if (!elementos.soundEffects?.checked) return;
    
    // Aquí podrías agregar sonidos reales
    console.log(`🔊 Reproduciendo sonido: ${tipo}`);
}

// ===== LOCAL STORAGE =====

// Guardar datos en localStorage
function guardarDatosLocalStorage() {
    const datos = {
        jugadores,
        colaJugadores,
        estadisticas
    };
    localStorage.setItem('l4d2_datos', JSON.stringify(datos));
}

// Cargar datos desde localStorage
function cargarDatosLocalStorage() {
    try {
        const datos = JSON.parse(localStorage.getItem('l4d2_datos') || '{}');
        jugadores = datos.jugadores || [];
        colaJugadores = datos.colaJugadores || [];
        estadisticas = datos.estadisticas || estadisticas;
    } catch (error) {
        console.error('Error cargando datos:', error);
    }
}

// ===== CSS DINÁMICO =====

// Agregar estilos dinámicos
const estilosDinamicos = document.createElement('style');
estilosDinamicos.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .equipo-card {
        background: linear-gradient(135deg, rgba(26, 26, 26, 0.9) 0%, rgba(45, 45, 45, 0.9) 100%);
        border: 2px solid var(--sangre-oscuro);
        border-radius: 10px;
        overflow: hidden;
        margin-bottom: 20px;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
    }
    
    .equipo-header {
        padding: 20px;
        color: white;
        text-align: center;
    }
    
    .equipo-header h3 {
        font-family: 'Russo One', sans-serif;
        margin: 0 0 10px 0;
        font-size: 1.5rem;
    }
    
    .equipo-jugadores {
        padding: 20px;
    }
    
    .equipo-jugador {
        display: flex;
        align-items: center;
        gap: 15px;
        padding: 10px;
        margin-bottom: 10px;
        background: rgba(26, 26, 26, 0.5);
        border-radius: 8px;
        transition: all 0.3s ease;
    }
    
    .equipo-jugador:hover {
        background: rgba(139, 0, 0, 0.2);
        transform: translateX(5px);
    }
    
    .jugador-avatar-small {
        width: 40px;
        height: 40px;
        background: var(--sangre-oscuro);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.2rem;
        flex-shrink: 0;
    }
    
    .jugador-info-small {
        flex: 1;
    }
    
    .jugador-info-small strong {
        color: var(--blanco-hueso);
        font-family: 'Russo One', sans-serif;
    }
    
    .jugador-nivel {
        margin-top: 5px;
        display: flex;
        gap: 10px;
        align-items: center;
    }
    
    .jugador-nivel small {
        color: rgba(245, 245, 245, 0.7);
        font-size: 0.8rem;
    }
`;

document.head.appendChild(estilosDinamicos);
