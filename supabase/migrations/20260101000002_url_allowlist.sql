-- Outbound-link domain allowlist, enforced at the database layer so even a
-- compromised admin session can't publish a phishing URL. See
-- docs/SECURITY.md SR-D1/SR-D2/SR-I5. A trigger is used instead of a
-- plain CHECK because the validation needs a table lookup against curated
-- foundation domains, not just gov.ph/edu.ph suffix matching.

create table allowlisted_domains (
  domain     text primary key,
  note       text,
  added_at   timestamptz not null default now()
);
-- Curated foundation domains go here (populated in P5 admin tool). Empty for now;
-- *.gov.ph / *.edu.ph are handled by suffix match in is_allowlisted_url() below
-- and don't need rows here.

create or replace function is_allowlisted_url(url text)
returns boolean
language plpgsql
stable
as $$
declare
  host text;
begin
  if url is null then
    return true;
  end if;
  host := lower((regexp_match(url, '^https?://([^/]+)'))[1]);
  if host is null then
    return false;
  end if;
  host := split_part(host, ':', 1); -- strip port
  if host ~ '(^|\.)gov\.ph$' or host ~ '(^|\.)edu\.ph$' then
    return true;
  end if;
  return exists (select 1 from allowlisted_domains d where d.domain = host);
end;
$$;

create or replace function enforce_scholarship_url_allowlist()
returns trigger
language plpgsql
as $$
begin
  if not is_allowlisted_url(new.official_url) then
    raise exception 'official_url % is not on the allowlist (gov.ph / edu.ph / curated domains)', new.official_url;
  end if;
  if new.application_url is not null and not is_allowlisted_url(new.application_url) then
    raise exception 'application_url % is not on the allowlist', new.application_url;
  end if;
  return new;
end;
$$;

create trigger scholarships_url_allowlist
  before insert or update of official_url, application_url on scholarships
  for each row execute function enforce_scholarship_url_allowlist();
