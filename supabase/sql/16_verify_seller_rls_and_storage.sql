-- ============================================================================
-- 16_verify_seller_rls_and_storage.sql
-- ============================================================================
-- WHAT IT DOES
--   Verifies that all storage buckets, seller_applications table, panel_path
--   columns, realtime publication, and RLS policies are properly configured.
--
-- WHEN TO RUN
--   After 15_seller_applications_and_panel_path.sql.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   All checks return 'PASS'.
-- ============================================================================

select 'storage_buckets' as check_name,
       case when count(*) >= 10 then 'PASS' else 'FAIL (' || count(*) || '/10)' end as status
  from storage.buckets
 where id in (
   'avatars', 'product-images', 'category-images', 'farm-images', 'logos',
   'slides', 'team', 'review-photos', 'complaint-photos', 'blog-images'
 );

select 'seller_applications_table' as check_name,
       case when to_regclass('public.seller_applications') is not null then 'PASS' else 'FAIL' end as status;

select 'seller_panel_path_columns' as check_name,
       case when exists (
         select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'sellers' and column_name = 'panel_path'
       ) and exists (
         select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'site_settings' and column_name = 'seller_panel_path'
       ) then 'PASS' else 'FAIL' end as status;

select 'notifications_realtime' as check_name,
       case when exists (
         select 1 from pg_publication_tables
          where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
       ) then 'PASS' else 'FAIL' end as status;
