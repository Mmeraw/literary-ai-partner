-- =========================================================

-- REVISIONGRADE PIPELINE — RPC / FUNCTIONS LAYER

-- Canon-aligned state advancement and guarded execution

-- =========================================================

begin;

-- ---------------------------------------------------------

-- 1. HELPER: CURRENT USER OWNS PIPELINE RUN

-- ---------------------------------------------------------

create or replace function public.current\_user\_owns\_pipeline\_run(

target\_pipeline\_run\_id uuid

)

returns boolean

language sql

stable

as $$

select exists (

select 1

from public.pipeline\_runs pr

join public.manuscripts m on m.id = pr.manuscript\_id

where pr.id = target\_pipeline\_run\_id

and m.owner\_user\_id = auth.uid()

);

$$;

-- ---------------------------------------------------------

-- 2. HELPER: REQUIRE OWNERSHIP

-- ---------------------------------------------------------

create or replace function public.assert\_pipeline\_ownership(

target\_pipeline\_run\_id uuid

)

returns void

language plpgsql

security definer

set search\_path = public

as $$

begin

if not public.current\_user\_owns\_pipeline\_run(target\_pipeline\_run\_id) then

raise exception 'Access denied for pipeline run %', target\_pipeline\_run\_id;

end if;

end;

$$;

revoke all on function public.assert\_pipeline\_ownership(uuid) from public;

grant execute on function public.assert\_pipeline\_ownership(uuid) to authenticated;

-- ---------------------------------------------------------

-- 3. ADVANCE PIPELINE STATE

-- ---------------------------------------------------------

create or replace function public.advance\_pipeline\_state(

p\_pipeline\_run\_id uuid,

p\_to\_state public.pipeline\_state,

p\_action text,

p\_reason text default null

)

returns public.pipeline\_runs

language plpgsql

security definer

set search\_path = public

as $$

declare

v\_run public.pipeline\_runs%rowtype;

begin

perform public.assert\_pipeline\_ownership(p\_pipeline\_run\_id);

select \*

into v\_run

from public.pipeline\_runs

where id = p\_pipeline\_run\_id

for update;

if not found then

raise exception 'Pipeline run not found: %', p\_pipeline\_run\_id;

end if;

if not public.is\_valid\_pipeline\_transition(v\_run.current\_state, p\_to\_state) then

raise exception 'Invalid pipeline state transition: % -> %', v\_run.current\_state, p\_to\_state;

end if;

update public.pipeline\_runs

set current\_state = p\_to\_state,

rejection\_reason = case when p\_to\_state = 'rejected' then coalesce(p\_reason, rejection\_reason) else rejection\_reason end,

completed\_at = case when p\_to\_state in ('validated', 'rejected') then now() else completed\_at end

where id = p\_pipeline\_run\_id

returning \* into v\_run;

insert into public.pipeline\_state\_history (

pipeline\_run\_id,

from\_state,

to\_state,

action,

actor,

reason

)

values (

p\_pipeline\_run\_id,

v\_run.current\_state,

p\_to\_state,

p\_action,

auth.uid()::text,

p\_reason

);

return v\_run;

end;

$$;

revoke all on function public.advance\_pipeline\_state(uuid, public.pipeline\_state, text, text) from public;

grant execute on function public.advance\_pipeline\_state(uuid, public.pipeline\_state, text, text) to authenticated;

-- ---------------------------------------------------------

-- 4. START PASS

-- ---------------------------------------------------------

create or replace function public.start\_pass(

p\_pipeline\_run\_id uuid,

p\_pass\_number integer

)

returns public.pass\_runs

language plpgsql

security definer

set search\_path = public

as $$

declare

v\_run public.pipeline\_runs%rowtype;

v\_pass public.pass\_runs%rowtype;

v\_expected\_state public.pipeline\_state;

begin

perform public.assert\_pipeline\_ownership(p\_pipeline\_run\_id);

if p\_pass\_number not in (1,2,3) then

raise exception 'Invalid pass number: %', p\_pass\_number;

end if;

select \*

into v\_run

from public.pipeline\_runs

where id = p\_pipeline\_run\_id

for update;

if not found then

raise exception 'Pipeline run not found: %', p\_pipeline\_run\_id;

end if;

v\_expected\_state := case

