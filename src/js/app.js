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

// Sortear equipos
function sortearEquipos() {
    if (colaJugadores.length < 4) {
        mostrarNotificacion('⚠️ Se necesitan al menos 4 jugadores para sortear', 'warning');
        return;
    }
    
    const jugadoresEnCola = [...colaJugadores];
    
    // Mezclar jugadores
    for (let i = jugadoresEnCola.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [jugadoresEnCola[i], jugadoresEnCola[j]] = [jugadoresEnCola[j], jugadoresEnCola[i]];
    }
    
    // Dividir en equipos
    const mitad = Math.ceil(jugadoresEnCola.length / 2);
    equipos = [
        { nombre: 'Equipo Alfa', jugadores: jugadoresEnCola.slice(0, mitad) },
        { nombre: 'Equipo Bravo', jugadores: jugadoresEnCola.slice(mitad) }
    ];
    
    // Calcular estadísticas de equipos
    equipos.forEach(equipo => {
        equipo.nivelPromedio = equipo.jugadores.reduce((sum, j) => sum + j.nivel, 0) / equipo.jugadores.length;
        equipo.nivelTotal = equipo.jugadores.reduce((sum, j) => sum + j.nivel, 0);
    });
    
    estadisticas.partidasTotales++;
    estadisticas.rachaActual++;
    
    // 📡 NUEVO: Al sortear, limpiamos los jugadores que acaban de entrar de la cola global
    const idsSorteados = jugadoresEnCola.map(j => j.id);
    supabase.from('lobby_queue').delete().in('profile_id', idsSorteados).then(({ error }) => {
        if (error) console.error("Error limpiando la cola tras el sorteo:", error);
    });
    
    // Iniciar votación de mapas en vez de mostrar resultados inmediatamente
    iniciarVotacionMapas();
    guardarDatosLocalStorage();
    
    mostrarNotificacion('🎲 ¡Equipos sorteados! Abriendo votación de mapas...', 'success');
    reproducirSonido('sorteo');
}

// ===== VOTACIÓN DE MAPAS =====

// Iniciar votación de mapas consultando Supabase
async function iniciarVotacionMapas() {
    if (!elementos.containerMapas) return;
    
    elementos.containerMapas.innerHTML = `
        <div class="col-12 text-center text-warning py-5">
            <div class="spinner-border text-danger me-2" role="status"></div> 
            Cargando mapas oficiales desde Supabase...
        </div>
    `;
    
    if (elementos.btnConfirmarMapa) elementos.btnConfirmarMapa.disabled = true;
    votosMapas = [0, 0, 0];
    mapaSeleccionado = null;

    // Abrir modal programáticamente usando Bootstrap JS cargado en index.html
    const modalElement = document.getElementById('modal-votacion-mapas');
    if (!modalElement) {
        mostrarResultados();
        return;
    }
    
    const modalInstance = new bootstrap.Modal(modalElement);
    modalInstance.show();

    try {
        // Obtenemos los mapas disponibles
        const { data: maps, error } = await supabase
            .from('maps')
            .select('*');
        
        if (error) throw error;
        
        if (!maps || maps.length === 0) {
            throw new Error("No se encontraron mapas en la base de datos.");
        }

        // Elegir 3 mapas al azar sin repetir
        const mezclados = [...maps].sort(() => 0.5 - Math.random());
        opcionesMapas = mezclados.slice(0, Math.min(3, mezclados.length));

        renderizarOpcionesVotacion();
    } catch (err) {
        console.error("Error al cargar mapas de Supabase:", err);
        mostrarNotificacion("⚠️ No se pudieron cargar los mapas de la DB.", "danger");
        
        // Cerrar modal y saltar votación en caso de fallo extrema
        setTimeout(() => {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
            mostrarResultados();
        }, 1500);
    }
}

// Renderizar las 3 cartas de mapas en el modal
function renderizarOpcionesVotacion() {
    if (!elementos.containerMapas) return;
    elementos.containerMapas.innerHTML = '';
    
    opcionesMapas.forEach((mapa, index) => {
        const col = document.createElement('div');
        col.className = 'col-md-4';
        col.innerHTML = `
            <div class="map-vote-card h-100" data-index="${index}">
                <img src="${mapa.image_url || 'https://images.alphacoders.com/105/thumb-1920-105187.jpg'}" class="map-vote-img" alt="${mapa.name}" onerror="this.src='https://images.alphacoders.com/105/thumb-1920-105187.jpg'">
                <div class="map-vote-info">
                    <h6 class="map-vote-name">${mapa.name}</h6>
                    <div>
                        <div class="vote-badge mb-2" id="vote-badge-${index}">0</div>
                    </div>
                    <button class="btn btn-primary w-100 btn-votar" data-index="${index}">
                        <i class="fas fa-plus-circle me-1"></i> Registrar Voto
                    </button>
                </div>
            </div>
        `;
        
        // Eventos de clic para registrar voto (tanto en botón como en carta)
        const card = col.querySelector('.map-vote-card');
        const btnVotar = col.querySelector('.btn-votar');
        
        const handledVote = (e) => {
            e.preventDefault();
            e.stopPropagation();
            registrarVotoLocal(index);
        };
        
        btnVotar.addEventListener('click', handledVote);
        card.addEventListener('click', handledVote);
        
        elementos.containerMapas.appendChild(col);
    });
}

