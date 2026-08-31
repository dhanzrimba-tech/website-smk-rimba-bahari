-- Keamanan area pengelolaan berita SMK Kehutanan Rimba Bahari
-- Jalankan di Supabase SQL Editor.
-- Tujuan: publik boleh membaca berita, tetapi hanya user yang sudah SIGN IN
-- yang boleh menambah, mengubah, menghapus berita dan file fotonya.

alter table public.berita enable row level security;

drop policy if exists "berita_public_read" on public.berita;
drop policy if exists "berita_auth_insert" on public.berita;
drop policy if exists "berita_auth_update" on public.berita;
drop policy if exists "berita_auth_delete" on public.berita;

create policy "berita_public_read"
on public.berita for select
to anon, authenticated
using (true);

create policy "berita_auth_insert"
on public.berita for insert
to authenticated
with check (true);

create policy "berita_auth_update"
on public.berita for update
to authenticated
using (true)
with check (true);

create policy "berita_auth_delete"
on public.berita for delete
to authenticated
using (true);

-- Storage bucket "berita":
-- Pastikan bucket bernama berita sudah ada dan Public = ON agar foto
-- dapat tampil di website publik.

drop policy if exists "berita_storage_public_read" on storage.objects;
drop policy if exists "berita_storage_auth_insert" on storage.objects;
drop policy if exists "berita_storage_auth_update" on storage.objects;
drop policy if exists "berita_storage_auth_delete" on storage.objects;

create policy "berita_storage_public_read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'berita');

create policy "berita_storage_auth_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'berita');

create policy "berita_storage_auth_update"
on storage.objects for update
to authenticated
using (bucket_id = 'berita')
with check (bucket_id = 'berita');

create policy "berita_storage_auth_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'berita');
