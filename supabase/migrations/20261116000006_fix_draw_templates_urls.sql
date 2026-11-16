-- ============================================================================
-- Migración: 20261116000006_fix_draw_templates_urls.sql
-- Descripción: Limpiar template_image_url en public.draw_templates para utilizar
--              el motor vectorial hiperrealista nativo sin peticiones 404 de imagen.
-- ============================================================================

update public.draw_templates
set template_image_url = null
where template_image_url is not null;
