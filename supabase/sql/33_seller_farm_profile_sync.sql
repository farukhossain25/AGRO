-- ============================================================================
-- 33_seller_farm_profile_sync.sql
-- ----------------------------------------------------------------------------
-- সমস্যা যা ঠিক করে
--   সেলারের প্রোফাইল দুটো জায়গায় লেখা থাকে:
--       sellers.name_bn / division / district / farm_address_bn / product_types
--       farms.name_bn   / division / district / address_bn       / type
--
--   সেলার আবেদন জমা দেয় → `sellers`-এ তথ্য যায় → অনুমোদনের সময়
--   `ensureSellerFarm()` ওই তথ্য কপি করে `farms`-এ।
--
--   BUT লাইভ পেজ /live/farms পড়ে `farms` থেকে, আর বাকি সব পেজ —
--   /market/<slug>, /farm, সেলারের ড্যাশবোর্ড — পড়ে `sellers` থেকে।
--   ফলে অ্যাডমিন প্যানেলের Farms সেকশনে নাম/ঠিকানা ঠিক করলে শুধু লাইভ
--   পেজে বদলটা দেখা যায়, বাকি সব জায়গায় আবেদনের পুরোনো তথ্য থেকে যায়।
--   এটাই রিপোর্ট হওয়া বাগ: "অন্যন্য পেজগুলোতে সেলার যা ফিল করেছিল সেটাই
--   দেখাচ্ছে"।
--
-- কীভাবে ঠিক করে
--   `sellers` থেকে `farms`-এ একমুখী sync — একটা ট্রিগার, তাই অ্যাডমিন প্যানেল,
--   সেলারের ড্যাশবোর্ড বা ভবিষ্যতের যেকোনো ক্লায়েন্ট — সবার জন্য একই নিয়ম।
--
--   কেন একমুখী, দুইমুখী নয়:
--   * `farms`-এর নিজস্ব কলাম আছে যেগুলো sellers-এ নেই (cover, description_bn,
--     lat/lng, cameras) — সেগুলো অ্যাডমিন স্বাধীনভাবে সম্পাদনা করেন, ট্রিগারে
--     ছোঁয়া উচিত নয়।
--   * দুইমুখী করলে admin → farms ঠিক করে → sellers-এ লেখে → আবার farms-এ
--     লেখার loop তৈরি হয়, আর কোনটা "সত্যি" তা আর বোঝা যায় না।
--   * "সেলার নিজের তথ্য" — নাম, ঠিকানা, ধরন — এর মালিক সেলারই। তাই
--     `sellers` সত্যের উৎস, `farms` তার প্রক্ষেপণ।
--
--   অ্যাডমিন কি `farms`-এ সরাসরি নাম বদলাতে পারবেন? হ্যাঁ — বদলটা সাথে সাথে
--   `sellers`-এও যায়, তাই দুই জায়গায় একই থাকবে। (নিচে দেখুন।)
--
--   ⚠ তবু `farms`-এর নিজস্ব কলাম (cover, description_bn, lat/lng, cameras,
--     is_active, is_premium) ট্রিগার স্পর্শ করে না।
--
-- ২৭–৩২-এর সাথে সামঞ্জস্যপূর্ণ। দুইবার চালালেও নিরাপদ। কোনো ডেটা মুছি না।
-- ============================================================================


-- ============================================================================
-- ১. sellers → farms (সেলার নিজের তথ্য বদলালে)
-- ============================================================================
create or replace function public.sync_seller_to_farm()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_farm   public.farms%rowtype;
  v_type   text;
  v_changed boolean := false;
