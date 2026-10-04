-- Add the MAKEUP exception value in its own migration so the enum change is
-- committed before later migrations define functions that reference it.
alter type public.exception_type add value if not exists 'MAKEUP';