when p\_pass\_number = 1 then 'draft'::public.pipeline\_state

when p\_pass\_number = 2 then 'pass1\_complete'::public.pipeline\_state

when p\_pass\_number = 3 then 'pass2\_complete'::public.pipeline\_state

end;

if v\_run.current\_state <> v\_expected\_state then

raise exception 'Cannot start pass % from state %; expected %', p\_pass\_number, v\_run.current\_state, v\_expected\_state;

end if;

insert into public.pass\_runs (

pipeline\_run\_id,

pass\_number,

status,

completed,

started\_at

)

values (

p\_pipeline\_run\_id,

p\_pass\_number,

'in\_progress',

false,

now()

)

on conflict (pipeline\_run\_id, pass\_number)

do update set

status = 'in\_progress',

completed = false,

started\_at = now()

returning \* into v\_pass;

return v\_pass;

end;

$$;

revoke all on function public.start\_pass(uuid, integer) from public;

grant execute on function public.start\_pass(uuid, integer) to authenticated;

-- ---------------------------------------------------------

-- 5. COMPLETE PASS

-- ---------------------------------------------------------

create or replace function public.complete\_pass(

p\_pipeline\_run\_id uuid,

p\_pass\_number integer,

p\_checklist\_passed boolean,

p\_primary\_strength text default null,

p\_primary\_weakness text default null,

p\_dominant\_pattern text default null,

p\_divergence\_summary text default null,

p\_convergence\_summary text default null,

p\_notes text default null

)

returns public.pass\_runs

language plpgsql

security definer

set search\_path = public

as $$

declare

v\_run public.pipeline\_runs%rowtype;

v\_pass public.pass\_runs%rowtype;

v\_next\_state public.pipeline\_state;

begin

perform public.assert\_pipeline\_ownership(p\_pipeline\_run\_id);

if p\_pass\_number not in (1,2,3) then

raise exception 'Invalid pass number: %', p\_pass\_number;

end if;

select \*

into v\_run

from public.pipeline\_runs

where id = p\_pipeline\_run\_id

for update;

if not found then

raise exception 'Pipeline run not found: %', p\_pipeline\_run\_id;

end if;

select \*

into v\_pass

from public.pass\_runs

where pipeline\_run\_id = p\_pipeline\_run\_id

and pass\_number = p\_pass\_number

for update;

if not found then

raise exception 'Pass % not started for pipeline run %', p\_pass\_number, p\_pipeline\_run\_id;

end if;

if v\_pass.status <> 'in\_progress' then

raise exception 'Pass % must be in\_progress to complete; current status = %', p\_pass\_number, v\_pass.status;

end if;

update public.pass\_runs

set status = case when p\_checklist\_passed then 'complete' else 'failed' end,

checklist\_passed = p\_checklist\_passed,

completed = p\_checklist\_passed,

completed\_at = now(),

summary\_primary\_strength = p\_primary\_strength,

summary\_primary\_weakness = p\_primary\_weakness,

summary\_dominant\_pattern = p\_dominant\_pattern,

summary\_divergence = p\_divergence\_summary,

summary\_convergence = p\_convergence\_summary,

notes = p\_notes

where id = v\_pass.id

returning \* into v\_pass;

if not p\_checklist\_passed then

update public.pipeline\_runs

set blocked = true

where id = p\_pipeline\_run\_id;

insert into public.governance\_logs (

pipeline\_run\_id,

decision,

blocked,

reason,

metadata

)

values (

p\_pipeline\_run\_id,

'require\_revision',

true,

format('Pass % failed checklist', p\_pass\_number),

jsonb\_build\_object('pass\_number', p\_pass\_number)

);

return v\_pass;

end if;

v\_next\_state := case

when p\_pass\_number = 1 then 'pass1\_complete'::public.pipeline\_state

when p\_pass\_number = 2 then 'pass2\_complete'::public.pipeline\_state

when p\_pass\_number = 3 then 'converged'::public.pipeline\_state

end;

update public.pipeline\_runs

set current\_state = v\_next\_state

where id = p\_pipeline\_run\_id;

insert into public.pipeline\_state\_history (

pipeline\_run\_id,

from\_state,

to\_state,

action,

actor,

reason

)

values (

p\_pipeline\_run\_id,

v\_run.current\_state,

v\_next\_state,

format('pass\_%s\_complete', p\_pass\_number),

auth.uid()::text,

null

);

