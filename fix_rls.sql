-- Corrección de Políticas de Seguridad (RLS) para permitir Confirmación de Lectura y Reacciones

-- 1. Asegúrate de estar en tu panel de Supabase > SQL Editor
-- 2. Copia y pega todo este código y dale a "Run"

-- Eliminar posibles políticas restrictivas previas sobre UPDATE (si existen y entran en conflicto)
-- (Nota: si tienes políticas con nombres diferentes para el UPDATE, puedes ignorar el DROP o adaptarlo)
DROP POLICY IF EXISTS "Allow users to update their own messages" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;

-- Crear una política unificada que permita tanto al remitente como al destinatario actualizar el mensaje
-- Esto es crucial porque:
-- A) El receptor necesita actualizar "read_at" (para marcar como leído)
-- B) Ambos necesitan actualizar "reactions" (para reaccionar a un mensaje)
CREATE POLICY "Allow participants to update messages" ON messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Opcional: Asegurarse de que el REPLICA IDENTITY esté en FULL para que los webhooks de Realtime envíen todos los datos
ALTER TABLE messages REPLICA IDENTITY FULL;
