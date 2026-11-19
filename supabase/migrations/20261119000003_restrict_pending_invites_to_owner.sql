-- ==============================================================================
-- Migración: 20261119000003_restrict_pending_invites_to_owner.sql
-- Descripción: Restringe la visibilidad de invitaciones pendientes exclusivamente
--              al propietario del décimo (y al usuario que ya la haya aceptado).
--              Impide que participantes terceros puedan listar códigos PIN ni tokens.
-- ==============================================================================

-- 1. Reemplazar la política SELECT en public.pending_invites
DROP POLICY IF EXISTS "pending_invites_select" ON public.pending_invites;

CREATE POLICY "pending_invites_select" ON public.pending_invites
  FOR SELECT
  TO authenticated
  USING (
    (created_by = auth.uid())
    OR public.is_ticket_owner(ticket_id)
    OR (accepted_by_user_id = auth.uid())
  );

COMMENT ON POLICY "pending_invites_select" ON public.pending_invites IS
  'Permite leer invitaciones pendientes únicamente al propietario del décimo o al usuario que ya la aceptó formalmente.';
