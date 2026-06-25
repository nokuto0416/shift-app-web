"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, addMonths, subMonths, isSameDay } from "date-fns";
import { ja } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, AlertCircle, X, Settings, CheckSquare, MousePointerClick, RefreshCw, Users } from "lucide-react";
import Link from "next/link";
import { Workspace, WorkspaceMember, Shift, Holiday } from "@/types";

export default function WorkspacePage() {
  const { id } = useParams();
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [memberInfo, setMemberInfo] = useState<WorkspaceMember | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Calendar & Modal state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'detail' | 'edit' | 'add'>('detail');
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  
  // Bulk Mode State
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);

  // Form state
  const [shiftType, setShiftType] = useState('working');
  const [inputMode, setInputMode] = useState<'time' | 'slot'>('time');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('18:00');
  const [slot, setSlot] = useState('A');
  const [submitting, setSubmitting] = useState(false);



  const fetchWorkspaceData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: ws, error: wsError } = await supabase.from('workspaces').select('*').eq('id', id).single();
      if (wsError) throw wsError;
      setWorkspace(ws);

      const { data: member, error: memberError } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', id)
        .eq('user_id', user.id)
        .single();
      
      if (memberError || !member || member.status !== 'approved') {
        alert("このサーバーにアクセスする権限がないか、承認待ちです。");
        router.push("/dashboard");
        return;
      }
      setMemberInfo(member);

      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      const { data: monthShifts, error: shiftsError } = await supabase
        .from('shifts')
        .select('*, profiles(full_name)')
        .eq('workspace_id', id)
        .gte('date', format(start, 'yyyy-MM-dd'))
        .lte('date', format(end, 'yyyy-MM-dd'));

      if (shiftsError) throw shiftsError;
      setShifts(monthShifts || []);

      // Fetch holidays
      const { data: hols } = await supabase
        .from('store_holidays')
        .select('*')
        .eq('workspace_id', id)
        .gte('date', format(start, 'yyyy-MM-dd'))
        .lte('date', format(end, 'yyyy-MM-dd'));
      setHolidays(hols || []);

      // Fetch all approved members for the member list popup
      const { data: allMembers } = await supabase
        .from('workspace_members')
        .select('*, profiles(full_name)')
        .eq('workspace_id', id)
        .eq('status', 'approved');
      setMembers(allMembers || []);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (id) fetchWorkspaceData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentDate]);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  if (loading && !workspace) {
    return <div className="container py-12 text-center text-muted">読み込み中...</div>;
  }

  const start = startOfMonth(currentDate);
  const end = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start, end });

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

  // 詳細モーダルを開く
  const openDayDetail = (date: Date) => {
    setSelectedDate(date);
    setModalMode('detail');
    setIsModalOpen(true);
  };

  // 編集フォームの準備
  const prepareEditForm = () => {
    if (!selectedDate) return;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const existingShift = shifts.find(s => s.date === dateStr && s.user_id === memberInfo?.user_id);
    
    const defaultStart = workspace?.open_time ? workspace.open_time.substring(0,5) : '10:00';
    const defaultEnd = workspace?.close_time ? workspace.close_time.substring(0,5) : '18:00';
    const defaultSlot = workspace?.shift_patterns && workspace.shift_patterns.length > 0 ? workspace.shift_patterns[0].name : 'Aシフト';
    
    if (existingShift) {
      setShiftType(existingShift.shift_type);
      setStartTime(existingShift.start_time ? existingShift.start_time.substring(0,5) : '10:00');
      setEndTime(existingShift.end_time ? existingShift.end_time.substring(0,5) : '18:00');
      if (existingShift.notes && existingShift.notes.includes('パターン:')) {
        setSlot(existingShift.notes.split('パターン: ')[1].trim());
        setInputMode('slot');
      } else {
        setInputMode('time');
      }
    } else {
      setShiftType('working');
      setInputMode('time');
      setStartTime(defaultStart);
      setEndTime(defaultEnd);
      setSlot(defaultSlot);
    }
    setModalMode('edit');
  };

  // バルク入力用
  const openBulkShiftModal = () => {
    const defaultStart = workspace?.open_time ? workspace.open_time.substring(0,5) : '10:00';
    const defaultEnd = workspace?.close_time ? workspace.close_time.substring(0,5) : '18:00';
    const defaultSlot = workspace?.shift_patterns && workspace.shift_patterns.length > 0 ? workspace.shift_patterns[0].name : 'Aシフト';

    setShiftType('working');
    setInputMode('time');
    setStartTime(defaultStart);
    setEndTime(defaultEnd);
    setSlot(defaultSlot);
    setModalMode('add');
    setIsModalOpen(true);
  };

  const handleDayClick = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const isHoliday = holidays.some(h => h.date === dateStr);
    
    if (isHoliday) {
      return;
    }

    if (isBulkMode) {
      const isSelected = selectedDates.some(d => isSameDay(d, day));
      if (isSelected) {
        setSelectedDates(selectedDates.filter(d => !isSameDay(d, day)));
      } else {
        setSelectedDates([...selectedDates, day]);
      }
    } else {
      openDayDetail(day);
    }
  };

  const handleShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberInfo) return;
    
    const datesToSave = isBulkMode ? selectedDates : (selectedDate ? [selectedDate] : []);
    if (datesToSave.length === 0) return;

    try {
      setSubmitting(true);
      
      for (const selectedDate of datesToSave) {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        
        const baseShiftData: Partial<Shift> = {
          workspace_id: id as string,
          user_id: memberInfo.user_id,
          date: dateStr,
          shift_type: shiftType as 'working' | 'off',
          status: 'pending',
        };

        if (shiftType === 'working') {
          if (inputMode === 'slot') {
            baseShiftData.notes = `パターン: ${slot}`;
            baseShiftData.start_time = null;
            baseShiftData.end_time = null;
          } else {
            baseShiftData.start_time = `${startTime}:00`;
            baseShiftData.end_time = `${endTime}:00`;
            baseShiftData.notes = null;
          }
        }

        await supabase
          .from('shifts')
          .delete()
          .eq('workspace_id', id)
          .eq('user_id', memberInfo.user_id)
          .eq('date', dateStr);

        const { error } = await supabase.from('shifts').insert(baseShiftData);
        if (error) throw error;
      }

      setIsBulkMode(false);
      setSelectedDates([]);
      setIsModalOpen(false);
      fetchWorkspaceData();
    } catch (error) {
      console.error(error);
      alert("保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const renderShiftForm = () => (
    <form onSubmit={handleShiftSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label className="text-base font-bold text-gray-800">希望タイプ</label>
        <div className="flex gap-3">
          <button 
            type="button" 
            className={`flex-1 py-3 text-lg rounded-md border-2 font-bold transition-colors shadow-sm ${shiftType === 'working' ? 'bg-green-500 text-white border-green-600' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
            onClick={() => setShiftType('working')}
          >出勤希望</button>
          <button 
            type="button" 
            className={`flex-1 py-3 text-lg rounded-md border-2 font-bold transition-colors shadow-sm ${shiftType === 'off' ? 'bg-red-500 text-white border-red-600' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
            onClick={() => setShiftType('off')}
          >休み希望</button>
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
            >パターンで入力</button>
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

      <button type="submit" className="btn btn-primary mt-2 py-4 text-lg font-bold shadow-md" disabled={submitting}>
        {submitting ? "保存中..." : (isBulkMode ? `${selectedDates.length}日分を一括保存` : "保存する")}
      </button>
    </form>
  );

  return (
    <>
      <main className="container-fluid max-w-[1400px] mx-auto py-8 px-4 flex flex-col gap-6 mb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarIcon className="text-primary" />
            {workspace?.name}
          </h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-sm text-muted bg-gray-100 px-2 py-0.5 rounded border">
              権限: {memberInfo?.role === 'manager' ? '管理者' : '従業員'}
            </span>
            <button 
              onClick={() => setIsMembersModalOpen(true)}
              className="text-sm text-gray-700 bg-white border border-gray-300 px-3 py-1 rounded-full shadow-sm hover:bg-gray-50 transition-colors flex items-center gap-1"
            >
              <Users size={14} />
              メンバー一覧
            </button>
            {memberInfo?.role === 'manager' && (
              <Link href={`/workspace/${id}/admin`} className="text-sm text-white bg-primary px-3 py-1 rounded-full shadow hover:bg-primary-dark transition-colors flex items-center gap-1">
                <Settings size={14} />
                シフト管理（全員分）を見る
              </Link>
            )}
          </div>
        </div>
        
        {workspace?.submission_deadline_day && (
          <div className="bg-orange-50 border border-orange-200 text-orange-700 px-4 py-2 rounded-md flex items-center gap-2 text-sm shadow-sm">
            <AlertCircle size={16} />
            <span>シフト提出の締め切りは <strong>毎月{workspace.submission_deadline_day}日</strong> です</span>
          </div>
        )}
      </div>

      {/* Calendar Grid Area */}
      <div className="card !p-0 overflow-hidden border-2 border-gray-100 shadow-md">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-gray-50 border-b gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              {format(currentDate, 'yyyy年 M月', { locale: ja })}
            </h2>
            <div className="flex gap-1">
              <button onClick={prevMonth} className="btn btn-secondary p-1.5 hover:bg-gray-200"><ChevronLeft size={20}/></button>
              <button onClick={() => setCurrentDate(new Date())} className="btn btn-secondary py-1.5 px-3 text-sm hover:bg-gray-200">今月</button>
              <button onClick={nextMonth} className="btn btn-secondary p-1.5 hover:bg-gray-200"><ChevronRight size={20}/></button>
              <button onClick={() => fetchWorkspaceData()} className="btn btn-secondary p-1.5 ml-2 hover:bg-gray-200" title="更新">
                <RefreshCw size={20} className="text-gray-600" />
              </button>
            </div>
          </div>
          
          <button 
            onClick={() => {
              setIsBulkMode(!isBulkMode);
              setSelectedDates([]);
            }} 
            className={`btn w-full sm:w-auto shadow-sm ${isBulkMode ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'btn-primary'} py-2 px-4 flex items-center justify-center gap-2`}
          >
            <CheckSquare size={18} />
            <span className="font-bold">{isBulkMode ? '選択モードを終了する' : '複数日をまとめて入力'}</span>
          </button>
        </div>

        {isBulkMode && (
          <div className="bg-blue-100 border-b border-blue-200 p-3 text-center text-blue-800 font-bold flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-2">
            <MousePointerClick size={20} />
            カレンダーの日付をタップして、入力したい日を選択してください
          </div>
        )}

        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 gap-[1px] bg-gray-200 border-t border-gray-200">
          {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
            <div key={d} className={`text-center font-bold text-xs sm:text-sm py-1 sm:py-2 bg-gray-50 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-700'}`}>
              {d}
            </div>
          ))}
        </div>
        
        {/* カレンダー本体 */}
        {(() => {
          // すべてのマスを1つの配列にまとめる
          const allCells: { type: 'empty' | 'day', day?: Date, id: string }[] = [];
          
          Array.from({ length: start.getDay() }).forEach((_, i) => {
            allCells.push({ type: 'empty', id: `empty-start-${i}` });
          });
          
          days.forEach(day => {
            allCells.push({ type: 'day', day, id: `day-${format(day, 'yyyy-MM-dd')}` });
          });
          
          Array.from({ length: 6 - end.getDay() }).forEach((_, i) => {
            allCells.push({ type: 'empty', id: `empty-end-${i}` });
          });

          // 週ごとに分割する
          const weeks = [];
          for (let i = 0; i < allCells.length; i += 7) {
            weeks.push(allCells.slice(i, i + 7));
          }

          return (
            <div className="flex flex-col gap-[1px] bg-gray-200 border-t border-gray-200">
              {weeks.map((week, wIndex) => {
                const isSelectedWeek = week.some(cell => cell.type === 'day' && selectedDate && isSameDay(cell.day!, selectedDate));
                
                return (
                  <React.Fragment key={`week-${wIndex}`}>
                    <div className="grid grid-cols-7 auto-rows-fr gap-[1px]">
                      {week.map(cell => {
                        if (cell.type === 'empty') {
                          return <div key={cell.id} className="block bg-gray-50 min-h-[80px] sm:min-h-[120px]"></div>;
                        }
                        
                        const day = cell.day!;
            const dateStr = format(day, 'yyyy-MM-dd');
            const isHoliday = holidays.some(h => h.date === dateStr);
            const dayShifts = shifts.filter(s => s.date === dateStr);
            dayShifts.sort((a, b) => {
              if (a.user_id === memberInfo?.user_id) return -1;
              if (b.user_id === memberInfo?.user_id) return 1;
              return 0;
            });
            
            // ハイライト判定
            const isSingleSelected = !isBulkMode && isModalOpen && selectedDate && isSameDay(selectedDate, day);
            const isMultiSelected = isBulkMode && selectedDates.some(d => isSameDay(d, day));
            const highlightClass = isMultiSelected 
              ? 'bg-blue-50 outline outline-4 outline-blue-500 outline-offset-[-4px] z-10' 
              : isSingleSelected 
                ? 'date-selected-highlight' 
                : 'border-transparent';
            
            return (
              <div 
                key={dateStr} 
                className={`bg-white transition-all ${isHoliday ? 'cursor-not-allowed bg-gray-200' : 'cursor-pointer'} relative
                  min-h-[80px] sm:min-h-[120px] p-0.5 sm:p-1 flex flex-col border-t overflow-hidden
                  ${isToday(day) && !isMultiSelected && !isHoliday ? 'bg-blue-50/30' : ''}
                  ${isBulkMode && !isMultiSelected && !isHoliday ? 'hover:bg-blue-50/50' : !isHoliday ? 'hover:bg-gray-50' : ''}
                  ${highlightClass}
                `}
                style={{ position: 'relative' }}
                onClick={() => handleDayClick(day)}
              >

                <div className="flex justify-between items-start z-10 relative">
                  <div className={`text-[10px] sm:text-xs font-bold sm:p-1 mb-0.5 sm:mb-1 ${day.getDay() === 0 ? 'text-red-500' : day.getDay() === 6 ? 'text-blue-500' : 'text-gray-700'} ${isToday(day) ? 'bg-primary text-white rounded-full w-4 h-4 sm:w-6 sm:h-6 flex items-center justify-center' : ''}`}>
                    {format(day, 'd')}
                  </div>
                  {isBulkMode && !isHoliday && (
                    <div className={`w-4 h-4 sm:w-5 sm:h-5 mt-0.5 sm:mt-1 mr-0.5 sm:mr-1 rounded border-2 flex items-center justify-center transition-colors ${isMultiSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'}`}>
                      {isMultiSelected && <CheckSquare size={12} className="text-white sm:w-4 sm:h-4" />}
                    </div>
                  )}
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
                      {dayShifts.map((shift, i) => {
                    const isMine = shift.user_id === memberInfo?.user_id;
                    const userName = isMine ? '自分' : (shift.profiles?.full_name || '不明');
                    const colorClass = getShiftColor(shift, i);
                    
                    let shiftText = '';
                    if (shift.shift_type === 'off') {
                      shiftText = '休み';
                    } else if (shift.notes && shift.notes.includes('パターン:')) {
                      shiftText = shift.notes.replace('パターン: ', '');
                    } else {
                      shiftText = `${shift.start_time?.substring(0,5)}-${shift.end_time?.substring(0,5)}`;
                    }

                    const isDraft = isMine && shift.status !== 'approved';

                    return (
                      <div key={shift.id} className="hidden sm:block">
                        <div 
                          className={`flex items-center text-xs px-1.5 py-1 rounded truncate border transition-all ${colorClass} ${isDraft ? 'bg-opacity-30 border-dashed opacity-80' : 'shadow-sm'}`}
                          title={`${userName}: ${shiftText} ${isDraft ? '(公開前)' : ''}`}
                        >
                          <span className="font-bold mr-1">{userName.substring(0,4)}</span>
                          <span>{shiftText}</span>
                          {isMine && (
                            <span className="ml-auto pl-1 text-[10px]">
                              {isDraft ? '⌚' : '✓'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* モバイル表示: 「自分」と「他〇名」の要約表示 */}
                  {dayShifts.length > 0 && (
                    <div className="sm:hidden flex flex-col gap-0.5 mt-0.5 px-0.5">
                      {dayShifts.some(s => s.user_id === memberInfo?.user_id) && (
                        (() => {
                          const myS = dayShifts.find(s => s.user_id === memberInfo?.user_id);
                          const isApproved = myS?.status === 'approved';
                          return (
                            <div className={`text-[10px] font-bold px-1 py-0.5 rounded truncate leading-none text-center flex items-center justify-center gap-0.5 ${
                              isApproved 
                                ? 'bg-blue-500 text-white shadow-sm border border-blue-600' 
                                : 'bg-blue-50 text-blue-600 border border-blue-400 border-dashed'
                            }`}>
                              自分 {isApproved ? '✓' : '⌚'}
                            </div>
                          );
                        })()
                      )}
                      {dayShifts.filter(s => s.user_id !== memberInfo?.user_id).length > 0 && (
                        <div className="text-[9px] font-bold bg-gray-100 text-gray-600 border border-gray-200 px-1 py-0.5 rounded truncate leading-none text-center">
                          他 {dayShifts.filter(s => s.user_id !== memberInfo?.user_id).length}名
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* モバイル用アコーディオン（選択された週の下に表示） */}
                      {!isBulkMode && isModalOpen && isSelectedWeek && selectedDate && (
                        <div className="sm:hidden col-span-7 bg-white border-y-2 border-primary animate-in slide-in-from-top-2 overflow-hidden shadow-inner flex flex-col">
                          {(() => {
                            const dateStr = format(selectedDate, 'yyyy-MM-dd');
                            const dayShifts = shifts.filter(s => s.date === dateStr);
                            const myShift = dayShifts.find(s => s.user_id === memberInfo?.user_id);
                            
                            let currentShiftDisplay = '未提出';
                            let statusBadge = null;
                            if (myShift) {
                              if (myShift.shift_type === 'off') {
                                currentShiftDisplay = '休み';
                              } else if (myShift.notes && myShift.notes.includes('パターン:')) {
                                currentShiftDisplay = myShift.notes.replace('パターン: ', '');
                              } else {
                                currentShiftDisplay = `${myShift.start_time?.substring(0,5)} 〜 ${myShift.end_time?.substring(0,5)}`;
                              }
                              statusBadge = myShift.status === 'approved' 
                                ? <span className="bg-green-100 text-green-800 text-[10px] px-2 py-0.5 rounded-full font-bold ml-2">確定</span>
                                : <span className="bg-yellow-100 text-yellow-800 text-[10px] px-2 py-0.5 rounded-full font-bold ml-2">公開前</span>;
                            }

                            return (
                              <div className="p-4 flex flex-col gap-4">
                                <div className="flex justify-between items-center border-b pb-2">
                                  <h3 className="font-bold text-base flex items-center gap-2">
                                    <span className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">
                                      {format(selectedDate, 'd')}
                                    </span>
                                    日のシフト入力
                                  </h3>
                                  <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black">
                                    <X size={20} />
                                  </button>
                                </div>

                                {modalMode === 'detail' ? (
                                  <>
                                    <div className="bg-blue-50/50 p-3 rounded-md border border-blue-100 flex flex-col gap-1">
                                      <div className="text-xs text-gray-500 font-bold">現在の登録状況</div>
                                      <div className="font-black text-lg text-gray-800 flex items-center">
                                        {currentShiftDisplay}
                                        {statusBadge}
                                      </div>
                                    </div>

                                    <button 
                                      onClick={prepareEditForm}
                                      className="w-full btn btn-primary py-2.5 text-sm mt-2"
                                    >
                                      {myShift ? 'シフトを変更する' : 'シフトを提出する'}
                                    </button>
                                  </>
                                ) : (
                                  <div className="mt-2">
                                    {renderShiftForm()}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
            </div>
          );
        })()}
      </div>

      {/* Floating Bulk Action Bar */}
      {isBulkMode && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-primary shadow-[0_-10px_15px_-3px_rgb(0,0,0,0.1)] p-4 z-40 animate-in slide-in-from-bottom-full">
          <div className="container max-w-[1400px] mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-lg">
              <span className="font-bold text-primary text-2xl">{selectedDates.length}</span> 日分を選択中
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button 
                className="btn bg-gray-100 text-gray-700 border hover:bg-gray-200 disabled:opacity-50 flex-1 sm:flex-none" 
                onClick={() => setSelectedDates([])}
                disabled={selectedDates.length === 0}
              >
                クリア
              </button>
              <button 
                className="btn btn-primary px-6 disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none" 
                onClick={openBulkShiftModal}
                disabled={selectedDates.length === 0}
              >
                この日をまとめて設定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Modal (PC版のみ、または複数日選択時のみ表示) */}
      {isModalOpen && selectedDate && (
        <div className={`fixed inset-0 bg-black/50 p-4 z-50 items-center justify-center ${isBulkMode ? 'flex' : 'hidden sm:flex'}`}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto sm:custom-scrollbar">
            <div className="flex justify-between items-center mb-6 border-b pb-3 sticky top-0 bg-white z-10">
              <h3 className="font-bold text-xl flex items-center gap-2">
                {modalMode === 'detail' && `${format(selectedDate, 'M月d日 (E)', { locale: ja })} のシフト`}
                {modalMode === 'edit' && `${format(selectedDate, 'M月d日 (E)', { locale: ja })} のシフト提出`}
                {modalMode === 'add' && <span className="text-primary">{selectedDates.length}日分の一括シフト提出</span>}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted hover:text-black p-1">
                <X size={24} />
              </button>
            </div>

            {modalMode === 'detail' ? (
              <div className="flex flex-col gap-4">
                {(() => {
                  const dateStr = format(selectedDate, 'yyyy-MM-dd');
                  const dayShifts = shifts.filter(s => s.date === dateStr);
                  const myShift = dayShifts.find(s => s.user_id === memberInfo?.user_id);
                  const otherShifts = dayShifts.filter(s => s.user_id !== memberInfo?.user_id);

                  return (
                    <>
                      {/* 自分のシフト */}
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-100 shadow-sm">
                        <div className="text-sm font-bold text-blue-800 mb-2">あなたのシフト</div>
                        {myShift ? (
                          <div className="flex justify-between items-center">
                            <div className="text-xl font-black text-gray-800">
                              {myShift.shift_type === 'off' ? '休み' : 
                               myShift.notes && myShift.notes.includes('パターン:') ? myShift.notes.replace('パターン: ', '') :
                               `${myShift.start_time?.substring(0,5)} - ${myShift.end_time?.substring(0,5)}`}
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full ${myShift.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                              {myShift.status === 'approved' ? '確定' : '公開前'}
                            </span>
                          </div>
                        ) : (
                          <div className="text-gray-500">未提出</div>
                        )}
                        <button 
                          onClick={prepareEditForm}
                          className="mt-4 w-full btn bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-50"
                        >
                          シフトを入力・編集する
                        </button>
                      </div>

                      {/* 他のメンバーのシフト */}
                      {otherShifts.length > 0 && (
                        <div className="mt-2">
                          <div className="text-sm font-bold text-gray-600 mb-2 border-b pb-1">他のメンバー</div>
                          <div className="flex flex-col gap-2">
                            {otherShifts.map((shift, i) => {
                              const userName = shift.profiles?.full_name || '不明';
                              const colorClass = getShiftColor(shift, i + 1); // 自分を0とした場合のシフト
                              
                              let shiftText = '';
                              if (shift.shift_type === 'off') {
                                shiftText = '休み';
                              } else if (shift.notes && shift.notes.includes('パターン:')) {
                                shiftText = shift.notes.replace('パターン: ', '');
                              } else {
                                shiftText = `${shift.start_time?.substring(0,5)} - ${shift.end_time?.substring(0,5)}`;
                              }

                              return (
                                <div key={shift.id} className={`flex justify-between items-center p-2 rounded border ${colorClass}`}>
                                  <span className="font-bold">{userName}</span>
                                  <span className="font-bold">{shiftText}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              renderShiftForm()
            )}
          </div>
        </div>
      )}
      {/* Members List Modal */}
      {isMembersModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Users className="text-primary" />
                メンバー一覧
              </h2>
              <button onClick={() => setIsMembersModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X size={24} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex flex-col gap-2">
              <div className="text-sm text-gray-500 mb-2">現在の承認済みメンバー：{members.length}名</div>
              {members.map(member => (
                <div key={member.id} className="flex items-center justify-between p-3 border rounded-md bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${member.role === 'manager' ? 'bg-primary text-white' : 'bg-primary-light text-primary'}`}>
                      {member.profiles?.full_name?.substring(0, 1) || '?'}
                    </div>
                    <div>
                      <div className="font-bold">{member.profiles?.full_name}</div>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded border ${member.role === 'manager' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-600'}`}>
                    {member.role === 'manager' ? '管理者' : '従業員'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
