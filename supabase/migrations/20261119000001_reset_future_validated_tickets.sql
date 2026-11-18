-- Migración 20261119000001_reset_future_validated_tickets.sql
-- Restablece a PENDIENTE cualquier billete cuya fecha de sorteo sea futura
-- y que haya sido indebidamente marcado como VALIDADO o comprobado prematuramente.

UPDATE public.tickets
SET
  status = 'PENDIENTE',
  prize_amount_cents = 0,
  last_checked_at = NULL,
  check_source = NULL
WHERE draw_date > CURRENT_DATE
  AND status = 'VALIDADO';