begin
  -- খামার নেই → কিছু করার নেই (ensureSellerFarm পরে বানাবে)
  if new.farm_id is null then
    return new;
  end if;

  select * into v_farm from public.farms where id = new.farm_id;
  if not found then
    return new;
  end if;

  -- product_types (text[]) → farms.type (enum), sales-এর নিয়মে
  v_type := case
    when 'dairy'   = any(new.product_types) then 'dairy'
    when 'poultry' = any(new.product_types) then 'poultry'
    when 'fish'    = any(new.product_types) then 'fish'
    when 'fruits'  = any(new.product_types) then 'fruits'
    else 'vegetables'
  end;

  -- শুধু তখনই লিখি যখন বাস্তবে কিছু বদলেছে — নইলে প্রতিটি seller update-এ
  -- farms.updated_at অকারণে বদলে যায় আর ISR cache বৃথা revalidate হয়।
  if v_farm.name_bn       is distinct from new.name_bn
     or v_farm.division   is distinct from new.division
     or v_farm.district   is distinct from new.district
     or v_farm.upazila    is distinct from new.upazila
     or v_farm.address_bn is distinct from new.farm_address_bn
     or v_farm.type::text is distinct from v_type
  then
    update public.farms
       set name_bn     = new.name_bn,
           division    = new.division,
           district    = new.district,
           upazila     = new.upazila,
           address_bn  = new.farm_address_bn,
           type        = v_type::public.farm_type,
           updated_at  = now()
     where id = new.farm_id;
    v_changed := true;
  end if;

  if v_changed then
    -- ক্যাশে করা পেজগুলো (/farm ISR, /market, /live) যেন পুরোনো নাম না দেখায়
    perform public.revalidate_farm_hosts();
  end if;

  return new;
end $$;

drop trigger if exists trg_sellers_sync_farm on public.sellers;
create trigger trg_sellers_sync_farm
  after update of name_bn, division, district, upazila, farm_address_bn, product_types, farm_id
  on public.sellers
  for each row
  execute function public.sync_seller_to_farm();


-- ============================================================================
-- ২. farms → sellers (অ্যাডমিন প্যানেলে খামারের নাম/ঠিকানা বদলালে)
-- ============================================================================
-- উল্টো দিকটা এই কারণেই দরকার: অ্যাডমিন /foisal/farms-এ ঢুকে নাম বা জেলা
-- ঠিক করলে সেটা sellers-এ না গেলে /market/<slug> আর সেলারের ড্যাশবোর্ড
-- পুরোনো তথ্য দেখাতেই থাকবে।
--
-- শুধু সেই কলামগুলোই ফেরত যায় যেগুলো sellers-এরও আছে, আর শুধু তখনই যখন
-- কলামগুলোর কোনোটা সত্যিই বদলেছে (guarded update → loop নেই)।
create or replace function public.sync_farm_to_seller()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- নিরাপত্তা: ট্রিগারের ভেতরে আবার এই টেবিলে লিখলে recursion_flag দিয়ে থামি।
  -- (farms-এ UPDATE হলে এটা চলে; ভেতরের UPDATE-টা sellers-এ, তাই আসলে loop হয়
  --  না — কিন্তু ভবিষ্যতে কেউ দুই টেবিলেই ট্রিগার যোগ করলে এই গার্ড বাঁচাবে।)
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if new.name_bn    is distinct from old.name_bn
     or new.division is distinct from old.division
     or new.district is distinct from old.district
     or new.upazila  is distinct from old.upazila
     or new.address_bn is distinct from old.address_bn
  then
    update public.sellers
       set name_bn         = coalesce(new.name_bn, old.name_bn),
           division        = new.division,
           district        = new.district,
           upazila         = new.upazila,
           farm_address_bn = new.address_bn,
           updated_at      = now()
     where farm_id = new.id;
  end if;

  return new;
end $$;

drop trigger if exists trg_farms_sync_seller on public.farms;
create trigger trg_farms_sync_seller
  after update of name_bn, division, district, upazila, address_bn
  on public.farms
  for each row
  execute function public.sync_farm_to_seller();


