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

    // 2. Descargar perfil del usuario
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

        if (error) throw error;

        if (profile) {
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
