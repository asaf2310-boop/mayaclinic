create table if not exists gift_vouchers (
  id uuid primary key default gen_random_uuid(), tenant_id text not null default 'maya',
  code text not null unique, status text not null default 'active' check (status in ('pending_payment','active','exhausted','cancelled')),
  treatments_total integer not null check (treatments_total between 1 and 10), treatments_remaining integer not null check (treatments_remaining >= 0),
  unit_price_agorot integer not null default 25000, amount_agorot integer not null,
  purchaser_name text not null, purchaser_phone text not null, purchaser_email text not null,
  recipient_name text not null default '', recipient_email text, recipient_phone text, send_to_recipient boolean not null default false, send_to_whatsapp boolean not null default false, greeting text,
  pelecard_booking_ref text, appointment_ids uuid[] not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint gift_vouchers_remaining_lte_total check (treatments_remaining <= treatments_total)
);
create unique index if not exists idx_gift_vouchers_code_upper on gift_vouchers (upper(code));
create index if not exists idx_gift_vouchers_tenant on gift_vouchers(tenant_id);
create index if not exists idx_gift_vouchers_booking_ref on gift_vouchers(pelecard_booking_ref);
alter table gift_vouchers enable row level security;
alter table gift_vouchers add column if not exists recipient_name text not null default '';
alter table gift_vouchers add column if not exists recipient_email text;
alter table gift_vouchers add column if not exists recipient_phone text;
alter table gift_vouchers add column if not exists send_to_recipient boolean not null default false;
alter table gift_vouchers add column if not exists send_to_whatsapp boolean not null default false;
alter table gift_vouchers add column if not exists greeting text;

create or replace function redeem_gift_voucher(p_code text, p_count int, p_tenant text)
returns gift_vouchers language plpgsql security definer set search_path = public as $$
declare v gift_vouchers;
begin
  select * into v from gift_vouchers where upper(code)=upper(p_code) and tenant_id=p_tenant for update;
  if not found or v.status <> 'active' then raise exception 'VOUCHER_NOT_ACTIVE'; end if;
  if p_count < 1 or v.treatments_remaining < p_count then raise exception 'VOUCHER_BALANCE'; end if;
  update gift_vouchers set treatments_remaining=treatments_remaining-p_count,
    status=case when treatments_remaining-p_count=0 then 'exhausted' else 'active' end, updated_at=now()
    where id=v.id returning * into v;
  return v;
end $$;
revoke all on function redeem_gift_voucher(text,int,text) from public, anon, authenticated;
grant execute on function redeem_gift_voucher(text,int,text) to service_role;

create or replace function restore_gift_voucher(p_id uuid, p_count int)
returns void language plpgsql security definer set search_path = public as $$
begin
  update gift_vouchers set treatments_remaining=least(treatments_total,treatments_remaining+p_count), status='active', updated_at=now() where id=p_id;
end $$;
revoke all on function restore_gift_voucher(uuid,int) from public, anon, authenticated;
grant execute on function restore_gift_voucher(uuid,int) to service_role;
