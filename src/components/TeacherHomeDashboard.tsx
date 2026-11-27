import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  Clock,
  Copy,
  DoorOpen,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Info,
  KeyRound,
  Lock,
  LogIn,
  Paperclip,
  Pencil,
  Plus,
  Printer,
  Search,
  Settings,
  Share2,
  Trash2,
  Upload,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  derivePrivateClassCode,
  downloadAttachedDocumentFile,
  downloadClassMaterialTxt,
  formatMaterialFileSize,
  getMaterialFileExtension,
  readClassMaterialFile,
} from '../data/studentPortalData';
import type {
  AttachedDocumentFile,
  ClassAssignment,
  ClassJoinRequest,
  ClassMaterial,
  ClassScheduleSlot,
  Exam,
  ExamSubmission,
  GradeLevel,
  Question,
  ResourceShareGrant,
  SubjectId,
  TeacherPrivateClass,
  UserAccount,
} from '../types/exam';
import {
  calculateExamMaxRawScore,
  canManageResourceSharing,
  canTeacherEditResource,
  classifyAcademicRankTT22,
  formatGradeLabel,
  formatScoreVi,
  generateClassCode5,
  getExamDurationMinutes,
  getSubjectMeta,
  getTeacherSharePermission,
  isAdminUser,
  isResourceOwner,
  isValidAllowedGrade,
  isValidClassCode5,
  MAX_CLASSES_PER_TEACHER,
  OPTION_LETTERS,
  sanitizeClassCodeInput,
} from '../utils/scoring2025';
import {
  localizeAcademicRank,
  localizeExamCategory,
  localizeGradeText,
  localizeSubjectName,
  useLanguage,
} from '../utils/i18n';
import { useSubjects } from '../utils/subjectStore';
import { AddSubjectModal } from './AddSubjectModal';
import { AssignmentQuestionBuilder } from './AssignmentQuestionBuilder';
import { GradeInputControl } from './GradeInputControl';
import type { AppView } from './Header';
import { ResourceShareModal } from './ResourceShareModal';
import type { StudentHomeSectionId } from './StudentHomeDashboard';
import { SubjectSearchSelect } from './SubjectSearchSelect';
import { WeeklyCalendarSchedule } from './WeeklyCalendarSchedule';

interface TeacherHomeDashboardProps {
  currentUser: UserAccount | null;
  exams: Exam[];
  questions?: Question[];
  submissions: ExamSubmission[];
  privateClasses: TeacherPrivateClass[];
  allPrivateClasses: TeacherPrivateClass[];
  classJoinRequests: ClassJoinRequest[];
  classMaterials: ClassMaterial[];
  classAssignments: ClassAssignment[];
  classSchedules: ClassScheduleSlot[];
  onAddPrivateClass: (cls: TeacherPrivateClass) => { ok: boolean; error?: string } | void;
  onUpdatePrivateClass?: (cls: TeacherPrivateClass) => void;
  onDeletePrivateClass: (id: string) => void;
  onReviewJoinRequest: (requestId: string, decision: 'approved' | 'rejected') => void;
  onRemoveClassMember: (classId: string, studentUserId: string) => void;
  onAddClassMaterial: (material: ClassMaterial) => void;
  onUpdateClassMaterial?: (material: ClassMaterial) => void;
  onDeleteClassMaterial: (id: string) => void;
  onAddClassAssignment: (assignment: ClassAssignment) => void;
  onUpdateClassAssignment?: (assignment: ClassAssignment) => void;
  onDeleteClassAssignment: (id: string) => void;
  onAddScheduleSlot: (slot: ClassScheduleSlot) => void;
  onUpdateScheduleSlot: (slot: ClassScheduleSlot) => void;
  onDeleteScheduleSlot: (id: string) => void;
  onSelectExamToStart: (exam: Exam) => void;
  onOpenPrintableExam: (exam: Exam) => void;
  onNavigate: (view: AppView) => void;
  onViewSubmission: (sub: ExamSubmission) => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  requestedSection?: { sectionId: StudentHomeSectionId; nonce: number } | null;
  onSectionActivated?: (sectionId: StudentHomeSectionId) => void;
  activeClassId?: string | null;
  onActiveClassChange?: (classId: string | null) => void;
  activeClassTab?: TeacherClassRoomTab | null;
  onActiveClassTabChange?: (tab: TeacherClassRoomTab | null) => void;
  editClassModalRequest?: number;
}

export type TeacherClassRoomTab =
  | 'overview'
  | 'students'
  | 'assignments'
  | 'exams'
  | 'scores'
  | 'schedule'
  | 'materials';

type OverviewSectionKey =
  | 'exams'
  | 'materials'
  | 'assignments'
  | 'scores'
  | 'schedule';

const OVERVIEW_SECTION_KEYS: OverviewSectionKey[] = [
  'exams',
  'materials',
  'assignments',
  'scores',
  'schedule',
];

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function suggestClassCode(
  grade: GradeLevel,
  subject: SubjectId,
  name = '',
  excludeCodes?: ReadonlySet<string>,
  previousCode?: string,
): string {
  return generateClassCode5({
    grade,
    subject,
    name,
    excludeCodes,
    previousCode,
  });
}

