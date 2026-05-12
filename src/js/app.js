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
    
    // Configuración
    autoBalance: document.getElementById('auto-balance'),
    soundEffects: document.getElementById('sound-effects'),
    btnExportar: document.getElementById('exportar-jugadores')
};

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', async () => {
    inicializarEventListeners();
    cargarDatosLocalStorage();
    actualizarInterfaz();
    
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

// Ingresar a cola
async function ingresarACola() {
    // Si no hemos verificado sesión aún, intentamos una vez
    if (!usuarioActual) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            mostrarNotificacion('⚠️ Debes iniciar sesión para unirte a la cola', 'warning');
            return;
        }
        // Si hay sesión pero no perfil, la función verificarSesionUsuario debería encargarse, esperamos.
        mostrarNotificacion('⚠️ Cargando datos de tu cuenta...', 'info');
        return;
    }
    
    if (colaJugadores.length >= 8) {
        mostrarNotificacion('⚠️ La cola está llena (máximo 8 jugadores)', 'warning');
        return;
    }
    
    // Adaptamos el perfil a la estructura que espera la cola
    const jugadorCola = {
        id: usuarioActual.id,
        nombre: usuarioActual.username,
        nivel: usuarioActual.mmr || 1000, // Usamos MMR real
        games_played: usuarioActual.games_played || 0,
        personaje: 'No seleccionado'
    };

    // Validar si ya está adentro
    if (!colaJugadores.some(j => j.id === jugadorCola.id)) {
        colaJugadores.push(jugadorCola);
        actualizarInterfaz();
        guardarDatosLocalStorage(); // Mantenemos cola en local por ahora
        mostrarNotificacion(`🎯 ${jugadorCola.nombre} ingresó a la cola`, 'info');
        reproducirSonido('cola');
    } else {
        mostrarNotificacion('⚠️ Ya estás en la cola de espera', 'warning');
    }
}

// Salir de cola
function salirDeCola() {
    if (colaJugadores.length === 0) {
        mostrarNotificacion('⚠️ No hay jugadores en la cola', 'warning');
        return;
    }
    
    const jugadorSalida = colaJugadores.pop();
    actualizarInterfaz();
    guardarDatosLocalStorage();
    mostrarNotificacion(`🚪 ${jugadorSalida.nombre} salió de la cola`, 'info');
}

// Vaciar cola
function vaciarCola() {
    if (colaJugadores.length === 0) {
        mostrarNotificacion('⚠️ La cola ya está vacía', 'warning');
        return;
    }
    
    const cantidad = colaJugadores.length;
    colaJugadores = [];
    actualizarInterfaz();
    guardarDatosLocalStorage();
    mostrarNotificacion(`🧹 Se vació la cola (${cantidad} jugadores)`, 'info');
}

// Sortear equipos
function sortearEquipos() {
    if (colaJugadores.length < 4) {
        mostrarNotificación('⚠️ Se necesitan al menos 4 jugadores para sortear', 'warning');
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
    
    mostrarResultados();
    guardarDatosLocalStorage();
    
    mostrarNotificacion('🎲 ¡Equipos sorteados con éxito!', 'success');
    reproducirSonido('sorteo');
}

// Sorteo rápido
function sorteoRapido() {
    // Agregar jugadores aleatorios a la cola si es necesario
    while (colaJugadores.length < 8 && jugadores.length > colaJugadores.length) {
        const jugadoresDisponibles = jugadores.filter(j => !colaJugadores.some(c => c.id === j.id));
        if (jugadoresDisponibles.length > 0) {
            const jugadorAleatorio = jugadoresDisponibles[Math.floor(Math.random() * jugadoresDisponibles.length)];
            colaJugadores.push(jugadorAleatorio);
        } else {
            break;
        }
    }
    
    actualizarInterfaz();
    
    if (colaJugadores.length >= 4) {
        setTimeout(() => sortearEquipos(), 500);
    } else {
        mostrarNotificacion('⚠️ No hay suficientes jugadores para el sorteo rápido', 'warning');
    }
}

// Mostrar resultados
function mostrarResultados() {
    elementos.resultadosSection.style.display = 'block';
    elementos.equiposResultados.innerHTML = '';
    
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
    actualizarInterfaz();
    guardarDatosLocalStorage();
    mostrarNotificación('🔄 Preparando nuevo sorteo...', 'info');
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
