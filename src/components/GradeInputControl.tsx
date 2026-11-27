import { ListFilter } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { GradeLevel } from '../types/exam';
import { localizeGradeText, useLanguage } from '../utils/i18n';
import {
  ALLOWED_GRADES,
  HIGHER_EDUCATION_GRADES,
  OTHER_GRADE_LEVELS,
  SCHOOL_GRADE_NUMBERS,
  formatGradeLabel,
  parseAllowedGradeInput,
} from '../utils/scoring2025';

interface GradeInputControlProps {
  value: GradeLevel;
  onChange: (nextGrade: GradeLevel) => void;
  ariaLabel?: string;
  compact?: boolean;
  className?: string;
  placeholder?: string;
}

export function GradeInputControl({
  value,
  onChange,
  ariaLabel,
  compact = false,
  className = '',
  placeholder,
}: GradeInputControlProps) {
  const { language, tx } = useLanguage();
  const resolvedAriaLabel =
    ariaLabel ??
    tx(
      'Chọn hoặc nhập khối (1–12, Đại học, Cao đẳng, Khác)',
      'Select or enter grade (1–12, University, College, Other)',
    );
  const resolvedPlaceholder =
    placeholder ??
    tx(
      'VD: 1..12, Đại học, Cao đẳng, Khác',
      'e.g., 1..12, University, College, Other',
    );
  const gradeErrorMessage = tx(
    'Chỉ cho phép nhập khối từ 1 đến 12, Đại học, Cao đẳng hoặc Khác.',
    'Only grades 1 to 12, University, College, or Other are allowed.',
  );

  const isAllowedOption = ALLOWED_GRADES.some(
    (g) => String(g) === String(value).trim(),
  );

  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState(() =>
    value !== undefined && value !== null ? String(value) : '12',
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      setCustomText(String(value));
    }
  }, [value]);

  const heightCls = compact ? 'h-9 text-xs' : 'h-10 text-xs';

  if (customMode) {
    return (
      <div className={className}>
        <div className="flex items-center gap-1">
          <input
            type="text"
            autoFocus
            aria-label={resolvedAriaLabel}
            aria-invalid={Boolean(error)}
            value={customText}
            onChange={(e) => {
              const raw = e.target.value;
              setCustomText(raw);
              if (!raw.trim()) {
                setError(null);
                return;
              }
              const parsed = parseAllowedGradeInput(raw);
              if (parsed !== null) {
                setError(null);
                onChange(parsed);
              } else {
                setError(gradeErrorMessage);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const parsed = parseAllowedGradeInput(customText);
                if (parsed !== null) {
                  setError(null);
                  onChange(parsed);
                  setCustomText(String(parsed));
                  setCustomMode(false);
                } else {
                  setError(gradeErrorMessage);
                }
              } else if (e.key === 'Escape') {
                setError(null);
                setCustomText(String(value ?? '12'));
                setCustomMode(false);
              }
            }}
            placeholder={resolvedPlaceholder}
            className={`${heightCls} min-w-0 flex-1 rounded-lg border bg-white px-2.5 font-medium text-slate-900 focus:outline-none dark:bg-slate-950 dark:text-slate-100 ${
              error
                ? 'border-rose-500 focus:border-rose-600 dark:border-rose-500'
                : 'border-blue-500 focus:border-blue-600 dark:border-blue-500'
            }`}
          />
          <button
            type="button"
            title={tx('Quay lại danh sách khối', 'Back to grade list')}
            onClick={() => {
              setError(null);
              const parsed = parseAllowedGradeInput(customText);
              if (parsed !== null) {
                onChange(parsed);
              } else {
                setCustomText(String(value ?? '12'));
              }
              setCustomMode(false);
            }}
            className={`${heightCls} inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-2 font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700`}
          >
            <ListFilter className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tx('Chọn', 'Select')}</span>
          </button>
        </div>
        {error && (
          <p
            role="alert"
            className="mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400"
          >
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <select
      aria-label={resolvedAriaLabel}
      value={String(value)}
      onChange={(e) => {
        const val = e.target.value;
        if (val === '__custom__') {
          setError(null);
          setCustomText(value !== undefined && value !== null ? String(value) : '');
          setCustomMode(true);
          return;
        }
        const parsed = parseAllowedGradeInput(val);
        if (parsed !== null) {
          onChange(parsed);
        }
      }}
      className={`${heightCls} w-full rounded-lg border border-slate-300 bg-white px-2.5 font-medium text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 ${className}`}
    >
      <optgroup label={tx('Phổ thông (Khối 1 – 12)', 'K-12 (Grades 1 – 12)')}>
        {SCHOOL_GRADE_NUMBERS.map((g) => (
          <option key={g} value={String(g)}>
            {tx(`Khối ${g}`, `Grade ${g}`)}
          </option>
        ))}
      </optgroup>
      <optgroup label={tx('Bậc Đại học / Cao đẳng', 'Higher Education')}>
        {HIGHER_EDUCATION_GRADES.map((g) => (
          <option key={g} value={g}>
            {localizeGradeText(g, language)}
          </option>
        ))}
      </optgroup>
      <optgroup label={tx('Bậc học khác', 'Other Level')}>
        {OTHER_GRADE_LEVELS.map((g) => (
          <option key={g} value={g}>
            {localizeGradeText(g, language)}
          </option>
        ))}
      </optgroup>
      {!isAllowedOption && String(value).trim() !== '' && (
        <option value={String(value)}>
          {localizeGradeText(formatGradeLabel(value), language)}
        </option>
      )}
      <option value="__custom__">
        {tx(
          '+ Nhập khối (1–12, Đại học, Cao đẳng, Khác)...',
          '+ Enter custom grade (1–12, University, College, Other)...',
        )}
      </option>
    </select>
  );
}