export function TeacherHomeDashboard({
  currentUser,
  exams,
  questions = [],
  submissions,
  privateClasses,
  allPrivateClasses,
  classJoinRequests,
  classMaterials,
  classAssignments,
  classSchedules,
  onAddPrivateClass,
  onUpdatePrivateClass,
  onDeletePrivateClass,
  onReviewJoinRequest,
  onRemoveClassMember,
  onAddClassMaterial,
  onUpdateClassMaterial,
  onDeleteClassMaterial,
  onAddClassAssignment,
  onUpdateClassAssignment,
  onDeleteClassAssignment,
  onAddScheduleSlot,
  onUpdateScheduleSlot,
  onDeleteScheduleSlot,
  onSelectExamToStart,
  onOpenPrintableExam,
  onNavigate,
  onViewSubmission,
  onOpenAuth,
  requestedSection,
  activeClassId: controlledClassId,
  onActiveClassChange,
  activeClassTab: controlledClassTab,
  onActiveClassTabChange,
  editClassModalRequest = 0,
}: TeacherHomeDashboardProps) {
  useSubjects();
  const { language, tx } = useLanguage();
  const [addSubjectModalOpen, setAddSubjectModalOpen] = useState(false);
  const [internalClassId, setInternalClassId] = useState<string | null>(null);
  const [internalClassTab, setInternalClassTab] =
    useState<TeacherClassRoomTab | null>(null);

  const activeClassId =
    controlledClassId !== undefined ? controlledClassId : internalClassId;
  const classRoomTab =
    controlledClassTab !== undefined ? controlledClassTab : internalClassTab;

  const setActiveClassId = (nextId: string | null) => {
    if (controlledClassId === undefined) {
      setInternalClassId(nextId);
    }
    onActiveClassChange?.(nextId);
  };

  const setClassRoomTab = (nextTab: TeacherClassRoomTab | null) => {
    if (controlledClassTab === undefined) {
      setInternalClassTab(nextTab);
    }
    onActiveClassTabChange?.(nextTab);
  };

  const [collapsedOverviewSections, setCollapsedOverviewSections] = useState<
    Record<OverviewSectionKey, boolean>
  >({
    exams: false,
    materials: false,
    assignments: false,
    scores: false,
    schedule: false,
  });

  useEffect(() => {
    setCollapsedOverviewSections({
      exams: false,
      materials: false,
      assignments: false,
      scores: false,
      schedule: false,
    });
  }, [activeClassId]);
  const [shareModalTarget, setShareModalTarget] = useState<
    | { kind: 'class'; item: TeacherPrivateClass }
    | { kind: 'material'; item: ClassMaterial }
    | { kind: 'assignment'; item: ClassAssignment }
    | null
  >(null);

  // Search teacher's classes
  const [classSearchInput, setClassSearchInput] = useState('');
  const [copiedClassId, setCopiedClassId] = useState<string | null>(null);
  const [confirmDeleteClassId, setConfirmDeleteClassId] = useState<string | null>(null);
  const [confirmStopShareClassId, setConfirmStopShareClassId] = useState<string | null>(null);

  // Create new class inline form state
  const [createClassOpen, setCreateClassOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassCode, setNewClassCode] = useState(() => suggestClassCode(12, ''));
  const [newClassSubject, setNewClassSubject] = useState<SubjectId>('');
  const [newClassGrade, setNewClassGrade] = useState<GradeLevel>(12);
  const [newClassDesc, setNewClassDesc] = useState('');
  const [createClassError, setCreateClassError] = useState<string | null>(null);

  // Edit active class info modal state
  const [editClassModalOpen, setEditClassModalOpen] = useState(false);
  const [editClassName, setEditClassName] = useState('');
  const [editClassCode, setEditClassCode] = useState('');
  const [editClassSubject, setEditClassSubject] = useState<SubjectId>('');
  const [editClassGrade, setEditClassGrade] = useState<GradeLevel>(12);
  const [editClassDesc, setEditClassDesc] = useState('');
  const [editClassRequireApproval, setEditClassRequireApproval] = useState(true);
  const [editClassError, setEditClassError] = useState<string | null>(null);
  const [editClassSavedNotice, setEditClassSavedNotice] = useState(false);
  const lastHandledEditReqRef = useRef(editClassModalRequest);

  // Create Material form state (used inside class room)
  const [matTitle, setMatTitle] = useState('');
  const [matCategory, setMatCategory] = useState('');
  const [matSummary, setMatSummary] = useState('');
  const [matKeyPoints, setMatKeyPoints] = useState('');
  const [matContent, setMatContent] = useState('');
  const [matAttachmentName, setMatAttachmentName] = useState<string | undefined>(undefined);
  const [matAttachmentMimeType, setMatAttachmentMimeType] = useState<string | undefined>(undefined);
  const [matAttachmentSize, setMatAttachmentSize] = useState<number | undefined>(undefined);
  const [matAttachmentDataUrl, setMatAttachmentDataUrl] = useState<string | undefined>(undefined);
  const [matError, setMatError] = useState<string | null>(null);
  const [activeMaterial, setActiveMaterial] = useState<ClassMaterial | null>(null);
  const matFileInputRef = useRef<HTMLInputElement | null>(null);

  // Create Assignment form state (used inside class room)
  const [asgTitle, setAsgTitle] = useState('');
  const [asgDue, setAsgDue] = useState('');
  const [asgMinutes, setAsgMinutes] = useState(20);
  const [asgRoomCode, setAsgRoomCode] = useState('');
  const [asgDesc, setAsgDesc] = useState('');
  const [asgQuestionFile, setAsgQuestionFile] = useState<AttachedDocumentFile | undefined>(undefined);
  const [asgAnswerFile, setAsgAnswerFile] = useState<AttachedDocumentFile | undefined>(undefined);
  const [asgQuestions, setAsgQuestions] = useState<Question[]>([]);
  const [asgQuestionCount, setAsgQuestionCount] = useState<number>(0);
  const [previewAssignment, setPreviewAssignment] = useState<ClassAssignment | null>(null);
  const [asgError, setAsgError] = useState<string | null>(null);
  const asgQuestionInputRef = useRef<HTMLInputElement | null>(null);
  const asgAnswerInputRef = useRef<HTMLInputElement | null>(null);

  const myClassIds = useMemo(
    () => new Set(privateClasses.map((pc) => pc.id)),
    [privateClasses],
  );

  const editableClasses = useMemo(
    () => privateClasses.filter((pc) => canTeacherEditResource(pc, currentUser)),
    [privateClasses, currentUser],
  );

  const editableClassIds = useMemo(
    () => new Set(editableClasses.map((pc) => pc.id)),
    [editableClasses],
  );

  const ownedClassesCount = useMemo(
    () => privateClasses.filter((pc) => isResourceOwner(pc, currentUser)).length,
    [privateClasses, currentUser],
  );

  const classMap = useMemo(
    () => new Map(privateClasses.map((pc) => [pc.id, pc])),
    [privateClasses],
  );

  const allClassCodesSet = useMemo(
    () => new Set(allPrivateClasses.map((pc) => derivePrivateClassCode(pc))),
    [allPrivateClasses],
  );

  const hasReachedClassLimit =
    !isAdminUser(currentUser) && ownedClassesCount >= MAX_CLASSES_PER_TEACHER;

  useEffect(() => {
    if (!createClassOpen) return;
    const hasName = newClassName.trim().length >= 2;
    const hasSubject = newClassSubject.trim().length > 0;
    const hasValidGrade = isValidAllowedGrade(newClassGrade);
    if (hasName && hasSubject && hasValidGrade) {
      setNewClassCode((prev) =>
        suggestClassCode(
          newClassGrade,
          newClassSubject,
          newClassName,
          allClassCodesSet,
          prev,
        ),
      );
    }
  }, [createClassOpen, newClassName, newClassSubject, newClassGrade, allClassCodesSet]);

  const myApprovedRequests = useMemo(
    () =>
      classJoinRequests.filter(
        (r) => myClassIds.has(r.classId) && r.status === 'approved',
      ),
    [classJoinRequests, myClassIds],
  );

  const filteredTeacherClasses = useMemo(() => {
    const q = normalizeSearchText(classSearchInput);
    if (!q) return privateClasses;
    return privateClasses.filter((pc) => {
      const code = normalizeSearchText(derivePrivateClassCode(pc));
      const name = normalizeSearchText(pc.name);
      return code.includes(q) || name.includes(q);
    });
  }, [classSearchInput, privateClasses]);

  const myClassSchedules = useMemo(
    () => classSchedules.filter((s) => myClassIds.has(s.classId)),
    [classSchedules, myClassIds],
  );

  useEffect(() => {
    if (!requestedSection) return;
    if (controlledClassId === undefined) {
      setInternalClassId(null);
    }
    onActiveClassChange?.(null);
    if (controlledClassTab === undefined) {
      setInternalClassTab(null);
    }
    onActiveClassTabChange?.(null);
    const timer = window.setTimeout(() => {
      const el = document.getElementById(
        `portal-section-${requestedSection.sectionId}`,
      );
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedSection]);

  const handleCopyCode = (classId: string, code: string) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopiedClassId(classId);
    window.setTimeout(() => {
      setCopiedClassId((prev) => (prev === classId ? null : prev));
    }, 2000);
  };

  const handleCreateClassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setCreateClassError(
        tx(
          'Vui lòng đăng nhập tài khoản Giáo viên để tạo lớp học mới.',
          'Please sign in with a Teacher account to create a new class.',
        ),
      );
      return;
    }
    if (!isAdminUser(currentUser) && ownedClassesCount >= MAX_CLASSES_PER_TEACHER) {
      setCreateClassError(
        tx(
          `Mỗi tài khoản giáo viên chỉ được tạo tối đa ${MAX_CLASSES_PER_TEACHER} lớp học. Vui lòng xóa bớt lớp cũ nếu muốn tạo thêm.`,
          `Each teacher account can create up to ${MAX_CLASSES_PER_TEACHER} classes. Please remove an old class first.`,
        ),
      );
      return;
    }
    const cleanName = newClassName.trim();
    if (cleanName.length < 2) {
      setCreateClassError(
        tx(
          'Vui lòng nhập tên lớp học (tối thiểu 2 ký tự).',
          'Please enter a class name (at least 2 characters).',
        ),
      );
      return;
    }
    const cleanCode = sanitizeClassCodeInput(newClassCode);
    if (!isValidClassCode5(cleanCode)) {
      setCreateClassError(
        tx(
          'Mã lớp phải gồm đúng 5 ký tự (3 chữ hoa A–Z và 2 số 0–9), VD: 4T9KA.',
          'Class code must be exactly 5 characters (3 uppercase letters A–Z and 2 digits 0–9), e.g. 4T9KA.',
        ),
      );
      return;
    }
    if (allClassCodesSet.has(cleanCode)) {
      setCreateClassError(
        tx(
          `Mã lớp "${cleanCode}" đã tồn tại. Vui lòng chọn mã khác.`,
          `Class code "${cleanCode}" already exists. Please choose another code.`,
        ),
      );
      return;
    }
    if (!newClassSubject.trim()) {
      setCreateClassError(
        tx(
          'Vui lòng tìm kiếm và chọn môn học cho lớp.',
          'Please search and select a subject for the class.',
        ),
      );
      return;
    }

    const created: TeacherPrivateClass = {
      id: `pclass_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      classCode: cleanCode,
      name: cleanName,
      subject: newClassSubject,
      grade: newClassGrade,
      description: newClassDesc.trim() || undefined,
      ownerTeacherId: currentUser.id,
      ownerTeacherName: currentUser.fullName,
      createdAt: new Date().toISOString(),
    };
    const result = onAddPrivateClass(created);
    if (result && !result.ok) {
      setCreateClassError(
        result.error ??
          tx(
            `Mỗi tài khoản giáo viên chỉ được tạo tối đa ${MAX_CLASSES_PER_TEACHER} lớp học.`,
            `Each teacher account can create up to ${MAX_CLASSES_PER_TEACHER} classes.`,
          ),
      );
      return;
    }
    setNewClassName('');
    setNewClassDesc('');
    setNewClassSubject('');
    setNewClassCode(suggestClassCode(newClassGrade, '', '', allClassCodesSet));
    setCreateClassError(null);
    setCreateClassOpen(false);
  };

  const handleMaterialFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = await readClassMaterialFile(file);
      setMatAttachmentName(parsed.name);
      setMatAttachmentMimeType(parsed.mimeType);
      setMatAttachmentSize(parsed.size);
      setMatAttachmentDataUrl(parsed.dataUrl);
      if (!matTitle.trim()) {
        setMatTitle(parsed.name.replace(/\.[^/.]+$/, ''));
      }
      if (parsed.textPreview && !matContent.trim()) {
        setMatContent(parsed.textPreview);
      }
      setMatError(null);
    } catch (err) {
      setMatError(
        err instanceof Error
          ? err.message
          : tx('Không thể đọc file tài liệu.', 'Failed to read material file.'),
      );
    }
  };

  const clearMaterialAttachment = () => {
    setMatAttachmentName(undefined);
    setMatAttachmentMimeType(undefined);
    setMatAttachmentSize(undefined);
    setMatAttachmentDataUrl(undefined);
  };

  const handleCreateMaterialSubmit = (e: React.FormEvent, targetClassId: string) => {
    e.preventDefault();
    if (!currentUser) {
      setMatError(
        tx(
          'Vui lòng đăng nhập tài khoản Giáo viên để gửi tài liệu.',
          'Please sign in with a Teacher account to post materials.',
        ),
      );
      return;
    }
    const targetCls = classMap.get(targetClassId);
    if (!targetCls) {
      setMatError(tx('Không tìm thấy lớp học nhận tài liệu.', 'Target class not found.'));
      return;
    }
    if (!canTeacherEditResource(targetCls, currentUser)) {
      setMatError(
        tx(
          'Bạn chỉ có quyền xem lớp học này nên không thể đăng tài liệu.',
          'You only have view access to this class and cannot post materials.',
        ),
      );
      return;
    }
    const effectiveTitle =
      matTitle.trim() ||
      (matAttachmentName ? matAttachmentName.replace(/\.[^/.]+$/, '') : '');
    if (!effectiveTitle) {
      setMatError(
        tx(
          'Vui lòng nhập tiêu đề hoặc chọn file tài liệu.',
          'Please enter a title or attach a material file.',
        ),
      );
      return;
    }
    const lines = matKeyPoints
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const attachmentNote = matAttachmentName
      ? `${tx('Tệp đính kèm', 'Attached file')}: ${matAttachmentName}${
          matAttachmentSize ? ` (${formatMaterialFileSize(matAttachmentSize)})` : ''
        }`
      : '';
    onAddClassMaterial({
      id: `cmat_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      classId: targetCls.id,
      title: effectiveTitle,
      subject: targetCls.subject ?? currentUser.subject ?? 'toan',
      grade: targetCls.grade,
      category: matCategory.trim() || tx('Tài liệu ôn tập', 'Study Material'),
      summary:
        matSummary.trim() ||
        (matAttachmentName
          ? tx(
              `Tài liệu đính kèm "${matAttachmentName}" do ${currentUser.fullName} gửi cho lớp ${targetCls.name}.`,
              `Attached file "${matAttachmentName}" posted by ${currentUser.fullName} for class ${targetCls.name}.`,
            )
          : tx(
              `Tài liệu do ${currentUser.fullName} gửi cho lớp ${targetCls.name}.`,
              `Material posted by ${currentUser.fullName} for class ${targetCls.name}.`,
            )),
      keyPoints: lines,
      contentText:
        matContent.trim() ||
        [
          effectiveTitle.toUpperCase(),
          `${tx('Giáo viên', 'Teacher')}: ${currentUser.fullName}`,
          `${tx('Lớp', 'Class')}: ${targetCls.name}`,
          attachmentNote,
          matSummary.trim(),
        ]
          .filter(Boolean)
          .join('\n'),
      attachmentName: matAttachmentName,
      attachmentMimeType: matAttachmentMimeType,
      attachmentSize: matAttachmentSize,
      attachmentDataUrl: matAttachmentDataUrl,
      ownerTeacherId: currentUser.id,
      ownerTeacherName: currentUser.fullName,
      createdAt: new Date().toISOString(),
    });
    setMatTitle('');
    setMatSummary('');
    setMatKeyPoints('');
    setMatContent('');
    clearMaterialAttachment();
    setMatError(null);
  };

  const handleAssignmentFileChange = async (
    kind: 'question' | 'answer',
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = await readClassMaterialFile(file);
      if (kind === 'question') {
        setAsgQuestionFile(parsed);
        if (!asgTitle.trim()) {
          setAsgTitle(parsed.name.replace(/\.[^/.]+$/, ''));
        }
      } else {
        setAsgAnswerFile(parsed);
      }
      setAsgError(null);
    } catch (err) {
      setAsgError(
        err instanceof Error
          ? err.message
          : tx('Không thể đọc file đính kèm.', 'Failed to read attached file.'),
      );
    }
  };

  const handleCreateAssignmentSubmit = (e: React.FormEvent, targetClassId: string) => {
    e.preventDefault();
    if (!currentUser) {
      setAsgError(
        tx(
          'Vui lòng đăng nhập tài khoản Giáo viên để giao bài tập.',
          'Please sign in with a Teacher account to create assignments.',
        ),
      );
      return;
    }
    const targetCls = classMap.get(targetClassId);
    if (!targetCls) {
      setAsgError(tx('Không tìm thấy lớp học nhận bài tập.', 'Target class not found.'));
      return;
    }
    if (!canTeacherEditResource(targetCls, currentUser)) {
      setAsgError(
        tx(
          'Bạn chỉ có quyền xem lớp học này nên không thể giao bài tập.',
          'You only have view access to this class and cannot assign tasks.',
        ),
      );
      return;
    }
    const normalizedCount =
      asgQuestions.length > 0
        ? Math.max(1, Math.min(asgQuestions.length, asgQuestionCount || asgQuestions.length))
        : undefined;
    const effectiveTitle =
      asgTitle.trim() ||
      (asgQuestionFile ? asgQuestionFile.name.replace(/\.[^/.]+$/, '') : '') ||
      (asgQuestions.length > 0
        ? tx(
            `Bài tập luyện tập (${normalizedCount} câu)`,
            `Practice Assignment (${normalizedCount} questions)`,
          )
        : '');
    if (!effectiveTitle) {
      setAsgError(
        tx(
          'Vui lòng nhập tiêu đề, soạn câu hỏi hoặc chọn file câu hỏi.',
          'Please enter a title, add questions, or attach a question file.',
        ),
      );
      return;
    }
    onAddClassAssignment({
      id: `casg_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      classId: targetCls.id,
      title: effectiveTitle,
      subject: targetCls.subject ?? currentUser.subject ?? 'toan',
      grade: targetCls.grade,
      description:
        asgDesc.trim() ||
        tx(
          `Hoàn thành bài tập ôn luyện cho lớp ${targetCls.name} trước thời hạn.`,
          `Complete the practice assignment for ${targetCls.name} before the deadline.`,
        ),
      dueDateLabel: asgDue.trim() || tx('Thứ 6 · 21:00', 'Fri · 21:00'),
      estimatedMinutes: Math.max(5, Number(asgMinutes) || 20),
      relatedRoomCode: asgRoomCode.trim().toUpperCase() || undefined,
      questions: asgQuestions.length > 0 ? asgQuestions : undefined,
      questionCount: normalizedCount,
      questionFile: asgQuestionFile,
      answerFile: asgAnswerFile,
      ownerTeacherId: currentUser.id,
      ownerTeacherName: currentUser.fullName,
      createdAt: new Date().toISOString(),
    });
    setAsgTitle('');
    setAsgDesc('');
    setAsgRoomCode('');
    setAsgQuestions([]);
    setAsgQuestionCount(0);
    setAsgQuestionFile(undefined);
    setAsgAnswerFile(undefined);
    setAsgError(null);
  };

  // ---------------------------------------------------------------------------
  // TEACHER CLASS ROOM WORKSPACE ("Trang lớp học" khi giáo viên bấm "Vào lớp học")
  // ---------------------------------------------------------------------------
  const activeClassObj = activeClassId ? classMap.get(activeClassId) ?? null : null;

  const syncEditFormFromActiveClass = (cls: TeacherPrivateClass) => {
    setEditClassName(cls.name);
    setEditClassCode(derivePrivateClassCode(cls));
    setEditClassSubject(cls.subject ?? 'toan');
    setEditClassGrade(cls.grade);
    setEditClassDesc(cls.description ?? '');
    setEditClassRequireApproval(cls.requireApproval !== false);
    setEditClassError(null);
  };

  useEffect(() => {
    if (!activeClassObj) {
      setEditClassModalOpen(false);
      return;
    }
    syncEditFormFromActiveClass(activeClassObj);
    setEditClassSavedNotice(false);
  }, [activeClassObj]);

  useEffect(() => {
    if (editClassModalRequest > lastHandledEditReqRef.current) {
      lastHandledEditReqRef.current = editClassModalRequest;
      if (activeClassObj) {
        syncEditFormFromActiveClass(activeClassObj);
        setEditClassModalOpen(true);
      }
    }
  }, [editClassModalRequest, activeClassObj]);

  useEffect(() => {
    if (!editClassModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setEditClassModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [editClassModalOpen]);

  const handleOpenEditClassModal = () => {
    if (!activeClassObj) return;
    syncEditFormFromActiveClass(activeClassObj);
    setEditClassModalOpen(true);
  };

  const handleSaveClassInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClassObj || !onUpdatePrivateClass) return;
    if (!canTeacherEditResource(activeClassObj, currentUser)) {
      setEditClassError(
        tx(
          'Bạn chỉ có quyền xem lớp học này nên không thể chỉnh sửa thông tin lớp.',
          'You only have view access to this class and cannot edit class details.',
        ),
      );
      return;
    }
    const cleanName = editClassName.trim();
    if (cleanName.length < 2) {
      setEditClassError(
        tx(
          'Vui lòng nhập tên lớp học (tối thiểu 2 ký tự).',
          'Please enter a class name (at least 2 characters).',
        ),
      );
      return;
    }
    const originalCode = derivePrivateClassCode(activeClassObj);
    const isCodeModified = editClassCode.trim().toUpperCase() !== originalCode;
    const cleanCode = isCodeModified
      ? sanitizeClassCodeInput(editClassCode)
      : originalCode;
    if (isCodeModified && !isValidClassCode5(cleanCode)) {
      setEditClassError(
        tx(
          'Mã lớp phải gồm đúng 5 ký tự (3 chữ hoa A–Z và 2 số 0–9), VD: 4T9KA.',
          'Class code must be exactly 5 characters (3 uppercase letters A–Z and 2 digits 0–9), e.g. 4T9KA.',
        ),
      );
      return;
    }
    const duplicateCode = allPrivateClasses.some(
      (pc) => pc.id !== activeClassObj.id && derivePrivateClassCode(pc) === cleanCode,
    );
    if (duplicateCode) {
      setEditClassError(
        tx(
          `Mã lớp "${cleanCode}" đã tồn tại ở một lớp khác. Vui lòng chọn mã khác.`,
          `Class code "${cleanCode}" is already used by another class. Please choose another.`,
        ),
      );
      return;
    }
    if (!editClassSubject.trim()) {
      setEditClassError(
        tx(
          'Vui lòng tìm kiếm và chọn môn học cho lớp.',
          'Please search and select a subject for the class.',
        ),
      );
      return;
    }

    onUpdatePrivateClass({
      ...activeClassObj,
      name: cleanName,
      classCode: cleanCode,
      subject: editClassSubject,
      grade: editClassGrade,
      description: editClassDesc.trim() || undefined,
      requireApproval: editClassRequireApproval,
    });
    setEditClassCode(cleanCode);
    setEditClassError(null);
    setEditClassModalOpen(false);
    setEditClassSavedNotice(true);
    window.setTimeout(() => {
      setEditClassSavedNotice(false);
    }, 3500);
  };

  const activeClassPendingRequests = useMemo(() => {
    if (!activeClassObj) return [];
    return classJoinRequests.filter(
      (r) => r.classId === activeClassObj.id && r.status === 'pending',
    );
  }, [activeClassObj, classJoinRequests]);

  const activeClassApprovedStudents = useMemo(() => {
    if (!activeClassObj) return [];
    return classJoinRequests.filter(
      (r) => r.classId === activeClassObj.id && r.status === 'approved',
    );
  }, [activeClassObj, classJoinRequests]);

  const activeClassExams = useMemo(() => {
    if (!activeClassObj) return [];
    return exams.filter((ex) => ex.privateClassId === activeClassObj.id);
  }, [activeClassObj, exams]);

  const activeClassMaterials = useMemo(() => {
    if (!activeClassObj) return [];
    return classMaterials.filter((m) => m.classId === activeClassObj.id);
  }, [activeClassObj, classMaterials]);

  const activeClassAssignments = useMemo(() => {
    if (!activeClassObj) return [];
    return classAssignments.filter((a) => a.classId === activeClassObj.id);
  }, [activeClassObj, classAssignments]);

  const activeClassSchedules = useMemo(() => {
    if (!activeClassObj) return [];
    return classSchedules.filter((s) => s.classId === activeClassObj.id);
  }, [activeClassObj, classSchedules]);

  const activeClassSubmissions = useMemo(() => {
    if (!activeClassObj) return [];
    const examIds = new Set(activeClassExams.map((ex) => ex.id));
    const roomCodes = new Set([
      ...activeClassExams.map((ex) => ex.roomCode.trim().toUpperCase()),
      ...activeClassAssignments
        .map((a) => (a.relatedRoomCode ?? '').trim().toUpperCase())
        .filter(Boolean),
    ]);
    const approvedStudentIds = new Set(
      activeClassApprovedStudents.map((s) => s.studentUserId),
    );
    return submissions.filter((sub) => {
      if (examIds.has(sub.examId)) return true;
      if (roomCodes.has(sub.roomCode.trim().toUpperCase())) return true;
      if (
        sub.submittedByUserId &&
        approvedStudentIds.has(sub.submittedByUserId) &&
        (!activeClassObj.subject || sub.subject === activeClassObj.subject)
      ) {
        return true;
      }
      return false;
    });
  }, [
    activeClassApprovedStudents,
    activeClassAssignments,
    activeClassExams,
    activeClassObj,
    submissions,
  ]);

  const activeClassScoreStats = useMemo(() => {
    if (activeClassSubmissions.length === 0) return { count: 0, avg: 0, best: 0 };
    const sum = activeClassSubmissions.reduce((acc, s) => acc + s.totalScore, 0);
    const best = Math.max(...activeClassSubmissions.map((s) => s.totalScore));
    return {
      count: activeClassSubmissions.length,
      avg: sum / activeClassSubmissions.length,
      best,
    };
  }, [activeClassSubmissions]);

  const handleSaveShareGrants = (nextSharedWith: ResourceShareGrant[]) => {
    if (!shareModalTarget) return;
    if (shareModalTarget.kind === 'class') {
      onUpdatePrivateClass?.({
        ...shareModalTarget.item,
        sharedWith: nextSharedWith,
      });
    } else if (shareModalTarget.kind === 'material') {
      onUpdateClassMaterial?.({
        ...shareModalTarget.item,
        sharedWith: nextSharedWith,
      });
    } else if (shareModalTarget.kind === 'assignment') {
      onUpdateClassAssignment?.({
        ...shareModalTarget.item,
        sharedWith: nextSharedWith,
      });
    }
  };

  const handleStopShareClass = (pc: TeacherPrivateClass, mode: 'self' | 'all') => {
    if (!onUpdatePrivateClass) return;
    if (mode === 'all') {
      onUpdatePrivateClass({
        ...pc,
        sharedWith: [],
      });
    } else if (currentUser) {
      onUpdatePrivateClass({
        ...pc,
        sharedWith: (pc.sharedWith ?? []).filter((g) => g.teacherId !== currentUser.id),
      });
      if (activeClassId === pc.id) {
        setActiveClassId(null);
        setClassRoomTab(null);
      }
    }
    setConfirmStopShareClassId(null);
  };

  const shareModalNode = (
    <ResourceShareModal
      open={Boolean(shareModalTarget)}
      onClose={() => setShareModalTarget(null)}
      resourceTypeLabel={
        shareModalTarget?.kind === 'class'
          ? tx('lớp học', 'class')
          : shareModalTarget?.kind === 'material'
            ? tx('tài liệu', 'material')
            : tx('bài tập', 'assignment')
      }
      resourceTitle={
        shareModalTarget
          ? shareModalTarget.kind === 'class'
            ? shareModalTarget.item.name
            : shareModalTarget.item.title
          : ''
      }
      ownerTeacherId={shareModalTarget?.item.ownerTeacherId}
      ownerTeacherName={shareModalTarget?.item.ownerTeacherName}
      sharedWith={shareModalTarget?.item.sharedWith}
      currentUser={currentUser}
      onSaveShares={handleSaveShareGrants}
    />
  );

  if (activeClassObj) {
    const classCode = derivePrivateClassCode(activeClassObj);
    const subjectMeta = getSubjectMeta(activeClassObj.subject ?? 'toan');
    const subjectName = localizeSubjectName(subjectMeta.id, subjectMeta.name, language);
    const canEditActiveClass = canTeacherEditResource(activeClassObj, currentUser);
    const canShareActiveClass = canManageResourceSharing(activeClassObj, currentUser);
    const activeClassSharePerm = getTeacherSharePermission(activeClassObj, currentUser);
    const activeClassShareCount = activeClassObj.sharedWith?.length ?? 0;
    const approvalEnabled = activeClassObj.requireApproval !== false;
    const isOverviewMode = classRoomTab === 'overview';
    const allOverviewCollapsed = OVERVIEW_SECTION_KEYS.every(
      (key) => collapsedOverviewSections[key],
    );
    const isExamsCollapsed = isOverviewMode && collapsedOverviewSections.exams;
    const isMaterialsCollapsed = isOverviewMode && collapsedOverviewSections.materials;
    const isAssignmentsCollapsed =
      isOverviewMode && collapsedOverviewSections.assignments;
    const isScoresCollapsed = isOverviewMode && collapsedOverviewSections.scores;
    const isScheduleCollapsed = isOverviewMode && collapsedOverviewSections.schedule;

    const toggleOverviewSection = (key: OverviewSectionKey) => {
      setCollapsedOverviewSections((prev) => ({
        ...prev,
        [key]: !prev[key],
      }));
    };

    const toggleAllOverviewSections = () => {
      const nextVal = !allOverviewCollapsed;
      setCollapsedOverviewSections({
        exams: nextVal,
        materials: nextVal,
        assignments: nextVal,
        scores: nextVal,
        schedule: nextVal,
      });
    };

    const renderOverviewCollapseButton = (
      key: OverviewSectionKey,
      sectionLabel: string,
    ) => {
      if (!isOverviewMode) return null;
      const isCollapsed = collapsedOverviewSections[key];
      return (
        <button
          type="button"
          onClick={() => toggleOverviewSection(key)}
          aria-expanded={!isCollapsed}
          aria-label={
            isCollapsed
              ? tx(`Mở rộng mục ${sectionLabel}`, `Expand ${sectionLabel}`)
              : tx(`Thu nhỏ mục ${sectionLabel}`, `Collapse ${sectionLabel}`)
          }
          className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-300 ease-out ${
              isCollapsed ? 'rotate-0' : 'rotate-180'
            }`}
          />
          <span>{isCollapsed ? tx('Mở rộng', 'Expand') : tx('Thu nhỏ', 'Collapse')}</span>
        </button>
      );
    };

    return (
      <div className="space-y-6">
        {/* Top Classroom Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setActiveClassId(null);
                setClassRoomTab(null);
              }}
              className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{tx('Quay lại Lớp học', 'Back to Classes')}</span>
            </button>
            <nav
              aria-label={tx('Vị trí lớp học', 'Class breadcrumb')}
              className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"
            >
              <span>{tx('Trang chủ', 'Home')}</span>
              <span aria-hidden="true">/</span>
              <span>{tx('Lớp học', 'Classes')}</span>
              <span aria-hidden="true">/</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {activeClassObj.name}
              </span>
            </nav>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEditActiveClass && onUpdatePrivateClass && (
              <button
                type="button"
                onClick={handleOpenEditClassModal}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>{tx('Chỉnh sửa thông tin lớp', 'Edit Class Info')}</span>
              </button>
            )}
            {canShareActiveClass && onUpdatePrivateClass && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setShareModalTarget({ kind: 'class', item: activeClassObj })
                  }
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-blue-200 bg-white px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-900/60 dark:bg-slate-800 dark:text-blue-300 dark:hover:bg-slate-700"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>
                    {tx('Chia sẻ lớp', 'Share Class')}
                    {activeClassShareCount > 0 ? ` (${activeClassShareCount})` : ''}
                  </span>
                </button>
                {activeClassShareCount > 0 &&
                  (confirmStopShareClassId === activeClassObj.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleStopShareClass(activeClassObj, 'all')}
                        className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                      >
                        {tx('Xác nhận dừng chia sẻ', 'Confirm Stop Sharing')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmStopShareClassId(null)}
                        className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {tx('Hủy', 'Cancel')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmStopShareClassId(activeClassObj.id)}
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      <span>{tx('Dừng chia sẻ', 'Stop Sharing')}</span>
                    </button>
                  ))}
              </>
            )}

            {!isResourceOwner(activeClassObj, currentUser) &&
              !isAdminUser(currentUser) &&
              activeClassSharePerm &&
              onUpdatePrivateClass &&
              (confirmStopShareClassId === activeClassObj.id ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleStopShareClass(activeClassObj, 'self')}
                    className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    {tx('Xác nhận dừng chia sẻ', 'Confirm Leave Share')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmStopShareClassId(null)}
                    className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {tx('Hủy', 'Cancel')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmStopShareClassId(activeClassObj.id)}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  <UserX className="h-3.5 w-3.5" />
                  <span>{tx('Dừng chia sẻ', 'Leave Share')}</span>
                </button>
              ))}

            <button
              type="button"
              onClick={() => handleCopyCode(activeClassObj.id, classCode)}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-blue-200 bg-blue-50/70 px-3.5 py-2 font-mono text-xs font-bold text-blue-700 hover:bg-blue-100 tabular-nums dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>
                {copiedClassId === activeClassObj.id
                  ? tx(`Đã sao chép: ${classCode}`, `Copied: ${classCode}`)
                  : tx(`Sao chép mã lớp: ${classCode}`, `Copy code: ${classCode}`)}
              </span>
            </button>
          </div>
        </div>

        {/* Class Information Panel */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold tracking-wide text-[#0057FF] uppercase dark:text-[#22D3EE]">
                  {tx('Thông tin lớp học', 'Class Information')}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {subjectName}
                </span>
                <span aria-hidden="true">·</span>
                <span>{localizeGradeText(formatGradeLabel(activeClassObj.grade), language)}</span>
                <span aria-hidden="true">·</span>
                {isResourceOwner(activeClassObj, currentUser) || isAdminUser(currentUser) ? (
                  <span className="inline-flex items-center gap-1 font-medium text-slate-500 dark:text-slate-400">
                    {activeClassShareCount > 0 ? (
                      <>
                        <Share2 className="h-3 w-3 text-[#0057FF] dark:text-[#22D3EE]" />
                        <span className="text-[#0057FF] dark:text-[#22D3EE]">
                          {tx(
                            `Đã chia sẻ (${activeClassShareCount} GV)`,
                            `Shared (${activeClassShareCount} teachers)`,
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
                ) : activeClassSharePerm ? (
                  <span className="inline-flex items-center gap-1 font-medium text-cyan-700 dark:text-cyan-300">
                    <Share2 className="h-3 w-3" />
                    <span>
                      {tx('Chia sẻ bởi', 'Shared by')} {activeClassObj.ownerTeacherName} (
                      {activeClassSharePerm === 'edit'
                        ? tx('Được sửa', 'Can edit')
                        : tx('Chỉ xem', 'View only')}
                      )
                    </span>
                  </span>
                ) : null}
              </div>

              <span className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                {tx('Tạo ngày', 'Created')}{' '}
                {new Date(activeClassObj.createdAt).toLocaleDateString(
                  language === 'en' ? 'en-US' : 'vi-VN',
                )}
              </span>
            </div>

            <h1 className="mt-2.5 font-display text-2xl font-bold tracking-tight text-[#061844] dark:text-slate-50">
              {activeClassObj.name}
            </h1>

            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {activeClassObj.description?.trim() ||
                tx(
                  'Không gian lớp học trực tuyến để quản lý thành viên, giao bài tập, tổ chức bài thi, theo dõi kết quả thi và cập nhật lịch học.',
                  'Online classroom workspace to manage members, assign tasks, host exams, track scores, and update schedules.',
                )}
            </p>

            {/* Structured Class Metadata Grid (single-elevation hairline grid) */}
            <dl className="mt-5 grid grid-cols-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-slate-50/50 sm:grid-cols-4 sm:divide-x sm:divide-y-0 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="px-4 py-3">
                <dt className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                  {tx('Mã tham gia lớp', 'Join Code')}
                </dt>
                <dd className="mt-1 font-mono text-base font-bold text-[#0057FF] tabular-nums dark:text-[#22D3EE]">
                  {classCode}
                </dd>
              </div>
              <div className="px-4 py-3">
                <dt className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                  {tx('Giáo viên phụ trách', 'Homeroom Teacher')}
                </dt>
                <dd className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {activeClassObj.ownerTeacherName || currentUser?.fullName || tx('Giáo viên', 'Teacher')}
                </dd>
              </div>
              <div className="px-4 py-3">
                <dt className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                  {tx('Môn · Khối / Bậc học', 'Subject · Grade')}
                </dt>
                <dd className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {subjectName} · {localizeGradeText(formatGradeLabel(activeClassObj.grade), language)}
                </dd>
              </div>
              <div className="px-4 py-3">
                <dt className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                  {tx('Sĩ số lớp', 'Class Size')}
                </dt>
                <dd className="mt-1 font-mono text-sm font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                  {activeClassApprovedStudents.length} {tx('thành viên', 'members')}
                  {activeClassPendingRequests.length > 0 && (
                    <span className="ml-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      ({activeClassPendingRequests.length} {tx('chờ', 'pending')})
                    </span>
                  )}
                </dd>
              </div>
            </dl>

            {editClassSavedNotice && (
              <div
                role="status"
                className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3.5 py-2 text-xs font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
              >
                <Check className="h-4 w-4 shrink-0" />
                <span>
                  {tx('Đã cập nhật thông tin lớp học thành công.', 'Class details updated successfully.')}
                </span>
              </div>
            )}

            {!canEditActiveClass && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50/70 px-3.5 py-2 text-xs text-cyan-900 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-200">
                <Eye className="h-4 w-4 shrink-0" />
                <span>
                  {tx('Lớp học được chia sẻ ở chế độ ', 'This class is shared in ')}
                  <strong>{tx('Chỉ xem', 'View Only')}</strong>
                  {tx(
                    '. Bạn có thể xem học sinh, đề thi, tài liệu và bảng điểm nhưng không thể thêm, sửa hoặc xóa nội dung.',
                    ' mode. You can view students, exams, materials, and scores, but cannot add, edit, or delete content.',
                  )}
                </span>
              </div>
            )}
          </div>
        </section>

        {classRoomTab === null && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-8 text-center dark:border-slate-700 dark:bg-slate-900/40">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {tx(
                'Chọn một mục trên thanh menu để hiển thị nội dung lớp học',
                'Select an item in the menu to view class content',
              )}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {tx('Hãy nhấn vào ', 'Click ')}
              <strong className="font-semibold text-slate-700 dark:text-slate-300">
                {tx('Thành viên', 'Members')}
              </strong>
              ,{' '}
              <strong className="font-semibold text-slate-700 dark:text-slate-300">
                {tx('Bài tập', 'Assignments')}
              </strong>
              ,{' '}
              <strong className="font-semibold text-slate-700 dark:text-slate-300">
                {tx('Bài thi', 'Exams')}
              </strong>
              ,{' '}
              <strong className="font-semibold text-slate-700 dark:text-slate-300">
                {tx('Kết quả thi', 'Results')}
              </strong>{' '}
              {tx('hoặc', 'or')}{' '}
              <strong className="font-semibold text-slate-700 dark:text-slate-300">
                {tx('Lịch học', 'Schedule')}
              </strong>
              {tx(
                ' trên thanh menu bên phải để xem chi tiết bên dưới.',
                ' on the right menu to view details below.',
              )}
            </p>
          </div>
        )}

        {/* Tab 1: Students */}
        {classRoomTab === 'students' && (
          <div className="space-y-5">
            {activeClassPendingRequests.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {tx(
                      `Yêu cầu học sinh xin vào lớp chờ bạn duyệt (${activeClassPendingRequests.length})`,
                      `Student join requests awaiting your approval (${activeClassPendingRequests.length})`,
                    )}
                  </p>
                  <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
                    {tx('Học sinh đã nhập đúng mã lớp', 'Student entered valid class code')}
                  </span>
                </div>

                <div className="mt-3 divide-y divide-amber-200/70 rounded-xl border border-amber-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                  {activeClassPendingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-3.5 text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100">
                          {req.studentName}{' '}
                          {req.studentClass ? (
                            <span className="font-normal text-slate-500 dark:text-slate-400">
                              · {tx('Lớp', 'Class')} {req.studentClass}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                          {tx('Xin vào:', 'Requesting:')}{' '}
                          <strong className="text-slate-900 dark:text-slate-100">
                            {activeClassObj.name}
                          </strong>{' '}
                          <span className="font-mono text-blue-700 dark:text-blue-400">
                            ({req.classCode})
                          </span>
                          {req.studentSbd ? ` · ${tx('SBD', 'ID')} ${req.studentSbd}` : ''}
                        </p>
                      </div>
                      {canEditActiveClass && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onReviewJoinRequest(req.id, 'approved')}
                            className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            <span>{tx('Duyệt', 'Approve')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onReviewJoinRequest(req.id, 'rejected')}
                            className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
                          >
                            <UserX className="h-3.5 w-3.5" />
                            <span>{tx('Từ chối', 'Reject')}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                {tx(
                  `Danh sách học sinh đã duyệt (${activeClassApprovedStudents.length})`,
                  `Approved Students (${activeClassApprovedStudents.length})`,
                )}
              </h2>

              {activeClassApprovedStudents.length === 0 ? (
                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                  {tx(
                    'Chưa có học sinh nào được duyệt vào lớp này. Hãy chia sẻ mã lớp ',
                    'No students approved in this class yet. Share class code ',
                  )}
                  <strong className="font-mono text-blue-700 dark:text-blue-400">
                    {classCode}
                  </strong>
                  {tx(' cho học sinh của bạn.', ' with your students.')}
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                        <th className="px-4 py-2.5">{tx('Học sinh', 'Student')}</th>
                        <th className="px-4 py-2.5">{tx('SBD / Lớp', 'ID / Class')}</th>
                        <th className="px-4 py-2.5">Email</th>
                        {canEditActiveClass && (
                          <th className="px-4 py-2.5 text-right">{tx('Thao tác', 'Actions')}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {activeClassApprovedStudents.map((stu) => (
                        <tr key={stu.id}>
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                            {stu.studentName}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">
                            {/^(HV|GV|AD)\d{4}$/.test(stu.studentUserId) ? `ID ${stu.studentUserId} · ` : ''}
                            {stu.studentSbd ?? '—'} {stu.studentClass ? `· ${stu.studentClass}` : ''}
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                            {stu.studentEmail ?? '—'}
                          </td>
                          {canEditActiveClass && (
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  onRemoveClassMember(activeClassObj.id, stu.studentUserId)
                                }
                                className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
                              >
                                <Trash2 className="h-3 w-3" />
                                <span>{tx('Mời rời lớp', 'Remove')}</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {isOverviewMode && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold tracking-wide text-slate-700 uppercase dark:text-slate-200">
                {tx('Tổng quan lớp học', 'Class Overview')}
              </span>
              <span aria-hidden="true" className="text-slate-400 dark:text-slate-500">
                ·
              </span>
              <span className="text-slate-500 tabular-nums dark:text-slate-400">
                {OVERVIEW_SECTION_KEYS.filter((k) => !collapsedOverviewSections[k]).length}/
                {OVERVIEW_SECTION_KEYS.length}{' '}
                {tx('mục đang mở', 'sections expanded')}
              </span>
            </div>
            <button
              type="button"
              onClick={toggleAllOverviewSections}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-300 ease-out ${
                  allOverviewCollapsed ? 'rotate-0' : 'rotate-180'
                }`}
              />
              <span>
                {allOverviewCollapsed
                  ? tx('Mở rộng tất cả', 'Expand all')
                  : tx('Thu nhỏ tất cả', 'Collapse all')}
              </span>
            </button>
          </div>
        )}

        {/* Tab 2: Exams */}
        {(classRoomTab === 'exams' || classRoomTab === 'overview') && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                    {tx('Bài thi', 'Exams')}
                  </h2>
                  {isExamsCollapsed && (
                    <span className="text-xs font-medium text-slate-500 tabular-nums dark:text-slate-400">
                      ({activeClassExams.length})
                    </span>
                  )}
                </div>
                {!isExamsCollapsed && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {tx(
                      'Tạo hoặc gán đề thi vào lớp trong Tổ chức đề thi để học sinh được duyệt làm bài.',
                      'Create or assign exams to this class in Manage Exams so approved students can take them.',
                    )}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!isExamsCollapsed && canEditActiveClass && (
                  <button
                    type="button"
                    onClick={() => onNavigate('exam_manager')}
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{tx('Tổ chức đề thi', 'Manage Exams')}</span>
                  </button>
                )}
                {renderOverviewCollapseButton('exams', tx('Bài thi', 'Exams'))}
              </div>
            </div>

            <div
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                isExamsCollapsed
                  ? 'pointer-events-none grid-rows-[0fr] opacity-0'
                  : 'grid-rows-[1fr] opacity-100'
              }`}
              aria-hidden={isExamsCollapsed}
              inert={isExamsCollapsed}
            >
              <div className="min-h-0 overflow-hidden">
                {activeClassExams.length === 0 ? (
                  <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {tx(
                    'Chưa có bài thi nào được gắn vào lớp học này.',
                    'No exams assigned to this class yet.',
                  )}
                </p>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                {activeClassExams.map((exam) => {
                  const totalQ =
                    exam.part1QuestionIds.length +
                    exam.part2QuestionIds.length +
                    exam.part3QuestionIds.length;
                  const maxRaw = calculateExamMaxRawScore(exam);
                  const subCount = submissions.filter((s) => s.examId === exam.id).length;
                  return (
                    <article
                      key={exam.id}
                      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/40"
                    >
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>{localizeExamCategory(exam.category, language)}</span>
                          <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                            {tx('Mã phòng', 'Room code')}: {exam.roomCode}
                          </span>
                        </div>
                        <h3 className="mt-2 font-display text-base font-bold text-slate-900 dark:text-slate-50">
                          {exam.title}
                        </h3>
                        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {getExamDurationMinutes(exam)} {tx('phút', 'min')}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {totalQ} {tx('câu', 'questions')} ({formatScoreVi(maxRaw)}{' '}
                            {tx('điểm', 'pts')})
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {subCount} {tx('bài nộp', 'submissions')}
                          </span>
                        </p>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenPrintableExam(exam)}
                            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            <span>{tx('Đề A4', 'Print A4')}</span>
                          </button>
                          {canTeacherEditResource(
                            exam,
                            currentUser,
                            editableClassIds,
                            exam.privateClassId,
                          ) && (
                            <button
                              type="button"
                              onClick={() => onNavigate('exam_manager')}
                              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                              <Settings className="h-3.5 w-3.5" />
                              <span>{tx('Cấu hình', 'Configure')}</span>
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelectExamToStart(exam)}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                        >
                          <span>{tx('Thi thử', 'Preview Exam')}</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
              </div>
            </div>
          </section>
        )}

        {/* Tab 3: Materials */}
        {(classRoomTab === 'materials' || classRoomTab === 'overview') && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                  {tx('Tài liệu', 'Materials')}
                </h2>
                {isMaterialsCollapsed && (
                  <span className="text-xs font-medium text-slate-500 tabular-nums dark:text-slate-400">
                    ({activeClassMaterials.length})
                  </span>
                )}
              </div>
              {renderOverviewCollapseButton('materials', tx('Tài liệu', 'Materials'))}
            </div>
            <div
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                isMaterialsCollapsed
                  ? 'pointer-events-none grid-rows-[0fr] opacity-0'
                  : 'grid-rows-[1fr] opacity-100'
              }`}
              aria-hidden={isMaterialsCollapsed}
              inert={isMaterialsCollapsed}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="space-y-5 pt-5">
                {canEditActiveClass && (
              <form
                onSubmit={(e) => handleCreateMaterialSubmit(e, activeClassObj.id)}
                className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    + {tx('Gửi tài liệu mới vào lớp', 'Add new study material to class')}
                  </p>
                  <input
                    ref={matFileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.zip,.rar"
                    onChange={handleMaterialFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => matFileInputRef.current?.click()}
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Upload className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    <span>{tx('Thêm file tài liệu', 'Attach material file')}</span>
                  </button>
                </div>

                {matAttachmentName && (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs dark:border-blue-900/60 dark:bg-blue-950/35">
                    <div className="flex min-w-0 items-center gap-2 text-blue-800 dark:text-blue-200">
                      <Paperclip className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate font-semibold">{matAttachmentName}</span>
                      {matAttachmentSize && (
                        <span className="shrink-0 font-mono text-[11px] text-blue-600 tabular-nums dark:text-blue-300">
                          · {formatMaterialFileSize(matAttachmentSize)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={clearMaterialAttachment}
                      aria-label={tx('Gỡ file đính kèm', 'Remove attached file')}
                      className="cursor-pointer rounded p-1 text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900/60"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    value={matTitle}
                    onChange={(e) => {
                      setMatTitle(e.target.value);
                      if (matError) setMatError(null);
                    }}
                    placeholder={tx('Tiêu đề tài liệu...', 'Material title...')}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    value={matCategory}
                    onChange={(e) => setMatCategory(e.target.value)}
                    placeholder={tx(
                      'Phân loại (VD: Tài liệu ôn tập)',
                      'Category (e.g., Study Guide)',
                    )}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <textarea
                  rows={2}
                  value={matSummary}
                  onChange={(e) => setMatSummary(e.target.value)}
                  placeholder={tx('Tóm tắt nội dung chính...', 'Brief summary...')}
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <textarea
                  rows={3}
                  value={matContent}
                  onChange={(e) => setMatContent(e.target.value)}
                  placeholder={tx(
                    'Nội dung chi tiết / ghi chú (hoặc chọn file PDF, Word, Excel, PowerPoint, .txt ở nút Thêm file tài liệu)...',
                    'Full content / notes (or attach PDF, Word, Excel, PowerPoint, .txt via Attach material file)...',
                  )}
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                {matError && (
                  <p className="text-xs font-medium text-red-600 dark:text-red-400">
                    {matError}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {tx(
                      'Hỗ trợ PDF, DOCX, PPTX, XLSX, TXT, ảnh, ZIP (tối đa 2.5 MB).',
                      'Supports PDF, DOCX, PPTX, XLSX, TXT, images, ZIP (max 2.5 MB).',
                    )}
                  </span>
                  <button
                    type="submit"
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{tx('Đăng tài liệu vào lớp', 'Publish material')}</span>
                  </button>
                </div>
              </form>
            )}

            {activeClassMaterials.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tx(
                  'Chưa có tài liệu nào trong lớp học này.',
                  'No study materials in this class yet.',
                )}
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeClassMaterials.map((mat) => {
                  const canShareMat = canManageResourceSharing(mat, currentUser);
                  const canDeleteMat = canTeacherEditResource(
                    mat,
                    currentUser,
                    editableClassIds,
                    mat.classId,
                  );
                  const matShareCount = mat.sharedWith?.length ?? 0;
                  return (
                    <div key={mat.id} className="py-4 first:pt-1 last:pb-1">
                      <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>{mat.category}</span>
                        {(isResourceOwner(mat, currentUser) || isAdminUser(currentUser)) && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-[11px]">
                              {matShareCount > 0 ? (
                                <>
                                  <Share2 className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                  <span className="text-blue-700 dark:text-blue-300">
                                    {tx('Đã chia sẻ', 'Shared')} ({matShareCount}{' '}
                                    {tx('GV', 'teachers')})
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Lock className="h-3 w-3" />
                                  <span>{tx('Riêng tư', 'Private')}</span>
                                </>
                              )}
                            </span>
                          </>
                        )}
                      </p>
                      <h3 className="mt-1 font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                        {mat.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        {mat.summary}
                      </p>
                      {mat.attachmentName && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <Paperclip className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                          <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                            {mat.attachmentName}
                          </span>
                          {mat.attachmentSize && (
                            <span className="shrink-0 font-mono text-[11px] tabular-nums">
                              · {formatMaterialFileSize(mat.attachmentSize)}
                            </span>
                          )}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveMaterial(mat)}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          <span>{tx('Xem nội dung', 'View content')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadClassMaterialTxt(mat)}
                          title={mat.attachmentName}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>
                            {mat.attachmentDataUrl && mat.attachmentName
                              ? tx(
                                  `Tải file (${getMaterialFileExtension(mat.attachmentName) || 'tệp'})`,
                                  `Download (${getMaterialFileExtension(mat.attachmentName) || 'file'})`,
                                )
                              : tx('Tải .txt', 'Download .txt')}
                          </span>
                        </button>
                        {canShareMat && onUpdateClassMaterial && (
                          <button
                            type="button"
                            onClick={() =>
                              setShareModalTarget({ kind: 'material', item: mat })
                            }
                            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            <span>{tx('Chia sẻ', 'Share')}</span>
                          </button>
                        )}
                        {canDeleteMat && (
                          <button
                            type="button"
                            onClick={() => onDeleteClassMaterial(mat.id)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>{tx('Xóa', 'Delete')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Tab 4: Assignments */}
        {(classRoomTab === 'assignments' || classRoomTab === 'overview') && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                  {tx('Bài tập', 'Assignments')}
                </h2>
                {isAssignmentsCollapsed && (
                  <span className="text-xs font-medium text-slate-500 tabular-nums dark:text-slate-400">
                    ({activeClassAssignments.length})
                  </span>
                )}
              </div>
              {renderOverviewCollapseButton('assignments', tx('Bài tập', 'Assignments'))}
            </div>
            <div
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                isAssignmentsCollapsed
                  ? 'pointer-events-none grid-rows-[0fr] opacity-0'
                  : 'grid-rows-[1fr] opacity-100'
              }`}
              aria-hidden={isAssignmentsCollapsed}
              inert={isAssignmentsCollapsed}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="space-y-5 pt-5">
                {canEditActiveClass && (
              <form
                onSubmit={(e) => handleCreateAssignmentSubmit(e, activeClassObj.id)}
                className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    + {tx('Giao bài tập mới cho lớp', 'Assign new task to class')}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={asgQuestionInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.zip,.rar"
                      onChange={(e) => handleAssignmentFileChange('question', e)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => asgQuestionInputRef.current?.click()}
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Upload className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span>{tx('Thêm file câu hỏi', 'Attach question file')}</span>
                    </button>

                    <input
                      ref={asgAnswerInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.zip,.rar"
                      onChange={(e) => handleAssignmentFileChange('answer', e)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => asgAnswerInputRef.current?.click()}
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Upload className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{tx('Thêm file đáp án', 'Attach answer file')}</span>
                    </button>
                  </div>
                </div>

                {(asgQuestionFile || asgAnswerFile) && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {asgQuestionFile && (
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs dark:border-blue-900/60 dark:bg-blue-950/35">
                        <div className="flex min-w-0 items-center gap-2 text-blue-800 dark:text-blue-200">
                          <Paperclip className="h-3.5 w-3.5 shrink-0" />
                          <span className="shrink-0 font-semibold">
                            {tx('Câu hỏi:', 'Questions:')}
                          </span>
                          <span className="truncate">{asgQuestionFile.name}</span>
                          {asgQuestionFile.size > 0 && (
                            <span className="shrink-0 font-mono text-[11px] tabular-nums">
                              · {formatMaterialFileSize(asgQuestionFile.size)}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setAsgQuestionFile(undefined)}
                          aria-label={tx('Gỡ file câu hỏi', 'Remove question file')}
                          className="cursor-pointer rounded p-1 text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900/60"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    {asgAnswerFile && (
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/35">
                        <div className="flex min-w-0 items-center gap-2 text-emerald-800 dark:text-emerald-200">
                          <Check className="h-3.5 w-3.5 shrink-0" />
                          <span className="shrink-0 font-semibold">
                            {tx('Đáp án:', 'Answers:')}
                          </span>
                          <span className="truncate">{asgAnswerFile.name}</span>
                          {asgAnswerFile.size > 0 && (
                            <span className="shrink-0 font-mono text-[11px] tabular-nums">
                              · {formatMaterialFileSize(asgAnswerFile.size)}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setAsgAnswerFile(undefined)}
                          aria-label={tx('Gỡ file đáp án', 'Remove answer file')}
                          className="cursor-pointer rounded p-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <input
                    type="text"
                    value={asgTitle}
                    onChange={(e) => {
                      setAsgTitle(e.target.value);
                      if (asgError) setAsgError(null);
                    }}
                    placeholder={tx('Tên bài tập...', 'Assignment title...')}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 sm:col-span-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    value={asgDue}
                    onChange={(e) => setAsgDue(e.target.value)}
                    placeholder={tx('Hạn nộp (VD: Thứ 6 · 21:00)', 'Due date (e.g., Fri · 21:00)')}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={asgMinutes}
                    onChange={(e) => setAsgMinutes(Number(e.target.value))}
                    placeholder={tx('Số phút dự kiến', 'Estimated minutes')}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <textarea
                  rows={2}
                  value={asgDesc}
                  onChange={(e) => setAsgDesc(e.target.value)}
                  placeholder={tx('Mô tả yêu cầu bài tập...', 'Assignment instructions...')}
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />

                <AssignmentQuestionBuilder
                  subject={activeClassObj.subject ?? currentUser?.subject ?? 'toan'}
                  grade={activeClassObj.grade}
                  currentUser={currentUser}
                  questionBank={questions}
                  questions={asgQuestions}
                  questionCount={asgQuestionCount}
                  onChange={(next) => {
                    setAsgQuestions(next);
                    if (asgError) setAsgError(null);
                  }}
                  onQuestionCountChange={(nextCount) => {
                    setAsgQuestionCount(nextCount);
                  }}
                  onSuggestTitle={(suggested) => {
                    if (!asgTitle.trim()) {
                      setAsgTitle(suggested);
                    }
                  }}
                />

                {asgError && (
                  <p className="text-xs font-medium text-red-600 dark:text-red-400">
                    {asgError}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {tx(
                      'Có thể soạn trực tiếp câu hỏi ở trên hoặc đính kèm file PDF/DOCX/XLSX cho giáo viên lưu trữ.',
                      'Build interactive questions above or attach PDF/DOCX/XLSX files for teacher reference.',
                    )}
                  </span>
                  <button
                    type="submit"
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{tx('Giao bài tập', 'Create assignment')}</span>
                  </button>
                </div>
              </form>
            )}

            {activeClassAssignments.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tx(
                  'Chưa có bài tập nào trong lớp học này.',
                  'No assignments in this class yet.',
                )}
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeClassAssignments.map((asg) => {
                  const canShareAsg = canManageResourceSharing(asg, currentUser);
                  const canDeleteAsg = canTeacherEditResource(
                    asg,
                    currentUser,
                    editableClassIds,
                    asg.classId,
                  );
                  return (
                    <div
                      key={asg.id}
                      className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-1 last:pb-1"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {tx('Hạn', 'Due')}: {asg.dueDateLabel} · ~{asg.estimatedMinutes}{' '}
                          {tx('phút', 'min')}
                          {asg.questions && asg.questions.length > 0 && (
                            <>
                              {' '}
                              ·{' '}
                              <span className="font-semibold text-blue-700 tabular-nums dark:text-blue-400">
                                {asg.questionCount && asg.questionCount < asg.questions.length
                                  ? `${asg.questionCount}/${asg.questions.length}`
                                  : asg.questions.length}{' '}
                                {tx('câu hỏi', 'questions')}
                              </span>
                            </>
                          )}
                        </p>
                        <h3 className="mt-1 font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                          {asg.title}
                        </h3>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                          {asg.description}
                        </p>
                        {(asg.questionFile || asg.answerFile) && (
                          <div className="mt-2.5 flex flex-wrap items-center gap-2">
                            {asg.questionFile && (
                              <button
                                type="button"
                                onClick={() => downloadAttachedDocumentFile(asg.questionFile!)}
                                title={asg.questionFile.name}
                                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50/70 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
                              >
                                <Download className="h-3.5 w-3.5" />
                                <span className="max-w-[200px] truncate">
                                  {tx('Câu hỏi:', 'Questions:')} {asg.questionFile.name}
                                </span>
                                {asg.questionFile.size > 0 && (
                                  <span className="font-mono text-[10px] opacity-80 tabular-nums">
                                    ({formatMaterialFileSize(asg.questionFile.size)})
                                  </span>
                                )}
                              </button>
                            )}
                            {asg.answerFile && (
                              <button
                                type="button"
                                onClick={() => downloadAttachedDocumentFile(asg.answerFile!)}
                                title={asg.answerFile.name}
                                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                              >
                                <Download className="h-3.5 w-3.5" />
                                <span className="max-w-[200px] truncate">
                                  {tx('Đáp án:', 'Answers:')} {asg.answerFile.name}
                                </span>
                                {asg.answerFile.size > 0 && (
                                  <span className="font-mono text-[10px] opacity-80 tabular-nums">
                                    ({formatMaterialFileSize(asg.answerFile.size)})
                                  </span>
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {asg.questions && asg.questions.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setPreviewAssignment(asg)}
                            className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>
                              {tx(
                                `Xem câu hỏi (${asg.questions.length})`,
                                `View Qs (${asg.questions.length})`,
                              )}
                            </span>
                          </button>
                        )}
                        {canShareAsg && onUpdateClassAssignment && (
                          <button
                            type="button"
                            onClick={() =>
                              setShareModalTarget({ kind: 'assignment', item: asg })
                            }
                            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            <span>{tx('Chia sẻ', 'Share')}</span>
                          </button>
                        )}
                        {canDeleteAsg && (
                          <button
                            type="button"
                            onClick={() => onDeleteClassAssignment(asg.id)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>{tx('Xóa', 'Delete')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Tab 5: Scores */}
        {(classRoomTab === 'scores' || classRoomTab === 'overview') && (
          <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col justify-between gap-3 px-6 py-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                    {tx('Bảng điểm', 'Grades')}
                  </h2>
                  {isScoresCollapsed && (
                    <span className="text-xs font-medium text-slate-500 tabular-nums dark:text-slate-400">
                      ({activeClassScoreStats.count})
                    </span>
                  )}
                </div>
                {!isScoresCollapsed && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {tx(
                      'Tổng hợp bài làm thí sinh đã nộp trong lớp học theo cấu trúc 3 phần 2025.',
                      'Summary of student submissions in this class under the 2025 3-part format.',
                    )}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                {!isScoresCollapsed && (
                  <>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-slate-500 dark:text-slate-400">
                        {tx('Bài nộp', 'Submissions')}:{' '}
                        <strong className="font-mono text-slate-900 tabular-nums dark:text-slate-100">
                          {activeClassScoreStats.count}
                        </strong>
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {tx('Điểm TB', 'Avg Score')}:{' '}
                        <strong className="font-mono text-blue-700 tabular-nums dark:text-blue-400">
                          {activeClassScoreStats.count > 0
                            ? formatScoreVi(activeClassScoreStats.avg)
                            : '—'}
                        </strong>
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {tx('Cao nhất', 'Highest')}:{' '}
                        <strong className="font-mono text-emerald-700 tabular-nums dark:text-emerald-400">
                          {activeClassScoreStats.count > 0
                            ? formatScoreVi(activeClassScoreStats.best)
                            : '—'}
                        </strong>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigate('results')}
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>{tx('Xem toàn bộ bảng điểm', 'View full gradebook')}</span>
                    </button>
                  </>
                )}
                {renderOverviewCollapseButton('scores', tx('Bảng điểm', 'Grades'))}
              </div>
            </div>

            <div
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                isScoresCollapsed
                  ? 'pointer-events-none grid-rows-[0fr] opacity-0'
                  : 'grid-rows-[1fr] opacity-100'
              }`}
              aria-hidden={isScoresCollapsed}
              inert={isScoresCollapsed}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                    <th className="px-6 py-3">{tx('SBD', 'ID')}</th>
                    <th className="px-6 py-3">{tx('Thí sinh', 'Student')}</th>
                    <th className="px-6 py-3">{tx('Kỳ thi', 'Exam')}</th>
                    <th className="px-6 py-3">{tx('Mã đề', 'Code')}</th>
                    <th className="px-6 py-3 text-right">{tx('Phần I / II / III', 'Part I / II / III')}</th>
                    <th className="px-6 py-3 text-right">{tx('Tổng điểm', 'Total')}</th>
                    <th className="px-6 py-3">{tx('Xếp loại', 'Rank')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeClassSubmissions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-10 text-center text-xs text-slate-500 dark:text-slate-400"
                      >
                        {tx(
                          'Chưa có bài thi nào được nộp trong lớp học này.',
                          'No exam submissions in this class yet.',
                        )}
                      </td>
                    </tr>
                  ) : (
                    activeClassSubmissions.map((sub) => {
                      const rank = classifyAcademicRankTT22(sub.totalScore);
                      return (
                        <tr
                          key={sub.id}
                          onClick={() => onViewSubmission(sub)}
                          className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <td className="px-6 py-3.5 font-mono text-xs font-semibold text-slate-700 tabular-nums dark:text-slate-300">
                            {sub.studentSbd}
                          </td>
                          <td className="px-6 py-3.5 text-xs">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {sub.studentName}
                            </span>
                            <span className="ml-1.5 text-slate-500 dark:text-slate-400">
                              ({sub.studentClass})
                            </span>
                          </td>
                          <td className="max-w-xs truncate px-6 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                            {sub.examTitle}
                          </td>
                          <td className="px-6 py-3.5 font-mono text-xs text-slate-600 tabular-nums dark:text-slate-300">
                            {sub.variantCode}
                          </td>
                          <td className="px-6 py-3.5 text-right font-mono text-xs text-slate-600 tabular-nums dark:text-slate-300">
                            {formatScoreVi(sub.part1Score)} /{' '}
                            {formatScoreVi(sub.part2Score)} /{' '}
                            {formatScoreVi(sub.part3Score)}
                          </td>
                          <td className="px-6 py-3.5 text-right font-mono text-sm font-bold text-blue-700 tabular-nums dark:text-blue-400">
                            {formatScoreVi(sub.totalScore)}
                          </td>
                          <td className="px-6 py-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {localizeAcademicRank(rank.label, language)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Tab 6: Schedule */}
        {(classRoomTab === 'schedule' || classRoomTab === 'overview') && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                  {tx('Lịch học', 'Schedule')}
                </h2>
                {isScheduleCollapsed && (
                  <span className="text-xs font-medium text-slate-500 tabular-nums dark:text-slate-400">
                    ({activeClassSchedules.length})
                  </span>
                )}
              </div>
              {renderOverviewCollapseButton('schedule', tx('Lịch học', 'Schedule'))}
            </div>
            <div
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                isScheduleCollapsed
                  ? 'pointer-events-none grid-rows-[0fr] opacity-0'
                  : 'grid-rows-[1fr] opacity-100'
              }`}
              aria-hidden={isScheduleCollapsed}
              inert={isScheduleCollapsed}
            >
              <div className="min-h-0 overflow-hidden">
                <p className="mt-1 mb-4 text-xs text-slate-500 dark:text-slate-400">
                  {tx(
                    'Nhấn “+ Thêm lịch” ở từng ngày để cập nhật thời khóa biểu; học sinh đã duyệt vào lớp sẽ xem ở chế độ chỉ đọc.',
                    'Click “+ Add slot” on any day to update the timetable; approved students view it in read-only mode.',
                  )}
                </p>
                <WeeklyCalendarSchedule
                  slots={activeClassSchedules}
                  classes={[activeClassObj]}
                  canEdit={canEditActiveClass}
                  currentUser={currentUser}
                  onAddSlot={onAddScheduleSlot}
                  onUpdateSlot={onUpdateScheduleSlot}
                  onDeleteSlot={onDeleteScheduleSlot}
                  emptyNotice={tx(
                    "Lớp học này chưa có lịch học tuần. Nhấn '+ Thêm lịch' để tạo.",
                    "No weekly schedule for this class yet. Click '+ Add slot' to create one.",
                  )}
                />
              </div>
            </div>
          </section>
        )}

        {editClassModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={tx('Thông tin lớp học', 'Class information')}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs dark:bg-slate-950/75"
            onClick={() => setEditClassModalOpen(false)}
          >
            <div
              className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                    <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                      {canEditActiveClass
                        ? tx('Chỉnh sửa thông tin lớp học', 'Edit class information')
                        : tx('Thông tin lớp học', 'Class information')}
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {canEditActiveClass
                      ? tx(
                          'Cập nhật tên lớp, mã tham gia, môn học, khối/bậc học, mô tả và chế độ phê duyệt học sinh.',
                          'Update class name, join code, subject, grade level, description, and student approval mode.',
                        )
                      : tx(
                          'Thông tin chi tiết về lớp học (chế độ chỉ xem).',
                          'Detailed class information (read-only).',
                        )}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={tx('Đóng bảng thông tin lớp học', 'Close class info modal')}
                  onClick={() => setEditClassModalOpen(false)}
                  className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="overflow-y-auto p-6">
                {canEditActiveClass && onUpdatePrivateClass ? (
                  <form id="edit-class-info-modal-form" onSubmit={handleSaveClassInfoSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {tx('Tên lớp học *', 'Class Name *')}
                      </label>
                      <input
                        type="text"
                        value={editClassName}
                        onChange={(e) => {
                          setEditClassName(e.target.value);
                          if (editClassError) setEditClassError(null);
                        }}
                        placeholder={tx(
                          'VD: Toán 12A2 — Luyện đề THPT 2025',
                          'e.g., Math 12A2 — 2025 Exam Prep',
                        )}
                        className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {tx('Mã lớp * (3 chữ hoa + 2 số)', 'Class Code * (3 letters + 2 digits)')}
                        </label>
                        <div className="mt-1 flex gap-1.5">
                          <input
                            type="text"
                            maxLength={9}
                            value={editClassCode}
                            onChange={(e) => {
                              setEditClassCode(sanitizeClassCodeInput(e.target.value));
                              if (editClassError) setEditClassError(null);
                            }}
                            placeholder="VD: 4T9KA"
                            className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs font-bold tracking-wider text-slate-900 uppercase focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                          />
                          <button
                            type="button"
                            title={tx(
                              'Tạo mã lớp mới (trộn 3 chữ hoa + 2 số)',
                              'Generate a new class code (3 letters + 2 digits)',
                            )}
                            onClick={() => {
                              const otherCodes = new Set(
                                allPrivateClasses
                                  .filter((pc) => pc.id !== activeClassObj.id)
                                  .map((pc) => derivePrivateClassCode(pc)),
                              );
                              setEditClassCode(
                                suggestClassCode(
                                  editClassGrade,
                                  editClassSubject,
                                  editClassName,
                                  otherCodes,
                                  editClassCode,
                                ),
                              );
                              if (editClassError) setEditClassError(null);
                            }}
                            className="cursor-pointer whitespace-nowrap rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            {tx('Đổi mã', 'New code')}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {tx('Môn học *', 'Subject *')}
                        </label>
                        <SubjectSearchSelect
                          value={editClassSubject}
                          onChange={(nextSubj) => {
                            setEditClassSubject(nextSubj);
                            if (editClassError) setEditClassError(null);
                          }}
                          placeholder={tx('Tìm tên môn...', 'Search subject...')}
                          ariaLabel={tx(
                            'Tìm kiếm và chọn môn học cho lớp',
                            'Search and select class subject',
                          )}
                          currentUser={currentUser}
                          onOpenAdvancedAdd={() => setAddSubjectModalOpen(true)}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {tx('Khối / Bậc học', 'Grade / Level')}
                        </label>
                        <GradeInputControl
                          value={editClassGrade}
                          onChange={(nextGrade) => setEditClassGrade(nextGrade)}
                          ariaLabel={tx(
                            'Chọn hoặc nhập khối từ 1 đến 12, Đại học hoặc Cao đẳng',
                            'Select or enter grade 1-12, University, College, or Other',
                          )}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {tx('Mô tả lớp học', 'Class Description')}
                      </label>
                      <textarea
                        rows={3}
                        value={editClassDesc}
                        onChange={(e) => setEditClassDesc(e.target.value)}
                        placeholder={tx(
                          'Nhập mô tả mục tiêu, nội dung ôn luyện hoặc lưu ý chung của lớp học...',
                          'Describe class goals, study focus, or general notes...',
                        )}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs leading-relaxed text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                      <div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {tx(
                            'Phê duyệt học sinh trước khi vào lớp',
                            'Require teacher approval before joining',
                          )}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {editClassRequireApproval
                            ? tx(
                                'Học sinh nhập đúng mã lớp sẽ ở trạng thái chờ bạn duyệt.',
                                'Students entering the right code will wait for your approval.',
                              )
                            : tx(
                                'Học sinh nhập đúng mã lớp sẽ được vào lớp ngay lập tức.',
                                'Students entering the right code will join immediately.',
                              )}
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={editClassRequireApproval}
                        onClick={() => setEditClassRequireApproval((v) => !v)}
                        className="inline-flex cursor-pointer items-center gap-2.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                      >
                        <span
                          aria-hidden="true"
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                            editClassRequireApproval
                              ? 'bg-[#0057FF]'
                              : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                              editClassRequireApproval ? 'translate-x-4.5' : 'translate-x-1'
                            }`}
                          />
                        </span>
                        <span>
                          {editClassRequireApproval
                            ? tx('Đang bật phê duyệt', 'Approval On')
                            : tx('Đang tắt phê duyệt', 'Approval Off')}
                        </span>
                      </button>
                    </div>

                    {editClassError && (
                      <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                        {editClassError}
                      </p>
                    )}
                  </form>
                ) : (
                  <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                      <dt className="font-semibold text-slate-500 dark:text-slate-400">
                        {tx('Tên lớp học', 'Class Name')}
                      </dt>
                      <dd className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                        {activeClassObj.name}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                      <dt className="font-semibold text-slate-500 dark:text-slate-400">
                        {tx('Mã lớp tham gia', 'Join Code')}
                      </dt>
                      <dd className="mt-1 font-mono text-sm font-bold text-blue-700 dark:text-blue-400">
                        {classCode}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                      <dt className="font-semibold text-slate-500 dark:text-slate-400">
                        {tx('Môn học · Khối / Bậc học', 'Subject · Grade / Level')}
                      </dt>
                      <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {subjectName} · {localizeGradeText(formatGradeLabel(activeClassObj.grade), language)}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                      <dt className="font-semibold text-slate-500 dark:text-slate-400">
                        {tx('Chế độ phê duyệt', 'Approval Mode')}
                      </dt>
                      <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {approvalEnabled
                          ? tx('Cần giáo viên duyệt vào lớp', 'Teacher approval required')
                          : tx('Tự động vào lớp khi đúng mã', 'Auto-join with valid code')}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 sm:col-span-2 dark:border-slate-800 dark:bg-slate-950/40">
                      <dt className="font-semibold text-slate-500 dark:text-slate-400">
                        {tx('Mô tả lớp học', 'Class Description')}
                      </dt>
                      <dd className="mt-1 leading-relaxed text-slate-700 dark:text-slate-300">
                        {activeClassObj.description?.trim() ||
                          tx('Chưa có mô tả cho lớp học này.', 'No description provided.')}
                      </dd>
                    </div>
                  </dl>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200 px-6 py-3.5 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditClassModalOpen(false)}
                  className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {canEditActiveClass && onUpdatePrivateClass
                    ? tx('Hủy', 'Cancel')
                    : tx('Đóng', 'Close')}
                </button>
                {canEditActiveClass && onUpdatePrivateClass && (
                  <button
                    type="submit"
                    form="edit-class-info-modal-form"
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{tx('Lưu thông tin lớp', 'Save class info')}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeMaterial && (
          <TeacherMaterialReaderModal
            material={activeMaterial}
            onClose={() => setActiveMaterial(null)}
          />
        )}
        {previewAssignment && (
          <TeacherAssignmentQuestionsModal
            assignment={previewAssignment}
            onClose={() => setPreviewAssignment(null)}
          />
        )}
        <AddSubjectModal
          open={addSubjectModalOpen}
          onClose={() => setAddSubjectModalOpen(false)}
          currentUser={currentUser}
          onSubjectAdded={(created) => {
            setEditClassSubject(created.id);
            setAddSubjectModalOpen(false);
          }}
        />
        {shareModalNode}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ===================================================================== */}
      {/* MỤC 1: LỚP HỌC (Tạo lớp học mới + Duyệt yêu cầu vào lớp bằng mã lớp) */}
      {/* ===================================================================== */}
      <section
        id="portal-section-classes"
        className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
                {tx('Lớp học', 'Classes')}
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {tx(
                'Tạo lớp học mới kèm mã lớp riêng. Học sinh chỉ vào được khi nhập đúng mã lớp và được bạn duyệt trực tiếp tại đây.',
                'Create a new class with a unique join code. Students can only enter after joining with the code and receiving approval.',
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-xs font-semibold text-blue-700 tabular-nums dark:text-blue-400">
              {ownedClassesCount}/{MAX_CLASSES_PER_TEACHER} {tx('lớp', 'classes')} ·{' '}
              {myApprovedRequests.length} {tx('học sinh', 'students')}
            </p>
            {currentUser ? (
              <button
                type="button"
                disabled={hasReachedClassLimit && !createClassOpen}
                title={
                  hasReachedClassLimit && !createClassOpen
                    ? tx(
                        `Mỗi tài khoản giáo viên chỉ được tạo tối đa ${MAX_CLASSES_PER_TEACHER} lớp học`,
                        `Each teacher account can create up to ${MAX_CLASSES_PER_TEACHER} classes`,
                      )
                    : undefined
                }
                onClick={() => {
                  setCreateClassOpen((v) => !v);
                  setCreateClassError(null);
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 dark:bg-blue-600 dark:hover:bg-blue-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-400"
              >
                <Plus className="h-4 w-4" />
                <span>
                  {createClassOpen
                    ? tx('Đóng biểu mẫu', 'Close form')
                    : hasReachedClassLimit
                      ? tx(
                          `Đã đạt giới hạn ${MAX_CLASSES_PER_TEACHER}/${MAX_CLASSES_PER_TEACHER} lớp`,
                          `Limit reached (${MAX_CLASSES_PER_TEACHER}/${MAX_CLASSES_PER_TEACHER})`,
                        )
                      : tx('Tạo lớp học mới', 'Create new class')}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <LogIn className="h-4 w-4" />
                <span>
                  {tx('Đăng nhập Giáo viên để tạo lớp', 'Sign in as Teacher to create')}
                </span>
              </button>
            )}
          </div>
        </div>

        {currentUser && hasReachedClassLimit && (
          <div
            role="status"
            className="mt-4 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
          >
            {tx('Tài khoản giáo viên của bạn đã đạt giới hạn tối đa', 'Your teacher account has reached the maximum of')}{' '}
            <strong className="font-semibold">
              {MAX_CLASSES_PER_TEACHER}/{MAX_CLASSES_PER_TEACHER} {tx('lớp học', 'classes')}
            </strong>
            {tx(
              '. Hãy xóa bớt lớp không còn sử dụng nếu bạn muốn tạo lớp mới.',
              '. Please remove an unused class before creating a new one.',
            )}
          </div>
        )}

        {/* Form Tạo lớp học mới */}
        {createClassOpen && currentUser && !hasReachedClassLimit && (
          <form
            onSubmit={handleCreateClassSubmit}
            className="mt-5 space-y-4 rounded-xl border border-blue-200 bg-blue-50/40 p-5 dark:border-blue-900/60 dark:bg-blue-950/20"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                {tx(
                  `Tạo lớp học mới của giáo viên (${currentUser.fullName})`,
                  `Create new class (${currentUser.fullName})`,
                )}
              </h3>
              <button
                type="button"
                onClick={() => setCreateClassOpen(false)}
                className="cursor-pointer rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {tx('Tên lớp học *', 'Class Name *')}
                </label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => {
                    setNewClassName(e.target.value);
                    if (createClassError) setCreateClassError(null);
                  }}
                  placeholder={tx(
                    'VD: Toán 12A2 — Luyện đề THPT 2025',
                    'e.g., Math 12A2 — 2025 Exam Prep',
                  )}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {tx('Mã lớp * (3 chữ hoa + 2 số)', 'Class Code * (3 letters + 2 digits)')}
                </label>
                <div className="mt-1 flex gap-1.5">
                  <input
                    type="text"
                    maxLength={5}
                    value={newClassCode}
                    onChange={(e) => {
                      setNewClassCode(sanitizeClassCodeInput(e.target.value));
                      if (createClassError) setCreateClassError(null);
                    }}
                    placeholder="VD: 4T9KA"
                    className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs font-bold tracking-wider text-slate-900 uppercase dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    title={tx(
                      'Tạo mã lớp mới (trộn 3 chữ hoa + 2 số)',
                      'Generate new class code (3 letters + 2 digits)',
                    )}
                    onClick={() =>
                      setNewClassCode((prev) =>
                        suggestClassCode(
                          newClassGrade,
                          newClassSubject,
                          newClassName,
                          allClassCodesSet,
                          prev,
                        ),
                      )
                    }
                    className="cursor-pointer whitespace-nowrap rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {tx('Đổi mã', 'New code')}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {tx('Môn học', 'Subject')}
                  </label>
                  <SubjectSearchSelect
                    value={newClassSubject}
                    onChange={(nextSubj) => {
                      setNewClassSubject(nextSubj);
                      if (createClassError) setCreateClassError(null);
                    }}
                    placeholder={tx('Tìm tên môn...', 'Search subject...')}
                    ariaLabel={tx(
                      'Tìm kiếm và chọn môn học cho lớp',
                      'Search and select class subject',
                    )}
                    currentUser={currentUser}
                    onOpenAdvancedAdd={() => setAddSubjectModalOpen(true)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {tx('Khối / Bậc học', 'Grade / Level')}
                  </label>
                  <GradeInputControl
                    value={newClassGrade}
                    onChange={(nextGrade) => setNewClassGrade(nextGrade)}
                    ariaLabel={tx(
                      'Chọn hoặc nhập khối từ 1 đến 12, Đại học hoặc Cao đẳng',
                      'Select or enter grade 1-12, University, College, or Other',
                    )}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {tx('Mô tả lớp học (tùy chọn)', 'Class description (optional)')}
              </label>
              <input
                type="text"
                value={newClassDesc}
                onChange={(e) => setNewClassDesc(e.target.value)}
                placeholder={tx(
                  'VD: Lớp ôn thi TN THPT theo cấu trúc 3 dạng thức 2025...',
                  'e.g., 2025 High School exam prep class...',
                )}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            {createClassError && (
              <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                {createClassError}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateClassOpen(false)}
                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {tx('Hủy', 'Cancel')}
              </button>
              <button
                type="submit"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{tx('Lưu & Mở lớp học', 'Save & Open Class')}</span>
              </button>
            </div>
          </form>
        )}

        {/* Thanh tìm kiếm lớp học của giáo viên */}
        {privateClasses.length > 0 && (
          <div className="mt-5 relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              aria-label={tx(
                'Tìm lớp học của bạn theo tên hoặc mã lớp',
                'Search your classes by name or code',
              )}
              value={classSearchInput}
              onChange={(e) => setClassSearchInput(e.target.value)}
              placeholder={tx(
                'Lọc lớp học của bạn theo tên lớp hoặc mã lớp...',
                'Filter your classes by name or code...',
              )}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-9 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            {classSearchInput && (
              <button
                type="button"
                aria-label={tx('Xóa từ khóa lọc lớp', 'Clear class filter')}
                onClick={() => setClassSearchInput('')}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Danh sách lớp học giáo viên đang quản lý */}
        {filteredTeacherClasses.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <Users className="mx-auto h-7 w-7 text-slate-400 dark:text-slate-500" />
            <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
              {currentUser
                ? tx(
                    'Bạn chưa có lớp học nào khớp bộ lọc.',
                    'No classes match your filter.',
                  )
                : tx(
                    'Đăng nhập tài khoản Giáo viên để tạo và quản lý lớp học.',
                    'Sign in as a Teacher to create and manage classes.',
                  )}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {currentUser
                ? tx(
                    'Nhấn "Tạo lớp học mới" ở góc trên để tạo lớp và nhận mã lớp cấp cho học sinh.',
                    'Click "Create new class" above to create a class and get a join code for students.',
                  )
                : tx(
                    'Tài khoản giáo viên mẫu: giaovien@kythi2025.edu.vn / 123456.',
                    'Demo teacher account: giaovien@kythi2025.edu.vn / 123456.',
                  )}
            </p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredTeacherClasses.map((pc) => {
              const code = derivePrivateClassCode(pc);
              const subjMeta = getSubjectMeta(pc.subject ?? 'toan');
              const subjectName = localizeSubjectName(subjMeta.id, subjMeta.name, language);
              const approvedCount = classJoinRequests.filter(
                (r) => r.classId === pc.id && r.status === 'approved',
              ).length;
              const pendingCount = classJoinRequests.filter(
                (r) => r.classId === pc.id && r.status === 'pending',
              ).length;
              const clsExamCount = exams.filter(
                (ex) => ex.privateClassId === pc.id,
              ).length;
              const clsMatCount = classMaterials.filter((m) => m.classId === pc.id).length;
              const clsAsgCount = classAssignments.filter(
                (a) => a.classId === pc.id,
              ).length;
              const canShareCls = canManageResourceSharing(pc, currentUser);
              const isOwnerOrAdminCls =
                isResourceOwner(pc, currentUser) || isAdminUser(currentUser);
              const sharePermCls = getTeacherSharePermission(pc, currentUser);
              const shareCountCls = pc.sharedWith?.length ?? 0;

              return (
                <article
                  key={pc.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-5 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-800/40"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-400">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {subjectName}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{localizeGradeText(formatGradeLabel(pc.grade), language)}</span>
                        <span aria-hidden="true">·</span>
                        {isOwnerOrAdminCls ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            {shareCountCls > 0 ? (
                              <>
                                <Share2 className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                <span className="text-blue-700 dark:text-blue-300">
                                  {tx('Đã chia sẻ', 'Shared')} ({shareCountCls}{' '}
                                  {tx('GV', 'teachers')})
                                </span>
                              </>
                            ) : (
                              <>
                                <Lock className="h-3 w-3" />
                                <span>{tx('Riêng tư', 'Private')}</span>
                              </>
                            )}
                          </span>
                        ) : sharePermCls ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-700 dark:text-cyan-300">
                            <Share2 className="h-3 w-3" />
                            <span>
                              {tx('Chia sẻ bởi', 'Shared by')} {pc.ownerTeacherName} (
                              {sharePermCls === 'edit'
                                ? tx('Được sửa', 'Can edit')
                                : tx('Chỉ xem', 'View only')}
                              )
                            </span>
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(pc.id, code)}
                        title={tx('Sao chép mã lớp', 'Copy class code')}
                        className="inline-flex cursor-pointer items-center gap-1 font-mono font-bold text-blue-700 hover:underline tabular-nums dark:text-blue-400"
                      >
                        <Copy className="h-3 w-3" />
                        <span>
                          {copiedClassId === pc.id
                            ? tx('Đã chép', 'Copied')
                            : `${tx('Mã', 'Code')}: ${code}`}
                        </span>
                      </button>
                    </div>

                    <h3 className="mt-2 font-display text-base font-bold text-slate-900 dark:text-slate-50">
                      {pc.name}
                    </h3>

                    {pc.description && (
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        {pc.description}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {approvedCount} {tx('học sinh', 'students')}
                      </span>
                      {pendingCount > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-amber-700 dark:text-amber-400">
                            {pendingCount} {tx('chờ duyệt', 'pending')}
                          </span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>
                        {clsExamCount} {tx('bài thi', 'exams')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {clsMatCount} {tx('tài liệu', 'materials')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {clsAsgCount} {tx('bài tập', 'assignments')}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveClassId(pc.id);
                          setClassRoomTab(null);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                      >
                        <DoorOpen className="h-3.5 w-3.5" />
                        <span>{tx('Vào lớp học', 'Enter Class')}</span>
                      </button>

                      {canShareCls && onUpdatePrivateClass && (
                        <>
                          <button
                            type="button"
                            onClick={() => setShareModalTarget({ kind: 'class', item: pc })}
                            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            <span>
                              {tx('Chia sẻ', 'Share')}
                              {shareCountCls > 0 ? ` (${shareCountCls})` : ''}
                            </span>
                          </button>

                          {shareCountCls > 0 &&
                            (confirmStopShareClassId === pc.id ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStopShareClass(pc, 'all')}
                                  className="cursor-pointer whitespace-nowrap rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                                >
                                  {tx('Xác nhận dừng', 'Confirm stop')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmStopShareClassId(null)}
                                  className="cursor-pointer whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                >
                                  {tx('Hủy', 'Cancel')}
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmStopShareClassId(pc.id)}
                                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                              >
                                <Lock className="h-3.5 w-3.5" />
                                <span>{tx('Dừng chia sẻ', 'Stop sharing')}</span>
                              </button>
                            ))}
                        </>
                      )}
                    </div>

                    {!isOwnerOrAdminCls &&
                      sharePermCls &&
                      onUpdatePrivateClass &&
                      (confirmStopShareClassId === pc.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStopShareClass(pc, 'self')}
                            className="cursor-pointer whitespace-nowrap rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                          >
                            {tx('Xác nhận dừng chia sẻ', 'Confirm stop sharing')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmStopShareClassId(null)}
                            className="cursor-pointer whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                          >
                            {tx('Hủy', 'Cancel')}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmStopShareClassId(pc.id)}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          <UserX className="h-3.5 w-3.5" />
                          <span>{tx('Dừng chia sẻ', 'Stop sharing')}</span>
                        </button>
                      ))}

                    {canShareCls &&
                      (confirmDeleteClassId === pc.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              onDeletePrivateClass(pc.id);
                              setConfirmDeleteClassId(null);
                            }}
                            className="cursor-pointer rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                          >
                            {tx('Xác nhận xóa', 'Confirm delete')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteClassId(null)}
                            className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                          >
                            {tx('Hủy', 'Cancel')}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteClassId(pc.id)}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>{tx('Xóa lớp', 'Delete class')}</span>
                        </button>
                      ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* MỤC 2: LỊCH HỌC (7 cột Thứ 2 – Chủ nhật, giáo viên chỉnh sửa trực tiếp) */}
      {/* ===================================================================== */}
      <section
        id="portal-section-schedule"
        className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-5 flex flex-col justify-between gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-end dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
                {tx('Lịch học', 'Schedule')}
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {tx(
                'Lịch giảng dạy tuần từ Thứ 2 đến Chủ nhật. Bạn có quyền thêm, sửa, xóa lịch học cho các lớp của mình.',
                'Weekly teaching timetable (Mon–Sun). You can add, edit, or delete slots for your classes.',
              )}
            </p>
          </div>
          <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
            {tx('Quyền giáo viên · Chỉnh sửa trực tiếp', 'Teacher access · Direct editing')}
          </span>
        </div>

        <WeeklyCalendarSchedule
          slots={myClassSchedules}
          classes={privateClasses}
          canEdit={Boolean(
            currentUser && (editableClasses.length > 0 || privateClasses.length === 0),
          )}
          currentUser={currentUser}
          onAddSlot={onAddScheduleSlot}
          onUpdateSlot={onUpdateScheduleSlot}
          onDeleteSlot={onDeleteScheduleSlot}
          emptyNotice={tx(
            "Chưa có lịch học nào cho các lớp của bạn. Nhấn '+ Thêm lịch' ở từng ngày để xếp lịch.",
            "No weekly schedule for your classes yet. Click '+ Add slot' on any day to create one.",
          )}
        />
      </section>

      {activeMaterial && (
        <TeacherMaterialReaderModal
          material={activeMaterial}
          onClose={() => setActiveMaterial(null)}
        />
      )}

      <AddSubjectModal
        open={addSubjectModalOpen}
        onClose={() => setAddSubjectModalOpen(false)}
        currentUser={currentUser}
        onSubjectAdded={(created) => {
          setNewClassSubject(created.id);
          setNewClassCode((prev) =>
            suggestClassCode(
              newClassGrade,
              created.id,
              newClassName,
              allClassCodesSet,
              prev,
            ),
          );
          setAddSubjectModalOpen(false);
        }}
      />
      {shareModalNode}
    </div>
  );
}

function TeacherMaterialReaderModal({
  material,
  onClose,
}: {
  material: ClassMaterial;
  onClose: () => void;
}) {
  const { language, tx } = useLanguage();
  const subjMeta = getSubjectMeta(material.subject);
  const subjName = localizeSubjectName(subjMeta.id, subjMeta.name, language);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={material.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs dark:bg-slate-950/75"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
              {subjName} · {material.category}
            </p>
            <h3 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              {material.title}
            </h3>
          </div>
          <button
            type="button"
            aria-label={tx('Đóng tài liệu', 'Close material')}
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-6">
          {material.attachmentName && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-950">
              <div className="flex min-w-0 items-center gap-2 text-slate-700 dark:text-slate-200">
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                <span className="truncate font-semibold">{material.attachmentName}</span>
                {material.attachmentSize && (
                  <span className="shrink-0 font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                    · {formatMaterialFileSize(material.attachmentSize)}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => downloadClassMaterialTxt(material)}
                className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap font-semibold text-blue-700 hover:underline dark:text-blue-400"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{tx('Tải tệp gốc', 'Download original')}</span>
              </button>
            </div>
          )}

          {material.attachmentDataUrl &&
            material.attachmentMimeType?.startsWith('image/') && (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950">
                <img
                  src={material.attachmentDataUrl}
                  alt={material.attachmentName || material.title}
                  className="mx-auto max-h-96 rounded object-contain"
                />
              </div>
            )}

          {material.attachmentDataUrl &&
            material.attachmentMimeType === 'application/pdf' && (
              <iframe
                src={material.attachmentDataUrl}
                title={material.attachmentName || material.title}
                className="h-96 w-full rounded-lg border border-slate-200 dark:border-slate-800"
              />
            )}

          <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {material.contentText}
          </pre>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 px-6 py-3.5 dark:border-slate-800">
          <button
            type="button"
            onClick={() => downloadClassMaterialTxt(material)}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5" />
            <span>
              {material.attachmentDataUrl && material.attachmentName
                ? tx(
                    `Tải file (${getMaterialFileExtension(material.attachmentName) || 'tệp'})`,
                    `Download (${getMaterialFileExtension(material.attachmentName) || 'file'})`,
                  )
                : tx('Tải về (.txt)', 'Download (.txt)')}
            </span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex cursor-pointer items-center whitespace-nowrap rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600"
          >
            {tx('Đóng', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
}

function TeacherAssignmentQuestionsModal({
  assignment,
  onClose,
}: {
  assignment: ClassAssignment;
  onClose: () => void;
}) {
  const { tx } = useLanguage();
  const list = assignment.questions ?? [];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={assignment.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs dark:bg-slate-950/75"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold text-blue-700 tabular-nums dark:text-blue-400">
              {tx('Danh sách câu hỏi bài tập', 'Assignment Questions')} ·{' '}
              {assignment.questionCount && assignment.questionCount < list.length
                ? tx(
                    `Học sinh làm ${assignment.questionCount}/${list.length} câu`,
                    `Students complete ${assignment.questionCount}/${list.length} questions`,
                  )
                : `${list.length} ${tx('câu', 'questions')}`}
            </p>
            <h3 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              {assignment.title}
            </h3>
          </div>
          <button
            type="button"
            aria-label={tx('Đóng xem trước', 'Close preview')}
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-6">
          {list.map((q, idx) => (
            <div
              key={q.id}
              className="rounded-xl border border-slate-200 p-4 text-xs dark:border-slate-800"
            >
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-mono font-bold text-blue-700 tabular-nums dark:text-blue-400">
                  {tx('Câu', 'Q')} {idx + 1}
                </span>
                <span>·</span>
                <span>
                  {q.type === 'multiple_choice'
                    ? tx('Trắc nghiệm', 'Multiple choice')
                    : q.type === 'true_false'
                      ? tx('Đúng / Sai', 'True / False')
                      : tx('Trả lời ngắn', 'Short answer')}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {q.prompt}
              </p>

              {q.type === 'multiple_choice' && q.options && (
                <div className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {q.options.map((opt, optIdx) => {
                    const isKey = q.correctOptionIndex === optIdx;
                    return (
                      <div
                        key={optIdx}
                        className={`rounded-lg border px-2.5 py-1.5 ${
                          isKey
                            ? 'border-emerald-500 bg-emerald-50 font-semibold text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-200'
                            : 'border-slate-200 bg-slate-50/50 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
                        }`}
                      >
                        <span className="mr-1.5 font-mono font-bold">
                          {OPTION_LETTERS[optIdx]}.
                        </span>
                        <span>{opt}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {q.type === 'true_false' && q.statements && (
                <div className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {q.statements.map((st) => (
                    <div
                      key={st.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-950"
                    >
                      <span className="min-w-0 flex-1 text-slate-800 dark:text-slate-200">
                        <strong>{st.id})</strong> {st.text}
                      </span>
                      <span
                        className={`shrink-0 font-mono text-[11px] font-bold ${
                          st.isTrue
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {st.isTrue ? tx('Đúng', 'True') : tx('Sai', 'False')}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {q.type === 'short_answer' && (
                <p className="mt-2 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  {tx('Đáp án:', 'Answer:')} {q.shortAnswer}
                </p>
              )}

              {q.explanation && (
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                  <strong className="text-slate-800 dark:text-slate-200">
                    {tx('Lời giải:', 'Explanation:')}
                  </strong>{' '}
                  {q.explanation}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end border-t border-slate-200 px-6 py-3.5 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex cursor-pointer items-center whitespace-nowrap rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600"
          >
            {tx('Đóng', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
}
