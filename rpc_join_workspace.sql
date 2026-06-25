-- 1. 店舗（workspaces）の読み取り権限を「メンバーのみ」に制限する
DROP POLICY IF EXISTS "Workspaces are viewable by everyone" ON public.workspaces;
CREATE POLICY "Workspaces viewable by members" ON public.workspaces FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members 
    WHERE workspace_id = public.workspaces.id 
    AND user_id = auth.uid()
  )
);

-- 2. 店舗作成を安全に行うための関数
CREATE OR REPLACE FUNCTION create_workspace_secure(
  p_name text, 
  p_passkey text, 
  p_shift_entry_mode text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ws_id uuid;
BEGIN
  -- ワークスペースを作成してIDを取得
  INSERT INTO public.workspaces (name, passkey, shift_entry_mode)
  VALUES (p_name, p_passkey, p_shift_entry_mode)
  RETURNING id INTO v_ws_id;

  -- 作成者を自動的に管理者（manager / approved）として登録
  INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
  VALUES (v_ws_id, auth.uid(), 'manager', 'approved');

  RETURN v_ws_id;
END;
$$;

-- 3. 店舗への参加申請を安全に行うための関数
CREATE OR REPLACE FUNCTION join_workspace_secure(
  p_workspace_id uuid,
  p_passkey text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- IDとパスキーが一致するワークスペースが存在するか確認
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE id = p_workspace_id AND passkey = p_passkey
  ) INTO v_exists;

  -- 存在しない、またはパスキーが間違っている場合はfalseを返す
  IF NOT v_exists THEN
    RETURN false;
  END IF;

  -- 存在する場合は、従業員（employee / pending）として登録
  INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
  VALUES (p_workspace_id, auth.uid(), 'employee', 'pending');

  RETURN true;
END;
$$;
