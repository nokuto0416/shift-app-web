"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, addMonths, subMonths, isSameDay } from "date-fns";
import { ja } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Settings, CheckCircle, Edit2, Plus, ArrowLeft, X, RefreshCw, Bell } from "lucide-react";
import Link from "next/link";
import { Workspace, WorkspaceMember, Shift, Holiday, ShiftPattern } from "@/types";

export default function AdminCalendarPage() {
  const { id } = useParams();
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'detail' | 'add' | 'edit'>('detail');
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Form state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [shiftType, setShiftType] = useState('working');
  const [inputMode, setInputMode] = useState<'time' | 'slot'>('time');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('18:00');
  const [slot, setSlot] = useState('A');
  const [submitting, setSubmitting] = useState(false);



  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // Check manager permission
      const { data: member, error: memberError } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', id)
        .eq('user_id', user.id)
        .eq('role', 'manager')
        .eq('status', 'approved')
        .single();
      
      if (memberError || !member) {
        alert("管理者権限がありません。");
        router.push(`/workspace/${id}`);
        return;
      }

      // Fetch workspace
      const { data: ws } = await supabase.from('workspaces').select('*').eq('id', id).single();
      setWorkspace(ws);

      // Fetch all members to map names
      const { data: mems } = await supabase
        .from('workspace_members')
        .select('user_id, profiles(full_name)')
        .eq('workspace_id', id)
        .eq('status', 'approved');
      setMembers((mems as unknown as WorkspaceMember[]) || []);

      // Fetch all shifts for the month
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      const { data: allShifts, error: shiftsError } = await supabase
        .from('shifts')
        .select('*')
        .eq('workspace_id', id)
        .gte('date', format(start, 'yyyy-MM-dd'))
        .lte('date', format(end, 'yyyy-MM-dd'));

      if (shiftsError) throw shiftsError;
      setShifts(allShifts || []);

      // Fetch holidays
      const { data: hols } = await supabase
        .from('store_holidays')
        .select('*')
        .eq('workspace_id', id)
        .gte('date', format(start, 'yyyy-MM-dd'))
        .lte('date', format(end, 'yyyy-MM-dd'));
      setHolidays(hols || []);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (id) fetchAdminData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentDate]);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  if (loading && !workspace) {
    return <div className="container py-12 text-center text-muted">読み込み中...</div>;
  }

  // Generate calendar days
  const start = startOfMonth(currentDate);
  const end = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start, end });

  const getMemberName = (userId: string) => {
    const mem = members.find(m => m.user_id === userId);
    return mem?.profiles?.full_name || '名称未設定';
  };

  // Helper to color-code shifts
  const getShiftColor = (shift: Shift, index: number) => {
    if (shift.shift_type === 'off') return 'bg-red-100 text-red-800 border-red-200';
    const colors = [
      'bg-blue-100 text-blue-800 border-blue-200',
      'bg-green-100 text-green-800 border-green-200',
      'bg-purple-100 text-purple-800 border-purple-200',
      'bg-yellow-100 text-yellow-800 border-yellow-200',
      'bg-indigo-100 text-indigo-800 border-indigo-200',
      'bg-pink-100 text-pink-800 border-pink-200',
    ];
    return colors[index % colors.length];
  };

  const handlePublishShifts = async () => {
    if (!confirm(`${format(currentDate, 'M月')}のシフトを確定して、従業員全員に公開しますか？`)) return;
    
    try {
      setLoading(true);
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');
      
      const { error } = await supabase
        .from('shifts')
        .update({ status: 'approved' })
        .eq('workspace_id', id)
        .gte('date', startStr)
        .lte('date', endStr);
        
      if (error) throw error;
      alert(`${format(currentDate, 'M月')}のシフトを公開しました！`);
      fetchAdminData();
    } catch (error) {
      console.error(error);
      alert("公開に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  // Handlers for modal
  const openDayDetail = (date: Date) => {
    setSelectedDate(date);
    setModalMode('detail');
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setModalMode('add');
    setSelectedUserId(members[0]?.user_id || '');
    setShiftType('working');
    setInputMode('time');
    
    // Use defaults
    setStartTime(workspace?.open_time ? workspace.open_time.substring(0,5) : '10:00');
    setEndTime(workspace?.close_time ? workspace.close_time.substring(0,5) : '18:00');
    setSlot(workspace?.shift_patterns && workspace.shift_patterns.length > 0 ? workspace.shift_patterns[0].name : 'Aシフト');
  };

  const openEditModal = (shift: Shift) => {
    setModalMode('edit');
    setSelectedShift(shift);
    setSelectedUserId(shift.user_id);
    setShiftType(shift.shift_type);
    
    if (shift.notes && shift.notes.includes('パターン:')) {
      setInputMode('slot');
      setSlot(shift.notes.split('パターン: ')[1].trim());
    } else {
      setInputMode('time');
      setStartTime(shift.start_time ? shift.start_time.substring(0,5) : '10:00');
      setEndTime(shift.end_time ? shift.end_time.substring(0,5) : '18:00');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !selectedDate) return;

    try {
      setSubmitting(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      const shiftData: Partial<Shift> = {
        workspace_id: id as string,
        user_id: selectedUserId,
        date: dateStr,
        shift_type: shiftType as 'working' | 'off',
      };

      if (shiftType === 'working') {
        if (inputMode === 'slot') {
          shiftData.notes = `パターン: ${slot}`;
          shiftData.start_time = null;
          shiftData.end_time = null;
        } else {
          shiftData.start_time = `${startTime}:00`;
          shiftData.end_time = `${endTime}:00`;
          shiftData.notes = null;
        }
      }

      if (modalMode === 'edit') {
        if (!selectedShift) throw new Error("Shift is null");
        const { error } = await supabase.from('shifts').update(shiftData).eq('id', selectedShift.id);
        if (error) throw error;
      } else {
        // Upsert logic for adding
        await supabase.from('shifts').delete().eq('workspace_id', id).eq('user_id', selectedUserId).eq('date', dateStr);
        const { error } = await supabase.from('shifts').insert(shiftData);
        if (error) throw error;
      }

      // Save成功後、詳細画面に戻るかモーダルを閉じる
      setModalMode('detail');
      fetchAdminData();
    } catch (error) {
      console.error(error);
      alert("保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendPush = async () => {
    if (!confirm('メンバー全員に「来月のシフトを提出してください」という通知を送りますか？')) return;
    try {
      setSubmitting(true);
      const memberIds = members.map(m => m.user_id);
      
      const { data: subs, error } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .in('user_id', memberIds);

      if (error) throw error;

      if (!subs || subs.length === 0) {
        alert("通知を受け取れるメンバーがいません（メンバーがダッシュボードで通知を許可する必要があります）");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("認証されていません");

      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          workspaceId: id,
          subscriptions: subs,
          payload: {
            title: 'シフト提出のお願い',
            body: `${workspace?.name}のシフト提出期限が近づいています。シフトを提出してください。`,
            url: `/workspace/${id}`
          }
        })
      });

      const result = await res.json();
      if (res.ok) {
        alert(`${result.successCount}人に通知を送信しました！`);
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      console.error(err);
      alert('通知の送信に失敗しました: ' + (err.message || ''));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('このシフトを削除してもよろしいですか？')) return;
    try {
      setSubmitting(true);
      if (!selectedShift) throw new Error("Shift is null");
      const { error } = await supabase.from('shifts').delete().eq('id', selectedShift.id);
      if (error) throw error;
      setModalMode('detail');
      fetchAdminData();
    } catch (error) {
      console.error(error);
      alert("削除に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleHoliday = async () => {
    if (!selectedDate || !id) return;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const isHoliday = holidays.some(h => h.date === dateStr);
    
    setSubmitting(true);
    try {
      if (isHoliday) {
        // Remove holiday
        const { error } = await supabase.from('store_holidays').delete().eq('workspace_id', id).eq('date', dateStr);
        if (error) throw error;
      } else {
        // Add holiday
        const { error } = await supabase.from('store_holidays').insert([{ workspace_id: id, date: dateStr }]);
        if (error) throw error;
      }
      await fetchAdminData();
    } catch (error) {
      console.error(error);
      alert("設定の変更に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  // 選択された日付の全シフトを取得してソート（出勤が上、休みが下）
  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const selectedDateShifts = selectedDateStr ? shifts.filter(s => s.date === selectedDateStr).sort((a, b) => {
    if (a.shift_type === 'working' && b.shift_type === 'off') return -1;
    if (a.shift_type === 'off' && b.shift_type === 'working') return 1;
    return 0;
  }) : [];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <main className="container-fluid max-w-[1400px] mx-auto py-8 px-4 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarIcon className="text-primary" />
            シフト管理（全員分）
          </h1>
          <p className="text-sm text-muted mt-1">{workspace?.name}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={handleSendPush}
            disabled={submitting}
            className="btn bg-blue-500 text-white border-blue-600 hover:bg-blue-600 flex items-center gap-1 text-xs sm:text-sm py-2"
            title="通知を許可している従業員全員に催促通知を送ります"
          >
            <Bell size={16} />
            <span className="hidden sm:inline">提出を催促</span>
          </button>
          <button 
            onClick={handlePublishShifts}
            className="btn bg-green-500 text-white border-green-600 hover:bg-green-600 flex items-center gap-1 text-xs sm:text-sm py-2"
          >
            <CheckCircle size={16} />
            <span className="hidden sm:inline">シフトを確定・公開</span>
          </button>
          <Link href={`/workspace/${id}/settings`} className="btn btn-secondary flex items-center gap-1">
            <Settings size={16} />
            店舗設定
          </Link>
          <Link href={`/workspace/${id}`} className="btn btn-secondary">
            自分のシフトを提出
          </Link>
        </div>
      </div>

      {/* Calendar Area */}
      <div className="card w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CalendarIcon className="text-primary" />
            {format(currentDate, 'yyyy年 M月', { locale: ja })}
          </h2>
          <div className="flex gap-2">
            <button onClick={prevMonth} className="btn btn-secondary p-2"><ChevronLeft size={20}/></button>
            <button onClick={() => setCurrentDate(new Date())} className="btn btn-secondary py-2 px-4 text-sm">今月</button>
            <button onClick={nextMonth} className="btn btn-secondary p-2"><ChevronRight size={20}/></button>
            <button onClick={() => fetchAdminData()} className="btn btn-secondary p-2 ml-2" title="更新">
              <RefreshCw size={20} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        {/* 曜日ヘッダー (PC・タブレット・スマホ共通) */}
        <div className="overflow-x-auto w-full custom-scrollbar">
          <div className="min-w-[700px] sm:min-w-full">
            <div className="grid grid-cols-7 gap-[1px] bg-gray-200 border border-gray-200 rounded-t overflow-hidden">
              {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                <div key={d} className={`text-center font-bold text-sm py-2 bg-white ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-700'}`}>
                  {d}
                </div>
              ))}
            </div>
        
            {/* カレンダー本体 */}
            <div className="grid grid-cols-7 auto-rows-fr gap-[1px] bg-gray-200 border border-gray-200 sm:rounded-b overflow-hidden">
              {Array.from({ length: start.getDay() }).map((_, i) => (
                <div key={`empty-${i}`} className="block bg-gray-50 h-24 sm:h-32"></div>
              ))}
          
          {days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayShifts = shifts.filter(s => s.date === dateStr);
            const isHoliday = holidays.some(h => h.date === dateStr);
            
            return (
              <div 
                key={dateStr} 
                className={`bg-white transition-all ${isHoliday ? 'cursor-not-allowed bg-gray-200' : 'cursor-pointer hover:bg-gray-50'} relative
                  min-h-[80px] sm:min-h-[120px] p-0.5 sm:p-1 flex flex-col border-t overflow-hidden
                  ${isToday(day) ? 'bg-blue-50/30' : ''}
                  ${selectedDate && isSameDay(selectedDate, day) ? 'date-selected-highlight' : 'border-transparent'}
                `}
                style={{ position: 'relative' }}
                onClick={() => openDayDetail(day)}
              >

                <div className="flex justify-between items-start z-10 relative">
                  <div className={`text-xs font-bold p-1 mb-1 ${day.getDay() === 0 ? 'text-red-500' : day.getDay() === 6 ? 'text-blue-500' : 'text-gray-700'} ${isToday(day) ? 'bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center' : ''}`}>
                    {format(day, 'd')}
                  </div>
                </div>
                
                <div className="flex-grow flex flex-col gap-0.5 sm:gap-1 overflow-y-auto sm:custom-scrollbar relative z-10 hide-scrollbar-on-mobile">
                  {isHoliday ? (
                    <>
                      {/* デスクトップ用 休業ブロック */}
                      <div className="hidden sm:block">
                        <div className="flex items-center justify-center text-xs px-1.5 py-1 rounded truncate border border-gray-200 bg-gray-100 text-gray-700 shadow-sm font-bold">
                          休業
                        </div>
                      </div>
                      {/* モバイル用 休業ブロック */}
                      <div className="sm:hidden flex flex-col gap-0.5 mt-0.5 px-0.5">
                        <div className="text-[10px] font-bold px-1 py-0.5 rounded truncate leading-none text-center flex items-center justify-center gap-0.5 bg-gray-100 text-gray-700 shadow-sm border border-gray-200">
                          休業
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {dayShifts.map((shift, idx) => {
                    const userName = getMemberName(shift.user_id);
                    const userIndex = members.findIndex(m => m.user_id === shift.user_id);
                    const colorClass = getShiftColor(shift, userIndex >= 0 ? userIndex : idx);
                    
                    let shiftText = '';
                    if (shift.shift_type === 'off') {
                      shiftText = '休み';
                    } else if (shift.notes && shift.notes.includes('パターン:')) {
                      shiftText = shift.notes.replace('パターン: ', '');
                    } else {
                      shiftText = `${shift.start_time?.substring(0,5)}-${shift.end_time?.substring(0,5)}`;
                    }
                    const isDraft = shift.status !== 'approved';
                    return (
                      <div key={shift.id} className="hidden sm:block">
                        <div 
                          className={`flex items-center text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 sm:py-1 rounded truncate border transition-all ${colorClass} ${isDraft ? 'bg-opacity-30 border-dashed opacity-80' : 'shadow-sm'}`}
                          title={`${userName}: ${shiftText} ${isDraft ? '(公開前)' : ''}`}
                        >
                          <span className="font-bold mr-1">{userName.substring(0,4)}</span>
                          <span>{shiftText}</span>
                          <span className="ml-auto pl-1 text-[10px]">
                            {isDraft ? '⌚' : '✓'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* モバイル表示: 「〇名」の要約表示 */}
                  {dayShifts.length > 0 && (
                    <div className="sm:hidden flex flex-col gap-0.5 mt-0.5 px-0.5">
                      <div className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1 py-0.5 rounded truncate leading-none text-center shadow-sm">
                        {dayShifts.length}名 出勤
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
            );
          })}
          
          {Array.from({ length: 6 - end.getDay() }).map((_, i) => (
            <div key={`empty-end-${i}`} className="block bg-gray-50 h-24 sm:h-32"></div>
          ))}
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Modal */}
      {isModalOpen && selectedDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
            
            <div className="flex justify-between items-center mb-6 border-b pb-3 sticky top-0 bg-white z-10">
              <h3 className="font-bold text-xl flex items-center gap-2">
                {modalMode !== 'detail' && (
                  <button onClick={() => setModalMode('detail')} className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-black">
                    <ArrowLeft size={20} />
                  </button>
                )}
                {format(selectedDate, 'M月d日 (E)', { locale: ja })} 
                {modalMode === 'detail' && ' のシフト'}
                {modalMode === 'add' && ' - シフト追加'}
                {modalMode === 'edit' && ' - シフト編集'}
              </h3>
              <div className="flex items-center gap-2">
                {modalMode === 'detail' && (
                  <button 
                    onClick={toggleHoliday}
                    disabled={submitting}
                    className={`text-xs px-2 py-1 rounded-full font-bold transition-colors ${holidays.some(h => h.date === format(selectedDate, 'yyyy-MM-dd')) ? 'bg-gray-500 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    {holidays.some(h => h.date === format(selectedDate, 'yyyy-MM-dd')) ? '休業日を解除' : '休業日に設定'}
                  </button>
                )}
                <button onClick={() => setIsModalOpen(false)} className="text-muted hover:text-black p-1">
                  <X size={24} />
                </button>
              </div>
            </div>

            {holidays.some(h => h.date === format(selectedDate, 'yyyy-MM-dd')) && modalMode !== 'detail' && (
              <div className="bg-yellow-50 text-yellow-800 p-3 rounded mb-4 text-sm font-bold border border-yellow-200">
                ⚠️ この日は休業日に設定されています。シフトを追加しても従業員には休業日として表示されます。
              </div>
            )}

            {modalMode === 'detail' ? (
              <div className="flex flex-col gap-4">
                {selectedDateShifts.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {selectedDateShifts.map((shift, idx) => {
                      const userName = getMemberName(shift.user_id);
                      const userIndex = members.findIndex(m => m.user_id === shift.user_id);
                      const colorClass = getShiftColor(shift, userIndex >= 0 ? userIndex : idx);
                      
                      let shiftText = '';
                      if (shift.shift_type === 'off') {
                        shiftText = '休み希望';
                      } else if (shift.notes && shift.notes.includes('パターン:')) {
                        shiftText = shift.notes.replace('パターン: ', '');
                      } else {
                        shiftText = `${shift.start_time?.substring(0,5)} 〜 ${shift.end_time?.substring(0,5)}`;
                      }

                      return (
                        <div key={shift.id} className={`flex items-center justify-between p-3 rounded-md border ${colorClass}`}>
                          <div className="flex flex-col">
                            <span className="font-bold">{userName}</span>
                            <span className="text-sm opacity-90">{shiftText}</span>
                          </div>
                          <button 
                            onClick={() => openEditModal(shift)}
                            className="p-2 bg-white/50 hover:bg-white rounded border border-transparent hover:border-gray-200 transition-colors shadow-sm"
                          >
                            <Edit2 size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted bg-gray-50 rounded-lg border border-dashed">
                    この日のシフトはまだありません
                  </div>
                )}
                
                <div className="mt-2 pt-4 border-t">
                  <button 
                    onClick={openAddModal} 
                    className="btn bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 w-full flex items-center justify-center gap-2"
                  >
                    <Plus size={18} />
                    この日に新しいシフトを追加
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSave} className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-base font-bold text-gray-800">対象の従業員</label>
                  <select 
                    className="input-field bg-white text-lg py-3" 
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    disabled={modalMode === 'edit'}
                    required
                  >
                    {members.map(m => (
                      <option key={m.user_id} value={m.user_id}>{m.profiles?.full_name || '名称未設定'}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-base font-bold text-gray-800">タイプ</label>
                  <div className="flex gap-3">
                    <button 
                      type="button" 
                      className={`flex-1 py-3 text-lg rounded-md border-2 font-bold transition-colors shadow-sm ${shiftType === 'working' ? 'bg-green-500 text-white border-green-600' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                      onClick={() => setShiftType('working')}
                    >出勤</button>
                    <button 
                      type="button" 
                      className={`flex-1 py-3 text-lg rounded-md border-2 font-bold transition-colors shadow-sm ${shiftType === 'off' ? 'bg-red-500 text-white border-red-600' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                      onClick={() => setShiftType('off')}
                    >休み</button>
                  </div>
                </div>

                {shiftType === 'working' && (
                  <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 flex flex-col gap-5 shadow-inner">
                    <div className="flex gap-2 p-1.5 bg-gray-200 rounded-md">
                      <button 
                        type="button"
                        className={`flex-1 py-2 text-base font-bold rounded transition-colors ${inputMode === 'time' ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-800'}`}
                        onClick={() => setInputMode('time')}
                      >時間で入力</button>
                      <button 
                        type="button"
                        className={`flex-1 py-2 text-base font-bold rounded transition-colors ${inputMode === 'slot' ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-800'}`}
                        onClick={() => setInputMode('slot')}
                      >パターン</button>
                    </div>

                    {inputMode === 'slot' ? (
                      <div className="flex flex-col gap-2 mt-2">
                        <label className="text-base font-bold text-gray-800">シフトパターンの選択</label>
                        <select 
                          className="input-field bg-white text-lg py-3" 
                          value={slot} 
                          onChange={(e) => setSlot(e.target.value)}
                        >
                          {workspace?.shift_patterns && (workspace.shift_patterns as ShiftPattern[]).length > 0 ? (
                            (workspace.shift_patterns as ShiftPattern[]).map((p) => (
                              <option key={p.name} value={p.name}>{p.name} ({p.startTime}-{p.endTime})</option>
                            ))
                          ) : (
                            <>
                              <option value="Aシフト">Aシフト (09:00-15:00)</option>
                              <option value="Bシフト">Bシフト (15:00-22:00)</option>
                            </>
                          )}
                        </select>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex-1 flex flex-col gap-2">
                          <label className="text-base font-bold text-muted">開始時間</label>
                          <input type="time" className="input-field text-lg py-3 text-center" value={startTime} onChange={(e) => setStartTime(e.target.value)} step="300" required />
                        </div>
                        <span className="mt-8 text-xl font-bold text-gray-400">〜</span>
                        <div className="flex-1 flex flex-col gap-2">
                          <label className="text-base font-bold text-muted">終了時間</label>
                          <input type="time" className="input-field text-lg py-3 text-center" value={endTime} onChange={(e) => setEndTime(e.target.value)} step="300" required />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3 mt-2">
                  {modalMode === 'edit' && (
                    <button type="button" className="btn bg-red-100 text-red-600 border border-red-200 hover:bg-red-200 py-4 text-lg font-bold" onClick={handleDelete} disabled={submitting}>
                      削除
                    </button>
                  )}
                  <button type="submit" className="btn btn-primary flex-1 py-4 text-lg font-bold shadow-md" disabled={submitting}>
                    {submitting ? "保存中..." : "保存する"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
