# Plan de Implementación: L4D2 MMR Community System

Este documento detalla la estrategia para transformar el actual selector de equipos local en una plataforma web conectada que permita el registro de usuarios, gestión de partidas competitivas y cálculo dinámico de MMR.

## 🚀 Propuesta Tecnológica: Supabase

Para un grupo de aproximadamente 30 personas, **Supabase** es la opción ideal por las siguientes razones:
1. **Nivel Gratuito Generoso**: Es más que suficiente para el tráfico y almacenamiento que generarán 30-50 usuarios.
2. **Autenticación Integrada**: Maneja el registro e inicio de sesión de forma nativa y segura.
3. **Base de Datos PostgreSQL**: Permite realizar consultas complejas para el ranking y estadísticas.
4. **Facilidad de Uso**: Se puede integrar directamente en la arquitectura HTML/JS actual sin necesidad de montar un backend propio (Serverless).

---

## 📊 Modelo de Datos Propuesto (Database Schema)

Se crearán las siguientes tablas en Supabase:

### 1. `profiles` (Información de Jugadores)
| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Vinculado a auth.users |
| `username` | Text | Apodo del jugador |
| `mmr` | Integer | MMR actual (Default: 1000) |
| `games_played` | Integer | Contador de partidas (Default: 0) |
| `avatar_url` | Text | Avatar opcional |
| `created_at` | Timestamp | Fecha de registro |

### 2. `matches` (Registro de Partidas)
| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | BigInt (PK) | ID único de la partida |
| `winner_team` | Text | 'Alfa' o 'Bravo' |
| `mvp_id` | UUID (FK) | Jugador destacado (Opcional) |
| `created_at` | Timestamp | Fecha y hora del juego |
| `recorded_by` | UUID (FK) | Admin que ingresó el resultado |

### 3. `match_participants` (Relación Jugador-Partida)
| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| `match_id` | BigInt (FK) | Partida asociada |
| `player_id` | UUID (FK) | Jugador que participó |
| `team` | Text | 'Alfa' o 'Bravo' |
| `mmr_change` | Integer | Cuánto ganó o perdió en esa partida |

---

## 🧠 Lógica de MMR y Calibración

### Fase de Calibración (Primeras 10 partidas)
* **Visualización**: En el frontend se mostrará como `"Calibrando (X/10)"`. El MMR numérico está oculto al público.
* **Fluctuación**: Durante la calibración, la variación de MMR puede ser mayor (ej: ±50) para ubicar al jugador en su rango real rápidamente.

### Fase Post-Calibración (>10 partidas)
* **Visualización**: El MMR es público y se muestra en el Leaderboard.
* **Fluctuación Estándar**:
  * **Victoria base**: +25 MMR
  * **Derrota base**: -25 MMR
* **Modificadores de Performance (Opcional/Votación)**:
  * **MVP de la partida**: +5 extra.
  * **Factores de equipo**: Se puede promediar el MMR de ambos equipos y dar más puntos si le ganas a un equipo con más MMR promedio.

---

## 🗺️ Mapa de Ruta de Desarrollo (Phases)

### Fase 1: Cimentación e Integración de Supabase (AHORA)
- [ ] Configuración del proyecto en Supabase.
- [ ] Creación de las tablas mencionadas arriba.
- [ ] Reemplazar el `LocalStorage` en `app.js` por llamadas al SDK de Supabase.

### Fase 2: Autenticación y Perfiles
- [ ] Creación de la pantalla de Login/Registro.
- [ ] Flujo de "Reclamar Perfil" para que tus amigos se registren y vinculen su cuenta.
- [ ] Panel de perfil donde el usuario ve sus estadísticas.

### Fase 3: Sistema de MMR y Partidas
- [ ] Implementar panel de administración para registrar partidas finalizadas.
- [ ] Crear la lógica de cálculo (Trigger de base de datos o función JS) que actualice el MMR y la cantidad de partidas jugadas tras registrar un resultado.
- [ ] Lógica de ocultar MMR durante las primeras 10 partidas.

### Fase 4: Leaderboard y UI Avanzada
- [ ] Creación de la página de Ranking (Top Players).
- [ ] Historial de partidas recientes.
- [ ] Pulido visual y animaciones apocalípticas.

---

## 📋 Preguntas Clave para Iniciar

1. **¿Quién registrará los resultados?**: ¿Cualquier jugador puede reportar quién ganó o habrá uno o dos "Administradores" que ingresen los resultados finales?
2. **¿Qué datos de rendimiento quieres evaluar?**: Para variar la ganancia de MMR (+30, +10, +20), ¿se medirá manualmente (ej. votación del MVP) o solo por ganar/perder? 
3. **¿Prefieres migrar a una arquitectura moderna (como Vite/React) o mantener la actual en HTML puro con JS conectado a Supabase?** (Para 30 personas, el HTML/JS actual conectado a Supabase funciona perfecto y es lo más rápido de implementar).

¿Te parece bien este plan para empezar a configurarlo? Si estás de acuerdo, comenzaremos por guiarte en la creación del proyecto Supabase o montando la estructura del frontend.
