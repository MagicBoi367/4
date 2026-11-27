import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  derivePrivateClassCode,
  SCHEDULE_WEEKDAYS,
} from '../data/studentPortalData';
import type {
  ClassScheduleSlot,
  ScheduleDayKey,
  SubjectId,
  TeacherPrivateClass,
  UserAccount,
} from '../types/exam';
import { localizeSubjectName, useLanguage } from '../utils/i18n';
import { canTeacherEditResource, getSubjectMeta } from '../utils/scoring2025';
import {
  getTodayScheduleDayKey,
  isTimeSlotActiveNow,
  useRealtimeNow,
} from '../utils/realtimeClient';
import { useSubjects } from '../utils/subjectStore';
import { SubjectSearchSelect } from './SubjectSearchSelect';

const DAY_LABELS_EN: Record<ScheduleDayKey, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

const DAY_OFFSET_FROM_MONDAY: Record<ScheduleDayKey, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

function getMondayOfWeek(ms: number): Date {
  const base = new Date(ms);
  const localMidnight = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const jsDay = localMidnight.getDay(); // 0=Sun .. 6=Sat
  const diffToMon = jsDay === 0 ? -6 : 1 - jsDay;
  localMidnight.setDate(localMidnight.getDate() + diffToMon);
  return localMidnight;
}

function addDaysLocal(base: Date, days: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
}

function toIsoDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDayMonthLocal(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}`;
}

function formatWeekRangeLabel(monday: Date, sunday: Date): string {
  const sameYear = monday.getFullYear() === sunday.getFullYear();
  if (sameYear) {
    return `${formatDayMonthLocal(monday)} – ${formatDayMonthLocal(sunday)}/${sunday.getFullYear()}`;
  }
  return `${formatDayMonthLocal(monday)}/${monday.getFullYear()} – ${formatDayMonthLocal(sunday)}/${sunday.getFullYear()}`;
}

function getIsoWeekNumber(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

function getWeekDiff(targetMonday: Date, baseMonday: Date): number {
  const utcTarget = Date.UTC(
    targetMonday.getFullYear(),
    targetMonday.getMonth(),
    targetMonday.getDate(),
  );
  const utcBase = Date.UTC(
    baseMonday.getFullYear(),
    baseMonday.getMonth(),
    baseMonday.getDate(),
  );
  return Math.round((utcTarget - utcBase) / (7 * 86_400_000));
}

interface WeeklyCalendarScheduleProps {
  slots: ClassScheduleSlot[];
  classes: TeacherPrivateClass[];
  canEdit: boolean;
  currentUser: UserAccount | null;
  onAddSlot?: (slot: ClassScheduleSlot) => void;
  onUpdateSlot?: (slot: ClassScheduleSlot) => void;
  onDeleteSlot?: (id: string) => void;
  emptyNotice?: string;
}

export function WeeklyCalendarSchedule({
  slots,
  classes,
  canEdit,
  currentUser,
  onAddSlot,
  onUpdateSlot,
  onDeleteSlot,
  emptyNotice,
}: WeeklyCalendarScheduleProps) {
  useSubjects();
  const { language, tx } = useLanguage();
  const realtimeNow = useRealtimeNow(15_000);
  const todayDayKey = getTodayScheduleDayKey(realtimeNow);

  const [weekOffset, setWeekOffset] = useState(0);
  const currentMonday = useMemo(() => getMondayOfWeek(realtimeNow), [realtimeNow]);
  const currentWeekStart = useMemo(() => toIsoDateLocal(currentMonday), [currentMonday]);
  const selectedMonday = useMemo(
    () => addDaysLocal(currentMonday, weekOffset * 7),
    [currentMonday, weekOffset],
  );
  const selectedSunday = useMemo(() => addDaysLocal(selectedMonday, 6), [selectedMonday]);
  const selectedWeekStart = useMemo(() => toIsoDateLocal(selectedMonday), [selectedMonday]);
  const selectedWeekNumber = useMemo(
    () => getIsoWeekNumber(selectedMonday),
    [selectedMonday],
  );
  const selectedWeekRange = useMemo(
    () => formatWeekRangeLabel(selectedMonday, selectedSunday),
    [selectedMonday, selectedSunday],
  );

  const visibleWeekSlots = useMemo(
    () =>
      slots.filter((s) => (s.weekStart ?? currentWeekStart) === selectedWeekStart),
    [slots, currentWeekStart, selectedWeekStart],
  );

  const weekOffsetLabel = useMemo(() => {
    if (weekOffset === 0) return tx('Tuần hiện tại', 'Current week');
    if (weekOffset === -1) return tx('Tuần trước', 'Previous week');
    if (weekOffset === 1) return tx('Tuần sau', 'Next week');
    if (weekOffset < -1) {
      return tx(
        `Cách đây ${Math.abs(weekOffset)} tuần`,
        `${Math.abs(weekOffset)} weeks ago`,
      );
    }
    return tx(`Sau ${weekOffset} tuần`, `In ${weekOffset} weeks`);
  }, [weekOffset, tx]);

  const handleJumpToDate = (isoDate: string) => {
    if (!isoDate) return;
    const parts = isoDate.split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return;
    const picked = new Date(parts[0], parts[1] - 1, parts[2]);
    if (Number.isNaN(picked.getTime())) return;
    const pickedMonday = getMondayOfWeek(picked.getTime());
    setWeekOffset(getWeekDiff(pickedMonday, currentMonday));
  };

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const editableClasses = useMemo(
    () => classes.filter((c) => canTeacherEditResource(c, currentUser)),
    [classes, currentUser],
  );
  const editableClassMap = useMemo(
    () => new Map(editableClasses.map((c) => [c.id, c])),
    [editableClasses],
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ClassScheduleSlot | null>(null);
  const [dayKey, setDayKey] = useState<ScheduleDayKey>('mon');
  const [classId, setClassId] = useState<string>(
    editableClasses[0]?.id ?? classes[0]?.id ?? '',
  );
  const [timeSlot, setTimeSlot] = useState('19:30 – 21:00');
  const [subject, setSubject] = useState<SubjectId>(
    editableClasses[0]?.subject ?? classes[0]?.subject ?? currentUser?.subject ?? '',
  );
  const [topic, setTopic] = useState('');
  const [roomOrNote, setRoomOrNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const openAddModal = (presetDay: ScheduleDayKey) => {
    if (!canEdit) return;
    setEditingSlot(null);
    setDayKey(presetDay);
    const defaultClass = editableClasses[0] ?? classes[0];
    setClassId(defaultClass?.id ?? '');
    setTimeSlot('19:30 – 21:00');
    setSubject(defaultClass?.subject ?? currentUser?.subject ?? '');
    setTopic('');
    setRoomOrNote(
      defaultClass
        ? `${tx('Lớp', 'Class')} ${derivePrivateClassCode(defaultClass)}`
        : tx('Trực tuyến', 'Online'),
    );
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (slot: ClassScheduleSlot) => {
    if (!canEdit) return;
    setEditingSlot(slot);
    setDayKey(slot.dayKey);
    setClassId(slot.classId);
    setTimeSlot(slot.timeSlot);
    setSubject(slot.subject);
    setTopic(slot.topic);
    setRoomOrNote(slot.roomOrNote);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSaveSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !currentUser) return;
    const cleanTopic = topic.trim();
    const cleanTime = timeSlot.trim();
    if (!subject.trim()) {
      setFormError(
        tx(
          'Vui lòng tìm kiếm và chọn môn học cho buổi học.',
          'Please search and select a subject for this session.',
        ),
      );
      return;
    }
    if (!cleanTime || !cleanTopic) {
      setFormError(
        tx(
          'Vui lòng nhập khung giờ và nội dung buổi học.',
          'Please enter the time slot and session topic.',
        ),
      );
      return;
    }
    const targetClassId =
      (classId && editableClassMap.has(classId) ? classId : editableClasses[0]?.id) ||
      (editingSlot ? editingSlot.classId : 'general');
    const nextWeekStart = editingSlot?.weekStart ?? selectedWeekStart;

    if (editingSlot && onUpdateSlot) {
      onUpdateSlot({
        ...editingSlot,
        classId: targetClassId,
        dayKey,
        weekStart: nextWeekStart,
        timeSlot: cleanTime,
        subject,
        topic: cleanTopic,
        roomOrNote: roomOrNote.trim() || 'Trực tuyến',
      });
    } else if (onAddSlot) {
      onAddSlot({
        id: `csch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        classId: targetClassId,
        dayKey,
        weekStart: nextWeekStart,
        timeSlot: cleanTime,
        subject,
        topic: cleanTopic,
        roomOrNote: roomOrNote.trim() || 'Trực tuyến',
        ownerTeacherId: currentUser.id,
        ownerTeacherName: currentUser.fullName,
        createdAt: new Date().toISOString(),
      });
    }
    setModalOpen(false);
    setEditingSlot(null);
  };

  return (
    <div>
      {/* Week Switcher & Actions Bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/75 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-950/50">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
            {tx(`Tuần ${selectedWeekNumber}`, `Week ${selectedWeekNumber}`)}
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
            ·
          </span>
          <span className="font-mono font-semibold text-slate-700 tabular-nums dark:text-slate-200">
            {selectedWeekRange}
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
            ·
          </span>
          <span
            className={`font-semibold ${
              weekOffset === 0
                ? 'text-blue-700 dark:text-blue-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {weekOffsetLabel}
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
            ·
          </span>
          <span className="font-mono text-slate-500 tabular-nums dark:text-slate-400">
            {visibleWeekSlots.length}{' '}
            {language === 'en'
              ? visibleWeekSlots.length === 1
                ? 'session'
                : 'sessions'
              : 'buổi học'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label={tx('Điều hướng tuần học', 'Week navigation')}
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900"
          >
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w - 1)}
              aria-label={tx('Tuần trước', 'Previous week')}
              title={tx('Xem tuần trước', 'View previous week')}
              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tx('Tuần trước', 'Prev')}</span>
            </button>

            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              disabled={weekOffset === 0}
              className={`h-7 rounded-md px-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                weekOffset === 0
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300'
                  : 'cursor-pointer text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
            >
              {tx('Tuần này', 'This week')}
            </button>

            <button
              type="button"
              onClick={() => setWeekOffset((w) => w + 1)}
              aria-label={tx('Tuần sau', 'Next week')}
              title={tx('Xem tuần sau', 'View next week')}
              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <span className="hidden sm:inline">{tx('Tuần sau', 'Next')}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
            <span className="sr-only">{tx('Chọn ngày để chuyển tuần', 'Pick date to jump to week')}</span>
            <input
              type="date"
              value={selectedWeekStart}
              onChange={(e) => handleJumpToDate(e.target.value)}
              aria-label={tx('Chọn tuần theo ngày', 'Jump to week by date')}
              className="cursor-pointer bg-transparent font-mono text-xs font-medium text-slate-700 focus:outline-none dark:text-slate-200 dark:[color-scheme:dark]"
            />
          </label>

          {canEdit && (
            <button
              type="button"
              onClick={() => openAddModal('mon')}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{tx('Thêm buổi học', 'Add Session')}</span>
            </button>
          )}
        </div>
      </div>

      {/* 7-Column Calendar Grid: Thứ 2 -> Chủ nhật (horizontal scroll on narrow mobile, 7 cols on xl/lg) */}
      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[920px] grid-cols-7 divide-x divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {SCHEDULE_WEEKDAYS.map((day) => {
            const isToday = weekOffset === 0 && day.key === todayDayKey;
            const dayDate = addDaysLocal(selectedMonday, DAY_OFFSET_FROM_MONDAY[day.key]);
            const dayDateLabel = formatDayMonthLocal(dayDate);
            const dayLabel = language === 'en' ? DAY_LABELS_EN[day.key] : day.label;
            const daySlots = visibleWeekSlots
              .filter((s) => s.dayKey === day.key)
              .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));

            return (
              <div
                key={day.key}
                className={`flex min-h-[240px] flex-col ${
                  isToday ? 'bg-blue-50/35 dark:bg-blue-950/15' : ''
                }`}
              >
                {/* Day Column Header */}
                <div
                  className={`flex items-center justify-between border-b px-3 py-2.5 ${
                    isToday
                      ? 'border-blue-200 bg-blue-50/90 dark:border-blue-900/70 dark:bg-blue-950/50'
                      : 'border-slate-200 bg-slate-50/90 dark:border-slate-800 dark:bg-slate-950/60'
                  }`}
                >
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className={`font-display text-xs font-bold ${
                          isToday
                            ? 'text-blue-700 dark:text-blue-300'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {dayLabel}
                      </span>
                      <span
                        className={`font-mono text-[11px] font-semibold tabular-nums ${
                          isToday
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {dayDateLabel}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500 tabular-nums dark:text-slate-400">
                      {isToday ? `${tx('Hôm nay', 'Today')} · ` : ''}
                      {daySlots.length}{' '}
                      {language === 'en'
                        ? daySlots.length === 1
                          ? 'slot'
                          : 'slots'
                        : 'buổi'}
                    </span>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => openAddModal(day.key)}
                      title={tx(`Thêm lịch ${dayLabel} (${dayDateLabel})`, `Add slot for ${dayLabel} (${dayDateLabel})`)}
                      aria-label={tx(`Thêm lịch ${dayLabel} (${dayDateLabel})`, `Add slot for ${dayLabel} (${dayDateLabel})`)}
                      className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:border-blue-400 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-blue-400"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Day Column Body */}
                <div className="flex-1 space-y-2.5 p-2.5">
                  {daySlots.length === 0 ? (
                    <div className="flex h-full min-h-[160px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 p-2 text-center dark:border-slate-800">
                      <CalendarDays className="h-4 w-4 text-slate-300 dark:text-slate-700" />
                      <span className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                        {tx('Trống lịch', 'No sessions')}
                      </span>
                    </div>
                  ) : (
                    daySlots.map((slot) => {
                      const cls = classMap.get(slot.classId);
                      const classCode = cls ? derivePrivateClassCode(cls) : '';
                      const isLiveNow = isToday && isTimeSlotActiveNow(slot.timeSlot, realtimeNow);
                      const isOwner =
                        canEdit &&
                        Boolean(
                          currentUser &&
                            (currentUser.role === 'admin' ||
                              slot.ownerTeacherId === currentUser.id ||
                              (cls && canTeacherEditResource(cls, currentUser))),
                        );

                      return (
                        <div
                          key={slot.id}
                          className={`rounded-lg border p-2.5 text-xs ${
                            isLiveNow
                              ? 'border-emerald-400 bg-emerald-50/75 dark:border-emerald-700 dark:bg-emerald-950/35'
                              : 'border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold tabular-nums ${
                                isLiveNow
                                  ? 'text-emerald-700 dark:text-emerald-300'
                                  : 'text-blue-700 dark:text-blue-400'
                              }`}
                            >
                              <Clock className="h-3 w-3 shrink-0" />
                              <span>{slot.timeSlot}</span>
                            </span>
                            {isLiveNow && (
                              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                {tx('Đang diễn ra', 'Live now')}
                              </span>
                            )}
                          </div>

                          <p className="mt-1.5 font-semibold text-slate-900 dark:text-slate-100">
                            {localizeSubjectName(
                              slot.subject,
                              getSubjectMeta(slot.subject).name,
                              language,
                            )}
                          </p>

                          <p className="mt-1 text-[11px] leading-snug text-slate-700 dark:text-slate-300">
                            {slot.topic}
                          </p>

                          <div className="mt-2 space-y-0.5 border-t border-slate-200/70 pt-1.5 text-[10px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                            {classCode && (
                              <p className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                                {tx('Lớp:', 'Class:')} {classCode}
                              </p>
                            )}
                            <p className="truncate">
                              {tx('GV:', 'Teacher:')} {slot.ownerTeacherName}
                            </p>
                            <p className="truncate">{slot.roomOrNote}</p>
                          </div>

                          {isOwner && (
                            <div className="mt-2 flex items-center justify-end gap-1 border-t border-slate-200/70 pt-1.5 dark:border-slate-800">
                              <button
                                type="button"
                                onClick={() => openEditModal(slot)}
                                aria-label={tx('Sửa lịch học', 'Edit session')}
                                className="inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-white hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                              >
                                <Edit3 className="h-3 w-3" />
                                <span>{tx('Sửa', 'Edit')}</span>
                              </button>
                              {onDeleteSlot && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteSlot(slot.id)}
                                  aria-label={tx('Xóa lịch học', 'Delete session')}
                                  className="inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  <span>{tx('Xóa', 'Delete')}</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {visibleWeekSlots.length === 0 && (slots.length > 0 || emptyNotice) && (
        <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
          {slots.length > 0
            ? canEdit
              ? tx(
                  `Tuần ${selectedWeekNumber} (${selectedWeekRange}) chưa có buổi học nào. Nhấn '+ Thêm buổi học' để xếp lịch riêng cho tuần này.`,
                  `Week ${selectedWeekNumber} (${selectedWeekRange}) has no sessions yet. Click '+ Add Session' to schedule for this week.`,
                )
              : tx(
                  `Tuần ${selectedWeekNumber} (${selectedWeekRange}) chưa có lịch học nào.`,
                  `Week ${selectedWeekNumber} (${selectedWeekRange}) has no scheduled sessions yet.`,
                )
            : emptyNotice}
        </p>
      )}

      {/* Teacher-Only Add/Edit Schedule Modal */}
      {canEdit && modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingSlot ? tx('Cập nhật buổi học', 'Update Session') : tx('Thêm buổi học vào lịch', 'Add Session to Schedule')}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs dark:bg-slate-950/80"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                {editingSlot ? tx('Chỉnh sửa buổi học', 'Edit Study Session') : tx('Thêm buổi học mới', 'Add New Study Session')}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSlot} className="space-y-4 p-6">
              <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-200/80 bg-blue-50/70 px-3 py-2 text-xs text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
                <span className="font-semibold">
                  {tx(`Lịch riêng Tuần ${selectedWeekNumber}`, `Week ${selectedWeekNumber} Schedule`)}
                </span>
                <span className="font-mono text-[11px] tabular-nums">
                  {selectedWeekRange}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {tx('Ngày trong tuần', 'Day of week')}
                  </label>
                  <select
                    value={dayKey}
                    onChange={(e) => setDayKey(e.target.value as ScheduleDayKey)}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    {SCHEDULE_WEEKDAYS.map((d) => {
                      const dDate = formatDayMonthLocal(
                        addDaysLocal(selectedMonday, DAY_OFFSET_FROM_MONDAY[d.key]),
                      );
                      return (
                        <option key={d.key} value={d.key}>
                          {(language === 'en' ? DAY_LABELS_EN[d.key] : d.label)} ({dDate})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {tx('Khung giờ', 'Time slot')}
                  </label>
                  <input
                    type="text"
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(e.target.value)}
                    placeholder="19:30 – 21:00"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {tx('Lớp học', 'Class')}
                  </label>
                  <select
                    value={classId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setClassId(nextId);
                      const found = classMap.get(nextId);
                      if (found?.subject) setSubject(found.subject);
                    }}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    {editableClasses.length === 0 ? (
                      <option value="general">{tx('Lịch chung', 'General Schedule')}</option>
                    ) : (
                      editableClasses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {derivePrivateClassCode(c)} · {c.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {tx('Môn học', 'Subject')}
                  </label>
                  <SubjectSearchSelect
                    value={subject}
                    onChange={(val) => {
                      setSubject(val);
                      if (formError) setFormError(null);
                    }}
                    placeholder={tx('Tìm tên môn...', 'Search subject...')}
                    ariaLabel={tx('Tìm kiếm và chọn môn học cho lịch học', 'Search and select subject for schedule')}
                    currentUser={currentUser}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {tx('Nội dung / Chuyên đề buổi học', 'Session topic / focus')}
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={tx('VD: Ôn tập Nguyên hàm – Tích phân & Oxyz', 'e.g., Integrals & 3D Geometry Review')}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {tx('Phòng học / Ghi chú', 'Room / Notes')}
                </label>
                <input
                  type="text"
                  value={roomOrNote}
                  onChange={(e) => setRoomOrNote(e.target.value)}
                  placeholder={tx('VD: Phòng trực tuyến hoặc Phòng thi TOAN2025', 'e.g., Online Room or Exam Room TOAN2025')}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              {formError && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-2.5 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {tx('Hủy', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="cursor-pointer rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  {editingSlot ? tx('Lưu buổi học', 'Save Session') : tx('Thêm vào lịch', 'Add to Schedule')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
