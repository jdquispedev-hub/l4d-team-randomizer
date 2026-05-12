import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', () => {
    
    const registerForm = document.getElementById('register-form');
    const loginForm = document.getElementById('login-form');

    // ==========================================
    // 📝 LÓGICA DE REGISTRO
    // ==========================================
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const btn = registerForm.querySelector('button[type="submit"]');

            if (password.length < 6) {
                alert('⚠️ La contraseña debe tener al menos 6 caracteres.');
                return;
            }

            try {
                btn.disabled = true;
                btn.textContent = 'REGISTRANDO...';

                // 1. Creamos la cuenta en Supabase Auth
                // Pasamos el username en metadata para que el trigger de SQL lo guarde en 'profiles'
                const { data, error } = await supabase.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            username: username,
                        }
                    }
                });

                if (error) throw error;

                alert('✅ ¡Registro exitoso! Revisa tu correo para confirmar la cuenta (o entra si configuraste confirmación opcional).');
                
                // Redirigimos al Login
                window.location.href = '/src/pages/auth/login.html';

            } catch (error) {
                console.error('Error registro:', error);
                alert(`❌ Error al registrar: ${error.message}`);
            } finally {
                btn.disabled = false;
                btn.textContent = 'REGISTRAR CUENTA';
            }
        });
    }

    // ==========================================
    // 🔑 LÓGICA DE INICIO DE SESIÓN
    // ==========================================
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const btn = loginForm.querySelector('button[type="submit"]');

            try {
                btn.disabled = true;
                btn.textContent = 'ENTRANDO...';

                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password,
                });

                if (error) throw error;

                alert(`🔥 Bienvenido de vuelta! Redirigiendo...`);
                
                // Guardar sesión local e ir al root
                window.location.href = '/';

            } catch (error) {
                console.error('Error login:', error);
                alert(`❌ Credenciales incorrectas: ${error.message}`);
            } finally {
                btn.disabled = false;
                btn.textContent = 'INICIAR SESIÓN';
            }
        });
    }
});