-- ============================================================================
-- ৩. revalidate_farm_hosts() — ক্যাশে ফেলে দেওয়ার helper
-- ============================================================================
-- ⚠ সত্যি কথা: Postgres নিজে থেকে Next.js-এর ISR ক্যাশে ফেলতে পারে না।
-- আগের কোডে `/api/sellers/profile` রুটের ভেতরে `revalidatePath()` ডাকত,
-- কারণ ওটা Node চলছিল। ট্রিগার ডেটাবেসের ভেতরে চলে, তাই ওখানে Next.js-এর
-- ফাংশন নেই।
--
-- তাই এই ফাংশনটা এখন শুধু একটা বৈধ **hook** — DB-তে কী বদলাল তার একটা সারি
-- রাখে, যাতে ভবিষ্যতে pg_net/webhook যোগ করলে একই ফাংশনেই ডাকা যায়।
-- আপাতত: কোনো লাইভ কাজ নেই, শুধু কমেন্ট ও ভবিষ্যতের জন্য জায়গা।
-- এতে কোনো বাগ তৈরি হয় না — পেজগুলো নিজে থেকেই revalidate হয়
-- (Farm pages-এ `export const revalidate = 600`, market pages dynamic)।
create or replace function public.revalidate_farm_hosts()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Intentionally empty. Next.js ISR ক্যাশে ডেটাবেস থেকে ফেলা যায় না;
  -- রুট-লেভেল revalidatePath আছে /api/sellers/profile ও /api/foisal/[resource]-এ।
  return;
end $$;


-- ============================================================================
-- ৪. একবারের backfill — যেসব খামার এখনো পুরোনো তথ্য ধরে আছে
-- ============================================================================
-- ট্রিগার শুধু ভবিষ্যতের বদল ধরে। যেগুলো ইতিমধ্যে ভুল হয়ে আছে সেগুলো
-- একবার ঠিক করে দিই। farmers যাদের farm_id আছে কিন্তু নাম/জেলা আলাদা।
do $$
declare
  r record;
  v_type public.farm_type;
begin
  for r in
    select s.id as seller_id, s.farm_id, s.name_bn, s.division, s.district,
           s.upazila, s.farm_address_bn, s.product_types,
           f.name_bn as farm_name, f.division as farm_division,
           f.district as farm_district, f.type as farm_type
      from public.sellers s
      join public.farms f on f.id = s.farm_id
     where s.name_bn       is distinct from f.name_bn
        or s.division      is distinct from f.division
        or s.district      is distinct from f.district
        or s.upazila       is distinct from f.upazila
        or s.farm_address_bn is distinct from f.address_bn
  loop
    v_type := case
      when 'dairy'   = any(r.product_types) then 'dairy'
      when 'poultry' = any(r.product_types) then 'poultry'
      when 'fish'    = any(r.product_types) then 'fish'
      when 'fruits'  = any(r.product_types) then 'fruits'
      else 'vegetables'
    end;

    -- farms-কে sellers-এর সাথে মেলাই (sellers সত্যের উৎস)
    update public.farms
       set name_bn    = r.name_bn,
           division   = r.division,
           district   = r.district,
           upazila    = r.upazila,
           address_bn = r.farm_address_bn,
           type       = v_type,
           updated_at = now()
     where id = r.farm_id;

    raise notice 'synced farm % ← seller %', r.farm_id, r.seller_id;
  end loop;
end $$;


-- ============================================================================
-- ৫. অনুমতি
-- ============================================================================
revoke all on function public.sync_seller_to_farm() from public;
revoke all on function public.sync_farm_to_seller() from public;
revoke all on function public.revalidate_farm_hosts() from public;
grant execute on function public.revalidate_farm_hosts() to service_role;


-- ============================================================================
-- ৬. যাচাই
-- ============================================================================
do $$
declare
  v_triggers int;
begin
  select count(*) into v_triggers
    from pg_trigger
   where tgname in ('trg_sellers_sync_farm', 'trg_farms_sync_seller')
     and not tgisinternal;

  if v_triggers <> 2 then
    raise exception 'expected 2 sync triggers, found %', v_triggers;
  end if;

  raise notice '33_seller_farm_profile_sync.sql — ২টি ট্রিগার তৈরি হয়েছে';
end $$;