return v\_pass;

end;

$$;

revoke all on function public.complete\_pass(uuid, integer, boolean, text, text, text, text, text, text) from public;

grant execute on function public.complete\_pass(uuid, integer, boolean, text, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------

-- 6. MARK WAVE ELIGIBLE

-- ---------------------------------------------------------

create or replace function public.mark\_wave\_eligible(

p\_pipeline\_run\_id uuid

)

returns public.wave\_executions

language plpgsql

security definer

set search\_path = public

as $$

declare

v\_run public.pipeline\_runs%rowtype;

v\_pass1 public.pass\_runs%rowtype;

v\_pass2 public.pass\_runs%rowtype;

v\_pass3 public.pass\_runs%rowtype;

v\_wave public.wave\_executions%rowtype;

begin

perform public.assert\_pipeline\_ownership(p\_pipeline\_run\_id);

select \*

into v\_run

from public.pipeline\_runs

where id = p\_pipeline\_run\_id

for update;

if not found then

raise exception 'Pipeline run not found: %', p\_pipeline\_run\_id;

end if;

if v\_run.current\_state <> 'converged' then

raise exception 'WAVE eligibility requires converged state; current state = %', v\_run.current\_state;

end if;

if v\_run.blocked then

raise exception 'Pipeline run is blocked and cannot be marked WAVE eligible';

end if;

select \* into v\_pass1 from public.pass\_runs where pipeline\_run\_id = p\_pipeline\_run\_id and pass\_number = 1;

select \* into v\_pass2 from public.pass\_runs where pipeline\_run\_id = p\_pipeline\_run\_id and pass\_number = 2;

select \* into v\_pass3 from public.pass\_runs where pipeline\_run\_id = p\_pipeline\_run\_id and pass\_number = 3;

if v\_pass1.status <> 'complete' or v\_pass2.status <> 'complete' or v\_pass3.status <> 'complete' then

raise exception 'All three passes must be complete before WAVE eligibility';

end if;

insert into public.wave\_executions (

pipeline\_run\_id,

eligible,

invocation\_valid,

invoked,

completed

)

values (

p\_pipeline\_run\_id,

true,

true,

false,

false

)

on conflict (pipeline\_run\_id)

do update set

eligible = true,

invocation\_valid = true

returning \* into v\_wave;

update public.pipeline\_runs

set current\_state = 'wave\_eligible'

where id = p\_pipeline\_run\_id;

insert into public.pipeline\_state\_history (

pipeline\_run\_id,

from\_state,

to\_state,

action,

actor,

reason

)

values (

p\_pipeline\_run\_id,

'converged',

'wave\_eligible',

'wave\_eligible',

auth.uid()::text,

null

);

return v\_wave;

end;

$$;

revoke all on function public.mark\_wave\_eligible(uuid) from public;

grant execute on function public.mark\_wave\_eligible(uuid) to authenticated;

-- ---------------------------------------------------------

-- 7. INVOKE WAVE

-- ---------------------------------------------------------

create or replace function public.invoke\_wave(

p\_pipeline\_run\_id uuid,

p\_waves integer[]

)

returns public.wave\_executions

language plpgsql

security definer

set search\_path = public

as $$

declare

v\_run public.pipeline\_runs%rowtype;

v\_wave public.wave\_executions%rowtype;

v\_wave\_number integer;

v\_order integer := 1;

begin

perform public.assert\_pipeline\_ownership(p\_pipeline\_run\_id);

if array\_length(p\_waves, 1) is null then

raise exception 'At least one wave must be provided';

end if;

select \*

into v\_run

from public.pipeline\_runs

where id = p\_pipeline\_run\_id

for update;

if not found then

raise exception 'Pipeline run not found: %', p\_pipeline\_run\_id;

end if;

if v\_run.current\_state <> 'wave\_eligible' then

raise exception 'WAVE can only be invoked from wave\_eligible; current state = %', v\_run.current\_state;

end if;

select \*

into v\_wave

from public.wave\_executions

where pipeline\_run\_id = p\_pipeline\_run\_id

for update;

if not found then

raise exception 'Wave execution record not found for pipeline run %', p\_pipeline\_run\_id;

end if;

if not v\_wave.eligible or not v\_wave.invocation\_valid then

raise exception 'WAVE invocation is not valid for pipeline run %', p\_pipeline\_run\_id;

end if;

update public.wave\_executions

set invoked = true,

started\_at = now()

where id = v\_wave.id

returning \* into v\_wave;

delete from public.wave\_runs

where wave\_execution\_id = v\_wave.id;

foreach v\_wave\_number in array p\_waves loop

if v\_wave\_number < 1 or v\_wave\_number > 62 then

raise exception 'Invalid wave number: %', v\_wave\_number;

end if;

insert into public.wave\_runs (

wave\_execution\_id,

wave\_number,

execution\_order,

completed

)

values (

v\_wave.id,

v\_wave\_number,

v\_order,

false

);

v\_order := v\_order + 1;

end loop;

update public.pipeline\_runs

set current\_state = 'wave\_executed'

where id = p\_pipeline\_run\_id;

insert into public.pipeline\_state\_history (

pipeline\_run\_id,

from\_state,

to\_state,

action,

actor,

reason

)

values (

p\_pipeline\_run\_id,

'wave\_eligible',

'wave\_executed',

'wave\_invoked',

auth.uid()::text,

null

);

return v\_wave;

end;

$$;

revoke all on function public.invoke\_wave(uuid, integer[]) from public;

grant execute on function public.invoke\_wave(uuid, integer[]) to authenticated;

-- ---------------------------------------------------------

-- 8. COMPLETE WAVE

-- ---------------------------------------------------------

create or replace function public.complete\_wave\_execution(

p\_pipeline\_run\_id uuid

)

returns public.wave\_executions

language plpgsql

security definer

set search\_path = public

as $$

declare

v\_run public.pipeline\_runs%rowtype;

v\_wave public.wave\_executions%rowtype;

begin

perform public.assert\_pipeline\_ownership(p\_pipeline\_run\_id);

select \*

into v\_run

from public.pipeline\_runs

where id = p\_pipeline\_run\_id

for update;

if not found then

raise exception 'Pipeline run not found: %', p\_pipeline\_run\_id;

end if;

if v\_run.current\_state <> 'wave\_executed' then

raise exception 'Wave execution can only be completed from wave\_executed state';

end if;

select \*

into v\_wave

from public.wave\_executions

where pipeline\_run\_id = p\_pipeline\_run\_id

for update;

if not found then

raise exception 'Wave execution record not found';

end if;

update public.wave\_executions

set completed = true,

completed\_at = now()

where id = v\_wave.id

returning \* into v\_wave;

update public.wave\_runs

set completed = true

where wave\_execution\_id = v\_wave.id;

update public.pipeline\_runs

set current\_state = 'revised\_output'

where id = p\_pipeline\_run\_id;

insert into public.pipeline\_state\_history (

pipeline\_run\_id,

from\_state,

to\_state,

action,

actor,

reason

)

values (

p\_pipeline\_run\_id,

'wave\_executed',

'revised\_output',

'wave\_complete',

auth.uid()::text,

null

);

return v\_wave;

end;

$$;

revoke all on function public.complete\_wave\_execution(uuid) from public;

grant execute on function public.complete\_wave\_execution(uuid) to authenticated;

-- ---------------------------------------------------------

-- 9. START VALIDATION

-- ---------------------------------------------------------

create or replace function public.start\_validation(

p\_pipeline\_run\_id uuid,

p\_checklist\_version text

)

returns public.validation\_runs

language plpgsql

security definer

set search\_path = public

as $$

declare

v\_run public.pipeline\_runs%rowtype;

v\_validation public.validation\_runs%rowtype;

begin

perform public.assert\_pipeline\_ownership(p\_pipeline\_run\_id);

select \*

into v\_run

from public.pipeline\_runs

where id = p\_pipeline\_run\_id

for update;

if not found then

raise exception 'Pipeline run not found: %', p\_pipeline\_run\_id;

end if;

if v\_run.current\_state <> 'revised\_output' then

raise exception 'Validation can only begin from revised\_output; current state = %', v\_run.current\_state;

end if;

insert into public.validation\_runs (

pipeline\_run\_id,

checklist\_version,

all\_checks\_passed

)

values (

p\_pipeline\_run\_id,

p\_checklist\_version,

false

)

on conflict (pipeline\_run\_id)

do update set

checklist\_version = excluded.checklist\_version,

all\_checks\_passed = false,

validated\_at = null

returning \* into v\_validation;

return v\_validation;

end;

$$;

revoke all on function public.start\_validation(uuid, text) from public;

grant execute on function public.start\_validation(uuid, text) to authenticated;

-- ---------------------------------------------------------

-- 10. COMPLETE VALIDATION

-- ---------------------------------------------------------

create or replace function public.complete\_validation(

p\_pipeline\_run\_id uuid

)

returns public.validation\_runs

language plpgsql

security definer

set search\_path = public

as $$

declare

v\_run public.pipeline\_runs%rowtype;

v\_validation public.validation\_runs%rowtype;

v\_failed\_count integer;

begin

perform public.assert\_pipeline\_ownership(p\_pipeline\_run\_id);

select \*

into v\_run

from public.pipeline\_runs

where id = p\_pipeline\_run\_id

for update;

if not found then

raise exception 'Pipeline run not found: %', p\_pipeline\_run\_id;

end if;

if v\_run.current\_state <> 'revised\_output' then

raise exception 'Validation completion requires revised\_output state';

end if;

select \*

into v\_validation

from public.validation\_runs

where pipeline\_run\_id = p\_pipeline\_run\_id

for update;

if not found then

raise exception 'Validation run not found';

end if;

select count(\*)

into v\_failed\_count

from public.validation\_check\_results

where validation\_run\_id = v\_validation.id

and passed = false;

update public.validation\_runs

set all\_checks\_passed = (v\_failed\_count = 0),

validated\_at = now()

where id = v\_validation.id

returning \* into v\_validation;

if v\_failed\_count = 0 then

update public.pipeline\_runs

set current\_state = 'validated',

blocked = false,

completed\_at = now()

where id = p\_pipeline\_run\_id;

insert into public.governance\_logs (

pipeline\_run\_id,

decision,

blocked,

reason,

metadata

)

values (

p\_pipeline\_run\_id,

'allow',

false,

'Validation passed',

'{}'::jsonb

);

insert into public.pipeline\_state\_history (

pipeline\_run\_id,

from\_state,

to\_state,

action,

actor,

reason

)

values (

p\_pipeline\_run\_id,

'revised\_output',

'validated',

'validation\_complete',

auth.uid()::text,

null

);

else

update public.pipeline\_runs

set blocked = true

where id = p\_pipeline\_run\_id;

insert into public.governance\_logs (

pipeline\_run\_id,

decision,

blocked,

reason,

metadata

)

values (

p\_pipeline\_run\_id,

'require\_revision',

true,

'Validation failed',

jsonb\_build\_object('failed\_check\_count', v\_failed\_count)

);

end if;

return v\_validation;

end;

$$;

revoke all on function public.complete\_validation(uuid) from public;

grant execute on function public.complete\_validation(uuid) to authenticated;

-- ---------------------------------------------------------

-- 11. APPEND VALIDATION CHECK

-- ---------------------------------------------------------

create or replace function public.upsert\_validation\_check(

p\_pipeline\_run\_id uuid,

p\_check\_code text,

p\_passed boolean,

p\_notes text default null

)

returns public.validation\_check\_results

language plpgsql

security definer

set search\_path = public

as $$

declare

v\_validation public.validation\_runs%rowtype;

v\_check public.validation\_check\_results%rowtype;

begin

perform public.assert\_pipeline\_ownership(p\_pipeline\_run\_id);

select \*

into v\_validation

from public.validation\_runs

where pipeline\_run\_id = p\_pipeline\_run\_id

for update;

if not found then

raise exception 'Validation run not found for pipeline run %', p\_pipeline\_run\_id;

end if;

insert into public.validation\_check\_results (

validation\_run\_id,

check\_code,

passed,

notes

)

values (

v\_validation.id,

p\_check\_code,

p\_passed,

p\_notes

)

on conflict (validation\_run\_id, check\_code)

do update set

passed = excluded.passed,

notes = excluded.notes

returning \* into v\_check;

return v\_check;

end;

$$;

revoke all on function public.upsert\_validation\_check(uuid, text, boolean, text) from public;

grant execute on function public.upsert\_validation\_check(uuid, text, boolean, text) to authenticated;

commit;