// Incrementar contador local de votos para una opción
function registrarVotoLocal(index) {
    votosMapas[index]++;
    const badge = document.getElementById(`vote-badge-${index}`);
    if (badge) {
        badge.innerText = votosMapas[index];
        badge.classList.add('animate__animated', 'animate__bounceIn');
        setTimeout(() => badge.classList.remove('animate__animated', 'animate__bounceIn'), 500);
    }
    
    if (elementos.btnConfirmarMapa) {
        elementos.btnConfirmarMapa.disabled = false; // Habilitar botón de confirmar al tener al menos un voto
    }
    
    reproducirSonido('click');
}

// Lógica de cierre de votación y desempate
function finalizarVotacionMapas() {
    const maxVotos = Math.max(...votosMapas);
    const indicesGanadores = [];
    
    votosMapas.forEach((votos, index) => {
        if (votos === maxVotos) indicesGanadores.push(index);
    });

    let ganadorIndex;
    if (indicesGanadores.length === 1) {
        ganadorIndex = indicesGanadores[0];
    } else {
        // Desempate aleatorio si hay empate de votos altos
        ganadorIndex = indicesGanadores[Math.floor(Math.random() * indicesGanadores.length)];
        mostrarNotificacion("🎲 ¡Empate! El servidor ha decidido el mapa al azar.", "info");
    }

    mapaSeleccionado = opcionesMapas[ganadorIndex];

    // Cerrar modal programáticamente
    const modalElement = document.getElementById('modal-votacion-mapas');
    const modal = bootstrap.Modal.getInstance(modalElement);
    if (modal) modal.hide();

    // Mostrar finalmente los resultados en la pantalla principal con el mapa ganador
    mostrarResultados();
    mostrarNotificacion(`🗺️ Mapa seleccionado: ${mapaSeleccionado.name}`, "success");
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

// Mostrar resultados
function mostrarResultados() {
    elementos.resultadosSection.style.display = 'block';
    elementos.equiposResultados.innerHTML = '';
    
    // Renderizar mapa elegido en su contenedor
    if (elementos.containerMapaElegido) {
        elementos.containerMapaElegido.innerHTML = '';
        if (mapaSeleccionado) {
            elementos.containerMapaElegido.innerHTML = `
                <div class="mapa-elegido-banner animate__animated animate__fadeIn">
                    <img src="${mapaSeleccionado.image_url || 'https://images.alphacoders.com/105/thumb-1920-105187.jpg'}" class="mapa-elegido-img" alt="${mapaSeleccionado.name}" onerror="this.src='https://images.alphacoders.com/105/thumb-1920-105187.jpg'">
                    <div class="mapa-elegido-info">
                        <h4><i class="fas fa-compass text-danger me-2"></i>CAMPAÑA OFICIAL ELEGIDA</h4>
                        <p class="fw-bold text-warning mb-0">${mapaSeleccionado.name}</p>
                    </div>
                </div>
            `;
        }
    }
    
    equipos.forEach((equipo, index) => {
        const equipoCard = crearEquipoCard(equipo, index);
        elementos.equiposResultados.appendChild(equipoCard);
    });
    
    // Scroll a resultados
    elementos.resultadosSection.scrollIntoView({ behavior: 'smooth' });
}

// Crear card de equipo
function crearEquipoCard(equipo, index) {
    const col = document.createElement('div');
    col.className = 'col-lg-6';
    
    const equipoClase = index === 0 ? 'equipo-alfa' : 'equipo-bravo';
    const colorPrimario = index === 0 ? 'var(--sangre-brillante)' : 'var(--verde-bio)';
    const colorSecundario = index === 0 ? 'var(--sangre-oscuro)' : '#006600';
    
    col.innerHTML = `
        <div class="equipo-card ${equipoClase}">
            <div class="equipo-header" style="background: linear-gradient(135deg, ${colorPrimario}, ${colorSecundario});">
                <h3>${equipo.nombre}</h3>
                <div class="equipo-stats">
                    <span class="badge bg-light text-dark">Nivel Total: ${equipo.nivelTotal}</span>
                    <span class="badge bg-light text-dark">Promedio: ${equipo.nivelPromedio.toFixed(1)}</span>
                </div>
            </div>
            <div class="equipo-jugadores">
                ${equipo.jugadores.map(jugador => `
                    <div class="equipo-jugador">
                        <div class="jugador-avatar-small">
                            ${getPersonajeEmoji(jugador.personaje)}
                        </div>
                        <div class="jugador-info-small">
                            <strong>${jugador.nombre}</strong>
                            <div class="jugador-nivel">
                                <span class="badge bg-secondary">Nivel ${jugador.nivel}</span>
                                <small>${jugador.personaje}</small>
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
    
    mostrarNotificación('💾 Partida guardada exitosamente', 'success');
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
    
    mostrarNotificación('📥 Lista de jugadores exportada', 'success');
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
