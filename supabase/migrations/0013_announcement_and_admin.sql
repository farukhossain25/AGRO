-- 0013_announcement_and_admin.sql
-- ---------------------------------------------------------------------------
-- Two data-only changes that the panel depends on. Both are idempotent, so
-- running this file on an environment that already has them is a no-op.
--
-- 1. The marquee row.  Without it the storefront uses the defaults baked into
--    lib/site-settings.ts, but /foisal/settings looks emptier — with the row the
--    owner starts from real values they can edit.
-- 2. The owner's account is the first admin.  Re-creating an auth user (for
--    example after a Google sign-in) makes the trigger build a fresh `customer`
--    profile, which silently locks the panel: /foisal answers 404 by design
--    until profiles.role = 'admin'. This block restores the role.
--
-- Replace the two addresses below with the addresses that should own the panel.
-- ---------------------------------------------------------------------------

-- 1 ── the announcement marquee ------------------------------------------------
insert into public.settings (key, value)
values (
  'announcement',
  jsonb_build_object(
    'enabled', true,
    'show_mobile', true,
    'speed', 38,
    'messages_bn', jsonb_build_array(
      'খামার থেকে সরাসরি আপনার পরিবারের খাবার টেবিলে',
      'সারা বাংলাদেশে ডেলিভারি · ঢাকায় ২৪ ঘণ্টায় পৌঁছে যাবে',
      '৳১২০০+ অর্ডারে ডেলিভারি ফ্রি'
    ),
    'messages_en', jsonb_build_array(
      'Straight from the farm to your family table',
      'Nationwide delivery · 24-hour delivery inside Dhaka',
      'Free delivery on orders over ৳1200'
    ),
    'link_url', '/products',
    'link_label_bn', 'আজকের অফার দেখুন',
    'link_label_en', 'See today''s offers'
  )
)
on conflict (key) do nothing;

-- 2 ── bootstrap the owner account -------------------------------------------
update public.profiles p
   set role = 'admin',
       updated_at = now()
  from auth.users u
 where u.id = p.id
   and lower(u.email) in ('foysaliqbal09@gmail.com', 'farukhossain01764@gmail.com')
   and p.role <> 'admin';

-- Read back what the panel will see.
select u.email, p.role
  from public.profiles p
  join auth.users u on u.id = p.id
 order by (p.role = 'admin') desc, p.created_at;
