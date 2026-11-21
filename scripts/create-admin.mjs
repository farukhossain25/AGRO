#!/usr/bin/env node
/**
 * Creates (or updates) the admin account.
 *
 *   node --env-file=.env.local scripts/create-admin.mjs
 *   npm run db:admin
 *
 * Reads ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_PHONE / ADMIN_NAME from the env,
 * falling back to the defaults below.
 */
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("✖ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  console.error("  Run: node --env-file=.env.local scripts/create-admin.mjs");
  process.exit(1);
}

const email = (process.env.ADMIN_EMAIL ?? "admin@bishwasagro.com").toLowerCase().trim();
const password = process.env.ADMIN_PASSWORD ?? "Admin@12345";
const phone = (process.env.ADMIN_PHONE ?? "01700000000").trim();
const name = process.env.ADMIN_NAME ?? "বিশ্বাস এগ্রো অ্যাডমিন";

if (password.length < 8) {
  console.error("✖ ADMIN_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const password_hash = await bcrypt.hash(password, 12);

const { data: existing } = await supabase.from("users").select("id").eq("email", email).maybeSingle();

let error;
if (existing) {
  ({ error } = await supabase
    .from("users")
    .update({ name, phone, password_hash, role: "admin", is_active: true, phone_verified: true })
    .eq("id", existing.id));
} else {
  ({ error } = await supabase.from("users").insert({
    name,
    email,
    phone,
    password_hash,
    role: "admin",
    is_active: true,
    phone_verified: true,
  }));
}

if (error) {
  console.error(`✖ ${error.message}`);
  process.exit(1);
}

console.log(`✅ Admin ${existing ? "updated" : "created"}`);
console.log(`   email:    ${email}`);
console.log(`   password: ${password}`);
console.log(`   login:    /admin/login`);
