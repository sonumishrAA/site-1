-- ==========================================
-- 1. Helper Functions (System Core)
-- ==========================================

CREATE OR REPLACE FUNCTION get_user_library_ids()
RETURNS UUID[] AS $$
  SELECT COALESCE(
    (SELECT library_ids FROM public.staff WHERE user_id = auth.uid() AND is_active = true LIMIT 1),
    ARRAY(SELECT id FROM public.libraries WHERE owner_id = auth.uid()),
    '{}'::UUID[]
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_library_owner(lib_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.libraries WHERE id = lib_id AND owner_id = auth.uid()
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ==========================================
-- 2. Tables & Constraints (Latest Structure)
-- ==========================================

-- Libraries (Main Registry)
CREATE TABLE public.libraries (
  id uuid not null default gen_random_uuid (),
  owner_id uuid null,
  name text not null,
  address text not null,
  city text not null,
  state text not null,
  pincode character(6) not null,
  phone text not null,
  is_gender_neutral boolean null default false,
  male_seats integer null default 0,
  female_seats integer null default 0,
  neutral_seats integer null default 0,
  has_lockers boolean null default false,
  male_lockers integer null default 0,
  female_lockers integer null default 0,
  neutral_lockers integer null default 0,
  subscription_plan text null,
  subscription_status text null default 'inactive'::text,
  subscription_start timestamp with time zone null,
  subscription_end timestamp with time zone null,
  delete_date timestamp with time zone null,
  data_cleared boolean null default false,
  original_plan_price numeric(10, 2) null,
  onboarding_done boolean null default false,
  notif_sent_7d boolean null default false,
  notif_sent_3d boolean null default false,
  notif_sent_1d boolean null default false,
  cleanup_warn_sent boolean null default false,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint libraries_pkey primary key (id),
  constraint libraries_owner_id_fkey foreign KEY (owner_id) references auth.users (id),
  constraint libraries_phone_check check ((phone ~ '^[6-9]\d{9}$'::text)),
  constraint libraries_subscription_plan_check check (
    (subscription_plan = any (array['1m'::text, '3m'::text, '6m'::text, '12m'::text]))
  ),
  constraint libraries_subscription_status_check check (
    (subscription_status = any (array['active'::text, 'inactive'::text, 'expired'::text, 'deleted'::text]))
  )
) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_libs_delete_date ON public.libraries (delete_date, subscription_status);

-- Combo Plans (Seat combinations)
CREATE TABLE public.combo_plans (
  id uuid not null default gen_random_uuid (),
  library_id uuid null,
  combination_key text not null,
  months integer not null,
  fee numeric(10, 2) not null,
  constraint combo_plans_pkey primary key (id),
  constraint combo_plans_library_id_combination_key_months_key unique (library_id, combination_key, months),
  constraint combo_plans_library_id_fkey foreign KEY (library_id) references libraries (id) on delete CASCADE,
  constraint combo_plans_months_check check ((months >= 1 and months <= 12))
) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_combo_lookup ON public.combo_plans (library_id, combination_key, months);

-- Contact Messages
CREATE TABLE public.contact_messages (
  id uuid not null default gen_random_uuid (),
  name text not null,
  phone text not null,
  message text not null,
  is_read boolean null default false,
  created_at timestamp with time zone null default now(),
  constraint contact_messages_pkey primary key (id),
  constraint contact_messages_phone_check check ((phone ~ '^[6-9]\d{9}$'::text))
) TABLESPACE pg_default;

-- Financial Events (Ledger)
CREATE TABLE public.financial_events (
  id uuid not null default gen_random_uuid (),
  library_id uuid not null,
  student_id uuid null,
  student_name text not null,
  event_type text not null,
  amount numeric not null default 0,
  pending_amount numeric not null default 0,
  payment_mode text null default 'cash'::text,
  actor_role text not null,
  actor_name text not null,
  note text null,
  created_at timestamp with time zone null default now(),
  constraint financial_events_pkey primary key (id),
  constraint financial_events_library_id_fkey foreign KEY (library_id) references libraries (id) on delete CASCADE,
  constraint financial_events_actor_role_check check (actor_role = any (array['owner'::text, 'staff'::text])),
  constraint financial_events_event_type_check check (
    event_type = any (array[
      'ADMISSION_FULL'::text, 'ADMISSION_PARTIAL'::text, 'ADMISSION_PENDING'::text,
      'PAYMENT_RECEIVED'::text, 'DISCOUNT_APPLIED'::text, 'RENEWAL'::text,
      'REFUND_ON_DELETE'::text, 'NO_REFUND_ON_DELETE'::text
    ])
  )
) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_fe_library ON public.financial_events (library_id);
CREATE INDEX IF NOT EXISTS idx_fe_created ON public.financial_events (created_at);
CREATE INDEX IF NOT EXISTS idx_fe_type ON public.financial_events (event_type);

-- Locker Policies
CREATE TABLE public.locker_policies (
  id uuid not null default gen_random_uuid (),
  library_id uuid null,
  eligible_combos text[] not null default '{}'::text[],
  monthly_fee numeric(10, 2) not null,
  updated_at timestamp with time zone null default now(),
  constraint locker_policies_pkey primary key (id),
  constraint locker_policies_library_id_key unique (library_id),
  constraint locker_policies_library_id_fkey foreign KEY (library_id) references libraries (id) on delete CASCADE
) TABLESPACE pg_default;

-- Lockers
CREATE TABLE public.lockers (
  id uuid not null default gen_random_uuid (),
  library_id uuid null,
  locker_number text not null,
  gender text not null,
  status text null default 'free'::text,
  constraint lockers_pkey primary key (id),
  constraint lockers_library_id_locker_number_key unique (library_id, locker_number),
  constraint lockers_library_id_fkey foreign KEY (library_id) references libraries (id) on delete CASCADE,
  constraint lockers_gender_check check (gender = any (array['male'::text, 'female'::text, 'neutral'::text])),
  constraint lockers_status_check check (status = any (array['free'::text, 'occupied'::text, 'key_pending'::text]))
) TABLESPACE pg_default;

-- Notifications
CREATE TABLE public.notifications (
  id uuid not null default gen_random_uuid (),
  library_id uuid null,
  type text not null,
  title text not null,
  message text not null,
  student_id uuid null,
  is_read boolean null default false,
  created_at timestamp with time zone null default now(),
  constraint notifications_pkey primary key (id),
  constraint notifications_library_id_fkey foreign KEY (library_id) references libraries (id) on delete CASCADE,
  constraint notifications_student_id_fkey foreign KEY (student_id) references students (id) on delete CASCADE,
  constraint notifications_type_check check (
    type = any (array[
      'expiry_warning'::text, 'subscription_expiry'::text, 'new_admission'::text,
      'fee_collected'::text, 'renewal_done'::text, 'student_renewed'::text,
      'seat_changed'::text, 'data_cleanup_warning'::text
    ])
  )
) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_notif_lib ON public.notifications (library_id, is_read);

-- Payment Records (Student Payments)
CREATE TABLE public.payment_records (
  id uuid not null default gen_random_uuid (),
  library_id uuid null,
  student_id uuid null,
  amount numeric(10, 2) not null,
  payment_method text null default 'cash'::text,
  payment_date date not null default CURRENT_DATE,
  received_by uuid null,
  notes text null,
  type text not null,
  created_at timestamp with time zone null default now(),
  constraint payment_records_pkey primary key (id),
  constraint payment_records_library_id_fkey foreign KEY (library_id) references libraries (id) on delete CASCADE,
  constraint payment_records_student_id_fkey foreign KEY (student_id) references students (id) on delete CASCADE,
  constraint payment_records_payment_method_check check (payment_method = any (array['cash'::text, 'upi'::text, 'online'::text, 'other'::text])),
  constraint payment_records_type_check check (type = any (array['admission'::text, 'renewal'::text, 'locker_deposit'::text]))
) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_pay_records_lib ON public.payment_records (library_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pay_records_student ON public.payment_records (student_id);

-- Pricing Config (Platform Rules)
CREATE TABLE public.pricing_config (
  id uuid not null default gen_random_uuid (),
  plan text not null,
  amount numeric(10, 2) not null,
  updated_at timestamp with time zone null default now(),
  duration_minutes integer not null default 43200,
  constraint pricing_config_pkey primary key (id),
  constraint pricing_config_plan_key unique (plan),
  constraint pricing_config_plan_check check (plan = any (array['1m'::text, '3m'::text, '6m'::text, '12m'::text]))
) TABLESPACE pg_default;

-- Seats
CREATE TABLE public.seats (
  id uuid not null default gen_random_uuid (),
  library_id uuid null,
  seat_number text not null,
  gender text not null,
  is_active boolean null default true,
  constraint seats_pkey primary key (id),
  constraint seats_library_id_seat_number_key unique (library_id, seat_number),
  constraint seats_library_id_fkey foreign KEY (library_id) references libraries (id) on delete CASCADE,
  constraint seats_gender_check check (gender = any (array['male'::text, 'female'::text, 'neutral'::text]))
) TABLESPACE pg_default;

-- Shifts
CREATE TABLE public.shifts (
  id uuid not null default gen_random_uuid (),
  library_id uuid null,
  code text not null,
  name text not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  constraint shifts_pkey primary key (id),
  constraint shifts_library_id_code_key unique (library_id, code),
  constraint shifts_library_id_fkey foreign KEY (library_id) references libraries (id) on delete CASCADE,
  constraint shifts_code_check check (code = any (array['M'::text, 'A'::text, 'E'::text, 'N'::text]))
) TABLESPACE pg_default;

-- Staff
CREATE TABLE public.staff (
  id uuid not null default gen_random_uuid (),
  library_ids uuid[] not null,
  user_id uuid null,
  name text not null,
  email text not null,
  role text null default 'staff'::text,
  staff_type text null default 'specific'::text,
  is_active boolean null default true,
  force_password_change boolean null default false,
  created_at timestamp with time zone null default now(),
  constraint staff_pkey primary key (id),
  constraint staff_email_key unique (email),
  constraint staff_user_id_key unique (user_id),
  constraint staff_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint staff_role_check check (role = any (array['owner'::text, 'staff'::text])),
  constraint staff_staff_type_check check (staff_type = any (array['specific'::text, 'combined'::text]))
) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_staff_user ON public.staff (user_id);
CREATE INDEX IF NOT EXISTS idx_staff_libs ON public.staff USING GIN (library_ids);

-- Student-Seat-Shift Mapping
CREATE TABLE public.student_seat_shifts (
  id uuid not null default gen_random_uuid (),
  student_id uuid null,
  seat_id uuid null,
  shift_code text not null,
  end_date date not null,
  constraint student_seat_shifts_pkey primary key (id),
  constraint student_seat_shifts_seat_id_fkey foreign KEY (seat_id) references seats (id) on delete CASCADE,
  constraint student_seat_shifts_student_id_fkey foreign KEY (student_id) references students (id) on delete CASCADE,
  constraint student_seat_shifts_shift_code_check check (shift_code = any (array['M'::text, 'A'::text, 'E'::text, 'N'::text]))
) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sss_active_lookup ON public.student_seat_shifts (seat_id, shift_code, end_date);

-- Students
CREATE TABLE public.students (
  id uuid not null default gen_random_uuid (),
  library_id uuid null,
  name text not null,
  father_name text null,
  address text null,
  phone text null,
  gender text not null,
  seat_id uuid null,
  combination_key text not null,
  shift_display text not null,
  selected_shifts text[] not null,
  locker_id uuid null,
  admission_date date not null default CURRENT_DATE,
  plan_months integer not null,
  end_date date not null,
  payment_status text null default 'pending'::text,
  monthly_rate numeric(10, 2) not null,
  total_fee numeric(10, 2) not null,
  is_deleted boolean null default false,
  deleted_at timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  amount_paid numeric null default 0,
  discount_amount numeric null default 0,
  constraint students_pkey primary key (id),
  constraint students_library_id_fkey foreign KEY (library_id) references libraries (id) on delete CASCADE,
  constraint students_seat_id_fkey foreign KEY (seat_id) references seats (id) on delete set null,
  constraint students_locker_id_fkey foreign KEY (locker_id) references lockers (id) on delete set null,
  constraint students_phone_check check (phone is null or phone ~ '^[6-9]\d{9}$'::text),
  constraint students_payment_status_check check (payment_status = any (array['paid'::text, 'pending'::text, 'partial'::text, 'discounted'::text])),
  constraint students_gender_check check (gender = any (array['male'::text, 'female'::text])),
  constraint students_plan_months_check check (plan_months >= 1 and plan_months <= 12)
) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_students_library ON public.students (library_id);
CREATE INDEX IF NOT EXISTS idx_students_end_date ON public.students (end_date);
CREATE INDEX IF NOT EXISTS idx_students_deleted ON public.students (is_deleted);

-- Subscription Payments (Razorpay Ledger)
CREATE TABLE public.subscription_payments (
  id uuid not null default gen_random_uuid (),
  library_id uuid null,
  razorpay_order_id text not null,
  razorpay_payment_id text null,
  razorpay_signature text null,
  amount numeric(10, 2) not null,
  plan text not null,
  status text null default 'pending'::text,
  processed boolean null default false,
  type text not null,
  created_at timestamp with time zone null default now(),
  constraint subscription_payments_pkey primary key (id),
  constraint subscription_payments_razorpay_order_id_key unique (razorpay_order_id),
  constraint subscription_payments_library_id_fkey foreign KEY (library_id) references libraries (id) on delete CASCADE,
  constraint subscription_payments_status_check check (status = any (array['pending'::text, 'success'::text, 'failed'::text])),
  constraint subscription_payments_type_check check (type = any (array['registration'::text, 'renewal'::text]))
) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_sub_pay_order ON public.subscription_payments (razorpay_order_id);

-- Temporary Registrations (Cache)
CREATE TABLE public.temp_registrations (
  id uuid not null default gen_random_uuid (),
  razorpay_order_id text not null,
  form_data jsonb not null,
  created_at timestamp with time zone null default now(),
  expires_at timestamp with time zone null default (now() + '02:00:00'::interval),
  constraint temp_registrations_pkey primary key (id),
  constraint temp_registrations_razorpay_order_id_key unique (razorpay_order_id)
) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_temp_reg_order ON public.temp_registrations (razorpay_order_id);

-- ==========================================
-- 3. Row Level Security (RLS) Policies
-- ==========================================

ALTER TABLE public.libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combo_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locker_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY libraries_select ON public.libraries FOR SELECT TO authenticated USING (id = ANY (get_user_library_ids()));
CREATE POLICY libraries_modify ON public.libraries FOR ALL TO authenticated USING (owner_id = auth.uid());

CREATE POLICY shifts_select ON public.shifts FOR SELECT TO authenticated USING (library_id = ANY (get_user_library_ids()));
CREATE POLICY shifts_modify ON public.shifts FOR ALL TO authenticated USING (is_library_owner(library_id));

CREATE POLICY combo_plans_select ON public.combo_plans FOR SELECT TO authenticated USING (library_id = ANY (get_user_library_ids()));
CREATE POLICY combo_plans_modify ON public.combo_plans FOR ALL TO authenticated USING (is_library_owner(library_id));

CREATE POLICY locker_policies_select ON public.locker_policies FOR SELECT TO authenticated USING (library_id = ANY (get_user_library_ids()));
CREATE POLICY locker_policies_modify ON public.locker_policies FOR ALL TO authenticated USING (is_library_owner(library_id));

CREATE POLICY seats_select ON public.seats FOR SELECT TO authenticated USING (library_id = ANY (get_user_library_ids()));
CREATE POLICY seats_modify ON public.seats FOR ALL TO authenticated USING (is_library_owner(library_id));

CREATE POLICY lockers_select ON public.lockers FOR SELECT TO authenticated USING (library_id = ANY (get_user_library_ids()));
CREATE POLICY lockers_modify ON public.lockers FOR ALL TO authenticated USING (is_library_owner(library_id));

CREATE POLICY staff_select ON public.staff FOR SELECT TO authenticated USING (library_ids && get_user_library_ids());

CREATE POLICY students_access ON public.students FOR ALL TO authenticated USING (library_id = ANY (get_user_library_ids()));

CREATE POLICY payment_records_access ON public.payment_records FOR ALL TO authenticated USING (library_id = ANY (get_user_library_ids()));

CREATE POLICY notifications_access ON public.notifications FOR ALL TO authenticated USING (library_id = ANY (get_user_library_ids()));

CREATE POLICY contact_messages_insert ON public.contact_messages FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY pricing_config_read ON public.pricing_config FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY financial_events_access ON public.financial_events FOR ALL TO public USING (true);

-- ==========================================
-- 4. Procedures & Functions
-- ==========================================

CREATE OR REPLACE FUNCTION complete_library_registration(
  p_order_id TEXT, 
  p_owner_uid UUID, 
  p_library_data JSONB, 
  p_seat_config JSONB, 
  p_locker_config JSONB, 
  p_shifts JSONB, 
  p_combo_plans JSONB, 
  p_locker_policy JSONB, 
  p_owner_data JSONB, 
  p_staff_list JSONB, 
  p_plan TEXT, 
  p_amount DECIMAL, 
  p_razorpay_pid TEXT, 
  p_razorpay_sig TEXT
) RETURNS JSONB AS $$
DECLARE
  v_library_id  UUID;
  v_dur_min     INTEGER;
  v_sub_end     TIMESTAMPTZ;
  v_del_date    TIMESTAMPTZ;
  v_staff       JSONB;
  v_shift       JSONB;
  v_combo       JSONB;
  v_is_neutral  BOOLEAN;
  v_male_seats  INTEGER;
  v_female_seats INTEGER;
  v_neutral_seats INTEGER;
  v_has_lockers BOOLEAN;
  v_male_lockers INTEGER;
  v_female_lockers INTEGER;
  v_neutral_lockers INTEGER;
  i             INTEGER;
BEGIN
  -- 1. Date Calculation (Minutes based)
  SELECT duration_minutes INTO v_dur_min FROM public.pricing_config WHERE plan = p_plan;
  v_dur_min := COALESCE(v_dur_min, 43200);

  v_sub_end  := NOW() + (v_dur_min || ' minutes')::INTERVAL;
  v_del_date := v_sub_end + INTERVAL '15 days';

  -- 2. Library Config
  v_is_neutral     := (p_seat_config->>'is_gender_neutral')::BOOLEAN;
  v_male_seats     := COALESCE((p_seat_config->>'male_seats')::INTEGER, 0);
  v_female_seats   := COALESCE((p_seat_config->>'female_seats')::INTEGER, 0);
  v_neutral_seats  := COALESCE((p_seat_config->>'neutral_seats')::INTEGER, 0);
  v_has_lockers    := COALESCE((p_locker_config->>'has_lockers')::BOOLEAN, false);
  v_male_lockers   := COALESCE((p_locker_config->>'male_lockers')::INTEGER, 0);
  v_female_lockers := COALESCE((p_locker_config->>'female_lockers')::INTEGER, 0);
  v_neutral_lockers:= COALESCE((p_locker_config->>'neutral_lockers')::INTEGER, 0);

  -- 3. Insert Library
  INSERT INTO public.libraries (
    owner_id, name, address, city, state, pincode, phone,
    is_gender_neutral, male_seats, female_seats, neutral_seats,
    has_lockers, male_lockers, female_lockers, neutral_lockers,
    subscription_plan, subscription_status, subscription_start, subscription_end, delete_date,
    original_plan_price, onboarding_done, data_cleared
  ) VALUES (
    p_owner_uid, p_library_data->>'name', p_library_data->>'address', p_library_data->>'city',
    p_library_data->>'state', p_library_data->>'pincode', p_library_data->>'phone',
    v_is_neutral, v_male_seats, v_female_seats, v_neutral_seats,
    v_has_lockers, v_male_lockers, v_female_lockers, v_neutral_lockers,
    p_plan, 'active', NOW(), v_sub_end, v_del_date, p_amount, true, false
  ) RETURNING id INTO v_library_id;

  -- 4. Shifts
  FOR v_shift IN SELECT * FROM jsonb_array_elements(p_shifts) LOOP
    INSERT INTO public.shifts (library_id, code, name, start_time, end_time)
    VALUES (v_library_id, v_shift->>'code', v_shift->>'name', (v_shift->>'start_time')::TIME, (v_shift->>'end_time')::TIME);
  END LOOP;

  -- 5. Seats
  IF v_is_neutral THEN
    FOR i IN 1..v_neutral_seats LOOP
      INSERT INTO public.seats (library_id, seat_number, gender) VALUES (v_library_id, i::TEXT, 'neutral');
    END LOOP;
  ELSE
    FOR i IN 1..v_male_seats LOOP
      INSERT INTO public.seats (library_id, seat_number, gender) VALUES (v_library_id, 'M' || i, 'male');
    END LOOP;
    FOR i IN 1..v_female_seats LOOP
      INSERT INTO public.seats (library_id, seat_number, gender) VALUES (v_library_id, 'F' || i, 'female');
    END LOOP;
  END IF;

  -- 6. Lockers
  IF v_has_lockers THEN
    IF v_is_neutral THEN
      FOR i IN 1..v_neutral_lockers LOOP
        INSERT INTO public.lockers (library_id, locker_number, gender) VALUES (v_library_id, 'L' || i, 'neutral');
      END LOOP;
    ELSE
      FOR i IN 1..v_male_lockers LOOP
        INSERT INTO public.lockers (library_id, locker_number, gender) VALUES (v_library_id, 'ML' || i, 'male');
      END LOOP;
      FOR i IN 1..v_female_lockers LOOP
        INSERT INTO public.lockers (library_id, locker_number, gender) VALUES (v_library_id, 'FL' || i, 'female');
      END LOOP;
    END IF;
  END IF;

  -- 7. Combo Plans
  FOR v_combo IN SELECT * FROM jsonb_array_elements(p_combo_plans) LOOP
    INSERT INTO public.combo_plans (library_id, combination_key, months, fee)
    VALUES (v_library_id, v_combo->>'combination_key', (v_combo->>'months')::INTEGER, (v_combo->>'fee')::DECIMAL);
  END LOOP;

  -- 8. Policy
  IF v_has_lockers THEN
    INSERT INTO public.locker_policies (library_id, eligible_combos, monthly_fee)
    VALUES (v_library_id, ARRAY(SELECT jsonb_array_elements_text(p_locker_policy->'eligible_combos')), (p_locker_policy->>'monthly_fee')::DECIMAL);
  END IF;

  -- 9. Registration Roles (Staff & Owner)
  INSERT INTO public.staff (library_ids, user_id, name, email, role, staff_type, is_active)
  VALUES (ARRAY[v_library_id], p_owner_uid, p_owner_data->>'name', p_owner_data->>'email', 'owner', 'specific', true)
  ON CONFLICT (user_id) DO UPDATE SET library_ids = staff.library_ids || ARRAY[v_library_id];

  FOR v_staff IN SELECT * FROM jsonb_array_elements(p_staff_list) LOOP
    INSERT INTO public.staff (library_ids, user_id, name, email, role, staff_type, is_active, force_password_change)
    VALUES (ARRAY[v_library_id], (v_staff->>'user_id')::UUID, v_staff->>'name', v_staff->>'email', 'staff', COALESCE(v_staff->>'staff_type', 'specific'), true, false);
  END LOOP;

  -- 10. Update Ledger
  UPDATE public.subscription_payments 
  SET status = 'success', processed = true, razorpay_payment_id = p_razorpay_pid, razorpay_signature = p_razorpay_sig, library_id = v_library_id 
  WHERE razorpay_order_id = p_order_id;
  
  DELETE FROM public.temp_registrations WHERE razorpay_order_id = p_order_id;

  RETURN jsonb_build_object('success', true, 'library_id', v_library_id, 'sub_end', v_sub_end, 'delete_date', v_del_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
