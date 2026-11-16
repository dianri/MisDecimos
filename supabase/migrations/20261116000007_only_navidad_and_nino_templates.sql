-- ============================================================================
-- Migración: 20261116000007_only_navidad_and_nino_templates.sql
-- Descripción: Limitar los sorteos de la plataforma a Lotería de Navidad y El Niño,
--              desactivando cualquier plantilla de sorteo ordinario ajena.
-- ============================================================================

-- Desactivar plantillas que no sean NAVIDAD ni EL_NINO
update public.draw_templates
set is_active = false
where draw_type not in ('NAVIDAD', 'EL_NINO');

-- Asegurar que las plantillas de Navidad y El Niño estén activas con template_image_url nulo
update public.draw_templates
set is_active = true,
    template_image_url = null
where draw_type in ('NAVIDAD', 'EL_NINO');
