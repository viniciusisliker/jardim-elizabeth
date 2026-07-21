-- Inclui Visita do Superintendente na one-page do Superintendente.

CREATE OR REPLACE FUNCTION public.je_superintendente_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_start date := date_trunc('week', CURRENT_DATE)::date;
  v_today date := CURRENT_DATE;
  v_until date := CURRENT_DATE + 30;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  IF NOT public.is_superintendente() THEN
    RAISE EXCEPTION 'Sem permissao para visao geral.';
  END IF;

  SELECT jsonb_build_object(
    'generated_at', now(),
    'stats', jsonb_build_object(
      'members', (SELECT count(*)::int FROM public.profiles),
      'territories_total', (SELECT count(*)::int FROM public.territories),
      'territories_designados', (
        SELECT count(*)::int
        FROM public.territory_active_assignments
        WHERE status = 'active'
      ),
      'territories_disponiveis', (
        SELECT count(*)::int FROM public.territories WHERE status = 'disponivel'
      ),
      'territories_alta', (
        SELECT count(*)::int
        FROM public.territories t
        WHERE t.status = 'disponivel'
          AND (
            t.last_worked_at IS NULL
            OR (CURRENT_DATE - t.last_worked_at) >= 28
          )
      ),
      'speeches_receive_30d', (
        SELECT count(*)::int
        FROM public.speech_assignments
        WHERE direction = 'receive'
          AND event_date BETWEEN v_today AND v_until
          AND confirmation_status <> 'cancelado'
      ),
      'speeches_send_30d', (
        SELECT count(*)::int
        FROM public.speech_assignments
        WHERE direction = 'send'
          AND event_date BETWEEN v_today AND v_until
          AND confirmation_status <> 'cancelado'
      ),
      'speeches_pending', (
        SELECT count(*)::int
        FROM public.speech_assignments
        WHERE confirmation_status = 'pendente'
          AND event_date >= v_today
      ),
      'equipment_publishers', (
        SELECT count(*)::int FROM public.equipment_publishers WHERE is_active = true
      ),
      'equipment_slots_week', (
        SELECT count(*)::int
        FROM public.equipment_schedule_slots s
        WHERE s.is_active = true
          AND (
            s.slot_kind = 'fixed'
            OR (s.slot_kind = 'temporary' AND s.week_start = v_week_start)
          )
      ),
      'notifications_unread', (
        SELECT count(*)::int
        FROM public.hub_notifications n
        WHERE n.recipient_user_id = auth.uid()
          AND n.read_at IS NULL
      ),
      'announcement_label', (
        SELECT b.reference_label
        FROM public.announcement_boards b
        WHERE b.status = 'published'
        ORDER BY b.reference_month DESC, b.published_at DESC NULLS LAST
        LIMIT 1
      ),
      'announcement_published', EXISTS (
        SELECT 1 FROM public.announcement_boards WHERE status = 'published'
      )
    ),
    'superintendent_visit', (
      SELECT row_to_json(v)::jsonb
      FROM (
        SELECT
          sv.id,
          sv.title,
          sv.visit_date,
          sv.notes,
          sv.updated_at,
          COALESCE((
            SELECT jsonb_agg(row_to_json(d)::jsonb ORDER BY d.sort_order, d.created_at)
            FROM (
              SELECT
                doc.id,
                doc.label,
                doc.file_name,
                doc.mime_type,
                doc.size_bytes,
                doc.storage_path,
                doc.sort_order
              FROM public.superintendent_visit_documents doc
              WHERE doc.visit_id = sv.id
              ORDER BY doc.sort_order, doc.created_at
            ) d
          ), '[]'::jsonb) AS documents
        FROM public.superintendent_visits sv
        WHERE sv.is_visible = true
        ORDER BY sv.visit_date DESC NULLS LAST, sv.updated_at DESC
        LIMIT 1
      ) v
    ),
    'agenda', COALESCE((
      SELECT jsonb_agg(row_to_json(x)::jsonb ORDER BY x.sort_key, x.event_date DESC, x.sort_order)
      FROM (
        SELECT
          e.title,
          e.category,
          e.event_date,
          e.date_display,
          e.date_label,
          e.event_time,
          e.location,
          e.is_highlight,
          e.sort_order,
          CASE WHEN e.event_date >= v_today THEN e.event_date ELSE '9999-12-31'::date END AS sort_key
        FROM public.agenda_events e
        WHERE e.published = true
          AND (e.event_date >= v_today OR e.is_highlight = true)
        ORDER BY sort_key, e.sort_order
        LIMIT 6
      ) x
    ), '[]'::jsonb),
    'territory_schedule', COALESCE((
      SELECT jsonb_agg(row_to_json(x)::jsonb ORDER BY x.sort_order)
      FROM (
        SELECT
          s.weekday_label,
          s.territory_code,
          s.dirigente_name,
          s.location_name,
          s.schedule_times,
          s.sort_order
        FROM public.territory_week_schedule s
        ORDER BY s.sort_order
      ) x
    ), '[]'::jsonb),
    'territory_assignments', COALESCE((
      SELECT jsonb_agg(row_to_json(x)::jsonb ORDER BY x.assigned_at DESC)
      FROM (
        SELECT
          t.num AS territory_num,
          t.display_name AS territory_name,
          p.full_name AS publisher_name,
          a.assigned_at
        FROM public.territory_active_assignments a
        JOIN public.territories t ON t.id = a.territory_id
        JOIN public.profiles p ON p.id = a.profile_id
        WHERE a.status = 'active'
        ORDER BY a.assigned_at DESC
        LIMIT 12
      ) x
    ), '[]'::jsonb),
    'speeches_upcoming', COALESCE((
      SELECT jsonb_agg(row_to_json(x)::jsonb ORDER BY x.event_date, x.event_time NULLS LAST)
      FROM (
        SELECT
          sa.direction,
          sa.event_date,
          sa.event_time,
          sa.confirmation_status,
          COALESCE(sp.full_name, sa.speaker_name) AS speaker_name,
          COALESCE(c.name, sa.congregation_name) AS congregation_name,
          COALESCE(st.title, sa.theme_title) AS theme_title
        FROM public.speech_assignments sa
        LEFT JOIN public.speech_speakers sp ON sp.id = sa.speaker_id
        LEFT JOIN public.speech_congregations c ON c.id = sa.congregation_id
        LEFT JOIN public.speech_themes st ON st.id = sa.theme_id
        WHERE sa.event_date BETWEEN v_today AND v_until
          AND sa.confirmation_status <> 'cancelado'
        ORDER BY sa.event_date, sa.event_time NULLS LAST
        LIMIT 8
      ) x
    ), '[]'::jsonb),
    'equipment_this_week', COALESCE((
      SELECT jsonb_agg(row_to_json(x)::jsonb ORDER BY x.sort_order)
      FROM (
        SELECT
          s.weekday_label,
          s.period_label,
          s.equipment_type,
          s.equipment_name,
          s.location_name,
          s.publisher_names,
          s.sort_order
        FROM public.equipment_schedule_slots s
        WHERE s.is_active = true
          AND (
            s.slot_kind = 'fixed'
            OR (s.slot_kind = 'temporary' AND s.week_start = v_week_start)
          )
        ORDER BY s.sort_order
        LIMIT 20
      ) x
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
