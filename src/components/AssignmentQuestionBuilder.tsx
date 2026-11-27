import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardPaste,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Library,
  Minus,
  Plus,
  Search,
  Shuffle,
  Trash2,
  Upload,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type {
  CognitiveLevel,
  GradeLevel,
  Question,
  QuestionType,
  SubjectId,
  UserAccount,
} from '../types/exam';
import {
  convertDraftToQuestion,
  downloadSampleAnswerExcel,
  downloadTextFile,
  extractTextFromUploadedFile,
  finalizeDraftWarnings,
  mergeQuestionsAndAnswers,
  parseAnswerFileContent,
  parseQuestionFileContent,
  type ImportDefaults,
  type ParsedQuestionDraft,
} from '../utils/examFileParser';
import { localizeCognitiveLevel, useLanguage } from '../utils/i18n';
import { OPTION_LETTERS } from '../utils/scoring2025';

const SAMPLE_ASSIGNMENT_QUESTION_TXT = `Câu 1. Cho hàm số y = x³ - 3x + 1. Giá trị cực đại của hàm số đã cho bằng
A. -1
B. 3
C. 1
D. -3

Câu 2. Tích phân ∫(từ 0 đến 2) (2x + 1) dx bằng
A. 4
B. 5
C. 6
D. 8

Câu 3. Trong không gian Oxyz, cho hai điểm A(1; 2; -1) và B(3; -2; 3). Tính độ dài đoạn thẳng AB.`;

interface AssignmentQuestionBuilderProps {
  subject: SubjectId;
  grade: GradeLevel;
  currentUser: UserAccount | null;
  questionBank?: Question[];
  questions: Question[];
  questionCount: number;
  onChange: (nextQuestions: Question[]) => void;
  onQuestionCountChange: (count: number) => void;
  onSuggestTitle?: (suggestedTitle: string) => void;
}

type BuilderPanelMode = 'none' | 'import' | 'manual' | 'bank';

