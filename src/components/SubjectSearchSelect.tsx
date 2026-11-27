import { BookPlus, Check, ChevronDown, Plus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SubjectMeta, UserAccount } from '../types/exam';
import { localizeSubjectName, useLanguage } from '../utils/i18n';
import { getSubjectMeta } from '../utils/scoring2025';
import {
  addCustomSubject,
  ensureCatalogSubjectRegistered,
  normalizeSubjectSearch,
  searchSubjectCandidates,
  type SubjectCandidate,
  useSubjects,
} from '../utils/subjectStore';

interface SubjectSearchSelectProps {
  value: string;
  onChange: (subjectId: string) => void;
  allowAll?: boolean;
  allLabel?: string;
  placeholder?: string;
  ariaLabel?: string;
  currentUser?: UserAccount | null;
  onSubjectCreated?: (subject: SubjectMeta) => void;
  onOpenAdvancedAdd?: () => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
  buttonClassName?: string;
}

export function SubjectSearchSelect({
  value,
  onChange,
  allowAll = false,
  allLabel,
  placeholder,
  ariaLabel,
  currentUser = null,
  onSubjectCreated,
  onOpenAdvancedAdd,
  disabled = false,
  compact = false,
  className = '',
  buttonClassName = '',
}: SubjectSearchSelectProps) {
  const { language, tx } = useLanguage();
  const resolvedAllLabel = allLabel ?? tx('Tất cả môn học', 'All subjects');
  const resolvedPlaceholder = placeholder ?? tx('Tìm kiếm tên môn học...', 'Search subject...');
  const resolvedAriaLabel = ariaLabel ?? tx('Tìm kiếm và chọn môn học', 'Search and select subject');
  const subjects = useSubjects();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
        setInlineError(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
        setInlineError(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const registeredSet = useMemo(
    () => new Set(subjects.map((s) => s.id)),
    [subjects],
  );

  const selectedLabel = useMemo(() => {
    if (allowAll && value === 'all') return resolvedAllLabel;
    if (!value) return '';
    const meta = getSubjectMeta(value);
    return localizeSubjectName(meta.id, meta.name, language);
  }, [allowAll, resolvedAllLabel, registeredSet, value, language]);

  const trimmedQuery = query.trim();
  const candidates = useMemo(() => {
    if (!trimmedQuery) return [];
    return searchSubjectCandidates(trimmedQuery);
  }, [trimmedQuery, subjects]);

  const hasExactMatch = useMemo(() => {
    const norm = normalizeSubjectSearch(trimmedQuery);
    if (!norm) return false;
    return candidates.some((c) => normalizeSubjectSearch(c.name) === norm);
  }, [candidates, trimmedQuery]);

  const actor = currentUser
    ? { id: currentUser.id, name: currentUser.fullName, role: currentUser.role }
    : { name: 'Giáo viên', role: 'teacher' as const };

  const handleSelectCandidate = (candidate: SubjectCandidate) => {
    setInlineError(null);
    const resolved = candidate.isRegistered
      ? getSubjectMeta(candidate.id)
      : ensureCatalogSubjectRegistered(candidate, actor);
    onChange(resolved.id);
    if (!candidate.isRegistered) {
      onSubjectCreated?.(resolved);
    }
    setOpen(false);
    setQuery('');
  };

  const handleQuickCreate = () => {
    if (trimmedQuery.length < 2) {
      setInlineError(
        tx('Tên môn học phải có ít nhất 2 ký tự.', 'Subject name must be at least 2 characters.'),
      );
      return;
    }
    const res = addCustomSubject({ name: trimmedQuery }, actor);
    if (!res.ok) {
      setInlineError(res.error);
      return;
    }
    onSubjectCreated?.(res.subject);
    onChange(res.subject.id);
    setOpen(false);
    setQuery('');
    setInlineError(null);
  };

  const showClearButton =
    !disabled && ((allowAll && value !== 'all') || (!allowAll && Boolean(value)));

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <button
          type="button"
          disabled={disabled}
          aria-label={resolvedAriaLabel}
          aria-expanded={open}
          onClick={() => {
            if (disabled) return;
            setOpen((prev) => !prev);
            setInlineError(null);
          }}
          className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white text-left transition-colors hover:border-slate-400 focus:border-blue-700 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600 ${
            compact ? 'h-9 px-2.5 text-xs' : 'h-10 px-3 text-sm'
          } ${showClearButton ? 'pr-12' : 'pr-8'} ${buttonClassName}`}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span
              className={`truncate ${
                selectedLabel
                  ? 'font-medium text-slate-900 dark:text-slate-100'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {selectedLabel || resolvedPlaceholder}
            </span>
          </span>
        </button>

        <div className="pointer-events-none absolute right-2.5 flex items-center gap-1">
          {showClearButton && (
            <button
              type="button"
              tabIndex={-1}
              aria-label={tx('Xóa lựa chọn môn học', 'Clear selected subject')}
              onClick={(e) => {
                e.stopPropagation();
                onChange(allowAll ? 'all' : '');
              }}
              className="pointer-events-auto cursor-pointer rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        </div>
      </div>

      {open && (
        <div className="absolute left-0 z-50 mt-1.5 w-full min-w-[260px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (inlineError) setInlineError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (candidates.length > 0) {
                    handleSelectCandidate(candidates[0]);
                  } else if (trimmedQuery.length >= 2) {
                    handleQuickCreate();
                  }
                }
              }}
              placeholder={tx(
                'Nhập tên môn để tìm (VD: Sinh học, Văn...)',
                'Type subject name (e.g., Biology, Literature...)',
              )}
              className="h-9 w-full rounded-lg border border-slate-300 bg-slate-50 pr-7 pl-8 text-xs text-slate-900 focus:border-blue-700 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:bg-slate-950"
            />
            {query && (
              <button
                type="button"
                aria-label={tx('Xóa từ khóa tìm môn', 'Clear subject search')}
                onClick={() => {
                  setQuery('');
                  setInlineError(null);
                  inputRef.current?.focus();
                }}
                className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="mt-2 max-h-60 overflow-y-auto">
            {allowAll && !trimmedQuery && (
              <button
                type="button"
                onClick={() => {
                  onChange('all');
                  setOpen(false);
                  setQuery('');
                }}
                className={`mb-1 flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition-colors ${
                  value === 'all'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <span>{resolvedAllLabel}</span>
                {value === 'all' && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            )}

            {!trimmedQuery ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-3 py-3 text-center text-[11px] leading-relaxed text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                {tx(
                  'Nhập tên môn học vào ô tìm kiếm để hiển thị danh sách môn phù hợp hoặc tạo môn học mới.',
                  'Type a subject name above to search available subjects or create a new one.',
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {candidates.map((cand) => {
                  const isSelected = value === cand.id;
                  return (
                    <button
                      key={`${cand.id}_${cand.name}`}
                      type="button"
                      onClick={() => handleSelectCandidate(cand)}
                      className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                        isSelected
                          ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                          : 'text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {localizeSubjectName(cand.id, cand.name, language)}{' '}
                          <span className="font-mono text-[10px] font-normal text-slate-500 dark:text-slate-400">
                            ({cand.shortName})
                          </span>
                        </p>
                        <p className="font-mono text-[10px] text-slate-500 tabular-nums dark:text-slate-400">
                          {cand.defaultDuration} {tx('phút', 'min')} ·{' '}
                          {cand.isRegistered
                            ? tx('Đã có trong hệ thống', 'Already in system')
                            : tx('Nhấn để chọn & kích hoạt', 'Click to select & activate')}
                        </p>
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />}
                    </button>
                  );
                })}

                {!hasExactMatch && trimmedQuery.length >= 2 && (
                  <button
                    type="button"
                    onClick={handleQuickCreate}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50/70 px-2.5 py-2 text-left text-xs font-semibold text-blue-700 hover:bg-blue-100/70 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/60"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {tx(`Thêm môn mới: "${trimmedQuery}"`, `Add new subject: "${trimmedQuery}"`)}
                    </span>
                  </button>
                )}

                {candidates.length === 0 && trimmedQuery.length < 2 && (
                  <p className="px-2 py-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
                    {tx(
                      'Nhập ít nhất 2 ký tự để tìm hoặc tạo môn mới.',
                      'Type at least 2 characters to search or create a subject.',
                    )}
                  </p>
                )}
              </div>
            )}
          </div>

          {inlineError && (
            <p className="mt-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">
              {inlineError}
            </p>
          )}

          {onOpenAdvancedAdd && (
            <div className="mt-2 border-t border-slate-100 pt-1.5 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setQuery('');
                  onOpenAdvancedAdd();
                }}
                className="flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
              >
                <BookPlus className="h-3.5 w-3.5 shrink-0" />
                <span>{tx('Cấu hình & thêm môn học chi tiết...', 'Configure & add detailed subject...')}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
