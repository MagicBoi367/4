import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Download,
  Edit3,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FolderLock,
  Lock,
  LogIn,
  Minus,
  Play,
  Plus,
  Printer,
  Search,
  Share2,
  Shuffle,
  Trash2,
  Upload,
  UserX,
  Wand2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { derivePrivateClassCode } from '../data/studentPortalData';
import { ImportExamFilesModal } from './ImportExamFilesModal';
import { ResourceShareModal } from './ResourceShareModal';
import { TeacherClassContentModal } from './TeacherClassContentModal';
import { WeeklyCalendarSchedule } from './WeeklyCalendarSchedule';
import type {
  ClassAssignment,
  ClassMaterial,
  ClassScheduleSlot,
  CognitiveLevel,
  Exam,
  ExamCategory,
  ExamSubmission,
  GradeLevel as GradeLevelType,
  Question,
  ResourceShareGrant,
  SubjectId,
  TeacherPrivateClass,
  TrueFalseStatement,
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
  SAMPLE_QUESTION_FILE_TXT,
  type ImportDefaults,
  type ParsedQuestionDraft,
} from '../utils/examFileParser';
import {
  areGradesEqual,
  calculateExamMaxRawScore,
  canManageResourceSharing,
  canTeacherEditResource,
  collectAvailableClasses,
  collectAvailableGrades,
  doesExamMatchStudentClass,
  extractGradeFromClassName,
  formatExamClassScope,
  formatGradeLabel,
  formatScoreVi,
  generateClassCode5,
  getGradeDescription,
  getSubjectMeta,
  getTeacherSharePermission,
  isAdminUser,
  isResourceOwner,
  isValidAllowedGrade,
  isValidClassCode5,
  MAX_CLASSES_PER_TEACHER,
  normalizeClassName,
  OPTION_LETTERS,
  parseAllowedGradeInput,
  parseTargetClassesInput,
  roundScore,
  sanitizeClassCodeInput,
} from '../utils/scoring2025';
import {
  localizeCognitiveLevel,
  localizeExamCategory,
  localizeGradeText,
  localizeSubjectName,
  useLanguage,
} from '../utils/i18n';
import { useSubjects } from '../utils/subjectStore';
import { AddSubjectModal } from './AddSubjectModal';
import { GradeInputControl } from './GradeInputControl';
import { SubjectSearchSelect } from './SubjectSearchSelect';

interface ExamManagerProps {
  exams: Exam[];
  questions: Question[];
  submissions: ExamSubmission[];
  currentUser?: UserAccount | null;
  privateClasses?: TeacherPrivateClass[];
  classMaterials?: ClassMaterial[];
  classAssignments?: ClassAssignment[];
  classSchedules?: ClassScheduleSlot[];
  onAddExam: (exam: Exam) => void;
  onUpdateExam: (exam: Exam) => void;
  onDeleteExam: (id: string) => void;
  onAddQuestion?: (question: Question) => void;
  onAddPrivateClass?: (cls: TeacherPrivateClass) => { ok: boolean; error?: string } | void;
  onUpdatePrivateClass?: (cls: TeacherPrivateClass) => void;
  onDeletePrivateClass?: (id: string) => void;
  onAddClassMaterial?: (material: ClassMaterial) => void;
  onDeleteClassMaterial?: (id: string) => void;
  onAddClassAssignment?: (assignment: ClassAssignment) => void;
  onDeleteClassAssignment?: (id: string) => void;
  onAddClassScheduleSlot?: (slot: ClassScheduleSlot) => void;
  onUpdateClassScheduleSlot?: (slot: ClassScheduleSlot) => void;
  onDeleteClassScheduleSlot?: (id: string) => void;
  onImportQuestions?: (incoming: Question[]) => void;
  onPrintExam: (exam: Exam) => void;
  onStartExam: (exam: Exam) => void;
  onViewExamResults?: (examId: string, className?: string) => void;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
}

