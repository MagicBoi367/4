import { BookPlus, CheckCircle2, Plus, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { SubjectMeta, UserAccount } from '../types/exam';
import { localizeSubjectName, useLanguage } from '../utils/i18n';
import {
  addCustomSubject,
  deleteCustomSubject,
  searchSubjectCandidates,
  type SubjectCandidate,
  useSubjects,
} from '../utils/subjectStore';

interface AddSubjectModalProps {
  open: boolean;
  onClose: () => void;
  currentUser?: UserAccount | null;
  onSubjectAdded?: (subject: SubjectMeta) => void;
  onSubjectDeleted?: (subjectId: string) => void;
}

export function AddSubjectModal({
  open,
  onClose,
  currentUser = null,
  onSubjectAdded,
  onSubjectDeleted,
}: AddSubjectModalProps) {
  const { language, tx } = useLanguage();
  const subjects = useSubjects();
  const [lookupQuery, setLookupQuery] = useState('');
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [defaultDuration, setDefaultDuration] = useState(50);
  const [defaultPart1Count, setDefaultPart1Count] = useState(24);
  const [defaultPart2Count, setDefaultPart2Count] = useState(4);
  const [defaultPart3Count, setDefaultPart3Count] = useState(4);
  const [defaultPart3Point, setDefaultPart3Point] = useState(0.25);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  const trimmedLookup = lookupQuery.trim();
  const matchedCandidates = useMemo(() => {
    if (!trimmedLookup) return [];
    return searchSubjectCandidates(trimmedLookup);
  }, [trimmedLookup, subjects]);

  if (!open) return null;

  const customSubjects = subjects.filter((s) => s.isCustom);

  const handlePickCandidate = (cand: SubjectCandidate) => {
    if (cand.isRegistered) {
      const existing = subjects.find((s) => s.id === cand.id);
      if (existing) {
        const displayName = localizeSubjectName(existing.id, existing.name, language);
        setFeedback(
          tx(`Môn "${displayName}" đã sẵn sàng để chọn.`, `"${displayName}" is ready to select.`),
        );
        setError(null);
        onSubjectAdded?.(existing);
      }
      return;
    }
    setName(cand.name);
    setShortName(cand.shortName);
    setDefaultDuration(cand.defaultDuration);
    setDefaultPart1Count(cand.defaultPart1Count);
    setDefaultPart2Count(cand.defaultPart2Count);
    setDefaultPart3Count(cand.defaultPart3Count);
    setDefaultPart3Point(cand.defaultPart3Point);
    setError(null);
    setFeedback(null);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);

    const res = addCustomSubject(
      {
        name,
        shortName,
        defaultDuration,
        defaultPart1Count,
        defaultPart2Count,
        defaultPart3Count,
        defaultPart3Point,
      },
      currentUser
        ? { id: currentUser.id, name: currentUser.fullName, role: currentUser.role }
        : { name: 'Giáo viên', role: 'teacher' },
    );

    if (!res.ok) {
      setError(res.error);
      return;
    }

    setFeedback(
      tx(
        `Đã thêm môn học "${res.subject.name}" vào hệ thống.`,
        `Added subject "${res.subject.name}" to the system.`,
      ),
    );
    setName('');
    setShortName('');
    setLookupQuery('');
    onSubjectAdded?.(res.subject);
  };

  const handleDeleteCustom = (subj: SubjectMeta) => {
    const res = deleteCustomSubject(
      subj.id,
      currentUser
        ? { id: currentUser.id, name: currentUser.fullName, role: currentUser.role }
        : { name: 'Quản trị viên', role: 'admin' },
    );
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setConfirmDeleteId(null);
    setFeedback(
      tx(
        `Đã xóa môn học tùy chỉnh "${subj.name}".`,
        `Deleted custom subject "${subj.name}".`,
      ),
    );
    onSubjectDeleted?.(subj.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-subject-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
              <BookPlus className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="add-subject-modal-title"
                className="font-display text-base font-bold text-slate-900 dark:text-slate-50"
              >
                {tx('Tìm kiếm & thêm môn học', 'Search & Add Subject')}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {tx(
                  'Tìm theo tên môn hoặc tự nhập môn học mới để tạo lớp, câu hỏi và đề thi',
                  'Search existing subjects or add a custom one for classes, questions, and exams',
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={tx('Đóng cửa sổ thêm môn học', 'Close add subject dialog')}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {/* Search-First Lookup (hidden until user types) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {tx('Tìm kiếm môn học', 'Search subjects')}
            </label>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={lookupQuery}
                onChange={(e) => {
                  setLookupQuery(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={tx(
                  'Nhập tên môn học để tìm (VD: Ngữ văn, Sinh học, Tiếng Pháp...)',
                  'Type subject name (e.g., Literature, Biology, French...)',
                )}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-8 pl-9 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              {lookupQuery && (
                <button
                  type="button"
                  aria-label={tx('Xóa từ khóa tìm môn', 'Clear subject search')}
                  onClick={() => setLookupQuery('')}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {!trimmedLookup ? (
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                {tx(
                  'Gõ tên môn học để hiển thị kết quả khớp, hoặc nhập trực tiếp thông tin môn mới bên dưới.',
                  'Type a subject name to view matching presets, or enter custom details below.',
                )}
              </p>
            ) : (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {matchedCandidates.map((cand) => {
                  const candLabel = localizeSubjectName(cand.id, cand.name, language);
                  return (
                    <button
                      key={`${cand.id}_${cand.name}`}
                      type="button"
                      onClick={() => handlePickCandidate(cand)}
                      className={`cursor-pointer whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                        cand.isRegistered
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-300'
                      }`}
                    >
                      {cand.isRegistered ? `✓ ${candLabel}` : `+ ${tx('Điền mẫu:', 'Use template:')} ${candLabel}`}
                    </button>
                  );
                })}
                {matchedCandidates.length === 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setName(trimmedLookup);
                      setError(null);
                    }}
                    className="cursor-pointer whitespace-nowrap rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                  >
                    + {tx(`Điền "${trimmedLookup}" vào biểu mẫu tạo môn mới`, `Fill "${trimmedLookup}" into new subject form`)}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Add Form */}
          <form onSubmit={handleSubmit} className="space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {tx('Tên môn học *', 'Subject Name *')}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={tx('Nhập tên môn học mới...', 'Enter new subject name...')}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {tx('Tên viết tắt', 'Short name')}
                </label>
                <input
                  type="text"
                  value={shortName}
                  onChange={(e) => setShortName(e.target.value)}
                  placeholder={tx('VD: Sinh', 'e.g., Bio')}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  {tx('Phút thi', 'Minutes')}
                </label>
                <input
                  type="number"
                  min={5}
                  max={240}
                  value={defaultDuration}
                  onChange={(e) => setDefaultDuration(Number(e.target.value))}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 font-mono text-xs tabular-nums text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  {tx('Câu Phần I', 'Part I Qs')}
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={defaultPart1Count}
                  onChange={(e) => setDefaultPart1Count(Number(e.target.value))}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 font-mono text-xs tabular-nums text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  {tx('Câu Phần II', 'Part II Qs')}
                </label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={defaultPart2Count}
                  onChange={(e) => setDefaultPart2Count(Number(e.target.value))}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 font-mono text-xs tabular-nums text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  {tx('Câu Phần III', 'Part III Qs')}
                </label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={defaultPart3Count}
                  onChange={(e) => setDefaultPart3Count(Number(e.target.value))}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 font-mono text-xs tabular-nums text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  {tx('Điểm P.III', 'Part III Pts')}
                </label>
                <input
                  type="number"
                  min={0.1}
                  max={2}
                  step={0.05}
                  value={defaultPart3Point}
                  onChange={(e) => setDefaultPart3Point(Number(e.target.value))}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 font-mono text-xs tabular-nums text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
              >
                {error}
              </p>
            )}

            {feedback && (
              <p
                role="status"
                className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{feedback}</span>
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer whitespace-nowrap rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {tx('Đóng', 'Close')}
              </button>
              <button
                type="submit"
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{tx('Thêm môn học', 'Add Subject')}</span>
              </button>
            </div>
          </form>

          {/* Existing Custom Subjects */}
          <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {tx('Môn học tùy chỉnh đã thêm', 'Custom subjects added')} ({customSubjects.length})
            </p>
            {customSubjects.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {tx('Chưa có môn học tùy chỉnh nào được thêm.', 'No custom subjects added yet.')}
              </p>
            ) : (
              <div className="mt-2.5 divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {customSubjects.map((subj) => (
                  <div
                    key={subj.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {subj.name}{' '}
                        <span className="font-mono text-[11px] font-normal text-slate-500 dark:text-slate-400">
                          ({subj.shortName})
                        </span>
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                        {subj.defaultDuration} {tx('phút', 'min')} · P1: {subj.defaultPart1Count} · P2:{' '}
                        {subj.defaultPart2Count} · P3: {subj.defaultPart3Count}
                      </p>
                    </div>

                    {confirmDeleteId === subj.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDeleteCustom(subj)}
                          className="cursor-pointer whitespace-nowrap rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-700"
                        >
                          {tx('Xác nhận xóa', 'Confirm delete')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="cursor-pointer whitespace-nowrap rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                        >
                          {tx('Hủy', 'Cancel')}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(subj.id)}
                        className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-red-200 px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>{tx('Xóa', 'Delete')}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