export function AssignmentQuestionBuilder({
  subject,
  grade,
  currentUser,
  questionBank = [],
  questions,
  questionCount,
  onChange,
  onQuestionCountChange,
  onSuggestTitle,
}: AssignmentQuestionBuilderProps) {
  const { language, tx } = useLanguage();
  const [activePanel, setActivePanel] = useState<BuilderPanelMode>('none');
  const [showAnswersInList, setShowAnswersInList] = useState(false);

  // Word / Excel Importer state
  const [wordFileName, setWordFileName] = useState<string | null>(null);
  const [wordText, setWordText] = useState('');
  const [wordPasteMode, setWordPasteMode] = useState(false);
  const [wordDragging, setWordDragging] = useState(false);
  const [wordError, setWordError] = useState<string | null>(null);

  const [excelFileName, setExcelFileName] = useState<string | null>(null);
  const [excelText, setExcelText] = useState('');
  const [excelPasteMode, setExcelPasteMode] = useState(false);
  const [excelDragging, setExcelDragging] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);

  const [importApplyMode, setImportApplyMode] = useState<'append' | 'replace'>('append');
  const [importManualOverrides, setImportManualOverrides] = useState<
    Record<string, Partial<ParsedQuestionDraft>>
  >({});
  const [importRemovedIds, setImportRemovedIds] = useState<Set<string>>(new Set());
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const wordFileInputRef = useRef<HTMLInputElement | null>(null);
  const excelFileInputRef = useRef<HTMLInputElement | null>(null);

  // Manual Question Creator state (Multiple Choice & Short Answer only — no True/False)
  const [manualType, setManualType] = useState<Extract<QuestionType, 'multiple_choice' | 'short_answer'>>(
    'multiple_choice',
  );
  const [manualPrompt, setManualPrompt] = useState('');
  const [manualOptions, setManualOptions] = useState<[string, string, string, string]>([
    '',
    '',
    '',
    '',
  ]);
  const [manualCorrectIdx, setManualCorrectIdx] = useState<0 | 1 | 2 | 3>(0);
  const [manualShortAnswer, setManualShortAnswer] = useState('');
  const [manualExplanation, setManualExplanation] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  // Question Bank picker state
  const [bankSearch, setBankSearch] = useState('');
  const [bankOnlyClassSubject, setBankOnlyClassSubject] = useState(true);

  const formatTypeLabel = (type: QuestionType) => {
    if (type === 'multiple_choice') {
      return tx('Trắc nghiệm', 'Multiple choice');
    }
    return tx('Trả lời ngắn', 'Short answer');
  };

  // Word + Excel parsing (excludes true_false)
  const importDefaults = useMemo<ImportDefaults>(
    () => ({
      subject: subject || 'toan',
      grade,
      defaultLevel: 'hieu' as CognitiveLevel,
      defaultTopic: tx('Bài tập về nhà', 'Homework'),
    }),
    [grade, subject, tx],
  );

  const parsedExcelAnswers = useMemo(
    () => parseAnswerFileContent(excelText, excelFileName ?? ''),
    [excelFileName, excelText],
  );

  const importedDrafts = useMemo(() => {
    if (!wordText.trim()) return [];
    const baseQuestions = parseQuestionFileContent(
      wordText,
      importDefaults,
      wordFileName ?? '',
    );
    const matched = mergeQuestionsAndAnswers(baseQuestions, parsedExcelAnswers);
    return matched
      .filter((d) => d.type !== 'true_false' && !importRemovedIds.has(d.tempId))
      .map((d, idx) => {
        const key = `${d.sourcePart ?? 0}_${d.sourceNumber}_${idx}`;
        const override = importManualOverrides[key] ?? importManualOverrides[d.tempId];
        if (!override) return d;
        return finalizeDraftWarnings({
          ...d,
          ...override,
          answerSource: 'manual',
        });
      });
  }, [
    importDefaults,
    importManualOverrides,
    importRemovedIds,
    parsedExcelAnswers,
    wordFileName,
    wordText,
  ]);

  const importStats = useMemo(() => {
    const total = importedDrafts.length;
    const mc = importedDrafts.filter((d) => d.type === 'multiple_choice').length;
    const sa = importedDrafts.filter((d) => d.type === 'short_answer').length;
    const warningCount = importedDrafts.filter((d) => d.warnings.length > 0).length;
    return {
      total,
      mc,
      sa,
      readyCount: total - warningCount,
      warningCount,
    };
  }, [importedDrafts]);

  const handleWordQuestionUpload = async (file: File) => {
    setWordError(null);
    setImportNotice(null);
    try {
      const content = await extractTextFromUploadedFile(file);
      setWordFileName(file.name);
      setWordText(content);
      setImportManualOverrides({});
      setImportRemovedIds(new Set());
      const cleanName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      if (cleanName) {
        onSuggestTitle?.(cleanName);
      }
    } catch (err) {
      setWordError(
        err instanceof Error
          ? err.message
          : tx('Không thể đọc file câu hỏi Word.', 'Unable to read Word question file.'),
      );
    }
  };

  const handleExcelAnswerUpload = async (file: File) => {
    setExcelError(null);
    setImportNotice(null);
    try {
      const content = await extractTextFromUploadedFile(file);
      setExcelFileName(file.name);
      setExcelText(content);
      setImportManualOverrides({});
    } catch (err) {
      setExcelError(
        err instanceof Error
          ? err.message
          : tx('Không thể đọc file đáp án Excel.', 'Unable to read Excel answer file.'),
      );
    }
  };

  const updateImportedDraftManual = (
    draftKey: string,
    patch: Partial<ParsedQuestionDraft>,
  ) => {
    setImportManualOverrides((prev) => ({
      ...prev,
      [draftKey]: { ...(prev[draftKey] ?? {}), ...patch },
    }));
  };

  const handleApplyImportedToAssignment = () => {
    if (importedDrafts.length === 0) return;
    const converted: Question[] = importedDrafts.map((draft, idx) => ({
      ...convertDraftToQuestion(draft),
      id: `asg_q_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      isPrivate: true,
      ownerTeacherId: currentUser?.id,
      ownerTeacherName: currentUser?.fullName,
    }));

    const shouldReplace = importApplyMode === 'replace' || questions.length === 0;
    const next = shouldReplace ? converted : [...questions, ...converted];
    onChange(next);
    onQuestionCountChange(next.length);
    setImportNotice(
      tx(
        `Đã nạp ${converted.length} câu hỏi vào bài tập. Bạn có thể chỉnh số câu cho học sinh làm bên dưới.`,
        `Added ${converted.length} questions. You can adjust the practice count below.`,
      ),
    );
  };

  const handleCreateManualQuestion = () => {
    if (!manualPrompt.trim()) {
      setManualError(tx('Vui lòng nhập nội dung câu hỏi.', 'Please enter the question prompt.'));
      return;
    }
    if (manualType === 'multiple_choice' && manualOptions.some((o) => !o.trim())) {
      setManualError(
        tx('Vui lòng nhập đủ 4 phương án A, B, C, D.', 'Please fill in all 4 options A, B, C, D.'),
      );
      return;
    }
    if (manualType === 'short_answer' && !manualShortAnswer.trim()) {
      setManualError(
        tx('Vui lòng nhập đáp án trả lời ngắn.', 'Please enter the short answer.'),
      );
      return;
    }

    const created: Question = {
      id: `asg_q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      subject: subject || 'toan',
      grade,
      topic: tx('Bài tập lớp học', 'Class Assignment'),
      level: 'hieu',
      type: manualType,
      prompt: manualPrompt.trim(),
      explanation:
        manualExplanation.trim() ||
        tx(
          'Đáp án được giáo viên soạn trực tiếp cho bài tập.',
          'Answer provided directly by the teacher for this assignment.',
        ),
      isPrivate: true,
      ownerTeacherId: currentUser?.id,
      ownerTeacherName: currentUser?.fullName,
      createdAt: new Date().toISOString(),
    };

    if (manualType === 'multiple_choice') {
      created.options = manualOptions.map((o) => o.trim()) as [string, string, string, string];
      created.correctOptionIndex = manualCorrectIdx;
    } else {
      const normalized = manualShortAnswer.trim();
      created.shortAnswer = normalized;
      created.acceptedAnswers = [
        normalized,
        normalized.replace('.', ','),
        normalized.replace(',', '.'),
      ].filter((v, idx, arr) => arr.indexOf(v) === idx);
    }

    const next = [...questions, created];
    const wasAtMax = questionCount === questions.length || questions.length === 0;
    onChange(next);
    if (wasAtMax) {
      onQuestionCountChange(next.length);
    }
    setManualPrompt('');
    setManualOptions(['', '', '', '']);
    setManualCorrectIdx(0);
    setManualShortAnswer('');
    setManualExplanation('');
    setManualError(null);
  };

  const addedBankIds = useMemo(() => new Set(questions.map((q) => q.id)), [questions]);

  const filteredBank = useMemo(() => {
    const qLower = bankSearch.trim().toLowerCase();
    return questionBank.filter((q) => {
      if (q.type === 'true_false') return false;
      if (bankOnlyClassSubject && subject && q.subject !== subject) return false;
      if (
        qLower &&
        !q.prompt.toLowerCase().includes(qLower) &&
        !q.topic.toLowerCase().includes(qLower)
      ) {
        return false;
      }
      return true;
    });
  }, [bankOnlyClassSubject, bankSearch, questionBank, subject]);

  const moveQuestion = (index: number, delta: -1 | 1) => {
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= questions.length) return;
    const next = [...questions];
    [next[index], next[targetIdx]] = [next[targetIdx], next[index]];
    onChange(next);
  };

  const removeQuestion = (id: string) => {
    const next = questions.filter((q) => q.id !== id);
    onChange(next);
    if (next.length === 0) {
      onQuestionCountChange(0);
    } else if (questionCount > next.length) {
      onQuestionCountChange(next.length);
    }
  };

  const updateSafeCount = (rawValue: number) => {
    if (questions.length === 0) {
      onQuestionCountChange(0);
      return;
    }
    const clamped = Math.max(1, Math.min(questions.length, Math.round(rawValue || 1)));
    onQuestionCountChange(clamped);
  };

  const trimRandomToCount = () => {
    if (questions.length === 0) return;
    const target = Math.max(1, Math.min(questions.length, questionCount));
    if (target >= questions.length) return;
    const copy = [...questions];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    const trimmed = copy.slice(0, target);
    onChange(trimmed);
    onQuestionCountChange(trimmed.length);
  };

  const togglePanel = (panel: Exclude<BuilderPanelMode, 'none'>) => {
    setActivePanel((prev) => (prev === panel ? 'none' : panel));
  };

  const effectiveQuestionCount =
    questions.length === 0
      ? 0
      : Math.max(1, Math.min(questions.length, questionCount || questions.length));

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
      {/* Toolbar Header */}
      <div className="flex flex-col justify-between gap-2.5 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
            {tx(
              'Soạn câu hỏi bài tập (không chia Phần 1, 2, 3 · không có Đúng/Sai)',
              'Build Assignment Questions (unified list · no Parts 1, 2, 3 · no True/False)',
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {tx(
              'Học sinh làm bài trực tiếp từng câu và được chấm điểm ngay, không thấy file gốc giáo viên tải lên.',
              'Students answer these interactive questions directly without seeing your raw uploaded files.',
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => togglePanel('import')}
            className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              activePanel === 'import'
                ? 'border-blue-600 bg-blue-50 text-blue-800 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-200'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Upload className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>{tx('Nhập Word / Excel', 'Import Word / Excel')}</span>
          </button>

          <button
            type="button"
            onClick={() => togglePanel('manual')}
            className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              activePanel === 'manual'
                ? 'border-blue-600 bg-blue-50 text-blue-800 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-200'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Plus className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{tx('Tạo câu hỏi', 'New Question')}</span>
          </button>

          {questionBank.some((q) => q.type !== 'true_false') && (
            <button
              type="button"
              onClick={() => togglePanel('bank')}
              className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                activePanel === 'bank'
                  ? 'border-blue-600 bg-blue-50 text-blue-800 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-200'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Library className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{tx('Chọn từ Ngân hàng', 'From Bank')}</span>
            </button>
          )}
        </div>
      </div>

      {/* PANEL 1: Word / Excel Import (Flat, No Part 1/2/3, No True/False) */}
      {activePanel === 'import' && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/50">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* Word Question Box */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {tx('File Câu hỏi (Word / Text)', 'Questions File (Word / Text)')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    downloadTextFile('mau_cau_hoi_bai_tap.txt', SAMPLE_ASSIGNMENT_QUESTION_TXT)
                  }
                  className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-blue-700 hover:underline dark:text-blue-400"
                >
                  <Download className="h-3 w-3" />
                  <span>{tx('Tải file mẫu', 'Sample')}</span>
                </button>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setWordDragging(true);
                }}
                onDragLeave={() => setWordDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setWordDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) void handleWordQuestionUpload(file);
                }}
                onClick={() => wordFileInputRef.current?.click()}
                className={`mt-2.5 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-3 py-3 text-center transition-colors ${
                  wordDragging
                    ? 'border-blue-600 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/40'
                    : 'border-slate-300 bg-slate-50/60 hover:border-blue-500 dark:border-slate-700 dark:bg-slate-950/60 dark:hover:border-blue-500'
                }`}
              >
                <input
                  ref={wordFileInputRef}
                  type="file"
                  accept=".docx,.txt,.md,.csv,.json,.xlsx,.xls"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleWordQuestionUpload(f);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <Upload className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {wordFileName
                    ? wordFileName
                    : tx('Chọn hoặc kéo thả file .docx / .txt', 'Select or drop .docx / .txt file')}
                </p>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setWordPasteMode((v) => !v)}
                  className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  <ClipboardPaste className="h-3 w-3" />
                  <span>
                    {wordPasteMode
                      ? tx('Ẩn khung dán chữ', 'Hide text input')
                      : tx('Hoặc dán trực tiếp nội dung câu hỏi', 'Or paste question text')}
                  </span>
                </button>
                {wordText.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      setWordFileName(null);
                      setWordText('');
                      setWordError(null);
                      setImportNotice(null);
                    }}
                    className="cursor-pointer text-[11px] font-semibold text-red-600 hover:underline dark:text-red-400"
                  >
                    {tx('Xóa', 'Clear')}
                  </button>
                )}
              </div>

              {wordPasteMode && (
                <textarea
                  rows={4}
                  value={wordText}
                  onChange={(e) => setWordText(e.target.value)}
                  placeholder={tx(
                    'Dán câu hỏi: Câu 1. ... A. ... B. ... C. ... D. ...',
                    'Paste questions: Câu 1. ... A. ... B. ... C. ... D. ...',
                  )}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              )}

              {wordError && (
                <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                  {wordError}
                </p>
              )}
            </div>

            {/* Excel Answer Key Box */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {tx('File Đáp án (Excel — Tùy chọn)', 'Answer Key File (Excel — Optional)')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => downloadSampleAnswerExcel('mau_dap_an_bai_tap.xlsx')}
                  className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  <Download className="h-3 w-3" />
                  <span>{tx('Tải mẫu Excel', 'Excel Sample')}</span>
                </button>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setExcelDragging(true);
                }}
                onDragLeave={() => setExcelDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setExcelDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) void handleExcelAnswerUpload(file);
                }}
                onClick={() => excelFileInputRef.current?.click()}
                className={`mt-2.5 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-3 py-3 text-center transition-colors ${
                  excelDragging
                    ? 'border-emerald-600 bg-emerald-50/70 dark:border-emerald-400 dark:bg-emerald-950/40'
                    : 'border-slate-300 bg-slate-50/60 hover:border-emerald-500 dark:border-slate-700 dark:bg-slate-950/60 dark:hover:border-emerald-500'
                }`}
              >
                <input
                  ref={excelFileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.ods,.csv,.txt,.docx"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleExcelAnswerUpload(f);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <Upload className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {excelFileName
                    ? excelFileName
                    : tx('Chọn hoặc kéo thả file .xlsx / .csv', 'Select or drop .xlsx / .csv file')}
                </p>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setExcelPasteMode((v) => !v)}
                  className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  <ClipboardPaste className="h-3 w-3" />
                  <span>
                    {excelPasteMode
                      ? tx('Ẩn khung dán đáp án', 'Hide answer input')
                      : tx('Hoặc dán nhanh bảng đáp án', 'Or paste answer key')}
                  </span>
                </button>
                {excelText.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      setExcelFileName(null);
                      setExcelText('');
                      setExcelError(null);
                    }}
                    className="cursor-pointer text-[11px] font-semibold text-red-600 hover:underline dark:text-red-400"
                  >
                    {tx('Xóa', 'Clear')}
                  </button>
                )}
              </div>

              {excelPasteMode && (
                <textarea
                  rows={4}
                  value={excelText}
                  onChange={(e) => setExcelText(e.target.value)}
                  placeholder={tx(
                    'VD: Câu 1: B | Lời giải: ... hoặc 1.A 2.C',
                    'e.g. Q1: B | Solution: ... or 1.A 2.C',
                  )}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              )}

              {excelError && (
                <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                  {excelError}
                </p>
              )}
            </div>
          </div>

          {/* Parsed summary & apply bar */}
          {(importedDrafts.length > 0 || wordText.trim().length > 0) && (
            <div className="space-y-2.5 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {tx(
                      `Đọc được ${importStats.total} câu`,
                      `Parsed ${importStats.total} questions`,
                    )}
                  </span>
                  {importStats.mc > 0 && (
                    <span className="text-slate-600 dark:text-slate-400">
                      · {tx('Trắc nghiệm:', 'MC:')} <strong>{importStats.mc}</strong>
                    </span>
                  )}
                  {importStats.sa > 0 && (
                    <span className="text-slate-600 dark:text-slate-400">
                      · {tx('Trả lời ngắn:', 'Short:')} <strong>{importStats.sa}</strong>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>
                      {importStats.readyCount} {tx('đủ đáp án', 'ready')}
                    </span>
                  </span>
                  {importStats.warningCount > 0 && (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>
                        {importStats.warningCount} {tx('thiếu đáp án', 'missing key')}
                      </span>
                    </span>
                  )}
                </div>

                {importedDrafts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowImportPreview((v) => !v)}
                    className="cursor-pointer whitespace-nowrap rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {showImportPreview
                      ? tx('Ẩn xem trước', 'Hide preview')
                      : tx(
                          `Xem & chỉnh đáp án (${importedDrafts.length})`,
                          `Review & edit keys (${importedDrafts.length})`,
                        )}
                  </button>
                )}
              </div>

              {importedDrafts.length === 0 ? (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {tx(
                    'Chưa nhận diện được câu hỏi trắc nghiệm hoặc trả lời ngắn nào. Hãy đảm bảo mỗi câu bắt đầu bằng "Câu 1.", "Câu 2."...',
                    'No multiple-choice or short-answer questions detected. Ensure items start with "Câu 1.", "Câu 2.", etc.',
                  )}
                </p>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                  {questions.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700 dark:text-slate-300">
                      <label className="flex cursor-pointer items-center gap-1.5">
                        <input
                          type="radio"
                          name="asgImportApplyMode"
                          checked={importApplyMode === 'append'}
                          onChange={() => setImportApplyMode('append')}
                          className="h-3.5 w-3.5 text-blue-700"
                        />
                        <span>{tx('Thêm tiếp vào bài tập', 'Append to list')}</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-1.5">
                        <input
                          type="radio"
                          name="asgImportApplyMode"
                          checked={importApplyMode === 'replace'}
                          onChange={() => setImportApplyMode('replace')}
                          className="h-3.5 w-3.5 text-blue-700"
                        />
                        <span>{tx('Thay thế danh sách hiện tại', 'Replace current list')}</span>
                      </label>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {tx(
                        'Sau khi nạp, bạn có thể chỉnh lại số câu muốn cho học sinh làm.',
                        'After loading, you can edit how many questions students will complete.',
                      )}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={handleApplyImportedToAssignment}
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>
                      {tx(
                        `Nạp ${importedDrafts.length} câu vào bài tập`,
                        `Add ${importedDrafts.length} questions`,
                      )}
                    </span>
                  </button>
                </div>
              )}

              {showImportPreview && importedDrafts.length > 0 && (
                <div className="max-h-64 space-y-2 overflow-y-auto border-t border-slate-200 pt-2.5 dark:border-slate-800">
                  {importedDrafts.map((draft, idx) => {
                    const overrideKey = `${draft.sourcePart ?? 0}_${draft.sourceNumber}_${idx}`;
                    return (
                      <div
                        key={draft.tempId}
                        className={`rounded-lg border p-2.5 text-xs ${
                          draft.warnings.length > 0
                            ? 'border-amber-300 bg-amber-50/40 dark:border-amber-800/70 dark:bg-amber-950/20'
                            : 'border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-950/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                {tx('Câu', 'Q')} {idx + 1}
                              </span>
                              <span>·</span>
                              <span className="font-semibold text-blue-700 dark:text-blue-400">
                                {formatTypeLabel(draft.type)}
                              </span>
                              <span>·</span>
                              <span
                                className={
                                  draft.answerSource === 'none'
                                    ? 'font-semibold text-amber-700 dark:text-amber-400'
                                    : 'font-semibold text-emerald-700 dark:text-emerald-400'
                                }
                              >
                                {draft.answerSource === 'none'
                                  ? tx('Chưa có đáp án', 'Missing key')
                                  : tx('Đã có đáp án', 'Key ready')}
                              </span>
                            </div>
                            <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                              {draft.prompt}
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label={tx('Bỏ câu này', 'Remove this item')}
                            onClick={() =>
                              setImportRemovedIds((prev) => new Set(prev).add(draft.tempId))
                            }
                            className="cursor-pointer rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {draft.type === 'multiple_choice' && draft.options && (
                          <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                            {draft.options.map((opt, optIdx) => {
                              const selected = draft.correctOptionIndex === optIdx;
                              return (
                                <button
                                  key={optIdx}
                                  type="button"
                                  onClick={() =>
                                    updateImportedDraftManual(overrideKey, {
                                      correctOptionIndex: optIdx as 0 | 1 | 2 | 3,
                                    })
                                  }
                                  className={`flex cursor-pointer items-start gap-1.5 rounded border px-2 py-1 text-left ${
                                    selected
                                      ? 'border-emerald-600 bg-emerald-50 font-semibold text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-200'
                                      : 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                                  }`}
                                >
                                  <span className="font-mono font-bold">
                                    {OPTION_LETTERS[optIdx]}.
                                  </span>
                                  <span className="min-w-0 flex-1 break-words">
                                    {opt || tx('(Trống)', '(Empty)')}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {draft.type === 'short_answer' && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                              {tx('Đáp án:', 'Answer:')}
                            </span>
                            <input
                              type="text"
                              value={draft.shortAnswer ?? ''}
                              onChange={(e) =>
                                updateImportedDraftManual(overrideKey, {
                                  shortAnswer: e.target.value,
                                })
                              }
                              placeholder={tx('Nhập đáp án...', 'Enter answer...')}
                              className="h-7 w-40 rounded border border-slate-300 bg-white px-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {importNotice && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{importNotice}</span>
            </div>
          )}
        </div>
      )}

      {/* PANEL 2: Manual Flat Question Creation (Multiple Choice & Short Answer only) */}
      {activePanel === 'manual' && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
              {tx('Tạo nhanh câu hỏi mới', 'Create New Question')}
            </span>
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-200/70 p-0.5 dark:bg-slate-800">
              {(
                [
                  { id: 'multiple_choice' as const, label: tx('Trắc nghiệm A-D', 'Multiple choice') },
                  { id: 'short_answer' as const, label: tx('Trả lời ngắn', 'Short answer') },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setManualType(opt.id);
                    setManualError(null);
                  }}
                  className={`cursor-pointer whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    manualType === opt.id
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-50'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <textarea
            rows={2}
            value={manualPrompt}
            onChange={(e) => {
              setManualPrompt(e.target.value);
              if (manualError) setManualError(null);
            }}
            placeholder={tx('Nhập nội dung câu hỏi...', 'Enter question prompt...')}
            className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />

          {manualType === 'multiple_choice' && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {manualOptions.map((opt, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                    manualCorrectIdx === idx
                      ? 'border-emerald-500 bg-emerald-50/70 dark:border-emerald-600 dark:bg-emerald-950/35'
                      : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                  }`}
                >
                  <input
                    type="radio"
                    name="manualAsgCorrectOption"
                    checked={manualCorrectIdx === idx}
                    onChange={() => setManualCorrectIdx(idx as 0 | 1 | 2 | 3)}
                    aria-label={tx(
                      `Đánh dấu ${OPTION_LETTERS[idx]} là đáp án đúng`,
                      `Mark ${OPTION_LETTERS[idx]} as correct`,
                    )}
                    className="h-3.5 w-3.5 text-emerald-600"
                  />
                  <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200">
                    {OPTION_LETTERS[idx]}.
                  </span>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const next = [...manualOptions] as [string, string, string, string];
                      next[idx] = e.target.value;
                      setManualOptions(next);
                      if (manualError) setManualError(null);
                    }}
                    placeholder={tx(
                      `Phương án ${OPTION_LETTERS[idx]}...`,
                      `Option ${OPTION_LETTERS[idx]}...`,
                    )}
                    className="min-w-0 flex-1 bg-transparent text-xs text-slate-900 outline-none dark:text-slate-100"
                  />
                </div>
              ))}
            </div>
          )}

          {manualType === 'short_answer' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {tx('Đáp án đúng:', 'Correct answer:')}
              </span>
              <input
                type="text"
                value={manualShortAnswer}
                onChange={(e) => {
                  setManualShortAnswer(e.target.value);
                  if (manualError) setManualError(null);
                }}
                placeholder={tx('VD: 6 hoặc 2,5 hoặc x=3', 'e.g. 6 or 2.5')}
                className="h-8 w-56 rounded-lg border border-slate-300 bg-white px-2.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          )}

          <input
            type="text"
            value={manualExplanation}
            onChange={(e) => setManualExplanation(e.target.value)}
            placeholder={tx(
              'Lời giải / gợi ý (tùy chọn — hiển thị sau khi học sinh kiểm tra)...',
              'Explanation / hint (optional — shown after checking)...',
            )}
            className="h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />

          {manualError && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400">{manualError}</p>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCreateManualQuestion}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{tx('Thêm vào bài tập', 'Add to assignment')}</span>
            </button>
          </div>
        </div>
      )}

      {/* PANEL 3: Flat Question Bank Picker (Excludes True/False) */}
      {activePanel === 'bank' && questionBank.length > 0 && (
        <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                placeholder={tx('Tìm câu hỏi trong ngân hàng...', 'Search question bank...')}
                className="h-8 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-8 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            {subject && (
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={bankOnlyClassSubject}
                  onChange={(e) => setBankOnlyClassSubject(e.target.checked)}
                  className="h-3.5 w-3.5 rounded text-blue-700"
                />
                <span>{tx('Chỉ môn của lớp', 'Class subject only')}</span>
              </label>
            )}
          </div>

          <div className="max-h-56 divide-y divide-slate-200 overflow-y-auto rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {filteredBank.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                {tx('Không tìm thấy câu hỏi phù hợp.', 'No matching questions found.')}
              </p>
            ) : (
              filteredBank.slice(0, 60).map((q) => {
                const alreadyAdded = addedBankIds.has(q.id);
                return (
                  <div
                    key={q.id}
                    className="flex items-start justify-between gap-2.5 p-2.5 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-blue-700 dark:text-blue-400">
                          {formatTypeLabel(q.type)}
                        </span>{' '}
                        · {q.topic} · {localizeCognitiveLevel(q.level, language)}
                      </p>
                      <p className="mt-0.5 line-clamp-2 font-medium text-slate-900 dark:text-slate-100">
                        {q.prompt}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => {
                        const next = [...questions, q];
                        const wasAtMax = questionCount === questions.length || questions.length === 0;
                        onChange(next);
                        if (wasAtMax) {
                          onQuestionCountChange(next.length);
                        }
                      }}
                      className={`inline-flex cursor-pointer items-center gap-1 whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                        alreadyAdded
                          ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                          : 'border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                      }`}
                    >
                      <Plus className="h-3 w-3" />
                      <span>{alreadyAdded ? tx('Đã chọn', 'Added') : tx('Thêm', 'Add')}</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Selected Unified Flat List + Editable Practice Count */}
      {questions.length > 0 && (
        <div className="space-y-2.5 border-t border-slate-200 pt-3 dark:border-slate-800">
          {/* Editable Question Count Control */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-2 text-xs dark:border-blue-900/60 dark:bg-blue-950/30">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {tx('Số câu muốn cho làm bài:', 'Questions to assign:')}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={tx('Giảm số câu làm bài', 'Decrease assigned count')}
                  disabled={effectiveQuestionCount <= 1}
                  onClick={() => updateSafeCount(effectiveQuestionCount - 1)}
                  className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <input
                  type="number"
                  min={1}
                  max={questions.length}
                  aria-label={tx('Số câu muốn cho làm bài', 'Number of questions to assign')}
                  value={effectiveQuestionCount}
                  onChange={(e) => updateSafeCount(Number(e.target.value))}
                  className="h-7 w-16 rounded border border-slate-300 bg-white px-2 text-center font-mono text-xs font-bold text-slate-900 tabular-nums dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <button
                  type="button"
                  aria-label={tx('Tăng số câu làm bài', 'Increase assigned count')}
                  disabled={effectiveQuestionCount >= questions.length}
                  onClick={() => updateSafeCount(effectiveQuestionCount + 1)}
                  className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <span className="font-mono text-[11px] text-slate-600 tabular-nums dark:text-slate-400">
                / {questions.length} {tx('câu đã nạp', 'loaded')}
              </span>
            </div>

            {effectiveQuestionCount < questions.length && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium text-blue-800 dark:text-blue-300">
                  {tx(
                    `Học sinh làm ngẫu nhiên ${effectiveQuestionCount} câu từ kho ${questions.length} câu`,
                    `Students get ${effectiveQuestionCount} random questions from ${questions.length}`,
                  )}
                </span>
                <button
                  type="button"
                  onClick={trimRandomToCount}
                  className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-blue-300 bg-white px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300"
                >
                  <Shuffle className="h-3 w-3" />
                  <span>
                    {tx(
                      `Cắt danh sách còn ${effectiveQuestionCount} câu`,
                      `Trim list to ${effectiveQuestionCount}`,
                    )}
                  </span>
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800 tabular-nums dark:text-slate-200">
              {tx(
                `Danh sách câu hỏi đã nạp (${questions.length} câu)`,
                `Loaded Assignment Questions (${questions.length})`,
              )}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowAnswersInList((v) => !v)}
                className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                {showAnswersInList ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                <span>
                  {showAnswersInList
                    ? tx('Ẩn đáp án', 'Hide keys')
                    : tx('Xem đáp án', 'Show keys')}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange([]);
                  onQuestionCountChange(0);
                }}
                className="cursor-pointer whitespace-nowrap text-[11px] font-semibold text-red-600 hover:underline dark:text-red-400"
              >
                {tx('Xóa hết câu', 'Clear all')}
              </button>
            </div>
          </div>

          <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950/40">
            {questions.map((q, idx) => (
              <div
                key={q.id}
                className="flex items-start justify-between gap-2.5 p-2.5 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-mono font-bold text-blue-700 tabular-nums dark:text-blue-400">
                      {tx('Câu', 'Q')} {idx + 1}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {formatTypeLabel(q.type)}
                    </span>
                  </div>
                  <p className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                    {q.prompt}
                  </p>

                  {showAnswersInList && (
                    <div className="mt-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                      {q.type === 'multiple_choice' &&
                        q.options &&
                        q.correctOptionIndex !== undefined && (
                          <span>
                            {tx('Đáp án:', 'Key:')}{' '}
                            <strong className="font-mono">
                              {OPTION_LETTERS[q.correctOptionIndex]}
                            </strong>{' '}
                            ({q.options[q.correctOptionIndex]})
                          </span>
                        )}
                      {q.type === 'short_answer' && (
                        <span>
                          {tx('Đáp án:', 'Key:')}{' '}
                          <strong className="font-mono">{q.shortAnswer}</strong>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label={tx(`Đưa câu ${idx + 1} lên`, `Move Q${idx + 1} up`)}
                    disabled={idx === 0}
                    onClick={() => moveQuestion(idx, -1)}
                    className="cursor-pointer rounded border border-slate-200 bg-white p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-35 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    aria-label={tx(`Đưa câu ${idx + 1} xuống`, `Move Q${idx + 1} down`)}
                    disabled={idx === questions.length - 1}
                    onClick={() => moveQuestion(idx, 1)}
                    className="cursor-pointer rounded border border-slate-200 bg-white p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-35 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    aria-label={tx(`Xóa câu ${idx + 1}`, `Remove Q${idx + 1}`)}
                    onClick={() => removeQuestion(q.id)}
                    className="cursor-pointer rounded border border-red-200 bg-white p-1 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