export function ExamManager({
  exams,
  questions,
  submissions,
  currentUser = null,
  privateClasses = [],
  classMaterials = [],
  classAssignments = [],
  classSchedules = [],
  onAddExam,
  onUpdateExam,
  onDeleteExam,
  onAddQuestion,
  onAddPrivateClass,
  onUpdatePrivateClass,
  onDeletePrivateClass,
  onAddClassMaterial,
  onDeleteClassMaterial,
  onAddClassAssignment,
  onDeleteClassAssignment,
  onAddClassScheduleSlot,
  onUpdateClassScheduleSlot,
  onDeleteClassScheduleSlot,
  onImportQuestions,
  onPrintExam,
  onStartExam,
  onViewExamResults,
  onOpenAuth,
}: ExamManagerProps) {
  useSubjects();
  const { language, tx } = useLanguage();
  const [addSubjectModalOpen, setAddSubjectModalOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderDefaults, setBuilderDefaults] = useState<{
    isPrivate?: boolean;
    privateClassId?: string;
    grade?: GradeLevelType;
  } | null>(null);
  const [importFilesOpen, setImportFilesOpen] = useState(false);
  const [importDefaults, setImportDefaults] = useState<{
    isPrivate?: boolean;
    privateClassId?: string;
  } | null>(null);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState<'all' | GradeLevelType>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<'all' | SubjectId>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');
  const [privateClassFilter, setPrivateClassFilter] = useState<string>('all');
  const [privateClassModalOpen, setPrivateClassModalOpen] = useState(false);
  const [editingPrivateClass, setEditingPrivateClass] =
    useState<TeacherPrivateClass | null>(null);
  const [managingClassContent, setManagingClassContent] =
    useState<TeacherPrivateClass | null>(null);
  const [deletePrivateClassId, setDeletePrivateClassId] = useState<string | null>(null);
  const [confirmStopShareClassId, setConfirmStopShareClassId] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<
    | { kind: 'exam'; item: Exam }
    | { kind: 'class'; item: TeacherPrivateClass }
    | null
  >(null);
  const [search, setSearch] = useState('');
  const [collapsedGrades, setCollapsedGrades] = useState<Record<string, boolean>>({});

  const toggleStatus = (exam: Exam) => {
    const nextStatus: Exam['status'] =
      exam.status === 'active' ? 'closed' : 'active';
    onUpdateExam({ ...exam, status: nextStatus });
  };

  const allAvailableClasses = useMemo(
    () => collectAvailableClasses(exams, submissions),
    [exams, submissions],
  );

  const visibleClassOptions = useMemo(() => {
    if (gradeFilter === 'all') return allAvailableClasses;
    return allAvailableClasses.filter((cls) => extractGradeFromClassName(cls) === gradeFilter);
  }, [allAvailableClasses, gradeFilter]);

  const handleSelectGradeFilter = (nextGrade: 'all' | GradeLevelType) => {
    setGradeFilter(nextGrade);
    if (
      nextGrade !== 'all' &&
      classFilter !== 'all' &&
      classFilter !== 'whole_grade' &&
      extractGradeFromClassName(classFilter) !== nextGrade
    ) {
      setClassFilter('all');
    }
  };

  const privateClassMap = useMemo(
    () => new Map(privateClasses.map((pc) => [pc.id, pc])),
    [privateClasses],
  );

  const editablePrivateClasses = useMemo(
    () => privateClasses.filter((pc) => canTeacherEditResource(pc, currentUser)),
    [privateClasses, currentUser],
  );

  const editableClassIds = useMemo(
    () => new Set(editablePrivateClasses.map((pc) => pc.id)),
    [editablePrivateClasses],
  );

  const ownedPrivateClassesCount = useMemo(
    () => privateClasses.filter((pc) => isResourceOwner(pc, currentUser)).length,
    [privateClasses, currentUser],
  );

  const hasReachedClassLimit =
    !isAdminUser(currentUser) && ownedPrivateClassesCount >= MAX_CLASSES_PER_TEACHER;

  const privateExamsCount = useMemo(
    () => exams.filter((ex) => Boolean(ex.isPrivate)).length,
    [exams],
  );

  const publicExamsCount = useMemo(
    () => exams.filter((ex) => !ex.isPrivate).length,
    [exams],
  );

  const baseWithoutGrade = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exams.filter((ex) => {
      if (visibilityFilter === 'public' && ex.isPrivate) return false;
      if (visibilityFilter === 'private' && !ex.isPrivate) return false;
      if (privateClassFilter !== 'all' && ex.privateClassId !== privateClassFilter) {
        return false;
      }
      if (subjectFilter !== 'all' && ex.subject !== subjectFilter) return false;
      if (classFilter === 'whole_grade') {
        if ((ex.targetClasses ?? []).length > 0) return false;
      } else if (classFilter !== 'all') {
        if (!doesExamMatchStudentClass(ex, classFilter)) return false;
      }
      if (q) {
        const matchClass = (ex.targetClasses ?? []).some((c) => c.toLowerCase().includes(q));
        const privateClassName = ex.privateClassId
          ? (privateClassMap.get(ex.privateClassId)?.name ?? '').toLowerCase()
          : '';
        if (
          !ex.title.toLowerCase().includes(q) &&
          !ex.roomCode.toLowerCase().includes(q) &&
          !matchClass &&
          !privateClassName.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    classFilter,
    exams,
    privateClassFilter,
    privateClassMap,
    search,
    subjectFilter,
    visibilityFilter,
  ]);

  const availableGrades = useMemo(
    () => collectAvailableGrades(baseWithoutGrade, true),
    [baseWithoutGrade],
  );

  const groupedExams = useMemo(() => {
    const levels = gradeFilter === 'all' ? availableGrades : [gradeFilter];
    const getLocalizedGradeDescription = (grade: GradeLevelType) => {
      if (language !== 'en') return getGradeDescription(grade);
      const parsed = parseAllowedGradeInput(grade);
      if (parsed === 'Đại học') return 'University-level assessments, modules & practice exams';
      if (parsed === 'Cao đẳng') return 'College-level assessments, modules & practice exams';
      if (parsed === 'Khác') return 'Other academic level assessments, modules & practice';
      if (parsed === 12) return '2025 High School Graduation Prep & Grade 12 Periodic Exams';
      if (parsed === 11) return 'Midterm, Final & Topic Practice Exams for Grade 11 (2018 Curriculum)';
      if (parsed === 10) return 'Foundational & Regular Assessments for Grade 10 (2018 Curriculum)';
      return `Assessments, assignments & practice for ${localizeGradeText(formatGradeLabel(grade), 'en')}`;
    };
    return levels
      .map((grade) => ({
        grade,
        key: String(grade),
        label: localizeGradeText(formatGradeLabel(grade), language),
        description: getLocalizedGradeDescription(grade),
        items: baseWithoutGrade.filter((ex) => areGradesEqual(ex.grade, grade)),
      }))
      .filter((g) => g.items.length > 0);
  }, [availableGrades, baseWithoutGrade, gradeFilter, language]);

  const hasActiveFilters =
    gradeFilter !== 'all' ||
    classFilter !== 'all' ||
    subjectFilter !== 'all' ||
    visibilityFilter !== 'all' ||
    privateClassFilter !== 'all' ||
    search.trim() !== '';

  const activePrivateClassObj =
    privateClassFilter !== 'all' ? privateClassMap.get(privateClassFilter) ?? null : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end dark:border-slate-800">
        <div>
          <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
            {tx(
              'Sinh mã đề hoán vị & Rút đề theo Ma trận Đặc tả 2025',
              'Permuted Test Codes & 2025 Exam Matrix Generation',
            )}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {tx(
              'Tổ chức kỳ thi & Lớp thi riêng của giáo viên',
              'Exam Management & Teacher Private Classes',
            )}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {tx(
              'Quản lý đề thi theo Khối (12 · 11 · 10), lọc theo lớp học và tạo Lớp thi riêng có đề thi bảo mật chỉ tài khoản giáo viên tạo mới thấy.',
              'Manage exams by grade level (12 · 11 · 10), filter by class, and create private teacher classes with restricted exam visibility.',
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {onImportQuestions && (
            <button
              type="button"
              onClick={() => {
                setImportDefaults(
                  activePrivateClassObj &&
                    canTeacherEditResource(activePrivateClassObj, currentUser)
                    ? { isPrivate: true, privateClassId: activePrivateClassObj.id }
                    : null,
                );
                setImportFilesOpen(true);
              }}
              className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800/70 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950"
            >
              <Upload className="h-4 w-4" />
              <span>{tx('Nhập từ file Đề & Đáp án', 'Import Exam & Answer Files')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setEditingExam(null);
              setBuilderDefaults(
                activePrivateClassObj &&
                  canTeacherEditResource(activePrivateClassObj, currentUser)
                  ? {
                      isPrivate: true,
                      privateClassId: activePrivateClassObj.id,
                      grade: activePrivateClassObj.grade,
                    }
                  : null,
              );
              setBuilderOpen(true);
            }}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
            <span>{tx('Tạo đề thi mới', 'Create New Exam')}</span>
          </button>
        </div>
      </div>

      {/* Teacher Private Classes Section */}
      <section
        aria-label={tx('Lớp thi riêng của giáo viên', 'Teacher Private Classes')}
        className="mt-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <FolderLock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                {tx('Lớp thi riêng của giáo viên', 'Teacher Private Classes')}
              </h2>
              {currentUser && (
                <>
                  <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                    ·
                  </span>
                  <span className="text-xs font-medium text-slate-500 tabular-nums dark:text-slate-400">
                    {currentUser.fullName} · {ownedPrivateClassesCount}/{MAX_CLASSES_PER_TEACHER}{' '}
                    {tx('lớp riêng', 'private classes')} · {privateExamsCount}{' '}
                    {tx('đề riêng tư', 'private exams')}
                  </span>
                </>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {tx(
                `Mọi đề thi thêm vào lớp thi riêng được khóa theo tài khoản giáo viên tạo (tối đa ${MAX_CLASSES_PER_TEACHER} lớp/giáo viên): học sinh và các giáo viên khác sẽ không nhìn thấy nếu chưa được chia sẻ.`,
                `Exams added to a private class are restricted to the creator teacher account (up to ${MAX_CLASSES_PER_TEACHER} classes/teacher): students and other teachers cannot view them unless shared.`,
              )}
            </p>
          </div>

          {currentUser && onAddPrivateClass ? (
            <button
              type="button"
              disabled={hasReachedClassLimit}
              title={
                hasReachedClassLimit
                  ? tx(
                      `Mỗi tài khoản giáo viên chỉ được tạo tối đa ${MAX_CLASSES_PER_TEACHER} lớp học`,
                      `Each teacher account can create up to ${MAX_CLASSES_PER_TEACHER} classes`,
                    )
                  : undefined
              }
              onClick={() => {
                setEditingPrivateClass(null);
                setPrivateClassModalOpen(true);
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 self-start whitespace-nowrap shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 sm:self-auto dark:border-amber-800/80 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-900/50 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-400"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>
                {hasReachedClassLimit
                  ? tx(
                      `Đã đạt giới hạn ${MAX_CLASSES_PER_TEACHER}/${MAX_CLASSES_PER_TEACHER} lớp`,
                      `Limit reached (${MAX_CLASSES_PER_TEACHER}/${MAX_CLASSES_PER_TEACHER} classes)`,
                    )
                  : tx('Tạo lớp thi riêng', 'Create Private Class')}
              </span>
            </button>
          ) : (
            onOpenAuth && (
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="inline-flex cursor-pointer items-center gap-1.5 self-start whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 sm:self-auto dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>{tx('Đăng nhập tài khoản Giáo viên', 'Sign In as Teacher')}</span>
              </button>
            )
          )}
        </div>

        {!currentUser ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
            {language === 'en' ? (
              <>
                You are browsing in Guest mode. Please sign in with a{' '}
                <strong className="text-slate-900 dark:text-slate-100">Teacher</strong> account to
                create private classes and manage private exams.
              </>
            ) : (
              <>
                Bạn đang xem ở chế độ khách. Hãy đăng nhập bằng tài khoản{' '}
                <strong className="text-slate-900 dark:text-slate-100">Giáo viên</strong> để tạo
                lớp thi riêng và thêm đề thi bảo mật theo từng tài khoản giáo viên.
              </>
            )}
          </div>
        ) : privateClasses.length === 0 ? (
          <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-4 sm:flex-row sm:items-center dark:border-slate-700 dark:bg-slate-950/40">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {language === 'en' ? (
                <>
                  Account{' '}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {currentUser.fullName}
                  </strong>{' '}
                  has no private classes yet. Create your first class (e.g., &quot;12A1 - Honors
                  Prep&quot;) to organize private exams.
                </>
              ) : (
                <>
                  Tài khoản{' '}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {currentUser.fullName}
                  </strong>{' '}
                  chưa có lớp thi riêng nào. Hãy tạo lớp đầu tiên (VD: &quot;12A1 - Nhóm Ôn
                  HSG&quot;) để lưu trữ đề thi riêng của bạn.
                </>
              )}
            </p>
            {onAddPrivateClass && (
              <button
                type="button"
                onClick={() => {
                  setEditingPrivateClass(null);
                  setPrivateClassModalOpen(true);
                }}
                className="cursor-pointer whitespace-nowrap shrink-0 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400"
              >
                {tx('+ Tạo lớp đầu tiên', '+ Create First Class')}
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {privateClasses.map((pc) => {
              const linkedCount = exams.filter((ex) => ex.privateClassId === pc.id).length;
              const matCount = classMaterials.filter((m) => m.classId === pc.id).length;
              const assignCount = classAssignments.filter((a) => a.classId === pc.id).length;
              const classCode = derivePrivateClassCode(pc);
              const subjectName = pc.subject
                ? localizeSubjectName(pc.subject, getSubjectMeta(pc.subject).name, language)
                : null;
              const isSelected = privateClassFilter === pc.id;
              const canEditCls = canTeacherEditResource(pc, currentUser);
              const canShareCls = canManageResourceSharing(pc, currentUser);
              const isOwnerOrAdminCls =
                isResourceOwner(pc, currentUser) || isAdminUser(currentUser);
              const sharePermCls = getTeacherSharePermission(pc, currentUser);
              const shareCountCls = pc.sharedWith?.length ?? 0;

              return (
                <div
                  key={pc.id}
                  className={`flex flex-col justify-between rounded-lg border p-4 transition-colors ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50/50 dark:border-amber-600 dark:bg-amber-950/30'
                      : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setPrivateClassFilter('all');
                          } else {
                            setPrivateClassFilter(pc.id);
                            setVisibilityFilter('all');
                          }
                        }}
                        className="min-w-0 flex-1 cursor-pointer text-left"
                      >
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                          <Lock className="h-3 w-3 shrink-0" />
                          <span className="font-mono font-semibold">{classCode}</span>
                          <span aria-hidden="true">·</span>
                          <span>{localizeGradeText(formatGradeLabel(pc.grade), language)}</span>
                          {subjectName && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{subjectName}</span>
                            </>
                          )}
                        </div>
                        <p className="mt-1 truncate font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                          {pc.name}
                        </p>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        {canShareCls && onUpdatePrivateClass && (
                          <button
                            type="button"
                            aria-label={tx(`Chia sẻ lớp ${pc.name}`, `Share class ${pc.name}`)}
                            onClick={() => setShareTarget({ kind: 'class', item: pc })}
                            className="cursor-pointer rounded p-1 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canEditCls && onUpdatePrivateClass && (
                          <button
                            type="button"
                            aria-label={tx(`Sửa lớp ${pc.name}`, `Edit class ${pc.name}`)}
                            onClick={() => {
                              setEditingPrivateClass(pc);
                              setPrivateClassModalOpen(true);
                            }}
                            className="cursor-pointer rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canShareCls && onDeletePrivateClass && (
                          <button
                            type="button"
                            aria-label={tx(`Xóa lớp ${pc.name}`, `Delete class ${pc.name}`)}
                            onClick={() => setDeletePrivateClassId(pc.id)}
                            className="cursor-pointer rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="mt-1.5 text-[11px] font-medium text-slate-500 tabular-nums dark:text-slate-400">
                      {linkedCount} {tx('đề thi', 'exams')} · {matCount}{' '}
                      {tx('tài liệu', 'materials')} · {assignCount}{' '}
                      {tx('bài tập', 'assignments')}
                    </p>

                    <p className="mt-1 flex items-center gap-1 text-[11px] font-medium">
                      {isOwnerOrAdminCls ? (
                        shareCountCls > 0 ? (
                          <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-300">
                            <Share2 className="h-3 w-3" />
                            <span>
                              {tx(
                                `Đã chia sẻ (${shareCountCls} GV)`,
                                `Shared (${shareCountCls} teachers)`,
                              )}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                            <Lock className="h-3 w-3" />
                            <span>{tx('Riêng tư', 'Private')}</span>
                          </span>
                        )
                      ) : sharePermCls ? (
                        <span className="inline-flex items-center gap-1 text-cyan-700 dark:text-cyan-300">
                          <Share2 className="h-3 w-3" />
                          <span>
                            {tx(
                              `Chia sẻ bởi ${pc.ownerTeacherName} (${sharePermCls === 'edit' ? 'Được sửa' : 'Chỉ xem'})`,
                              `Shared by ${pc.ownerTeacherName} (${sharePermCls === 'edit' ? 'Can edit' : 'View only'})`,
                            )}
                          </span>
                        </span>
                      ) : null}
                    </p>

                    {pc.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                        {pc.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-200/80 pt-3 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setPrivateClassFilter('all');
                        } else {
                          setPrivateClassFilter(pc.id);
                          setVisibilityFilter('all');
                        }
                      }}
                      className={`cursor-pointer whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-semibold tabular-nums transition-colors ${
                        isSelected
                          ? 'bg-amber-600 text-white'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      {isSelected
                        ? tx('Đang lọc lớp này', 'Filtering this class')
                        : tx(`Xem đề (${linkedCount})`, `View exams (${linkedCount})`)}
                    </button>

                    <button
                      type="button"
                      onClick={() => setManagingClassContent(pc)}
                      className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950"
                    >
                      <BookOpen className="h-3 w-3" />
                      <span>{tx('Tài liệu · Bài tập · Lịch', 'Materials · Tasks · Schedule')}</span>
                    </button>

                    {canEditCls && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingExam(null);
                          setBuilderDefaults({
                            isPrivate: false,
                            privateClassId: pc.id,
                            grade: pc.grade,
                          });
                          setBuilderOpen(true);
                        }}
                        className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800/70 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
                      >
                        <Plus className="h-3 w-3" />
                        <span>{tx('Thêm đề', 'Add Exam')}</span>
                      </button>
                    )}

                    {canEditCls && onImportQuestions && (
                      <button
                        type="button"
                        onClick={() => {
                          setImportDefaults({
                            isPrivate: true,
                            privateClassId: pc.id,
                          });
                          setImportFilesOpen(true);
                        }}
                        className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Upload className="h-3 w-3" />
                        <span>{tx('Nhập file', 'Import')}</span>
                      </button>
                    )}

                    {canShareCls && shareCountCls > 0 && onUpdatePrivateClass && (
                      confirmStopShareClassId === pc.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onUpdatePrivateClass({ ...pc, sharedWith: [] });
                              setConfirmStopShareClassId(null);
                            }}
                            className="cursor-pointer whitespace-nowrap rounded-md bg-amber-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-700"
                          >
                            {tx('Xác nhận dừng', 'Confirm stop')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmStopShareClassId(null)}
                            className="cursor-pointer whitespace-nowrap rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                          >
                            {tx('Hủy', 'Cancel')}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmStopShareClassId(pc.id)}
                          className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-amber-200 bg-amber-50/70 px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                        >
                          <Lock className="h-3 w-3" />
                          <span>{tx('Dừng chia sẻ', 'Stop sharing')}</span>
                        </button>
                      )
                    )}

                    {!isOwnerOrAdminCls &&
                      sharePermCls &&
                      currentUser &&
                      onUpdatePrivateClass &&
                      (confirmStopShareClassId === pc.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onUpdatePrivateClass({
                                ...pc,
                                sharedWith: (pc.sharedWith ?? []).filter(
                                  (g) => g.teacherId !== currentUser.id,
                                ),
                              });
                              if (privateClassFilter === pc.id) {
                                setPrivateClassFilter('all');
                              }
                              setConfirmStopShareClassId(null);
                            }}
                            className="cursor-pointer whitespace-nowrap rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700"
                          >
                            {tx('Xác nhận dừng', 'Confirm stop')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmStopShareClassId(null)}
                            className="cursor-pointer whitespace-nowrap rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                          >
                            {tx('Hủy', 'Cancel')}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmStopShareClassId(pc.id)}
                          className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          <UserX className="h-3 w-3" />
                          <span>{tx('Dừng chia sẻ', 'Stop sharing')}</span>
                        </button>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Grade, Class, Visibility & Subject Toolbar */}
      <div className="mt-6 space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div
            role="tablist"
            aria-label={tx('Lọc đề thi theo khối', 'Filter exams by grade')}
            className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
          >
            <button
              type="button"
              role="tab"
              aria-selected={gradeFilter === 'all'}
              onClick={() => handleSelectGradeFilter('all')}
              className={`cursor-pointer whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                gradeFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-50'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {tx('Tất cả khối', 'All grades')} ({baseWithoutGrade.length})
            </button>
            {availableGrades.map((grade) => {
              const count = baseWithoutGrade.filter((ex) => areGradesEqual(ex.grade, grade)).length;
              const isSelected = gradeFilter !== 'all' && areGradesEqual(gradeFilter, grade);
              return (
                <button
                  key={String(grade)}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => handleSelectGradeFilter(grade)}
                  className={`cursor-pointer whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                    isSelected
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-50'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {localizeGradeText(formatGradeLabel(grade), language)} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tx(
                  'Tìm tên đề, mã phòng, lớp (12A1)...',
                  'Search exam title, room code, class (12A1)...',
                )}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-8 text-xs text-slate-900 focus:border-blue-700 focus:outline-none sm:w-56 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <select
              aria-label={tx('Lọc bài thi theo lớp', 'Filter exams by class')}
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="all">{tx('Tất cả các lớp', 'All classes')}</option>
              <option value="whole_grade">{tx('Chỉ đề Toàn khối', 'Whole grade only')}</option>
              {visibleClassOptions.map((cls) => (
                <option key={cls} value={cls}>
                  {tx('Lớp', 'Class')} {cls}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1.5">
              <SubjectSearchSelect
                allowAll
                compact
                allLabel={tx('Tất cả môn học', 'All subjects')}
                value={subjectFilter}
                onChange={(val) => setSubjectFilter((val || 'all') as 'all' | SubjectId)}
                ariaLabel={tx('Lọc môn học', 'Filter by subject')}
                currentUser={currentUser}
                onOpenAdvancedAdd={() => setAddSubjectModalOpen(true)}
                className="w-48"
              />
              <button
                type="button"
                title={tx('Thêm môn học khác', 'Add another subject')}
                onClick={() => setAddSubjectModalOpen(true)}
                className="inline-flex h-9 cursor-pointer items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-blue-400 dark:hover:bg-slate-800"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{tx('Môn', 'Subject')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Class Filter Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div
            role="tablist"
            aria-label={tx('Chọn nhanh theo lớp học', 'Quick filter by class')}
            className="flex flex-wrap items-center gap-1.5"
          >
            <span className="mr-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              {tx('Lọc nhanh theo lớp:', 'Quick class filter:')}
            </span>
            <button
              type="button"
              role="tab"
              aria-selected={classFilter === 'all'}
              onClick={() => setClassFilter('all')}
              className={`cursor-pointer whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                classFilter === 'all'
                  ? 'bg-blue-700 text-white dark:bg-blue-600'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {tx('Tất cả', 'All')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={classFilter === 'whole_grade'}
              onClick={() => setClassFilter(classFilter === 'whole_grade' ? 'all' : 'whole_grade')}
              className={`cursor-pointer whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                classFilter === 'whole_grade'
                  ? 'bg-blue-700 text-white dark:bg-blue-600'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {tx('Toàn khối', 'Whole grade')}
            </button>
            {visibleClassOptions.map((cls) => {
              const isSelected = classFilter === cls;
              const matchCount = exams.filter(
                (ex) =>
                  (gradeFilter === 'all' || areGradesEqual(ex.grade, gradeFilter)) &&
                  doesExamMatchStudentClass(ex, cls),
              ).length;
              return (
                <button
                  key={cls}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setClassFilter(isSelected ? 'all' : cls)}
                  className={`cursor-pointer whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 font-mono text-xs font-semibold tabular-nums transition-colors ${
                    isSelected
                      ? 'bg-blue-700 text-white dark:bg-blue-600'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {cls} ({matchCount})
                </button>
              );
            })}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setGradeFilter('all');
                setClassFilter('all');
                setSubjectFilter('all');
                setVisibilityFilter('all');
                setPrivateClassFilter('all');
                setSearch('');
              }}
              className="cursor-pointer whitespace-nowrap shrink-0 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400"
            >
              {tx('Xóa bộ lọc', 'Clear filters')}
            </button>
          )}
        </div>

        {/* Visibility Scope Filter Bar */}
        {currentUser && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <div
              role="tablist"
              aria-label={tx('Lọc theo quyền riêng tư đề thi', 'Filter by exam visibility')}
              className="flex flex-wrap items-center gap-1.5"
            >
              <span className="mr-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                {tx('Phạm vi hiển thị:', 'Visibility scope:')}
              </span>
              <button
                type="button"
                role="tab"
                aria-selected={visibilityFilter === 'all'}
                onClick={() => {
                  setVisibilityFilter('all');
                  setPrivateClassFilter('all');
                }}
                className={`cursor-pointer whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors ${
                  visibilityFilter === 'all' && privateClassFilter === 'all'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {tx('Tất cả', 'All')} ({exams.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={visibilityFilter === 'public'}
                onClick={() => {
                  setVisibilityFilter('public');
                  setPrivateClassFilter('all');
                }}
                className={`cursor-pointer whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors ${
                  visibilityFilter === 'public'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {tx('Đề chung công khai', 'Public exams')} ({publicExamsCount})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={visibilityFilter === 'private'}
                onClick={() => setVisibilityFilter('private')}
                className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors ${
                  visibilityFilter === 'private'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                <Lock className="h-3 w-3" />
                <span>
                  {tx('Đề riêng của tôi', 'My private exams')} ({privateExamsCount})
                </span>
              </button>
            </div>

            {activePrivateClassObj && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                <FolderLock className="h-3.5 w-3.5" />
                <span>
                  {tx('Đang lọc lớp riêng:', 'Filtering private class:')} {activePrivateClassObj.name}
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 space-y-6">
        {groupedExams.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              {tx(
                'Không có đề thi phù hợp bộ lọc khối / lớp / môn học',
                'No exams match the selected grade / class / subject filter',
              )}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {tx(
                'Hãy chọn lớp hoặc khối khác, xóa bộ lọc hoặc nhấn "Tạo đề thi mới" để bổ sung đề.',
                'Select a different class or grade, clear filters, or click "Create New Exam" to add one.',
              )}
            </p>
          </div>
        ) : (
          groupedExams.map((group) => {
            const isCollapsed = gradeFilter === 'all' && Boolean(collapsedGrades[group.key]);
            return (
              <section
                key={group.key}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950/50">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                        {group.label}
                      </h2>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                        ·
                      </span>
                      <span className="font-mono text-xs font-semibold text-blue-700 tabular-nums dark:text-blue-400">
                        {group.items.length} {tx('đề thi', 'exams')}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {group.description}
                    </p>
                  </div>

                  {gradeFilter === 'all' && (
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedGrades((prev) => ({
                          ...prev,
                          [group.key]: !prev[group.key],
                        }))
                      }
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      {isCollapsed ? (
                        <>
                          <ChevronRight className="h-3.5 w-3.5" />
                          <span>{tx(`Mở rộng (${group.items.length})`, `Expand (${group.items.length})`)}</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" />
                          <span>{tx('Thu gọn', 'Collapse')}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {!isCollapsed && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {group.items.map((exam) => {
                      const maxRaw = calculateExamMaxRawScore(exam);
                      const examSubmissions = submissions.filter((s) => s.examId === exam.id);
                      const attempts = examSubmissions.length;
                      const isSpecificClassFilter =
                        classFilter !== 'all' && classFilter !== 'whole_grade';
                      const classAttempts = isSpecificClassFilter
                        ? examSubmissions.filter(
                            (s) =>
                              normalizeClassName(s.studentClass) ===
                              normalizeClassName(classFilter),
                          ).length
                        : 0;
                      const canEditExam = canTeacherEditResource(
                        exam,
                        currentUser,
                        editableClassIds,
                        exam.privateClassId,
                      );
                      const canShareExam = canManageResourceSharing(exam, currentUser);
                      const isOwnerOrAdminExam =
                        isResourceOwner(exam, currentUser) || isAdminUser(currentUser);
                      const sharePermExam = getTeacherSharePermission(exam, currentUser);
                      const shareCountExam = exam.sharedWith?.length ?? 0;

                      return (
                        <article
                          key={exam.id}
                          className="p-6 transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                        >
                          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                                  {exam.roomCode}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {localizeSubjectName(
                                    exam.subject,
                                    getSubjectMeta(exam.subject).name,
                                    language,
                                  )}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{localizeGradeText(formatExamClassScope(exam), language)}</span>
                                {exam.isPrivate && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                                      <Lock className="h-3 w-3 shrink-0" />
                                      <span>
                                        {exam.privateClassId && privateClassMap.get(exam.privateClassId)
                                          ? tx(
                                              `Lớp riêng: ${privateClassMap.get(exam.privateClassId)?.name}`,
                                              `Private class: ${privateClassMap.get(exam.privateClassId)?.name}`,
                                            )
                                          : tx('Riêng tư', 'Private')}
                                      </span>
                                    </span>
                                  </>
                                )}
                                <span aria-hidden="true">·</span>
                                <span>{localizeExamCategory(exam.category, language)}</span>
                                <span aria-hidden="true">·</span>
                                <span
                                  className={`font-semibold ${
                                    exam.status === 'active'
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : 'text-slate-500 dark:text-slate-400'
                                  }`}
                                >
                                  {exam.status === 'active'
                                    ? tx('Đang mở phòng thi', 'Open for testing')
                                    : tx('Đã đóng', 'Closed')}
                                </span>
                                <span aria-hidden="true">·</span>
                                {isOwnerOrAdminExam ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                    {shareCountExam > 0 ? (
                                      <>
                                        <Share2 className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                        <span className="text-blue-700 dark:text-blue-300">
                                          {tx(
                                            `Đã chia sẻ (${shareCountExam} GV)`,
                                            `Shared (${shareCountExam} teachers)`,
                                          )}
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <Lock className="h-3 w-3" />
                                        <span>{tx('Riêng tư', 'Private')}</span>
                                      </>
                                    )}
                                  </span>
                                ) : sharePermExam ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-700 dark:text-cyan-300">
                                    <Share2 className="h-3 w-3" />
                                    <span>
                                      {tx(
                                        `Chia sẻ bởi ${exam.ownerTeacherName ?? 'Giáo viên'} (${sharePermExam === 'edit' ? 'Được sửa' : 'Chỉ xem'})`,
                                        `Shared by ${exam.ownerTeacherName ?? 'Teacher'} (${sharePermExam === 'edit' ? 'Can edit' : 'View only'})`,
                                      )}
                                    </span>
                                  </span>
                                ) : null}
                              </div>

                              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                                {exam.title}
                              </h3>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 tabular-nums dark:text-slate-400">
                                {exam.part1QuestionIds.length > 0 && (
                                  <>
                                    <span>
                                      {tx('Phần I:', 'Part I:')}{' '}
                                      <strong className="text-slate-900 dark:text-slate-100">
                                        {exam.part1QuestionIds.length}
                                      </strong>{' '}
                                      {tx('câu', 'qs')} ({formatScoreVi(exam.part1PointPerQ)}
                                      {tx('đ', ' pts')})
                                    </span>
                                    <span aria-hidden="true">·</span>
                                  </>
                                )}
                                {exam.part2QuestionIds.length > 0 && (
                                  <>
                                    <span>
                                      {tx('Phần II:', 'Part II:')}{' '}
                                      <strong className="text-slate-900 dark:text-slate-100">
                                        {exam.part2QuestionIds.length}
                                      </strong>{' '}
                                      {tx('câu', 'qs')} ({formatScoreVi(exam.part2PointMaxPerQ)}
                                      {tx('đ', ' pts')})
                                    </span>
                                    <span aria-hidden="true">·</span>
                                  </>
                                )}
                                {exam.part3QuestionIds.length > 0 && (
                                  <>
                                    <span>
                                      {tx('Phần III:', 'Part III:')}{' '}
                                      <strong className="text-slate-900 dark:text-slate-100">
                                        {exam.part3QuestionIds.length}
                                      </strong>{' '}
                                      {tx('câu', 'qs')} ({formatScoreVi(exam.part3PointPerQ)}
                                      {tx('đ', ' pts')})
                                    </span>
                                    <span aria-hidden="true">·</span>
                                  </>
                                )}
                                <span>
                                  {tx('Tổng thang:', 'Total scale:')}{' '}
                                  <strong className="text-slate-900 dark:text-slate-100">
                                    {formatScoreVi(maxRaw)} {tx('điểm', 'pts')}
                                  </strong>
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>
                                  {exam.duration ?? exam.durationMinutes} {tx('phút', 'min')}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>
                                  {exam.autoSubmitOnTimeout !== false
                                    ? tx('Tự động thu bài khi hết giờ', 'Auto-submit on timeout')
                                    : tx('Nộp thủ công', 'Manual submit')}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>
                                  {isSpecificClassFilter ? (
                                    <>
                                      <strong className="text-blue-700 dark:text-blue-400">
                                        {tx(
                                          `${classAttempts} bài lớp ${classFilter}`,
                                          `${classAttempts} in class ${classFilter}`,
                                        )}
                                      </strong>{' '}
                                      / {attempts} {tx('lượt thi', 'attempts')}
                                    </>
                                  ) : (
                                    `${attempts} ${tx('lượt thi', 'attempts')}`
                                  )}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {onViewExamResults && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onViewExamResults(
                                      exam.id,
                                      isSpecificClassFilter ? classFilter : undefined,
                                    )
                                  }
                                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800/70 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
                                >
                                  <BarChart3 className="h-3.5 w-3.5" />
                                  <span>
                                    {isSpecificClassFilter
                                      ? tx(`Điểm lớp ${classFilter}`, `Class ${classFilter} Scores`)
                                      : tx('Xem bảng điểm', 'View Scores')}
                                  </span>
                                </button>
                              )}
                              {canShareExam && (
                                <button
                                  type="button"
                                  onClick={() => setShareTarget({ kind: 'exam', item: exam })}
                                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
                                >
                                  <Share2 className="h-3.5 w-3.5" />
                                  <span>{tx('Chia sẻ', 'Share')}</span>
                                </button>
                              )}
                              {canEditExam && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingExam(exam);
                                    setBuilderOpen(true);
                                  }}
                                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                  <span>{tx('Cấu hình & Lớp', 'Config & Class')}</span>
                                </button>
                              )}
                              {canEditExam && (
                                <button
                                  type="button"
                                  onClick={() => toggleStatus(exam)}
                                  className="cursor-pointer whitespace-nowrap rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                  {exam.status === 'active'
                                    ? tx('Đóng phòng', 'Close Room')
                                    : tx('Mở phòng', 'Open Room')}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onPrintExam(exam)}
                                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                <Printer className="h-3.5 w-3.5" />
                                <span>{tx('In đề & Mã đề', 'Print & Variants')}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onStartExam(exam)}
                                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                              >
                                <Play className="h-3.5 w-3.5" />
                                <span>{tx('Vào thi thử', 'Preview Exam')}</span>
                              </button>
                              {canShareExam && (
                                <button
                                  type="button"
                                  aria-label={tx('Xóa đề thi', 'Delete exam')}
                                  onClick={() => setDeleteId(exam.id)}
                                  className="cursor-pointer rounded-lg border border-slate-200 p-2 text-red-600 hover:bg-red-50 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-950/40"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>

      {/* Weekly Calendar Schedule for Teacher's Classes */}
      {currentUser && privateClasses.length > 0 && (
        <section className="mt-8">
          <div className="mb-3">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
              {tx(
                'Lịch học tuần các lớp của bạn (Thứ 2 – Chủ nhật)',
                'Weekly Schedule for Your Classes (Mon – Sun)',
              )}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {tx(
                'Giáo viên có thể thêm, sửa hoặc xóa lịch học trực tiếp trên từng ngày; học sinh đã tham gia lớp sẽ xem lịch ở chế độ chỉ đọc.',
                'Teachers can add, edit, or remove sessions directly by day; joined students view the schedule in read-only mode.',
              )}
            </p>
          </div>
          <WeeklyCalendarSchedule
            slots={classSchedules.filter((s) => privateClasses.some((pc) => pc.id === s.classId))}
            classes={privateClasses}
            canEdit={editablePrivateClasses.length > 0}
            currentUser={currentUser}
            onAddSlot={onAddClassScheduleSlot}
            onUpdateSlot={onUpdateClassScheduleSlot}
            onDeleteSlot={onDeleteClassScheduleSlot}
            emptyNotice={tx(
              "Chưa có lịch học nào cho các lớp của bạn. Nhấn '+ Thêm lịch' ở ngày tương ứng để tạo.",
              "No schedule slots for your classes yet. Click '+ Add Slot' on a day to create one.",
            )}
          />
        </section>
      )}

      {managingClassContent && currentUser && (
        <TeacherClassContentModal
          targetClass={managingClassContent}
          currentUser={currentUser}
          materials={classMaterials.filter((m) => m.classId === managingClassContent.id)}
          assignments={classAssignments.filter((a) => a.classId === managingClassContent.id)}
          schedules={classSchedules.filter((s) => s.classId === managingClassContent.id)}
          onAddMaterial={(mat) => onAddClassMaterial?.(mat)}
          onDeleteMaterial={(id) => onDeleteClassMaterial?.(id)}
          onAddAssignment={(asg) => onAddClassAssignment?.(asg)}
          onDeleteAssignment={(id) => onDeleteClassAssignment?.(id)}
          onAddScheduleSlot={(slot) => onAddClassScheduleSlot?.(slot)}
          onUpdateScheduleSlot={(slot) => onUpdateClassScheduleSlot?.(slot)}
          onDeleteScheduleSlot={(id) => onDeleteClassScheduleSlot?.(id)}
          onClose={() => setManagingClassContent(null)}
        />
      )}

      {importFilesOpen && onImportQuestions && (
        <ImportExamFilesModal
          defaultCreateExam
          currentUser={currentUser}
          privateClasses={editablePrivateClasses}
          defaultPrivate={Boolean(importDefaults?.isPrivate)}
          defaultPrivateClassId={importDefaults?.privateClassId ?? ''}
          onClose={() => {
            setImportFilesOpen(false);
            setImportDefaults(null);
          }}
          onImportQuestions={onImportQuestions}
          onCreateExam={onAddExam}
        />
      )}

      {builderOpen && (
        <ExamBuilderModal
          initialExam={editingExam}
          questions={questions}
          currentUser={currentUser}
          privateClasses={editablePrivateClasses}
          defaultPrivate={builderDefaults?.isPrivate}
          defaultPrivateClassId={builderDefaults?.privateClassId}
          defaultGrade={builderDefaults?.grade}
          onAddQuestion={onAddQuestion}
          onImportQuestions={onImportQuestions}
          onClose={() => {
            setBuilderOpen(false);
            setEditingExam(null);
            setBuilderDefaults(null);
          }}
          onSave={(exam) => {
            if (editingExam) {
              onUpdateExam(exam);
            } else {
              onAddExam(exam);
            }
            setBuilderOpen(false);
            setEditingExam(null);
            setBuilderDefaults(null);
          }}
        />
      )}

      {privateClassModalOpen && currentUser && (onAddPrivateClass || onUpdatePrivateClass) && (
        <PrivateClassModal
          initial={editingPrivateClass}
          currentUser={currentUser}
          teacherClassCount={ownedPrivateClassesCount}
          existingClassCodes={
            new Set(
              privateClasses
                .filter((pc) => pc.id !== editingPrivateClass?.id)
                .map((pc) => derivePrivateClassCode(pc)),
            )
          }
          onClose={() => {
            setPrivateClassModalOpen(false);
            setEditingPrivateClass(null);
          }}
          onSave={(cls) => {
            if (editingPrivateClass) {
              onUpdatePrivateClass?.(cls);
              setPrivateClassModalOpen(false);
              setEditingPrivateClass(null);
              return;
            }
            const res = onAddPrivateClass?.(cls);
            if (res && !res.ok) {
              return res;
            }
            setPrivateClassModalOpen(false);
            setEditingPrivateClass(null);
          }}
        />
      )}

      {deletePrivateClassId && onDeletePrivateClass && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 dark:bg-slate-950/80"
        >
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
              {tx('Xác nhận xóa lớp thi riêng?', 'Confirm deleting private class?')}
            </h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              {tx(
                'Lớp thi riêng sẽ bị xóa khỏi danh sách. Các đề thi bên trong vẫn được giữ ở chế độ riêng tư cá nhân (chỉ tài khoản của bạn mới xem được).',
                'The private class will be removed from the list. Exams inside it remain saved in your personal private mode (only visible to you).',
              )}
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletePrivateClassId(null)}
                className="cursor-pointer rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {tx('Hủy', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeletePrivateClass(deletePrivateClassId);
                  if (privateClassFilter === deletePrivateClassId) {
                    setPrivateClassFilter('all');
                  }
                  setDeletePrivateClassId(null);
                }}
                className="cursor-pointer rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700"
              >
                {tx('Xóa lớp riêng', 'Delete Class')}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 dark:bg-slate-950/80"
        >
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
              {tx('Xác nhận xóa đề thi?', 'Confirm deleting exam?')}
            </h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              {tx(
                'Đề thi sẽ bị xóa khỏi danh sách phòng thi. Lịch sử điểm đã nộp của thí sinh vẫn được giữ nguyên.',
                'The exam will be removed from the exam list. Existing student submission scores will be preserved.',
              )}
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="cursor-pointer rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {tx('Hủy', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteExam(deleteId);
                  setDeleteId(null);
                }}
                className="cursor-pointer rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700"
              >
                {tx('Xóa đề thi', 'Delete Exam')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ResourceShareModal
        open={Boolean(shareTarget)}
        onClose={() => setShareTarget(null)}
        resourceTypeLabel={
          shareTarget?.kind === 'class' ? tx('lớp học', 'class') : tx('đề thi', 'exam')
        }
        resourceTitle={
          shareTarget
            ? shareTarget.kind === 'class'
              ? shareTarget.item.name
              : shareTarget.item.title
            : ''
        }
        ownerTeacherId={shareTarget?.item.ownerTeacherId}
        ownerTeacherName={shareTarget?.item.ownerTeacherName}
        sharedWith={shareTarget?.item.sharedWith}
        currentUser={currentUser}
        onSaveShares={(nextSharedWith: ResourceShareGrant[]) => {
          if (!shareTarget) return;
          if (shareTarget.kind === 'exam') {
            onUpdateExam({
              ...shareTarget.item,
              sharedWith: nextSharedWith,
            });
          } else {
            onUpdatePrivateClass?.({
              ...shareTarget.item,
              sharedWith: nextSharedWith,
            });
          }
        }}
      />

      <AddSubjectModal
        open={addSubjectModalOpen}
        onClose={() => setAddSubjectModalOpen(false)}
        currentUser={currentUser}
        onSubjectAdded={(created) => {
          setSubjectFilter(created.id);
          setAddSubjectModalOpen(false);
        }}
      />
    </div>
  );
}

interface PrivateClassModalProps {
  initial?: TeacherPrivateClass | null;
  currentUser: UserAccount;
  teacherClassCount: number;
  existingClassCodes: ReadonlySet<string>;
  onClose: () => void;
  onSave: (cls: TeacherPrivateClass) => { ok: boolean; error?: string } | void;
}

function PrivateClassModal({
  initial,
  currentUser,
  teacherClassCount,
  existingClassCodes,
  onClose,
  onSave,
}: PrivateClassModalProps) {
  useSubjects();
  const { language, tx } = useLanguage();
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? '');
  const [classCode, setClassCode] = useState(
    () => initial?.classCode ?? generateClassCode5({ excludeCodes: existingClassCodes }),
  );
  const [subject, setSubject] = useState<SubjectId>(initial?.subject ?? '');
  const [grade, setGrade] = useState<GradeLevelType>(initial?.grade ?? 12);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const hasReachedLimit =
    !initial &&
    !isAdminUser(currentUser) &&
    teacherClassCount >= MAX_CLASSES_PER_TEACHER;

  useEffect(() => {
    if (initial) return;
    if (
      name.trim().length >= 2 &&
      subject.trim().length > 0 &&
      isValidAllowedGrade(grade)
    ) {
      setClassCode((prev) =>
        generateClassCode5({
          subject,
          name,
          grade,
          excludeCodes: existingClassCodes,
          previousCode: prev,
        }),
      );
    }
  }, [initial, name, subject, grade, existingClassCodes]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasReachedLimit) {
      setError(
        tx(
          `Mỗi tài khoản giáo viên chỉ được tạo tối đa ${MAX_CLASSES_PER_TEACHER} lớp học.`,
          `Each teacher account can create up to ${MAX_CLASSES_PER_TEACHER} classes.`,
        ),
      );
      return;
    }
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setError(
        tx(
          'Vui lòng nhập tên lớp học (tối thiểu 2 ký tự).',
          'Please enter a class name (at least 2 characters).',
        ),
      );
      return;
    }
    if (!subject.trim()) {
      setError(
        tx(
          'Vui lòng tìm kiếm và chọn môn học cho lớp.',
          'Please search and select a subject for this class.',
        ),
      );
      return;
    }
    const isCodeModified = !initial || classCode !== (initial.classCode ?? '');
    const cleanCode = isCodeModified
      ? sanitizeClassCodeInput(classCode)
      : (initial?.classCode ?? '').trim().toUpperCase();
    if (isCodeModified && !isValidClassCode5(cleanCode)) {
      setError(
        tx(
          'Mã lớp phải gồm đúng 5 ký tự (3 chữ hoa A–Z và 2 số 0–9), VD: 4T9KA.',
          'Class code must be exactly 5 characters (3 uppercase A–Z and 2 digits 0–9), e.g., 4T9KA.',
        ),
      );
      return;
    }
    if (cleanCode && existingClassCodes.has(cleanCode)) {
      setError(
        tx(
          `Mã lớp "${cleanCode}" đã tồn tại. Vui lòng bấm Đổi mã để tạo mã khác.`,
          `Class code "${cleanCode}" already exists. Click Regenerate to create another code.`,
        ),
      );
      return;
    }
    const res = onSave({
      id: initial?.id ?? `pclass_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      classCode: cleanCode || undefined,
      subject,
      grade,
      description: description.trim() || undefined,
      ownerTeacherId: initial?.ownerTeacherId ?? currentUser.id,
      ownerTeacherName: initial?.ownerTeacherName ?? currentUser.fullName,
      sharedWith: initial?.sharedWith,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    });
    if (res && !res.ok) {
      setError(
        res.error ??
          tx(
            `Mỗi tài khoản giáo viên chỉ được tạo tối đa ${MAX_CLASSES_PER_TEACHER} lớp học.`,
            `Each teacher account can create up to ${MAX_CLASSES_PER_TEACHER} classes.`,
          ),
      );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs dark:bg-slate-950/80"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
            {initial
              ? tx('Cấu hình Lớp học của giáo viên', 'Update Teacher Class')
              : tx('Tạo Lớp học mới của giáo viên', 'Create New Teacher Class')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={tx('Đóng hộp thoại lớp học', 'Close class modal')}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200">
            {language === 'en' ? (
              <>
                Class created by <strong>{currentUser.fullName}</strong>. Students can search by
                teacher name or class code to join for exams, materials, assignments, and schedule.
              </>
            ) : (
              <>
                Lớp học do <strong>{currentUser.fullName}</strong> tạo. Học sinh có thể tìm theo tên
                giáo viên hoặc mã lớp để tham gia nhận bài thi, tài liệu, bài tập và lịch học.
              </>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {tx('Tên lớp học', 'Class name')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder={tx('VD: 12A1 - Nhóm Ôn HSG Toán', 'e.g. 12A1 - Math Honors Prep')}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {tx('Mã lớp (3 chữ hoa + 2 số)', 'Class code (3 letters + 2 digits)')}
              </label>
              <div className="mt-1 flex gap-1.5">
                <input
                  type="text"
                  maxLength={5}
                  value={classCode}
                  onChange={(e) => {
                    setClassCode(sanitizeClassCodeInput(e.target.value));
                    if (error) setError(null);
                  }}
                  placeholder={tx('VD: 4T9KA', 'e.g. 4T9KA')}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs font-bold tracking-wider text-slate-900 uppercase dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <button
                  type="button"
                  title={tx(
                    'Tạo mã lớp mới (trộn 3 chữ hoa + 2 số)',
                    'Generate new class code (3 uppercase + 2 digits)',
                  )}
                  onClick={() =>
                    setClassCode((prev) =>
                      generateClassCode5({
                        subject,
                        name,
                        grade,
                        excludeCodes: existingClassCodes,
                        previousCode: prev,
                      }),
                    )
                  }
                  className="cursor-pointer whitespace-nowrap rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {tx('Đổi mã', 'New code')}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {tx('Môn học', 'Subject')}
                </label>
                <button
                  type="button"
                  onClick={() => setAddSubjectOpen(true)}
                  className="cursor-pointer whitespace-nowrap text-[11px] font-semibold text-blue-700 hover:underline dark:text-blue-400"
                >
                  {tx('+ Thêm môn', '+ Add subject')}
                </button>
              </div>
              <SubjectSearchSelect
                value={subject}
                onChange={(val) => {
                  setSubject(val);
                  if (error) setError(null);
                }}
                placeholder={tx('Tìm tên môn...', 'Search subject...')}
                ariaLabel={tx('Tìm kiếm và chọn môn học cho lớp', 'Search and select subject for class')}
                currentUser={currentUser}
                onOpenAdvancedAdd={() => setAddSubjectOpen(true)}
                className="mt-1"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {tx('Khối / Bậc học', 'Grade / Level')}
              </label>
              <GradeInputControl
                value={grade}
                onChange={setGrade}
                ariaLabel={tx(
                  'Chọn hoặc nhập khối từ 1 đến 12, Đại học hoặc Cao đẳng',
                  'Select or enter grade 1–12, University, or College',
                )}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {tx('Ghi chú / Mô tả lớp (tùy chọn)', 'Class notes / description (optional)')}
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tx(
                'VD: Đề luyện tập chuyên đề nâng cao cho nhóm học sinh lớp 12A1',
                'e.g. Advanced topic practice set for class 12A1',
              )}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          {hasReachedLimit && !error && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400">
              {tx(
                `Bạn đã đạt giới hạn tối đa ${MAX_CLASSES_PER_TEACHER}/${MAX_CLASSES_PER_TEACHER} lớp học. Hãy xóa bớt lớp cũ nếu muốn tạo lớp mới.`,
                `You have reached the maximum limit of ${MAX_CLASSES_PER_TEACHER}/${MAX_CLASSES_PER_TEACHER} classes. Remove an existing class to create a new one.`,
              )}
            </p>
          )}

          {error && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex justify-end gap-2.5 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {tx('Hủy', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={hasReachedLimit}
              className="cursor-pointer rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 dark:bg-blue-600 dark:hover:bg-blue-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-400"
            >
              {initial ? tx('Lưu thay đổi', 'Save Changes') : tx('Tạo lớp học', 'Create Class')}
            </button>
          </div>
        </form>
      </div>

      <AddSubjectModal
        open={addSubjectOpen}
        onClose={() => setAddSubjectOpen(false)}
        currentUser={currentUser}
        onSubjectAdded={(created) => {
          setSubject(created.id);
          setAddSubjectOpen(false);
        }}
      />
    </div>
  );
}

interface ExamBuilderModalProps {
  initialExam?: Exam | null;
  questions: Question[];
  currentUser?: UserAccount | null;
  privateClasses?: TeacherPrivateClass[];
  defaultPrivate?: boolean;
  defaultPrivateClassId?: string;
  defaultGrade?: GradeLevelType;
  onAddQuestion?: (question: Question) => void;
  onImportQuestions?: (incoming: Question[]) => void;
  onClose: () => void;
  onSave: (exam: Exam) => void;
}

type BuilderPartKey = 'p1' | 'p2' | 'p3';

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function ExamBuilderModal({
  initialExam,
  questions,
  currentUser = null,
  privateClasses = [],
  defaultPrivate = false,
  defaultPrivateClassId = '',
  defaultGrade,
  onAddQuestion,
  onImportQuestions,
  onClose,
  onSave,
}: ExamBuilderModalProps) {
  useSubjects();
  const { language, tx } = useLanguage();
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);
  const [draftExamId] = useState(() => initialExam?.id ?? `exam_${Date.now()}`);
  const initialSubject: SubjectId = initialExam?.subject ?? '';
  const initialMeta = getSubjectMeta(initialSubject || 'toan');

  const [title, setTitle] = useState(
    () =>
      initialExam?.title ??
      tx('Đề kiểm tra Định kỳ Chuẩn 2025', '2025 Standard Periodic Exam'),
  );
  const [subject, setSubject] = useState<SubjectId>(initialSubject);
  const [grade, setGrade] = useState<GradeLevelType>(
    initialExam?.grade ?? defaultGrade ?? 12,
  );
  const [visibilityMode, setVisibilityMode] = useState<'public' | 'class' | 'private'>(() => {
    if (initialExam) {
      if (initialExam.isPrivate) return 'private';
      if (initialExam.privateClassId) return 'class';
      return 'public';
    }
    if (currentUser && defaultPrivate) return 'private';
    if (currentUser && defaultPrivateClassId) return 'class';
    if (currentUser) return 'private';
    return 'public';
  });
  const [privateClassId, setPrivateClassId] = useState<string>(
    initialExam?.privateClassId ?? defaultPrivateClassId ?? '',
  );
  const [targetClassesText, setTargetClassesText] = useState(
    (initialExam?.targetClasses ?? []).join(', '),
  );
  const [filterPoolByGrade, setFilterPoolByGrade] = useState(false);
  const [category, setCategory] = useState<ExamCategory>(
    initialExam?.category ?? 'giua_ky',
  );
  const [duration, setDuration] = useState(
    initialExam?.duration ?? initialExam?.durationMinutes ?? 45,
  );
  const [autoSubmitOnTimeout, setAutoSubmitOnTimeout] = useState(
    initialExam?.autoSubmitOnTimeout ?? true,
  );
  const [warningMinutes, setWarningMinutes] = useState(
    initialExam?.warningMinutes ?? 5,
  );
  const [roomCode, setRoomCode] = useState(
    initialExam?.roomCode ?? `KT${Math.floor(1000 + Math.random() * 9000)}`,
  );

  const [p1Point, setP1Point] = useState(initialExam?.part1PointPerQ ?? 0.25);
  const [p2Point, setP2Point] = useState(initialExam?.part2PointMaxPerQ ?? 1.0);
  const [p3Point, setP3Point] = useState(
    initialExam?.part3PointPerQ ?? initialMeta.defaultPart3Point,
  );

  const [selectedP1, setSelectedP1] = useState<string[]>(
    initialExam?.part1QuestionIds ?? [],
  );
  const [selectedP2, setSelectedP2] = useState<string[]>(
    initialExam?.part2QuestionIds ?? [],
  );
  const [selectedP3, setSelectedP3] = useState<string[]>(
    initialExam?.part3QuestionIds ?? [],
  );

  // Part enablement toggles (Part II & III are strictly optional)
  const [includePart1, setIncludePart1] = useState<boolean>(
    initialExam ? initialExam.part1QuestionIds.length > 0 : true,
  );
  const [includePart2, setIncludePart2] = useState<boolean>(
    initialExam ? initialExam.part2QuestionIds.length > 0 : initialMeta.defaultPart2Count > 0,
  );
  const [includePart3, setIncludePart3] = useState<boolean>(
    initialExam ? initialExam.part3QuestionIds.length > 0 : initialMeta.defaultPart3Count > 0,
  );

  // Configurable target question count per part
  const [targetP1Count, setTargetP1Count] = useState<number>(
    initialExam ? initialExam.part1QuestionIds.length : initialMeta.defaultPart1Count,
  );
  const [targetP2Count, setTargetP2Count] = useState<number>(
    initialExam ? initialExam.part2QuestionIds.length : initialMeta.defaultPart2Count,
  );
  const [targetP3Count, setTargetP3Count] = useState<number>(
    initialExam ? initialExam.part3QuestionIds.length : initialMeta.defaultPart3Count,
  );

  // Two-pane question selector state
  const [activePartTab, setActivePartTab] = useState<BuilderPartKey>('p1');
  const [poolSearch, setPoolSearch] = useState('');
  const [poolLevelFilter, setPoolLevelFilter] = useState<'all' | CognitiveLevel>('all');
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  const [shuffleQuestions, setShuffleQuestions] = useState(
    initialExam?.shuffleQuestions ?? true,
  );
  const [shuffleOptions, setShuffleOptions] = useState(
    initialExam?.shuffleOptions ?? true,
  );
  const [strictProctoring, setStrictProctoring] = useState(
    initialExam?.strictProctoring ?? true,
  );
  const [showSolutionsAfterSubmit, setShowSolutionsAfterSubmit] = useState(
    initialExam?.showSolutionsAfterSubmit ?? true,
  );
  const [error, setError] = useState<string | null>(null);

  // Inline Word (questions) + Excel (answers) importer inside ExamBuilderModal
  const [fileImportOpen, setFileImportOpen] = useState<boolean>(!initialExam);
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

  const [importDefaultLevel, setImportDefaultLevel] = useState<CognitiveLevel>('hieu');
  const [importDefaultTopic, setImportDefaultTopic] = useState(() =>
    tx('Tổng hợp', 'General'),
  );
  const [importApplyMode, setImportApplyMode] = useState<'append' | 'replace'>('append');
  const [importManualOverrides, setImportManualOverrides] = useState<
    Record<string, Partial<ParsedQuestionDraft>>
  >({});
  const [importRemovedIds, setImportRemovedIds] = useState<Set<string>>(new Set());
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importSuccessNotice, setImportSuccessNotice] = useState<string | null>(null);

  const wordFileInputRef = useRef<HTMLInputElement | null>(null);
  const excelFileInputRef = useRef<HTMLInputElement | null>(null);

  const importDefaults = useMemo<ImportDefaults>(
    () => ({
      subject,
      grade,
      defaultLevel: importDefaultLevel,
      defaultTopic: importDefaultTopic.trim() || tx('Tổng hợp', 'General'),
    }),
    [grade, importDefaultLevel, importDefaultTopic, language, subject],
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
      .filter((d) => !importRemovedIds.has(d.tempId))
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
    const p1 = importedDrafts.filter((d) => d.type === 'multiple_choice').length;
    const p2 = importedDrafts.filter((d) => d.type === 'true_false').length;
    const p3 = importedDrafts.filter((d) => d.type === 'short_answer').length;
    const warningCount = importedDrafts.filter((d) => d.warnings.length > 0).length;
    const fromAnswerFile = importedDrafts.filter(
      (d) => d.answerSource === 'answer_file',
    ).length;
    return {
      total,
      p1,
      p2,
      p3,
      readyCount: total - warningCount,
      warningCount,
      fromAnswerFile,
    };
  }, [importedDrafts]);

  const handleWordQuestionUpload = async (file: File) => {
    setWordError(null);
    setImportSuccessNotice(null);
    try {
      const content = await extractTextFromUploadedFile(file);
      setWordFileName(file.name);
      setWordText(content);
      setImportManualOverrides({});
      setImportRemovedIds(new Set());
      const cleanName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      if (
        cleanName &&
        !initialExam &&
        (title.trim() === 'Đề kiểm tra Định kỳ Chuẩn 2025' ||
          title.trim() === '2025 Standard Periodic Exam')
      ) {
        setTitle(cleanName);
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
    setImportSuccessNotice(null);
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

  const handleApplyImportedFilesToExam = () => {
    if (importedDrafts.length === 0) return;

    const cleanFileTitle = wordFileName
      ? wordFileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
      : '';
    const resolvedExamTitle =
      title.trim() ||
      cleanFileTitle ||
      tx('Đề kiểm tra Định kỳ Chuẩn 2025', '2025 Standard Periodic Exam');

    const converted = importedDrafts.map((draft) => ({
      ...convertDraftToQuestion(draft),
      isPrivate: true,
      ownerTeacherId: currentUser?.id,
      ownerTeacherName: currentUser?.fullName,
      sourceExamId: draftExamId,
      sourceExamTitle: resolvedExamTitle,
    }));
    onImportQuestions?.(converted);

    const newP1Ids = converted
      .filter((q) => q.type === 'multiple_choice')
      .map((q) => q.id);
    const newP2Ids = converted
      .filter((q) => q.type === 'true_false')
      .map((q) => q.id);
    const newP3Ids = converted
      .filter((q) => q.type === 'short_answer')
      .map((q) => q.id);

    const shouldReplace =
      importApplyMode === 'replace' ||
      (selectedP1.length === 0 && selectedP2.length === 0 && selectedP3.length === 0);

    const mergeUnique = (base: string[], incoming: string[]) => {
      const seen = new Set(base);
      return [...base, ...incoming.filter((id) => !seen.has(id))];
    };

    const nextP1 = shouldReplace ? newP1Ids : mergeUnique(selectedP1, newP1Ids);
    const nextP2 = shouldReplace ? newP2Ids : mergeUnique(selectedP2, newP2Ids);
    const nextP3 = shouldReplace ? newP3Ids : mergeUnique(selectedP3, newP3Ids);

    setSelectedP1(nextP1);
    setSelectedP2(nextP2);
    setSelectedP3(nextP3);

    setIncludePart1(nextP1.length > 0);
    setIncludePart2(nextP2.length > 0);
    setIncludePart3(nextP3.length > 0);

    setTargetP1Count(nextP1.length);
    setTargetP2Count(nextP2.length);
    setTargetP3Count(nextP3.length);

    if (newP1Ids.length > 0) {
      setActivePartTab('p1');
    } else if (newP2Ids.length > 0) {
      setActivePartTab('p2');
    } else if (newP3Ids.length > 0) {
      setActivePartTab('p3');
    }

    setError(null);
    const summaryParts = [
      newP1Ids.length > 0 ? `${tx('Phần I', 'Part I')}: ${newP1Ids.length}` : null,
      newP2Ids.length > 0 ? `${tx('Phần II', 'Part II')}: ${newP2Ids.length}` : null,
      newP3Ids.length > 0 ? `${tx('Phần III', 'Part III')}: ${newP3Ids.length}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    setImportSuccessNotice(
      tx(
        `Đã nạp ${converted.length} câu hỏi (${summaryParts}) vào đề thi${onImportQuestions ? ' và lưu vào Ngân hàng câu hỏi' : ''}.`,
        `Added ${converted.length} questions (${summaryParts}) to the exam${onImportQuestions ? ' and saved to the Question Bank' : ''}.`,
      ),
    );
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  const questionById = useMemo(
    () => new Map(questions.map((q) => [q.id, q])),
    [questions],
  );

  const subjectQuestions = useMemo(
    () =>
      questions.filter(
        (q) => q.subject === subject && (!filterPoolByGrade || areGradesEqual(q.grade, grade)),
      ),
    [filterPoolByGrade, grade, questions, subject],
  );

  const p1Pool = useMemo(
    () => subjectQuestions.filter((q) => q.type === 'multiple_choice'),
    [subjectQuestions],
  );
  const p2Pool = useMemo(
    () => subjectQuestions.filter((q) => q.type === 'true_false'),
    [subjectQuestions],
  );
  const p3Pool = useMemo(
    () => subjectQuestions.filter((q) => q.type === 'short_answer'),
    [subjectQuestions],
  );

  const effectiveP1 = includePart1 ? selectedP1 : [];
  const effectiveP2 = includePart2 ? selectedP2 : [];
  const effectiveP3 = includePart3 ? selectedP3 : [];

  const totalSelectedCount = effectiveP1.length + effectiveP2.length + effectiveP3.length;
  const totalRawPoints = roundScore(
    effectiveP1.length * p1Point +
      effectiveP2.length * p2Point +
      effectiveP3.length * p3Point,
  );

  const adjustSelectionToCount = (
    pool: Question[],
    current: string[],
    desiredCount: number,
  ): string[] => {
    const safeTarget = Math.max(0, Math.min(pool.length, Math.round(desiredCount || 0)));
    if (safeTarget === 0) return [];
    const poolIds = new Set(pool.map((q) => q.id));
    const validCurrent = current.filter((id) => poolIds.has(id));
    if (validCurrent.length >= safeTarget) {
      return validCurrent.slice(0, safeTarget);
    }
    const chosenSet = new Set(validCurrent);
    const remaining = shuffleArray(pool.filter((q) => !chosenSet.has(q.id)));
    const needed = safeTarget - validCurrent.length;
    return [...validCurrent, ...remaining.slice(0, needed).map((q) => q.id)];
  };

  const handleApplyCounts = () => {
    const nextP1 = includePart1
      ? adjustSelectionToCount(p1Pool, selectedP1, targetP1Count)
      : [];
    const nextP2 = includePart2
      ? adjustSelectionToCount(p2Pool, selectedP2, targetP2Count)
      : [];
    const nextP3 = includePart3
      ? adjustSelectionToCount(p3Pool, selectedP3, targetP3Count)
      : [];
    setSelectedP1(nextP1);
    setSelectedP2(nextP2);
    setSelectedP3(nextP3);
    setTargetP1Count(nextP1.length);
    setTargetP2Count(nextP2.length);
    setTargetP3Count(nextP3.length);
    setError(null);
  };

  const applySinglePartCount = (part: BuilderPartKey, desired: number) => {
    if (part === 'p1') {
      const next = adjustSelectionToCount(p1Pool, selectedP1, desired);
      setIncludePart1(next.length > 0);
      setSelectedP1(next);
      setTargetP1Count(next.length);
    } else if (part === 'p2') {
      const next = adjustSelectionToCount(p2Pool, selectedP2, desired);
      setIncludePart2(next.length > 0);
      setSelectedP2(next);
      setTargetP2Count(next.length);
    } else {
      const next = adjustSelectionToCount(p3Pool, selectedP3, desired);
      setIncludePart3(next.length > 0);
      setSelectedP3(next);
      setTargetP3Count(next.length);
    }
    setError(null);
  };

  const autoPickByMatrix = () => {
    const meta = getSubjectMeta(subject);
    const wantP1 = Math.min(meta.defaultPart1Count || 12, p1Pool.length);
    const wantP2 = Math.min(meta.defaultPart2Count, p2Pool.length);
    const wantP3 = Math.min(meta.defaultPart3Count, p3Pool.length);

    const pickedP1 = shuffleArray(p1Pool)
      .slice(0, wantP1)
      .map((q) => q.id);
    const pickedP2 = shuffleArray(p2Pool)
      .slice(0, wantP2)
      .map((q) => q.id);
    const pickedP3 = shuffleArray(p3Pool)
      .slice(0, wantP3)
      .map((q) => q.id);

    setIncludePart1(pickedP1.length > 0);
    setIncludePart2(pickedP2.length > 0);
    setIncludePart3(pickedP3.length > 0);
    setSelectedP1(pickedP1);
    setSelectedP2(pickedP2);
    setSelectedP3(pickedP3);
    setTargetP1Count(pickedP1.length);
    setTargetP2Count(pickedP2.length);
    setTargetP3Count(pickedP3.length);

    if (pickedP1.length === 6 && pickedP2.length === 4 && pickedP3.length === 3) {
      setP1Point(0.5);
      setP2Point(1.0);
      setP3Point(1.0);
    } else {
      setP1Point(0.25);
      setP2Point(1.0);
      setP3Point(meta.defaultPart3Point);
    }
    setError(null);
  };

  const applyPresetOnlyMc = () => {
    const count = Math.min(
      Math.max(1, targetP1Count > 0 ? targetP1Count : Math.min(20, p1Pool.length)),
      p1Pool.length,
    );
    const pickedP1 = adjustSelectionToCount(p1Pool, selectedP1, count);
    setIncludePart1(true);
    setIncludePart2(false);
    setIncludePart3(false);
    setSelectedP1(pickedP1);
    setSelectedP2([]);
    setSelectedP3([]);
    setTargetP1Count(pickedP1.length);
    setTargetP2Count(0);
    setTargetP3Count(0);
    if (pickedP1.length > 0) {
      setP1Point(roundScore(10 / pickedP1.length));
    }
    setActivePartTab('p1');
    setError(null);
  };

  const applyPresetP1AndP3 = () => {
    const wantP1 = Math.min(targetP1Count > 0 ? targetP1Count : 12, p1Pool.length);
    const wantP3 = Math.min(targetP3Count > 0 ? targetP3Count : 6, p3Pool.length);
    const pickedP1 = adjustSelectionToCount(p1Pool, selectedP1, wantP1);
    const pickedP3 = adjustSelectionToCount(p3Pool, selectedP3, wantP3);
    setIncludePart1(pickedP1.length > 0);
    setIncludePart2(false);
    setIncludePart3(pickedP3.length > 0);
    setSelectedP1(pickedP1);
    setSelectedP2([]);
    setSelectedP3(pickedP3);
    setTargetP1Count(pickedP1.length);
    setTargetP2Count(0);
    setTargetP3Count(pickedP3.length);
    setError(null);
  };

  const balancePointsToTen = () => {
    const c1 = effectiveP1.length;
    const c2 = effectiveP2.length;
    const c3 = effectiveP3.length;
    if (c1 + c2 + c3 === 0) return;

    if (c1 > 0 && c2 === 0 && c3 === 0) {
      setP1Point(roundScore(10 / c1));
      return;
    }
    if (c2 > 0 && c1 === 0 && c3 === 0) {
      setP2Point(roundScore(10 / c2));
      return;
    }
    if (c3 > 0 && c1 === 0 && c2 === 0) {
      setP3Point(roundScore(10 / c3));
      return;
    }
    const currentTotal = c1 * p1Point + c2 * p2Point + c3 * p3Point;
    if (currentTotal <= 0) {
      const equalPerQ = roundScore(10 / (c1 + c2 + c3));
      if (c1 > 0) setP1Point(equalPerQ);
      if (c2 > 0) setP2Point(equalPerQ);
      if (c3 > 0) setP3Point(equalPerQ);
      return;
    }
    const scale = 10 / currentTotal;
    if (c1 > 0) setP1Point(Math.max(0.05, roundScore(p1Point * scale)));
    if (c2 > 0) setP2Point(Math.max(0.05, roundScore(p2Point * scale)));
    if (c3 > 0) setP3Point(Math.max(0.05, roundScore(p3Point * scale)));
  };

  const getPartState = (part: BuilderPartKey) => {
    if (part === 'p1') {
      return {
        label: tx('Phần I · Nhiều lựa chọn (A/B/C/D)', 'Part I · Multiple Choice (A/B/C/D)'),
        shortLabel: tx('Phần I', 'Part I'),
        enabled: includePart1,
        setEnabled: (next: boolean) => {
          setIncludePart1(next);
          if (!next) {
            setSelectedP1([]);
            setTargetP1Count(0);
          } else if (targetP1Count === 0) {
            setTargetP1Count(Math.min(12, p1Pool.length));
          }
        },
        pool: p1Pool,
        selected: selectedP1,
        setSelected: setSelectedP1,
        targetCount: targetP1Count,
        setTargetCount: setTargetP1Count,
        optional: false,
      };
    }
    if (part === 'p2') {
      return {
        label: tx('Phần II · Trắc nghiệm Đúng / Sai (4 ý)', 'Part II · True / False (4 items)'),
        shortLabel: tx('Phần II', 'Part II'),
        enabled: includePart2,
        setEnabled: (next: boolean) => {
          setIncludePart2(next);
          if (!next) {
            setSelectedP2([]);
            setTargetP2Count(0);
          } else if (targetP2Count === 0) {
            setTargetP2Count(Math.min(4, p2Pool.length));
          }
        },
        pool: p2Pool,
        selected: selectedP2,
        setSelected: setSelectedP2,
        targetCount: targetP2Count,
        setTargetCount: setTargetP2Count,
        optional: true,
      };
    }
    return {
      label: tx('Phần III · Trả lời ngắn', 'Part III · Short Answer'),
      shortLabel: tx('Phần III', 'Part III'),
      enabled: includePart3,
      setEnabled: (next: boolean) => {
        setIncludePart3(next);
        if (!next) {
          setSelectedP3([]);
          setTargetP3Count(0);
        } else if (targetP3Count === 0) {
          setTargetP3Count(Math.min(6, p3Pool.length));
        }
      },
      pool: p3Pool,
      selected: selectedP3,
      setSelected: setSelectedP3,
      targetCount: targetP3Count,
      setTargetCount: setTargetP3Count,
      optional: true,
    };
  };

  const activeState = getPartState(activePartTab);
  const selectedSetForActive = useMemo(
    () => new Set(activeState.selected),
    [activeState.selected],
  );

  const filteredUnselectedPool = useMemo(() => {
    const qLower = poolSearch.trim().toLowerCase();
    return activeState.pool.filter((q) => {
      if (selectedSetForActive.has(q.id)) return false;
      if (poolLevelFilter !== 'all' && q.level !== poolLevelFilter) return false;
      if (
        qLower &&
        !q.prompt.toLowerCase().includes(qLower) &&
        !q.topic.toLowerCase().includes(qLower)
      ) {
        return false;
      }
      return true;
    });
  }, [activeState.pool, poolLevelFilter, poolSearch, selectedSetForActive]);

  const selectedQuestionsForActive = useMemo(
    () =>
      activeState.selected
        .map((id) => questionById.get(id))
        .filter((q): q is Question => Boolean(q)),
    [activeState.selected, questionById],
  );

  const addQuestionIdToPart = (part: BuilderPartKey, id: string) => {
    const st = getPartState(part);
    if (st.selected.includes(id)) return;
    const next = [...st.selected, id];
    st.setEnabled(true);
    st.setSelected(next);
    st.setTargetCount(next.length);
    setError(null);
  };

  const addManyQuestionIdsToPart = (part: BuilderPartKey, ids: string[]) => {
    if (ids.length === 0) return;
    const st = getPartState(part);
    const existing = new Set(st.selected);
    const fresh = ids.filter((id) => !existing.has(id));
    if (fresh.length === 0) return;
    const next = [...st.selected, ...fresh];
    st.setEnabled(true);
    st.setSelected(next);
    st.setTargetCount(next.length);
    setError(null);
  };

  const removeQuestionIdFromPart = (part: BuilderPartKey, id: string) => {
    const st = getPartState(part);
    const next = st.selected.filter((x) => x !== id);
    st.setSelected(next);
    st.setTargetCount(next.length);
  };

  const moveQuestionInPart = (part: BuilderPartKey, index: number, delta: -1 | 1) => {
    const st = getPartState(part);
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= st.selected.length) return;
    const next = [...st.selected];
    [next[index], next[targetIdx]] = [next[targetIdx], next[index]];
    st.setSelected(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !roomCode.trim()) {
      setError(
        tx('Vui lòng nhập Tên kỳ thi và Mã phòng thi.', 'Please enter the Exam Title and Room Code.'),
      );
      return;
    }
    if (!subject.trim()) {
      setError(
        tx(
          'Vui lòng tìm kiếm và chọn Môn học cho đề thi.',
          'Please search and select a Subject for this exam.',
        ),
      );
      return;
    }
    if (effectiveP1.length + effectiveP2.length + effectiveP3.length === 0) {
      setError(
        tx(
          'Vui lòng thêm ít nhất 1 câu hỏi (VD: ở Phần I) hoặc bấm "Rút theo cấu hình" / "Chỉ Phần I".',
          'Please add at least 1 question (e.g. in Part I) or click "Apply Counts" / "Part I Only".',
        ),
      );
      return;
    }

    const safeDuration = Math.max(1, Math.min(240, Math.round(duration || 1)));
    const safeWarning = Math.max(1, Math.min(safeDuration, Math.round(warningMinutes || 1)));
    const parsedClasses = parseTargetClassesInput(targetClassesText);
    const usePrivate = Boolean(currentUser && visibilityMode === 'private');
    const useClass = Boolean(currentUser && visibilityMode === 'class' && privateClassId);
    const ownerId = initialExam?.ownerTeacherId ?? currentUser?.id;
    const ownerName = initialExam?.ownerTeacherName ?? currentUser?.fullName;
    const effectivePrivateClassId =
      useClass || (usePrivate && privateClassId) ? privateClassId : undefined;

    onSave({
      id: draftExamId,
      roomCode: roomCode.trim().toUpperCase(),
      title: title.trim(),
      subject,
      grade,
      targetClasses: parsedClasses.length > 0 ? parsedClasses : undefined,
      isPrivate: usePrivate || undefined,
      ownerTeacherId: ownerId,
      ownerTeacherName: ownerName,
      sharedWith: initialExam?.sharedWith,
      privateClassId: effectivePrivateClassId,
      category,
      duration: safeDuration,
      durationMinutes: safeDuration,
      autoSubmitOnTimeout,
      warningMinutes: safeWarning,
      status: initialExam?.status ?? 'active',
      part1QuestionIds: effectiveP1,
      part2QuestionIds: effectiveP2,
      part3QuestionIds: effectiveP3,
      part1PointPerQ: p1Point,
      part2PointMaxPerQ: p2Point,
      part3PointPerQ: p3Point,
      shuffleQuestions,
      shuffleOptions,
      strictProctoring,
      showSolutionsAfterSubmit,
      createdBy:
        initialExam?.createdBy ??
        currentUser?.fullName ??
        tx('Giáo viên Bộ môn', 'Subject Teacher'),
      createdAt: initialExam?.createdAt ?? new Date().toISOString(),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs dark:bg-slate-950/80"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[93vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              {initialExam
                ? tx(
                    'Cấu hình Đề thi, Số lượng câu & Chọn câu hỏi',
                    'Configure Exam, Question Counts & Selection',
                  )
                : tx('Tạo & Cấu hình Đề thi mới', 'Create & Configure New Exam')}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {tx(
                'Tùy chỉnh số lượng câu theo từng phần, thêm hoặc xóa từng câu hỏi (không bắt buộc có Phần II Đúng/Sai).',
                'Customize question counts per part and add or remove individual questions (Part II True/False is optional).',
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tx('Đóng trình cấu hình đề thi', 'Close exam builder')}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {/* Basic Metadata & Timing */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {tx('Tên kỳ thi / Đề kiểm tra', 'Exam / Test Title')}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {tx('Môn học', 'Subject')}
                </label>
                <button
                  type="button"
                  onClick={() => setAddSubjectOpen(true)}
                  className="cursor-pointer whitespace-nowrap text-[11px] font-semibold text-blue-700 hover:underline dark:text-blue-400"
                >
                  {tx('+ Thêm môn', '+ Add subject')}
                </button>
              </div>
              <SubjectSearchSelect
                value={subject}
                onChange={(nextSubj) => {
                  setSubject(nextSubj);
                  if (!nextSubj) return;
                  const nextMeta = getSubjectMeta(nextSubj);
                  setSelectedP1([]);
                  setSelectedP2([]);
                  setSelectedP3([]);
                  setIncludePart1(true);
                  setIncludePart2(nextMeta.defaultPart2Count > 0);
                  setIncludePart3(nextMeta.defaultPart3Count > 0);
                  setTargetP1Count(nextMeta.defaultPart1Count);
                  setTargetP2Count(nextMeta.defaultPart2Count);
                  setTargetP3Count(nextMeta.defaultPart3Count);
                  setP3Point(nextMeta.defaultPart3Point);
                  if (error) setError(null);
                }}
                placeholder={tx('Tìm tên môn học...', 'Search subject...')}
                ariaLabel={tx('Tìm kiếm và chọn môn học cho đề thi', 'Search and select subject for exam')}
                currentUser={currentUser}
                onOpenAdvancedAdd={() => setAddSubjectOpen(true)}
                className="mt-1"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {tx('Mã phòng thi', 'Room Code')}
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm font-bold text-slate-900 uppercase dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {tx('Khối / Bậc học', 'Grade / Level')}
              </label>
              <GradeInputControl
                value={grade}
                onChange={setGrade}
                ariaLabel={tx(
                  'Chọn hoặc nhập khối từ 1 đến 12, Đại học hoặc Cao đẳng',
                  'Select or enter grade 1–12, University, or College',
                )}
                className="mt-1"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {tx('Phạm vi lớp (để trống = Toàn khối)', 'Target classes (blank = Whole grade)')}
              </label>
              <input
                type="text"
                value={targetClassesText}
                onChange={(e) => setTargetClassesText(e.target.value.toUpperCase())}
                placeholder={
                  grade === 'Đại học'
                    ? tx('VD: ĐH-01, ĐH-02', 'e.g. ĐH-01, ĐH-02')
                    : grade === 'Cao đẳng'
                      ? tx('VD: CĐ-01, CĐ-02', 'e.g. CĐ-01, CĐ-02')
                      : tx(`VD: ${grade}A1, ${grade}A2`, `e.g. ${grade}A1, ${grade}A2`)
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs text-slate-900 uppercase dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {(grade === 'Đại học'
                  ? ['ĐH-01', 'ĐH-02', 'ĐH-A1', 'ĐH-A2']
                  : grade === 'Cao đẳng'
                    ? ['CĐ-01', 'CĐ-02', 'CĐ-A1', 'CĐ-A2']
                    : [`${grade}A1`, `${grade}A2`, `${grade}A3`, `${grade}A4`]
                ).map((cls) => {
                  const selectedList = parseTargetClassesInput(targetClassesText);
                  const active = selectedList.includes(cls);
                  return (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? selectedList.filter((item) => item !== cls)
                          : [...selectedList, cls];
                        setTargetClassesText(next.join(', '));
                      }}
                      className={`cursor-pointer rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums transition-colors ${
                        active
                          ? 'bg-blue-700 text-white dark:bg-blue-600'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                      }`}
                    >
                      {cls}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {tx('Loại kỳ thi', 'Exam Category')}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExamCategory)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {(['tot_nghiep_2025', 'cuoi_ky', 'giua_ky', 'thuong_xuyen'] as const).map((k) => (
                  <option key={k} value={k}>
                    {localizeExamCategory(k, language)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {tx('Thời gian làm bài (phút)', 'Duration (minutes)')}
              </label>
              <input
                type="number"
                min={1}
                max={240}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 tabular-nums dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {[15, 45, 50, 90].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDuration(preset)}
                    className={`cursor-pointer rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums ${
                      duration === preset
                        ? 'bg-blue-700 text-white dark:bg-blue-600'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {preset}
                    {tx('p', 'm')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Teacher Visibility & Class Assignment */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                  <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span>{tx('Phạm vi phát hành & Giao vào Lớp học', 'Visibility & Class Assignment')}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {!currentUser
                    ? tx(
                        'Đăng nhập tài khoản Giáo viên để giao đề vào lớp học hoặc lưu đề riêng tư.',
                        'Sign in with a Teacher account to assign to a class or keep this exam private.',
                      )
                    : visibilityMode === 'private'
                      ? tx(
                          `Chế độ Riêng tư: Chỉ tài khoản ${currentUser.fullName} nhìn thấy đề thi này.`,
                          `Private mode: Only ${currentUser.fullName} can view this exam.`,
                        )
                      : visibilityMode === 'class'
                        ? tx(
                            'Học sinh đã tham gia lớp học được chọn sẽ nhìn thấy và làm bài thi này.',
                            'Students joined in the selected class can see and take this exam.',
                          )
                        : tx(
                            'Đề thi hiển thị công khai trong ngân hàng đề theo Khối / Lớp.',
                            'Exam is publicly visible in the exam bank by Grade / Class.',
                          )}
                </p>
              </div>

              {currentUser && (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label={tx('Quyền hiển thị đề thi', 'Exam visibility scope')}
                    value={visibilityMode}
                    onChange={(e) => {
                      const nextMode = e.target.value as 'public' | 'class' | 'private';
                      setVisibilityMode(nextMode);
                      if (nextMode === 'class' && !privateClassId && privateClasses[0]) {
                        setPrivateClassId(privateClasses[0].id);
                        setGrade(privateClasses[0].grade);
                      }
                    }}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="public">{tx('Công khai theo Khối / Lớp', 'Public by Grade / Class')}</option>
                    <option value="class">
                      {tx('Giao vào Lớp học (Học sinh đã tham gia thấy)', 'Assign to Class (Visible to joined students)')}
                    </option>
                    <option value="private">{tx('Riêng tư (Chỉ mình giáo viên thấy)', 'Private (Teacher only)')}</option>
                  </select>

                  {(visibilityMode === 'class' || visibilityMode === 'private') && (
                    <select
                      aria-label={tx('Chọn lớp học', 'Select class')}
                      value={privateClassId}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        setPrivateClassId(nextId);
                        const found = privateClasses.find((c) => c.id === nextId);
                        if (found) {
                          setGrade(found.grade);
                        }
                      }}
                      className="h-9 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-slate-800 dark:border-amber-800 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value="">
                        {visibilityMode === 'private'
                          ? tx('Đề riêng cá nhân (Chưa gắn lớp)', 'Personal private exam (No class)')
                          : tx('Chọn lớp học...', 'Select class...')}
                      </option>
                      {privateClasses.map((pc) => (
                        <option key={pc.id} value={pc.id}>
                          {pc.name} ({derivePrivateClassCode(pc)} ·{' '}
                          {localizeGradeText(formatGradeLabel(pc.grade), language)})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* INLINE FILE IMPORTER: Word (.docx) Questions + Excel (.xlsx/.xls) Answers */}
          <section className="rounded-xl border border-blue-200/80 bg-blue-50/40 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 rounded-lg bg-blue-100 p-2 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                  <Upload className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                    {tx(
                      'Nhập nhanh từ file Word (Câu hỏi) & Excel (Đáp án)',
                      'Quick Import from Word (Questions) & Excel (Answers)',
                    )}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    {language === 'en' ? (
                      <>
                        Upload a <span className="font-mono font-semibold">.docx</span> question
                        file and <span className="font-mono font-semibold">.xlsx / .xls</span>{' '}
                        answer sheet to parse questions, match keys, and add them directly to this
                        exam.
                      </>
                    ) : (
                      <>
                        Tải lên file đề <span className="font-mono font-semibold">.docx</span> và
                        bảng đáp án <span className="font-mono font-semibold">.xlsx / .xls</span> để
                        tự động tách câu hỏi, ghép đáp án và đưa thẳng vào đề thi đang tạo.
                      </>
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setFileImportOpen((v) => !v)}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-slate-800"
              >
                {fileImportOpen ? (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    <span>{tx('Thu gọn khung nhập file', 'Collapse file importer')}</span>
                  </>
                ) : (
                  <>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <span>{tx('Mở nhập file Word & Excel', 'Open Word & Excel importer')}</span>
                  </>
                )}
              </button>
            </div>

            {fileImportOpen && (
              <div className="mt-4 space-y-4 border-t border-blue-200/70 pt-4 dark:border-blue-900/50">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {/* Word Question File Dropzone */}
                  <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {tx('File câu hỏi Word (.docx)', 'Word Question File (.docx)')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() =>
                            downloadTextFile('file_cau_hoi_mau.txt', SAMPLE_QUESTION_FILE_TXT)
                          }
                          className="inline-flex cursor-pointer items-center gap-1 font-medium text-slate-600 hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-400"
                        >
                          <Download className="h-3 w-3" />
                          <span>{tx('Tải mẫu', 'Sample')}</span>
                        </button>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                          |
                        </span>
                        <button
                          type="button"
                          onClick={() => setWordPasteMode((v) => !v)}
                          className="inline-flex cursor-pointer items-center gap-1 font-medium text-slate-600 hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-400"
                        >
                          <ClipboardPaste className="h-3 w-3" />
                          <span>
                            {wordPasteMode
                              ? tx('Ẩn ô dán', 'Hide paste box')
                              : tx('Dán văn bản', 'Paste text')}
                          </span>
                        </button>
                      </div>
                    </div>

                    <input
                      ref={wordFileInputRef}
                      type="file"
                      accept=".docx,.doc,.txt,.md,.csv,.json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleWordQuestionUpload(file);
                        e.target.value = '';
                      }}
                    />

                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => wordFileInputRef.current?.click()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          wordFileInputRef.current?.click();
                        }
                      }}
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
                      className={`mt-2.5 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-3 py-4 text-center transition-colors ${
                        wordDragging
                          ? 'border-blue-600 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-950/40'
                          : wordFileName
                            ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800/70 dark:bg-emerald-950/30'
                            : 'border-slate-300 bg-slate-50/70 hover:border-blue-500 dark:border-slate-700 dark:bg-slate-950/50 dark:hover:border-blue-500'
                      }`}
                    >
                      {wordFileName ? (
                        <>
                          <FileCheck2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                          <p className="mt-1 text-xs font-bold text-slate-900 dark:text-slate-100">
                            {wordFileName}
                          </p>
                          <p className="mt-0.5 font-mono text-[11px] text-emerald-700 tabular-nums dark:text-emerald-400">
                            {tx(
                              `Tách được ${importStats.total} câu hỏi · Bấm để chọn file khác`,
                              `Parsed ${importStats.total} questions · Click to replace`,
                            )}
                          </p>
                        </>
                      ) : (
                        <>
                          <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {tx(
                              'Chọn hoặc kéo thả file Word đề thi (.docx)',
                              'Choose or drag & drop Word exam file (.docx)',
                            )}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {tx(
                              'Hỗ trợ .docx, .txt, .md · Tự nhận diện Phần I, Phần II, Phần III',
                              'Supports .docx, .txt, .md · Auto-detects Parts I, II, III',
                            )}
                          </p>
                        </>
                      )}
                    </div>

                    {(wordFileName || wordText.trim().length > 0) && (
                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-mono tabular-nums">
                          {wordText.length.toLocaleString(language === 'en' ? 'en-US' : 'vi-VN')}{' '}
                          {tx('ký tự', 'chars')}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setWordFileName(null);
                            setWordText('');
                            setImportManualOverrides({});
                            setImportRemovedIds(new Set());
                            setImportSuccessNotice(null);
                          }}
                          className="cursor-pointer font-medium text-red-600 hover:underline dark:text-red-400"
                        >
                          {tx('Xóa file câu hỏi', 'Remove question file')}
                        </button>
                      </div>
                    )}

                    {wordPasteMode && (
                      <textarea
                        rows={4}
                        value={wordText}
                        onChange={(e) => setWordText(e.target.value)}
                        placeholder={tx(
                          'Dán trực tiếp nội dung câu hỏi (Câu 1. ... A. ... B. ... C. ... D. ...)',
                          'Paste question content directly (Question 1. ... A. ... B. ... C. ... D. ...)',
                        )}
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    )}

                    {wordError && (
                      <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                        {wordError}
                      </p>
                    )}
                  </div>

                  {/* Excel Answer File Dropzone */}
                  <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <FileSpreadsheet className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {tx(
                            'File câu trả lời Excel (.xlsx / .xls)',
                            'Excel Answer File (.xlsx / .xls)',
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() =>
                            downloadSampleAnswerExcel('file_cau_tra_loi_mau.xlsx')
                          }
                          className="inline-flex cursor-pointer items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                        >
                          <Download className="h-3 w-3" />
                          <span>{tx('Mẫu Excel (.xlsx)', 'Excel Sample (.xlsx)')}</span>
                        </button>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                          |
                        </span>
                        <button
                          type="button"
                          onClick={() => setExcelPasteMode((v) => !v)}
                          className="inline-flex cursor-pointer items-center gap-1 font-medium text-slate-600 hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-400"
                        >
                          <ClipboardPaste className="h-3 w-3" />
                          <span>
                            {excelPasteMode
                              ? tx('Ẩn ô dán', 'Hide paste box')
                              : tx('Dán bảng đáp án', 'Paste answer key')}
                          </span>
                        </button>
                      </div>
                    </div>

                    <input
                      ref={excelFileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.ods,.csv,.tsv,.docx,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleExcelAnswerUpload(file);
                        e.target.value = '';
                      }}
                    />

                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => excelFileInputRef.current?.click()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          excelFileInputRef.current?.click();
                        }
                      }}
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
                      className={`mt-2.5 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-3 py-4 text-center transition-colors ${
                        excelDragging
                          ? 'border-emerald-600 bg-emerald-50/70 dark:border-emerald-500 dark:bg-emerald-950/40'
                          : excelFileName
                            ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800/70 dark:bg-emerald-950/30'
                            : 'border-slate-300 bg-slate-50/70 hover:border-emerald-600 dark:border-slate-700 dark:bg-slate-950/50 dark:hover:border-emerald-500'
                      }`}
                    >
                      {excelFileName ? (
                        <>
                          <FileCheck2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                          <p className="mt-1 text-xs font-bold text-slate-900 dark:text-slate-100">
                            {excelFileName}
                          </p>
                          <p className="mt-0.5 font-mono text-[11px] text-emerald-700 tabular-nums dark:text-emerald-400">
                            {tx(
                              `Nhận diện ${parsedExcelAnswers.length} đáp án · Bấm để chọn file khác`,
                              `Detected ${parsedExcelAnswers.length} answers · Click to replace`,
                            )}
                          </p>
                        </>
                      ) : (
                        <>
                          <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                          <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {tx(
                              'Chọn hoặc kéo thả file Excel đáp án (.xlsx, .xls)',
                              'Choose or drag & drop Excel answer file (.xlsx, .xls)',
                            )}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {tx(
                              'Hỗ trợ .xlsx, .xls, .csv, .docx · Cột Phần / Câu / Đáp án / Lời giải',
                              'Supports .xlsx, .xls, .csv, .docx · Part / Question / Answer / Solution columns',
                            )}
                          </p>
                        </>
                      )}
                    </div>

                    {(excelFileName || excelText.trim().length > 0) && (
                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-mono tabular-nums">
                          {parsedExcelAnswers.length} {tx('mục đáp án đã đọc', 'answers parsed')}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setExcelFileName(null);
                            setExcelText('');
                            setImportSuccessNotice(null);
                          }}
                          className="cursor-pointer font-medium text-red-600 hover:underline dark:text-red-400"
                        >
                          {tx('Xóa file đáp án', 'Remove answer file')}
                        </button>
                      </div>
                    )}

                    {excelPasteMode && (
                      <textarea
                        rows={4}
                        value={excelText}
                        onChange={(e) => setExcelText(e.target.value)}
                        placeholder={tx(
                          'Dán bảng đáp án (VD: Câu 1: B | Lời giải: ... hoặc 1.A 2.C)',
                          'Paste answer key (e.g. Q1: B | Solution: ... or 1.A 2.C)',
                        )}
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    )}

                    {excelError && (
                      <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                        {excelError}
                      </p>
                    )}
                  </div>
                </div>

                {/* Default Level / Topic + Import Summary & Action Bar */}
                {(importedDrafts.length > 0 || wordText.trim().length > 0) && (
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {tx(
                            `Kết quả đọc file: ${importStats.total} câu`,
                            `Parsed result: ${importStats.total} questions`,
                          )}
                        </span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                          ·
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          {tx('Phần I:', 'Part I:')} <strong>{importStats.p1}</strong>
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          {tx('Phần II:', 'Part II:')} <strong>{importStats.p2}</strong>
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          {tx('Phần III:', 'Part III:')} <strong>{importStats.p3}</strong>
                        </span>
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>
                            {importStats.readyCount} {tx('hợp lệ', 'ready')}
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

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          aria-label={tx('Mức độ mặc định khi nhập file', 'Default cognitive level for import')}
                          value={importDefaultLevel}
                          onChange={(e) =>
                            setImportDefaultLevel(e.target.value as CognitiveLevel)
                          }
                          className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        >
                          <option value="biet">
                            {tx('Mức độ:', 'Level:')} {localizeCognitiveLevel('biet', language)}
                          </option>
                          <option value="hieu">
                            {tx('Mức độ:', 'Level:')} {localizeCognitiveLevel('hieu', language)}
                          </option>
                          <option value="van_dung">
                            {tx('Mức độ:', 'Level:')} {localizeCognitiveLevel('van_dung', language)}
                          </option>
                        </select>
                        <input
                          type="text"
                          aria-label={tx('Chuyên đề mặc định khi nhập file', 'Default topic for import')}
                          value={importDefaultTopic}
                          onChange={(e) => setImportDefaultTopic(e.target.value)}
                          placeholder={tx('Chuyên đề mặc định', 'Default topic')}
                          className="h-8 w-36 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        />
                        {importedDrafts.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowImportPreview((v) => !v)}
                            className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            {showImportPreview
                              ? tx('Ẩn xem trước câu', 'Hide preview')
                              : tx(
                                  `Xem & chỉnh đáp án (${importedDrafts.length})`,
                                  `Review & edit keys (${importedDrafts.length})`,
                                )}
                          </button>
                        )}
                      </div>
                    </div>

                    {importedDrafts.length === 0 ? (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        {tx(
                          'Chưa nhận diện được câu hỏi nào từ nội dung file vừa tải. Hãy đảm bảo mỗi câu bắt đầu bằng "Câu 1.", "Câu 2."... và các đáp án A. B. C. D.',
                          'No questions detected in the uploaded content. Make sure each item starts with "Câu 1." / "Question 1." and options A. B. C. D.',
                        )}
                      </p>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                        {totalSelectedCount > 0 ? (
                          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700 dark:text-slate-300">
                            <label className="flex cursor-pointer items-center gap-1.5">
                              <input
                                type="radio"
                                name="inlineImportApplyMode"
                                checked={importApplyMode === 'append'}
                                onChange={() => setImportApplyMode('append')}
                                className="h-3.5 w-3.5 text-blue-700"
                              />
                              <span>{tx('Thêm tiếp vào đề đang soạn', 'Append to current exam')}</span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-1.5">
                              <input
                                type="radio"
                                name="inlineImportApplyMode"
                                checked={importApplyMode === 'replace'}
                                onChange={() => setImportApplyMode('replace')}
                                className="h-3.5 w-3.5 text-blue-700"
                              />
                              <span>{tx('Thay thế toàn bộ câu đang chọn', 'Replace all selected questions')}</span>
                            </label>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {tx(
                              'Các câu hỏi sẽ được lưu vào Ngân hàng và tự động chọn vào đề thi bên dưới.',
                              'Questions will be saved to the Question Bank and auto-selected into the exam below.',
                            )}
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={handleApplyImportedFilesToExam}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>
                            {tx(
                              `Nạp ${importedDrafts.length} câu từ file vào đề`,
                              `Add ${importedDrafts.length} imported questions to exam`,
                            )}
                          </span>
                        </button>
                      </div>
                    )}

                    {/* Optional Compact Preview & Manual Quick-Fix List */}
                    {showImportPreview && importedDrafts.length > 0 && (
                      <div className="max-h-72 space-y-2.5 overflow-y-auto border-t border-slate-200 pt-3 dark:border-slate-800">
                        {importedDrafts.map((draft, idx) => {
                          const overrideKey = `${draft.sourcePart ?? 0}_${draft.sourceNumber}_${idx}`;
                          const partLabel =
                            draft.type === 'multiple_choice'
                              ? tx('Phần I', 'Part I')
                              : draft.type === 'true_false'
                                ? tx('Phần II', 'Part II')
                                : tx('Phần III', 'Part III');

                          return (
                            <div
                              key={draft.tempId}
                              className={`rounded-lg border p-3 text-xs ${
                                draft.warnings.length > 0
                                  ? 'border-amber-300 bg-amber-50/40 dark:border-amber-800/70 dark:bg-amber-950/20'
                                  : 'border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-950/40'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                      {tx('Câu', 'Q')} {draft.sourceNumber}
                                    </span>
                                    <span>·</span>
                                    <span className="font-semibold text-blue-700 dark:text-blue-400">
                                      {partLabel}
                                    </span>
                                    <span>·</span>
                                    <span
                                      className={
                                        draft.answerSource === 'none'
                                          ? 'font-semibold text-amber-700 dark:text-amber-400'
                                          : 'font-semibold text-emerald-700 dark:text-emerald-400'
                                      }
                                    >
                                      {draft.answerSource === 'answer_file'
                                        ? tx('Đã ghép từ Excel/Đáp án', 'Matched from Excel/Answer sheet')
                                        : draft.answerSource === 'embedded'
                                          ? tx('Có sẵn đáp án', 'Embedded key')
                                          : draft.answerSource === 'manual'
                                            ? tx('Đã chọn thủ công', 'Manually edited')
                                            : tx('Chưa có đáp án', 'Missing answer')}
                                    </span>
                                  </div>
                                  <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                                    {draft.prompt}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  aria-label={tx(
                                    `Bỏ câu ${draft.sourceNumber} khỏi danh sách nạp`,
                                    `Remove question ${draft.sourceNumber} from import list`,
                                  )}
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

                              {draft.type === 'true_false' && draft.statements && (
                                <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                  {draft.statements.map((st, sIdx) => (
                                    <div
                                      key={st.id}
                                      className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-2 py-1 dark:border-slate-800 dark:bg-slate-900"
                                    >
                                      <span className="min-w-0 flex-1 truncate">
                                        <strong>{st.id})</strong> {st.text || tx('(Trống)', '(Empty)')}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (!draft.statements) return;
                                          const nextSt = draft.statements.map((item, i) =>
                                            i === sIdx ? { ...item, isTrue: !item.isTrue } : item,
                                          ) as ParsedQuestionDraft['statements'];
                                          updateImportedDraftManual(overrideKey, {
                                            statements: nextSt,
                                          });
                                        }}
                                        className={`cursor-pointer whitespace-nowrap shrink-0 rounded px-2 py-0.5 font-mono text-[11px] font-bold ${
                                          st.isTrue
                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                        }`}
                                      >
                                        {st.isTrue ? tx('Đúng', 'True') : tx('Sai', 'False')}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {draft.type === 'short_answer' && (
                                <div className="mt-2 flex items-center gap-2">
                                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                                    {tx('Đáp án ngắn:', 'Short answer:')}
                                  </span>
                                  <input
                                    type="text"
                                    value={draft.shortAnswer ?? ''}
                                    onChange={(e) =>
                                      updateImportedDraftManual(overrideKey, {
                                        shortAnswer: e.target.value,
                                      })
                                    }
                                    placeholder={tx(
                                      'Nhập đáp án (VD: 6 hoặc 2,5)',
                                      'Enter answer (e.g. 6 or 2.5)',
                                    )}
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

                {importSuccessNotice && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{importSuccessNotice}</span>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* SECTION 1: Configure Part Structure, Question Counts & Points */}
          <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-3.5 lg:flex-row lg:items-center dark:border-slate-800">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                  {tx(
                    '1. Cấu hình cấu trúc đề & Số lượng câu hỏi từng phần',
                    '1. Configure Exam Structure & Question Counts per Part',
                  )}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {language === 'en' ? (
                    <>
                      Adjust how many questions to draw for each part. Part II (True/False) and
                      Part III (Short Answer) are{' '}
                      <strong className="text-slate-700 dark:text-slate-200">optional</strong>.
                    </>
                  ) : (
                    <>
                      Chỉnh số lượng câu hỏi muốn lấy cho mỗi phần. Phần II (Đúng/Sai) và Phần III
                      (Trả lời ngắn){' '}
                      <strong className="text-slate-700 dark:text-slate-200">không bắt buộc</strong>
                      .
                    </>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={filterPoolByGrade}
                    onChange={(e) => setFilterPoolByGrade(e.target.checked)}
                    className="h-3.5 w-3.5 rounded text-blue-700"
                  />
                  <span>
                    {tx(
                      `Chỉ lọc nguồn ${localizeGradeText(formatGradeLabel(grade), language)}`,
                      `Filter pool: ${localizeGradeText(formatGradeLabel(grade), language)} only`,
                    )}
                  </span>
                </label>

                <button
                  type="button"
                  onClick={applyPresetOnlyMc}
                  className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {tx('Chỉ Phần I (Không Đúng/Sai)', 'Part I Only (No True/False)')}
                </button>
                <button
                  type="button"
                  onClick={applyPresetP1AndP3}
                  className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {tx('Phần I + III (Không Đúng/Sai)', 'Part I + III (No True/False)')}
                </button>
                <button
                  type="button"
                  onClick={autoPickByMatrix}
                  className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800/70 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  <span>{tx('Chuẩn 2025 (3 phần)', '2025 Standard (3 Parts)')}</span>
                </button>
              </div>
            </div>

            {/* 3 Part Config Cards */}
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {(
                [
                  {
                    key: 'p1' as const,
                    title: tx('Phần I · Nhiều lựa chọn', 'Part I · Multiple Choice'),
                    subtitle: tx(
                      'Trắc nghiệm 4 phương án A, B, C, D',
                      '4-option multiple choice A, B, C, D',
                    ),
                    optional: false,
                    enabled: includePart1,
                    onToggle: (checked: boolean) => getPartState('p1').setEnabled(checked),
                    target: targetP1Count,
                    onTargetChange: (v: number) =>
                      setTargetP1Count(Math.max(0, Math.min(p1Pool.length, v))),
                    selectedCount: selectedP1.length,
                    poolCount: p1Pool.length,
                    point: p1Point,
                    onPointChange: (v: number) => setP1Point(v),
                    pointLabel: tx('Điểm / câu', 'Points / question'),
                  },
                  {
                    key: 'p2' as const,
                    title: tx('Phần II · Đúng / Sai', 'Part II · True / False'),
                    subtitle: tx(
                      'Không bắt buộc · Có thể tắt nếu đề không dùng',
                      'Optional · Disable if not used in this exam',
                    ),
                    optional: true,
                    enabled: includePart2,
                    onToggle: (checked: boolean) => getPartState('p2').setEnabled(checked),
                    target: targetP2Count,
                    onTargetChange: (v: number) =>
                      setTargetP2Count(Math.max(0, Math.min(p2Pool.length, v))),
                    selectedCount: selectedP2.length,
                    poolCount: p2Pool.length,
                    point: p2Point,
                    onPointChange: (v: number) => setP2Point(v),
                    pointLabel: tx('Điểm tối đa / câu', 'Max points / question'),
                  },
                  {
                    key: 'p3' as const,
                    title: tx('Phần III · Trả lời ngắn', 'Part III · Short Answer'),
                    subtitle: tx(
                      'Không bắt buộc · Tự do bật hoặc tắt',
                      'Optional · Freely toggle on or off',
                    ),
                    optional: true,
                    enabled: includePart3,
                    onToggle: (checked: boolean) => getPartState('p3').setEnabled(checked),
                    target: targetP3Count,
                    onTargetChange: (v: number) =>
                      setTargetP3Count(Math.max(0, Math.min(p3Pool.length, v))),
                    selectedCount: selectedP3.length,
                    poolCount: p3Pool.length,
                    point: p3Point,
                    onPointChange: (v: number) => setP3Point(v),
                    pointLabel: tx('Điểm / câu', 'Points / question'),
                  },
                ] as const
              ).map((part) => (
                <div
                  key={part.key}
                  className={`flex flex-col justify-between rounded-xl border p-3.5 transition-colors ${
                    part.enabled
                      ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                      : 'border-dashed border-slate-300 bg-slate-100/70 opacity-85 dark:border-slate-800 dark:bg-slate-950/60'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <label className="flex cursor-pointer items-start gap-2">
                        <input
                          type="checkbox"
                          checked={part.enabled}
                          onChange={(e) => part.onToggle(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded text-blue-700"
                        />
                        <div>
                          <span className="block text-xs font-bold text-slate-900 dark:text-slate-100">
                            {part.title}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                            {part.subtitle}
                          </span>
                        </div>
                      </label>
                      {part.optional && (
                        <span className="shrink-0 font-mono text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          {part.enabled ? tx('Đang bật', 'Enabled') : tx('Đã tắt', 'Disabled')}
                        </span>
                      )}
                    </div>

                    {part.enabled ? (
                      <div className="mt-3 space-y-2.5 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                            {tx('Số câu muốn lấy:', 'Target question count:')}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={tx(
                                `Giảm số câu ${part.title}`,
                                `Decrease count for ${part.title}`,
                              )}
                              disabled={part.target <= 0}
                              onClick={() => applySinglePartCount(part.key, part.target - 1)}
                              className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <input
                              type="number"
                              min={0}
                              max={part.poolCount}
                              value={part.target}
                              onChange={(e) => part.onTargetChange(Number(e.target.value))}
                              className="h-7 w-14 rounded border border-slate-300 bg-white px-1.5 text-center font-mono text-xs font-bold text-slate-900 tabular-nums dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            />
                            <button
                              type="button"
                              aria-label={tx(
                                `Tăng số câu ${part.title}`,
                                `Increase count for ${part.title}`,
                              )}
                              disabled={part.target >= part.poolCount}
                              onClick={() => applySinglePartCount(part.key, part.target + 1)}
                              className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                            {part.pointLabel}:
                          </span>
                          <input
                            type="number"
                            step="0.05"
                            min="0.05"
                            max="10"
                            value={part.point}
                            onChange={(e) => part.onPointChange(Number(e.target.value))}
                            className="h-7 w-20 rounded border border-slate-300 bg-white px-2 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 border-t border-slate-200/70 pt-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                        {tx(
                          'Phần này không xuất hiện trong đề thi (0 câu).',
                          'This part will not appear in the exam (0 questions).',
                        )}
                      </div>
                    )}
                  </div>

                  {part.enabled && (
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-[11px] dark:border-slate-800">
                      <span className="font-mono text-slate-600 tabular-nums dark:text-slate-400">
                        {tx('Đã chọn:', 'Selected:')}{' '}
                        <strong
                          className={
                            part.selectedCount === part.target
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-amber-700 dark:text-amber-400'
                          }
                        >
                          {part.selectedCount}
                        </strong>
                        /{part.target} ({tx('Kho', 'Pool')} {part.poolCount})
                      </span>
                      <button
                        type="button"
                        onClick={() => applySinglePartCount(part.key, part.target)}
                        className="cursor-pointer whitespace-nowrap shrink-0 font-semibold text-blue-700 hover:underline dark:text-blue-400"
                      >
                        {tx(`Rút đủ ${part.target} câu`, `Draw ${part.target} Qs`)}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Summary Bar for Total Questions & Score */}
            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-3 tabular-nums">
                <span className="text-slate-600 dark:text-slate-400">
                  {tx('Tổng câu đã chọn:', 'Total selected:')}{' '}
                  <strong className="font-mono text-slate-900 dark:text-slate-100">
                    {totalSelectedCount} {tx('câu', 'questions')}
                  </strong>
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                  ·
                </span>
                <span className="text-slate-600 dark:text-slate-400">
                  {tx('Tổng điểm thô:', 'Total raw points:')}{' '}
                  <strong
                    className={`font-mono ${
                      Math.abs(totalRawPoints - 10) < 0.01
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-blue-700 dark:text-blue-400'
                    }`}
                  >
                    {formatScoreVi(totalRawPoints)} / {tx('10,00đ', '10.00 pts')}
                  </strong>
                </span>
                {totalSelectedCount > 0 && Math.abs(totalRawPoints - 10) >= 0.01 && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {tx(
                      '(Hệ thống tự quy đổi về thang 10 khi chấm)',
                      '(Automatically scaled to a 10-point scale when grading)',
                    )}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplyCounts}
                  className="cursor-pointer whitespace-nowrap shrink-0 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800/70 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950"
                >
                  {tx('Rút toàn bộ theo số lượng đã nhập', 'Apply Counts to All Parts')}
                </button>
                <button
                  type="button"
                  disabled={totalSelectedCount === 0}
                  onClick={balancePointsToTen}
                  className="cursor-pointer whitespace-nowrap shrink-0 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {tx('Tự chia điểm = 10,00đ', 'Auto-balance = 10.00 pts')}
                </button>
              </div>
            </div>
          </section>

          {/* SECTION 2: Two-Pane Question Selector (Add Specific / Remove Specific / Reorder / Quick Create) */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center dark:border-slate-800">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                  {tx(
                    '2. Chọn chi tiết từng câu hỏi (Thêm câu nào · Xóa câu nào)',
                    '2. Select Individual Questions (Add · Remove · Reorder)',
                  )}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {tx(
                    'Chọn phần thi bên dưới để thêm từ Ngân hàng câu hỏi, tạo câu hỏi mới hoặc xóa/sắp xếp thứ tự các câu đã có trong đề.',
                    'Choose a part below to add from the Question Bank, create a new question, or remove/reorder selected items.',
                  )}
                </p>
              </div>

              <div
                role="tablist"
                aria-label={tx(
                  'Chọn phần đề thi để thêm hoặc xóa câu hỏi',
                  'Select exam part to add or remove questions',
                )}
                className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
              >
                {(
                  [
                    {
                      id: 'p1' as const,
                      label: `${tx('Phần I', 'Part I')} (${includePart1 ? selectedP1.length : tx('Tắt', 'Off')})`,
                    },
                    {
                      id: 'p2' as const,
                      label: `${tx('Phần II Đúng/Sai', 'Part II T/F')} (${includePart2 ? selectedP2.length : tx('Tắt', 'Off')})`,
                    },
                    {
                      id: 'p3' as const,
                      label: `${tx('Phần III', 'Part III')} (${includePart3 ? selectedP3.length : tx('Tắt', 'Off')})`,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activePartTab === tab.id}
                    onClick={() => {
                      setActivePartTab(tab.id);
                      setQuickCreateOpen(false);
                    }}
                    className={`cursor-pointer whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                      activePartTab === tab.id
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-50'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {!activeState.enabled ? (
              <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center dark:border-slate-700 dark:bg-slate-950/50">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {tx(
                    `${activeState.label} đang được tắt (không bắt buộc)`,
                    `${activeState.label} is disabled (optional)`,
                  )}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {tx(
                    'Đề thi sẽ bỏ qua phần này khi phát hành và khi thí sinh làm bài.',
                    'This part will be skipped when publishing and during the exam.',
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => activeState.setEnabled(true)}
                  className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{tx(`Bật lại ${activeState.shortLabel}`, `Re-enable ${activeState.shortLabel}`)}</span>
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {quickCreateOpen && onAddQuestion && (
                  <InlineQuickQuestionForm
                    subject={subject}
                    grade={grade}
                    part={activePartTab}
                    currentUser={currentUser}
                    sourceExamId={draftExamId}
                    sourceExamTitle={
                      title.trim() ||
                      tx('Đề kiểm tra Định kỳ Chuẩn 2025', '2025 Standard Periodic Exam')
                    }
                    onCancel={() => setQuickCreateOpen(false)}
                    onCreated={(created) => {
                      onAddQuestion(created);
                      addQuestionIdToPart(activePartTab, created.id);
                      setQuickCreateOpen(false);
                    }}
                  />
                )}

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {/* Left Pane: Question Bank Available to Add */}
                  <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="space-y-2.5 border-b border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800 tabular-nums dark:text-slate-100">
                          {tx('Kho câu hỏi chưa thêm', 'Available Question Bank')} (
                          {filteredUnselectedPool.length})
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {onAddQuestion && (
                            <button
                              type="button"
                              onClick={() => setQuickCreateOpen((v) => !v)}
                              className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap shrink-0 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800/70 dark:bg-blue-950/50 dark:text-blue-300"
                            >
                              <Plus className="h-3 w-3" />
                              <span>
                                {quickCreateOpen
                                  ? tx('Ẩn tạo câu', 'Hide creator')
                                  : tx('Tạo câu mới', 'New question')}
                              </span>
                            </button>
                          )}
                          {filteredUnselectedPool.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                addManyQuestionIdsToPart(
                                  activePartTab,
                                  filteredUnselectedPool.map((q) => q.id),
                                )
                              }
                              className="cursor-pointer whitespace-nowrap shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-300"
                            >
                              + {tx('Thêm tất cả', 'Add all')} ({filteredUnselectedPool.length})
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <div className="relative min-w-[160px] flex-1">
                          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={poolSearch}
                            onChange={(e) => setPoolSearch(e.target.value)}
                            placeholder={tx(
                              'Tìm nội dung hoặc chuyên đề...',
                              'Search prompt or topic...',
                            )}
                            className="h-8 w-full rounded-lg border border-slate-300 bg-white pr-2.5 pl-8 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                          />
                        </div>
                        <select
                          aria-label={tx(
                            'Lọc mức độ nhận thức câu hỏi',
                            'Filter cognitive level',
                          )}
                          value={poolLevelFilter}
                          onChange={(e) =>
                            setPoolLevelFilter(e.target.value as 'all' | CognitiveLevel)
                          }
                          className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        >
                          <option value="all">{tx('Tất cả mức độ', 'All levels')}</option>
                          <option value="biet">{localizeCognitiveLevel('biet', language)}</option>
                          <option value="hieu">{localizeCognitiveLevel('hieu', language)}</option>
                          <option value="van_dung">
                            {localizeCognitiveLevel('van_dung', language)}
                          </option>
                        </select>
                      </div>
                    </div>

                    <div className="max-h-72 flex-1 divide-y divide-slate-100 overflow-y-auto p-2 dark:divide-slate-800">
                      {filteredUnselectedPool.length === 0 ? (
                        <p className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                          {activeState.pool.length === 0
                            ? tx(
                                `Chưa có câu hỏi ${activeState.shortLabel} thuộc môn ${localizeSubjectName(subject, getSubjectMeta(subject).name, language)} trong ngân hàng. Hãy bấm "Tạo câu mới" hoặc nhập từ file.`,
                                `No ${activeState.shortLabel} questions for ${localizeSubjectName(subject, getSubjectMeta(subject).name, language)} in the bank yet. Click "New question" or import from files.`,
                              )
                            : tx(
                                'Không còn câu hỏi phù hợp hoặc tất cả câu đã được thêm vào đề.',
                                'No matching questions left or all questions have been added to the exam.',
                              )}
                        </p>
                      ) : (
                        filteredUnselectedPool.map((q) => (
                          <div
                            key={q.id}
                            className="flex items-start justify-between gap-2.5 rounded-lg p-2.5 text-xs hover:bg-white dark:hover:bg-slate-900"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 font-medium text-slate-900 dark:text-slate-100">
                                {q.prompt}
                              </p>
                              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                {localizeGradeText(formatGradeLabel(q.grade), language)} · {q.topic}{' '}
                                · {localizeCognitiveLevel(q.level, language)}
                                {q.type === 'multiple_choice' && q.correctOptionIndex !== undefined
                                  ? ` · ${tx('Đáp án', 'Ans')} ${OPTION_LETTERS[q.correctOptionIndex]}`
                                  : q.type === 'short_answer' && q.shortAnswer
                                    ? ` · ${tx('Đáp án', 'Ans')} ${q.shortAnswer}`
                                    : ''}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => addQuestionIdToPart(activePartTab, q.id)}
                              className="inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800/70 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900"
                            >
                              <Plus className="h-3 w-3" />
                              <span>{tx('Thêm', 'Add')}</span>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Right Pane: Selected Questions Currently Inside the Exam */}
                  <div className="flex flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/30">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-bold text-slate-900 tabular-nums dark:text-slate-100">
                          {tx('Đã chọn trong', 'Selected in')} {activeState.shortLabel} (
                          {selectedQuestionsForActive.length} {tx('câu', 'Qs')})
                        </span>
                      </div>

                      {selectedQuestionsForActive.length > 0 && (
                        <button
                          type="button"
                          onClick={() => applySinglePartCount(activePartTab, 0)}
                          className="cursor-pointer whitespace-nowrap shrink-0 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                        >
                          {tx(`Xóa hết ${activeState.shortLabel}`, `Clear ${activeState.shortLabel}`)}
                        </button>
                      )}
                    </div>

                    <div className="max-h-72 flex-1 divide-y divide-slate-100 overflow-y-auto p-2 dark:divide-slate-800">
                      {selectedQuestionsForActive.length === 0 ? (
                        <p className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                          {language === 'en' ? (
                            <>
                              No questions selected in {activeState.shortLabel}. Click{' '}
                              <strong className="text-slate-700 dark:text-slate-200">+ Add</strong>{' '}
                              on the left or click{' '}
                              <strong className="text-slate-700 dark:text-slate-200">
                                Draw Qs
                              </strong>{' '}
                              in section 1.
                            </>
                          ) : (
                            <>
                              Chưa có câu hỏi nào trong {activeState.shortLabel}. Hãy bấm{' '}
                              <strong className="text-slate-700 dark:text-slate-200">+ Thêm</strong>{' '}
                              ở danh sách bên trái hoặc bấm{' '}
                              <strong className="text-slate-700 dark:text-slate-200">
                                Rút đủ câu
                              </strong>{' '}
                              ở mục 1.
                            </>
                          )}
                        </p>
                      ) : (
                        selectedQuestionsForActive.map((q, idx) => (
                          <div
                            key={q.id}
                            className="flex items-start justify-between gap-2.5 rounded-lg p-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-900/60"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[11px] font-bold text-blue-700 tabular-nums dark:text-blue-400">
                                  {tx('Câu', 'Q')} {idx + 1}
                                </span>
                                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                                  ·
                                </span>
                                <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                                  {q.topic} · {localizeCognitiveLevel(q.level, language)}
                                </span>
                              </div>
                              <p className="mt-0.5 line-clamp-2 font-medium text-slate-900 dark:text-slate-100">
                                {q.prompt}
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                aria-label={tx(`Đưa câu ${idx + 1} lên`, `Move question ${idx + 1} up`)}
                                disabled={idx === 0}
                                onClick={() => moveQuestionInPart(activePartTab, idx, -1)}
                                className="cursor-pointer rounded border border-slate-200 p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-35 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                aria-label={tx(
                                  `Đưa câu ${idx + 1} xuống`,
                                  `Move question ${idx + 1} down`,
                                )}
                                disabled={idx === selectedQuestionsForActive.length - 1}
                                onClick={() => moveQuestionInPart(activePartTab, idx, 1)}
                                className="cursor-pointer rounded border border-slate-200 p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-35 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                aria-label={tx(
                                  `Xóa câu ${idx + 1} khỏi đề`,
                                  `Remove question ${idx + 1} from exam`,
                                )}
                                onClick={() => removeQuestionIdFromPart(activePartTab, q.id)}
                                className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
                              >
                                <Trash2 className="h-3 w-3" />
                                <span>{tx('Xóa', 'Remove')}</span>
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Proctoring & Shuffle Toggles */}
          <div className="grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 text-xs sm:grid-cols-2 dark:border-slate-800">
            <label className="flex cursor-pointer items-center gap-2.5 text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                className="h-4 w-4 rounded text-blue-700"
              />
              <Shuffle className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <span>
                {tx(
                  'Trộn thứ tự câu hỏi theo từng mã đề (0101–0104)',
                  'Shuffle question order by exam variant (0101–0104)',
                )}
              </span>
            </label>

            <label className="flex cursor-pointer items-center gap-2.5 text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={shuffleOptions}
                onChange={(e) => setShuffleOptions(e.target.checked)}
                className="h-4 w-4 rounded text-blue-700"
              />
              <span>
                {tx(
                  'Hoán vị phương án A, B, C, D ở Phần I',
                  'Shuffle options A, B, C, D in Part I',
                )}
              </span>
            </label>

            <label className="flex cursor-pointer items-center gap-2.5 text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={strictProctoring}
                onChange={(e) => setStrictProctoring(e.target.checked)}
                className="h-4 w-4 rounded text-blue-700"
              />
              <span>
                {tx(
                  'Giám sát chuyển tab & chống sao chép (Thông tư 09/2021)',
                  'Tab-switch monitoring & anti-copy proctoring (Circ. 09/2021)',
                )}
              </span>
            </label>

            <label className="flex cursor-pointer items-center gap-2.5 text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={showSolutionsAfterSubmit}
                onChange={(e) => setShowSolutionsAfterSubmit(e.target.checked)}
                className="h-4 w-4 rounded text-blue-700"
              />
              <span>
                {tx(
                  'Hiển thị đáp án & lời giải chi tiết sau khi nộp',
                  'Show answers & detailed solutions after submission',
                )}
              </span>
            </label>

            <label className="flex cursor-pointer items-center gap-2.5 text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={autoSubmitOnTimeout}
                onChange={(e) => setAutoSubmitOnTimeout(e.target.checked)}
                className="h-4 w-4 rounded text-blue-700"
              />
              <span>
                {tx(
                  'Tự động khóa đề & nộp bài ngay khi hết giờ (00:00)',
                  'Auto-lock exam & submit immediately at 00:00',
                )}
              </span>
            </label>

            <label className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
              <span>
                {tx(
                  'Cảnh báo sắp hết giờ trước (phút):',
                  'Low-time warning threshold (minutes):',
                )}
              </span>
              <input
                type="number"
                min={1}
                max={30}
                value={warningMinutes}
                onChange={(e) => setWarningMinutes(Number(e.target.value))}
                className="h-8 w-16 rounded border border-slate-300 bg-white px-2 font-mono text-xs text-slate-900 tabular-nums dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
          </div>

          {error && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <p className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
              {tx('Cấu trúc hiện tại:', 'Current structure:')} {effectiveP1.length}{' '}
              {tx('câu Phần I', 'Part I Qs')}
              {effectiveP2.length > 0 ? ` · ${effectiveP2.length} ${tx('câu Phần II', 'Part II Qs')}` : ''}
              {effectiveP3.length > 0 ? ` · ${effectiveP3.length} ${tx('câu Phần III', 'Part III Qs')}` : ''}{' '}
              ({tx('Tổng', 'Total')} {totalSelectedCount} {tx('câu', 'Qs')})
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {tx('Hủy', 'Cancel')}
              </button>
              <button
                type="submit"
                className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                {initialExam
                  ? tx('Lưu cập nhật đề thi', 'Save Exam Changes')
                  : tx('Phát hành phòng thi', 'Publish Exam Room')}
              </button>
            </div>
          </div>
        </form>
      </div>

      <AddSubjectModal
        open={addSubjectOpen}
        onClose={() => setAddSubjectOpen(false)}
        currentUser={currentUser}
        onSubjectAdded={(created) => {
          setSubject(created.id);
          setSelectedP1([]);
          setSelectedP2([]);
          setSelectedP3([]);
          setIncludePart1(true);
          setIncludePart2(created.defaultPart2Count > 0);
          setIncludePart3(created.defaultPart3Count > 0);
          setTargetP1Count(created.defaultPart1Count);
          setTargetP2Count(created.defaultPart2Count);
          setTargetP3Count(created.defaultPart3Count);
          setP3Point(created.defaultPart3Point);
          setAddSubjectOpen(false);
        }}
      />
    </div>
  );
}

function InlineQuickQuestionForm({
  subject,
  grade,
  part,
  currentUser,
  sourceExamId,
  sourceExamTitle,
  onCancel,
  onCreated,
}: {
  subject: SubjectId;
  grade: GradeLevelType;
  part: BuilderPartKey;
  currentUser?: UserAccount | null;
  sourceExamId?: string;
  sourceExamTitle?: string;
  onCancel: () => void;
  onCreated: (q: Question) => void;
}) {
  const { language, tx } = useLanguage();
  const [topic, setTopic] = useState(() => tx('Chuyên đề ôn tập', 'Review Topic'));
  const [level, setLevel] = useState<CognitiveLevel>('biet');
  const [prompt, setPrompt] = useState('');
  const [options, setOptions] = useState<[string, string, string, string]>(['', '', '', '']);
  const [correctIdx, setCorrectIdx] = useState<0 | 1 | 2 | 3>(0);
  const [statements, setStatements] = useState<
    [
      TrueFalseStatement,
      TrueFalseStatement,
      TrueFalseStatement,
      TrueFalseStatement,
    ]
  >([
    { id: 'a', text: '', isTrue: true },
    { id: 'b', text: '', isTrue: false },
    { id: 'c', text: '', isTrue: true },
    { id: 'd', text: '', isTrue: false },
  ]);
  const [shortAnswer, setShortAnswer] = useState('');
  const [formErr, setFormErr] = useState<string | null>(null);

  const handleAdd = () => {
    if (!prompt.trim() || !topic.trim()) {
      setFormErr(
        tx(
          'Vui lòng nhập nội dung câu hỏi và chuyên đề.',
          'Please enter the question prompt and topic.',
        ),
      );
      return;
    }
    if (part === 'p1' && options.some((o) => !o.trim())) {
      setFormErr(
        tx('Vui lòng nhập đủ 4 phương án A, B, C, D.', 'Please fill in all 4 options A, B, C, D.'),
      );
      return;
    }
    if (part === 'p2' && statements.some((s) => !s.text.trim())) {
      setFormErr(
        tx(
          'Vui lòng nhập đủ nội dung 4 ý a, b, c, d.',
          'Please fill in all 4 statements a, b, c, d.',
        ),
      );
      return;
    }
    if (part === 'p3' && (!shortAnswer.trim() || shortAnswer.trim().length > 4)) {
      setFormErr(
        tx(
          'Đáp án Phần III gồm 1 đến 4 ký tự.',
          'Part III answer must be 1 to 4 characters long.',
        ),
      );
      return;
    }

    const created: Question = {
      id: `q_quick_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      subject,
      grade,
      topic: topic.trim(),
      level,
      type:
        part === 'p1'
          ? 'multiple_choice'
          : part === 'p2'
            ? 'true_false'
            : 'short_answer',
      prompt: prompt.trim(),
      explanation: tx(
        'Đáp án được giáo viên bổ sung trực tiếp khi soạn đề.',
        'Answer added directly by the teacher while building the exam.',
      ),
      isPrivate: true,
      ownerTeacherId: currentUser?.id,
      ownerTeacherName: currentUser?.fullName,
      sourceExamId,
      sourceExamTitle,
      createdAt: new Date().toISOString(),
    };

    if (part === 'p1') {
      created.options = options.map((o) => o.trim()) as [string, string, string, string];
      created.correctOptionIndex = correctIdx;
    } else if (part === 'p2') {
      created.statements = statements.map((s) => ({ ...s, text: s.text.trim() })) as typeof statements;
    } else {
      const norm = shortAnswer.trim();
      created.shortAnswer = norm;
      created.acceptedAnswers = Array.from(
        new Set([norm, norm.replace(/,/g, '.'), norm.replace(/\./g, ',')]),
      );
    }

    onCreated(created);
  };

  return (
    <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4 text-xs dark:border-blue-900/60 dark:bg-blue-950/25">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-slate-900 dark:text-slate-100">
          {tx(
            'Tạo nhanh câu hỏi mới (Lưu vào Ngân hàng & thêm ngay vào đề)',
            'Quick-create new question (Saved to Bank & added to exam)',
          )}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer text-slate-500 hover:text-slate-800 dark:text-slate-400"
        >
          {tx('Đóng', 'Close')}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={tx('Chuyên đề', 'Topic')}
          className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as CognitiveLevel)}
          className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="biet">{localizeCognitiveLevel('biet', language)}</option>
          <option value="hieu">{localizeCognitiveLevel('hieu', language)}</option>
          <option value="van_dung">{localizeCognitiveLevel('van_dung', language)}</option>
        </select>
        <div className="flex items-center text-[11px] text-slate-500 dark:text-slate-400">
          {localizeSubjectName(subject, getSubjectMeta(subject).name, language)} ·{' '}
          {localizeGradeText(formatGradeLabel(grade), language)}
        </div>
      </div>

      <textarea
        rows={2}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={tx('Nhập nội dung câu hỏi...', 'Enter question prompt...')}
        className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />

      {part === 'p1' && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="quick-p1-correct"
                checked={correctIdx === i}
                onChange={() => setCorrectIdx(i as 0 | 1 | 2 | 3)}
                className="h-3.5 w-3.5 text-blue-700"
              />
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {OPTION_LETTERS[i]}.
              </span>
              <input
                type="text"
                value={opt}
                onChange={(e) => {
                  const next = [...options] as [string, string, string, string];
                  next[i] = e.target.value;
                  setOptions(next);
                }}
                placeholder={`${tx('Phương án', 'Option')} ${OPTION_LETTERS[i]}`}
                className="h-8 flex-1 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          ))}
        </div>
      )}

      {part === 'p2' && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {statements.map((st, idx) => (
            <div key={st.id} className="flex items-center gap-2">
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {st.id})
              </span>
              <input
                type="text"
                value={st.text}
                onChange={(e) => {
                  const next = [...statements] as typeof statements;
                  next[idx] = { ...next[idx], text: e.target.value };
                  setStatements(next);
                }}
                placeholder={`${tx('Nội dung ý', 'Statement')} ${st.id})`}
                className="h-8 flex-1 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => {
                  const next = [...statements] as typeof statements;
                  next[idx] = { ...next[idx], isTrue: !next[idx].isTrue };
                  setStatements(next);
                }}
                className={`cursor-pointer rounded px-2 py-1 font-mono text-[11px] font-bold ${
                  st.isTrue
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                }`}
              >
                {st.isTrue ? tx('Đúng', 'True') : tx('Sai', 'False')}
              </button>
            </div>
          ))}
        </div>
      )}

      {part === 'p3' && (
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {tx('Đáp án chuẩn (≤ 4 ký tự):', 'Standard answer (≤ 4 chars):')}
          </span>
          <input
            type="text"
            maxLength={4}
            value={shortAnswer}
            onChange={(e) =>
              setShortAnswer(e.target.value.replace(/[^0-9.,-]/g, '').slice(0, 4))
            }
            placeholder={tx('VD: 12,5', 'e.g. 12.5')}
            className="h-8 w-28 rounded-md border border-slate-300 bg-white px-2.5 font-mono text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      )}

      {formErr && <p className="font-medium text-red-600 dark:text-red-400">{formErr}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          {tx('Hủy', 'Cancel')}
        </button>
        <button
          type="button"
          onClick={handleAdd}
          className="cursor-pointer rounded-md bg-blue-700 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-800 dark:bg-blue-600"
        >
          {tx('Lưu & Thêm vào đề', 'Save & Add to Exam')}
        </button>
      </div>
    </div>
  );
}
