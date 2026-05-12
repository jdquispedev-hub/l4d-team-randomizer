import { createClient } from '@supabase/supabase-js';

// Cargamos las variables de entorno definidas en el archivo .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'TU_URL_AQUI') {
  console.warn('⚠️ Supabase no configurado: Falta definir URL y Key en el archivo .env');
}

// Creamos y exportamos la instancia del cliente para usarla en todo el proyecto
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
