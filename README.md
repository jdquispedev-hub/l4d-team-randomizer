# 🧟‍♂️ L4D2 Team Randomizer - Competitivo & Matchmaking Pro 🏆

¡Bienvenido al sistema definitivo de emparejamiento competitivo para Left 4 Dead 2! Esta es una plataforma web moderna diseñada para automatizar, equilibrar y profesionalizar las salas de Versus entre amigos, eliminando el desbalanceo y los "jugadores fantasma".

![Version](https://img.shields.io/badge/versión-2.0_Pro-success?style=for-the-badge&logo=github)
![Tech](https://img.shields.io/badge/Stack-Vite_%2B_Supabase-blueviolet?style=for-the-badge)
![Status](https://img.shields.io/badge/Despliegue-Listo_para_Vercel-FF3366?style=for-the-badge)

---

## 🚀 Características Principales (Key Features)

El proyecto ha evolucionado de un simple randomizador a un ecosistema de eSports completo:

### 🧠 1. Algoritmo de Emparejamiento Combinatorio (MMR Balancer)
Olvídate de los equipos injustos. El sistema ejecuta un análisis combinatorio de fuerza bruta en milisegundos para evaluar las cientos de alineaciones posibles.
*   Calcula la diferencia absoluta de MMR entre ambos bandos.
*   Implementa **Smart Variety**: no solo elige la mejor combinación teórica, sino que selecciona al azar entre un *pool* de variantes con un margen óptimo de tolerancia (+40 MMR) para garantizar rejugabilidad.

### 🚨 2. Sistema "Ready Check" de 15 Segundos (Anti-Fantasmas)
Inspirado en los grandes títulos competitivos (CS:GO, Dota 2). 
*   Al iniciar el sorteo, a los convocados les salta un modal sincronizado en tiempo real.
*   Si un jugador no presiona **"Aceptar"** antes de que el contador de 15 segundos expire, el sistema lo expulsa de la cola global y cancela la partida automáticamente de forma distribuida, protegiendo a los jugadores activos.

### 🏆 3. Salón de la Fama (Leaderboard Extendido)
Una página dedicada e interactiva (`/src/pages/leaderboard`) que lee el historial de Supabase en vivo:
*   **🔍 Buscador Instantáneo:** Encuentra supervivientes o infectados en tiempo real.
*   **🥇 Sistema de Ligas por MMR:** Rangos visuales dinámicos (*Infectado Común, Hunter Acechante, Boomer Master, Charger Elite* y el mítico *Tank Legendario*).
*   **🔥 Rachas y Win Rate:** Cálculo en el lado del cliente de rachas de victorias activas consecutivas (con llamas animadas) y círculos de luz con el porcentaje real de victoria (Win Rate %).

### 🔊 4. Motor de Audio Inmersivo e Interfaz Premium
Estética **Deep Dark Mode** con acabados de cristal esmerilado (*Glassmorphism*):
*   Sonidos atmosféricos oficiales de L4D2.
*   **Fade-Out inteligente de 500ms** y límite de tiempo automático para garantizar que los efectos de sonido de la UI sean cortos, precisos y placenteros al oído.

### 💬 5. Notificaciones a Discord en Vivo
Integración nativa con **Webhooks de Discord**. Al finalizar las votaciones, el sistema envía un reporte de combate automatizado con la alineación definitiva de equipos y la campaña votada para que toda tu comunidad se entere.

---

## 🛠️ Stack Tecnológico

*   **Frontend:** HTML5 Semántico, CSS3 (Custom Glassmorphism / Neon Themes), Vanilla Javascript Moderno (ESM).
*   **Bundler/Build Tools:** [Vite 8](https://vitejs.dev/) para una compilación ultra-rápida.
*   **Framework Visual:** Bootstrap 5.3 + FontAwesome 6 + Animate.css.
*   **Base de Datos y Backend-as-a-Service:** [Supabase](https://supabase.com/) (PostgreSQL, Autenticación de usuarios y canales **Realtime** para sincronización instantánea multi-dispositivo).

---

## 📦 Configuración Local (Local Setup)

Sigue estos pasos para correr el proyecto en tu entorno local en menos de un minuto:

1.  **Clonar el repositorio e instalar dependencias:**
    ```bash
    git clone https://github.com/tu-usuario/l4d-team-randomizer.git
    cd l4d-team-randomizer
    npm install
    ```

2.  **Configurar variables de entorno:**
    Crea un archivo llamado `.env` en la raíz del proyecto y define las siguientes variables con tus credenciales de Supabase y Discord:
    ```env
    VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
    VITE_SUPABASE_ANON_KEY=tu-clave-anon-publica
    VITE_DISCORD_WEBHOOK_URL=tu-webhook-opcional
    ```

3.  **Ejecutar servidor de desarrollo:**
    ```bash
    npm run dev
    ```
    Abre tu navegador en [http://localhost:5173](http://localhost:5173) ¡y listo!

---

## 🌐 Despliegue Gratuito en Vercel (Deployment)

El proyecto está 100% optimizado y configurado en `vite.config.js` para funcionar perfectamente en la nube sin costo alguno:

1.  Crea un nuevo proyecto en **Vercel** importando tu repositorio de GitHub.
2.  **IMPORTANTE:** En la pestaña de **Environment Variables**, copia y pega las variables de tu archivo `.env` local.
3.  Presiona **Deploy**. Vercel se encargará de compilar tu código y entregarte una URL pública en cuestión de segundos.

---

## 📜 Licencia e Intención
Desarrollado con pasión para los fanáticos de **Left 4 Dead 2**. Siéntete libre de clonarlo, bifurcarlo y adaptarlo para las partidas de tu propia comunidad. ¡Sobrevive, lucha y winnea! 🩸⚔️
