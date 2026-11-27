import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  Check,
  ClipboardList,
  Clock,
  DoorOpen,
  Download,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  KeyRound,
  LogOut,
  Paperclip,
  Printer,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  derivePrivateClassCode,
  downloadClassMaterialTxt,
  formatMaterialFileSize,
  getMaterialFileExtension,
} from '../data/studentPortalData';
import type {
  ClassAssignment,
  ClassJoinRequest,
  ClassMaterial,
  ClassScheduleSlot,
  Exam,
  ExamSubmission,
  Question,
  SubjectId,
  TeacherPrivateClass,
  UserAccount,
} from '../types/exam';
import { appendSystemLog } from '../utils/systemLogs';
import {
  localizeAcademicRank,
  localizeExamCategory,
  localizeGradeText,
  localizeSubjectName,
  useLanguage,
} from '../utils/i18n';
import {
  areGradesEqual,
  calculateExamMaxRawScore,
  classifyAcademicRankTT22,
  formatGradeLabel,
  formatScoreVi,
  getExamDurationMinutes,
  getSubjectMeta,
  isShortAnswerCorrect,
  OPTION_LETTERS,
} from '../utils/scoring2025';
import { useSubjects } from '../utils/subjectStore';
import type { AppView } from './Header';
import { SubjectSearchSelect } from './SubjectSearchSelect';
import { WeeklyCalendarSchedule } from './WeeklyCalendarSchedule';

const STUDENT_PROGRESS_KEY = 'kythi2025_student_hub_progress_v2';

interface StudentHubLocalProgress {
  completedAssignmentIds: string[];
}

function readProgress(userId: string): StudentHubLocalProgress {
  try {
    const raw = localStorage.getItem(`${STUDENT_PROGRESS_KEY}_${userId}`);
    if (!raw) {
      return { completedAssignmentIds: [] };
    }
    const parsed = JSON.parse(raw) as Partial<StudentHubLocalProgress>;
    return {
      completedAssignmentIds: Array.isArray(parsed.completedAssignmentIds)
        ? parsed.completedAssignmentIds
        : [],
    };
  } catch {
    return { completedAssignmentIds: [] };
  }
}

function saveProgress(userId: string, data: StudentHubLocalProgress): void {
  try {
    localStorage.setItem(`${STUDENT_PROGRESS_KEY}_${userId}`, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export type StudentHomeSectionId =
  | 'classes'
  | 'schedule'
  | 'materials'
  | 'assignments'
  | 'exams'
  | 'scores';

interface StudentHomeDashboardProps {
  currentUser: UserAccount | null;
  exams: Exam[];
  questions: Question[];
  submissions: ExamSubmission[];
  allPrivateClasses: TeacherPrivateClass[];
  classJoinRequests: ClassJoinRequest[];
  classMaterials: ClassMaterial[];
  classAssignments: ClassAssignment[];
  classSchedules: ClassScheduleSlot[];
  onRequestJoinClass: (targetClass: TeacherPrivateClass) => {
    ok: boolean;
    error?: string;
    request?: ClassJoinRequest;
  };
  onCancelJoinRequest: (requestId: string) => void;
  onLeaveClassMembership: (classId: string) => void;
  onSelectExamToStart: (exam: Exam) => void;
  onJoinByRoomCode: (code: string) => string | null;
  onOpenPrintableExam: (exam: Exam) => void;
  onNavigate: (view: AppView) => void;
  onViewSubmission: (sub: ExamSubmission) => void;
  requestedSection?: { sectionId: StudentHomeSectionId; nonce: number } | null;
  onSectionActivated?: (sectionId: StudentHomeSectionId) => void;
}

type ClassRoomTab = 'exams' | 'materials' | 'assignments' | 'schedule';

export function StudentHomeDashboard({
  currentUser,
  exams,
  questions,
  submissions,
  allPrivateClasses,
  classJoinRequests,
  classMaterials,
  classAssignments,
  classSchedules,
  onRequestJoinClass,
  onCancelJoinRequest,
  onLeaveClassMembership,
  onSelectExamToStart,
  onJoinByRoomCode,
  onOpenPrintableExam,
  onNavigate,
  onViewSubmission,
  requestedSection,
  onSectionActivated,
}: StudentHomeDashboardProps) {
  useSubjects();
  const { language, tx } = useLanguage();
  const userKey = currentUser?.id ?? 'guest_student';
  const [progress, setProgress] = useState<StudentHubLocalProgress>(() =>
    readProgress(userKey),
  );

  useEffect(() => {
    setProgress(readProgress(userKey));
  }, [userKey]);

  const updateProgressState = (
    updater: (prev: StudentHubLocalProgress) => StudentHubLocalProgress,
  ) => {
    setProgress((prev) => {
      const next = updater(prev);
      saveProgress(userKey, next);
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // 1. CLASS ENROLLMENT (BY CLASS CODE + TEACHER APPROVAL) & CLASS NAVIGATION
  // ---------------------------------------------------------------------------
  const [classActionInput, setClassActionInput] = useState('');
  const [joinFeedback, setJoinFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [appliedClassQuery, setAppliedClassQuery] = useState('');
  const [inlineCardCodeInputs, setInlineCardCodeInputs] = useState<Record<string, string>>(
    {},
  );
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [classRoomTab, setClassRoomTab] = useState<ClassRoomTab>('exams');

  const classMap = useMemo(
    () => new Map(allPrivateClasses.map((pc) => [pc.id, pc])),
    [allPrivateClasses],
  );

  const myClassRequests = useMemo(
    () => classJoinRequests.filter((r) => r.studentUserId === userKey),
    [classJoinRequests, userKey],
  );

  const requestByClassId = useMemo(
    () => new Map(myClassRequests.map((r) => [r.classId, r])),
    [myClassRequests],
  );

  const enrolledClassIds = useMemo(() => {
    const approved = new Set<string>();
    for (const req of myClassRequests) {
      if (req.status === 'approved') {
        approved.add(req.classId);
      }
    }
    return approved;
  }, [myClassRequests]);

  const joinedClasses = useMemo(
    () => allPrivateClasses.filter((pc) => enrolledClassIds.has(pc.id)),
    [allPrivateClasses, enrolledClassIds],
  );

  const pendingOrRejectedRequests = useMemo(
    () =>
      myClassRequests.filter(
        (r) =>
          (r.status === 'pending' || r.status === 'rejected') &&
          classMap.has(r.classId),
      ),
    [classMap, myClassRequests],
  );

  const submitJoinWithExactCode = (rawCode: string, expectedClass?: TeacherPrivateClass) => {
    const cleaned = rawCode.trim().toUpperCase().replace(/\s+/g, '-');
    if (!cleaned) {
      setJoinFeedback({
        type: 'error',
        text: tx(
          'Vui lòng nhập mã lớp do giáo viên cung cấp (VD: 12A1-HSG).',
          'Please enter the class code provided by your teacher (e.g. 12A1-HSG).',
        ),
      });
      return;
    }

    const matched = expectedClass
      ? derivePrivateClassCode(expectedClass) === cleaned
        ? expectedClass
        : undefined
      : allPrivateClasses.find((pc) => derivePrivateClassCode(pc) === cleaned);

    if (!matched) {
      setJoinFeedback({
        type: 'error',
        text: expectedClass
          ? tx(
              `Mã lớp chưa đúng cho lớp "${expectedClass.name}". Vui lòng kiểm tra lại với giáo viên.`,
              `Incorrect class code for "${expectedClass.name}". Please check with your teacher.`,
            )
          : tx(
              `Không tìm thấy lớp học nào mang mã "${cleaned}". Vui lòng hỏi lại giáo viên để lấy đúng mã lớp.`,
              `No class found with code "${cleaned}". Please confirm the exact code with your teacher.`,
            ),
      });
      return;
    }

    const res = onRequestJoinClass(matched);
    if (!res.ok) {
      setJoinFeedback({
        type: 'error',
        text: res.error ?? tx('Không thể gửi yêu cầu vào lớp.', 'Unable to submit class join request.'),
      });
      return;
    }

    setClassActionInput('');
    setAppliedClassQuery('');
    setInlineCardCodeInputs((prev) => ({ ...prev, [matched.id]: '' }));
    setJoinFeedback({
      type: 'success',
      text:
        res.request?.status === 'approved' || matched.requireApproval === false
          ? tx(
              `Đã tham gia lớp "${matched.name}" (${derivePrivateClassCode(matched)}) thành công. Bạn có thể vào lớp học ngay.`,
              `Joined class "${matched.name}" (${derivePrivateClassCode(matched)}) successfully. You can enter the classroom now.`,
            )
          : tx(
              `Đã gửi yêu cầu tham gia lớp "${matched.name}" (${derivePrivateClassCode(matched)}). Vui lòng chờ giáo viên duyệt để vào lớp học.`,
              `Join request sent for "${matched.name}" (${derivePrivateClassCode(matched)}). Please wait for teacher approval.`,
            ),
    });
  };

  const handleLeaveClass = (classId: string) => {
    onLeaveClassMembership(classId);
    if (activeClassId === classId) {
      setActiveClassId(null);
    }
  };

  const handleEnterClassRoom = (classId: string, initialTab: ClassRoomTab = 'exams') => {
    if (!enrolledClassIds.has(classId)) return;
    const targetCls = classMap.get(classId);
    appendSystemLog({
      category: 'class',
      level: 'info',
      action: tx('Học sinh vào lớp học', 'Student entered classroom'),
      detail: tx(
        `Truy cập trang lớp học "${targetCls?.name ?? classId}".`,
        `Opened classroom "${targetCls?.name ?? classId}".`,
      ),
      actorName: currentUser?.fullName ?? tx('Học sinh (Khách)', 'Student (Guest)'),
      actorRole: currentUser?.role ?? 'guest',
      actorId: currentUser?.id,
      targetLabel: targetCls ? derivePrivateClassCode(targetCls) : classId,
    });
    setActiveClassId(classId);
    setClassRoomTab(initialTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const rawUpperInput = classActionInput
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-');
  const exactCodeMatchedClass = useMemo(
    () =>
      rawUpperInput
        ? allPrivateClasses.find((pc) => derivePrivateClassCode(pc) === rawUpperInput)
        : undefined,
    [allPrivateClasses, rawUpperInput],
  );

  const searchKeyword = normalizeSearchText(appliedClassQuery || classActionInput);
  const rawUpperQuery = (appliedClassQuery || classActionInput)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-');
  const isSearchingClasses = searchKeyword.length > 0;

  const searchedTeacherClasses = useMemo(() => {
    if (!searchKeyword) return [];
    return allPrivateClasses.filter((pc) => {
      const code = normalizeSearchText(derivePrivateClassCode(pc));
      const teacher = normalizeSearchText(pc.ownerTeacherName);
      const name = normalizeSearchText(pc.name);
      return (
        teacher.includes(searchKeyword) ||
        code === searchKeyword ||
        name.includes(searchKeyword)
      );
    });
  }, [allPrivateClasses, searchKeyword]);

  const handleUnifiedClassFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = classActionInput.trim();
    if (!trimmed) {
      setJoinFeedback({
        type: 'error',
        text: tx(
          'Vui lòng nhập mã lớp (VD: 12A1-HSG) hoặc tên giáo viên / tên lớp để tìm.',
          'Please enter a class code (e.g. 12A1-HSG), teacher name, or class name.',
        ),
      });
      return;
    }

    if (exactCodeMatchedClass) {
      submitJoinWithExactCode(rawUpperInput, exactCodeMatchedClass);
      return;
    }

    setAppliedClassQuery(classActionInput);
    const norm = normalizeSearchText(classActionInput);
    const matches = allPrivateClasses.filter((pc) => {
      const code = normalizeSearchText(derivePrivateClassCode(pc));
      const teacher = normalizeSearchText(pc.ownerTeacherName);
      const name = normalizeSearchText(pc.name);
      return teacher.includes(norm) || code === norm || name.includes(norm);
    });

    if (matches.length === 0) {
      setJoinFeedback({
        type: 'error',
        text: tx(
          `Không tìm thấy lớp học nào khớp mã hoặc từ khóa "${trimmed}". Vui lòng kiểm tra lại với giáo viên.`,
          `No class matched "${trimmed}". Please verify with your teacher.`,
        ),
      });
    } else {
      setJoinFeedback(null);
    }
  };

  // ---------------------------------------------------------------------------
  // 3. FILTERED DATA STRICTLY SCOPED TO JOINED TEACHER CLASSES
  // ---------------------------------------------------------------------------
  const [examSubjectFilter, setExamSubjectFilter] = useState<'all' | SubjectId>('all');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [roomError, setRoomError] = useState<string | null>(null);

  const joinedClassExams = useMemo(() => {
    return exams.filter((ex) => {
      if (ex.status !== 'active' || ex.isPrivate) return false;
      if (!ex.privateClassId || !enrolledClassIds.has(ex.privateClassId)) {
        return false;
      }
      if (examSubjectFilter !== 'all' && ex.subject !== examSubjectFilter) {
        return false;
      }
      return true;
    });
  }, [exams, enrolledClassIds, examSubjectFilter]);

  const handleRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = roomCodeInput.trim().toUpperCase();
    if (!trimmed) {
      setRoomError(
        tx(
          'Vui lòng nhập mã bài thi (VD: TOAN2025).',
          'Please enter an exam code (e.g. TOAN2025).',
        ),
      );
      return;
    }
    const matchedInJoined = joinedClassExams.find(
      (ex) => ex.roomCode.toUpperCase() === trimmed,
    );
    if (!matchedInJoined) {
      const existsInSystem = exams.find(
        (ex) => ex.roomCode.toUpperCase() === trimmed && !ex.isPrivate,
      );
      if (existsInSystem && existsInSystem.privateClassId) {
        const cls = classMap.get(existsInSystem.privateClassId);
        if (cls && !enrolledClassIds.has(cls.id)) {
          setRoomError(
            tx(
              `Bài thi "${trimmed}" thuộc lớp "${cls.name}" (${derivePrivateClassCode(cls)}). Hãy tìm và tham gia lớp học này trước để làm bài.`,
              `Exam "${trimmed}" belongs to class "${cls.name}" (${derivePrivateClassCode(cls)}). Please join that class first.`,
            ),
          );
          return;
        }
      }
      const err = onJoinByRoomCode(trimmed);
      if (err) {
        setRoomError(err);
      } else {
        setRoomError(null);
        setRoomCodeInput('');
      }
      return;
    }
    onSelectExamToStart(matchedInJoined);
    setRoomError(null);
    setRoomCodeInput('');
  };

  const [materialSubjectFilter, setMaterialSubjectFilter] = useState<'all' | SubjectId>(
    'all',
  );
  const [activeMaterial, setActiveMaterial] = useState<ClassMaterial | null>(null);

  const joinedClassMaterials = useMemo(() => {
    return classMaterials.filter((mat) => {
      if (!enrolledClassIds.has(mat.classId)) return false;
      if (materialSubjectFilter !== 'all' && mat.subject !== materialSubjectFilter) {
        return false;
      }
      return true;
    });
  }, [classMaterials, enrolledClassIds, materialSubjectFilter]);

  const joinedClassAssignments = useMemo(() => {
    return classAssignments.filter((asg) => enrolledClassIds.has(asg.classId));
  }, [classAssignments, enrolledClassIds]);

  const joinedClassSchedules = useMemo(() => {
    return classSchedules.filter((slot) => enrolledClassIds.has(slot.classId));
  }, [classSchedules, enrolledClassIds]);

  // Scoreboard (Module 4) — strictly student's own submissions
  const scoreStats = useMemo(() => {
    if (submissions.length === 0) {
      return { count: 0, avg: 0, best: 0 };
    }
    const sum = submissions.reduce((acc, s) => acc + s.totalScore, 0);
    const best = Math.max(...submissions.map((s) => s.totalScore));
    return {
      count: submissions.length,
      avg: sum / submissions.length,
      best,
    };
  }, [submissions]);

  // Interactive Assignment Modal State
  const [activeAssignment, setActiveAssignment] =
    useState<ClassAssignment | null>(null);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, number>>({});
  const [tfAnswers, setTfAnswers] = useState<
    Record<string, Partial<Record<'a' | 'b' | 'c' | 'd', boolean>>>
  >({});
  const [shortAnswers, setShortAnswers] = useState<Record<string, string>>({});
  const [practiceSubmitted, setPracticeSubmitted] = useState(false);
  const [sampledPracticeQuestions, setSampledPracticeQuestions] = useState<Question[] | null>(
    null,
  );

  const openAssignmentPractice = (asg: ClassAssignment) => {
    setActiveAssignment(asg);
    setPracticeAnswers({});
    setTfAnswers({});
    setShortAnswers({});
    setPracticeSubmitted(false);
    if (asg.questions && asg.questions.length > 0) {
      const pool = asg.questions.filter((q) => q.type !== 'true_false');
      const targetList = pool.length > 0 ? pool : asg.questions;
      const limit =
        asg.questionCount && asg.questionCount > 0
          ? Math.min(targetList.length, asg.questionCount)
          : targetList.length;
      if (limit < targetList.length) {
        const shuffled = [...targetList];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        setSampledPracticeQuestions(shuffled.slice(0, limit));
      } else {
        setSampledPracticeQuestions(targetList);
      }
    } else {
      setSampledPracticeQuestions(null);
    }
  };

  const assignmentPracticeQuestions = useMemo(() => {
    if (!activeAssignment) return [];
    if (sampledPracticeQuestions && sampledPracticeQuestions.length > 0) {
      return sampledPracticeQuestions;
    }
    if (activeAssignment.questions && activeAssignment.questions.length > 0) {
      return activeAssignment.questions;
    }
    const matching = questions.filter(
      (q) =>
        q.type === 'multiple_choice' &&
        q.subject === activeAssignment.subject &&
        q.options &&
        q.options.length === 4,
    );
    const gradeMatched = matching.filter((q) => areGradesEqual(q.grade, activeAssignment.grade));
    const pool = gradeMatched.length >= 3 ? gradeMatched : matching;
    return pool.slice(0, 5);
  }, [activeAssignment, questions, sampledPracticeQuestions]);

  const toggleAssignmentCompleted = (assignmentId: string) => {
    updateProgressState((prev) => {
      const exists = prev.completedAssignmentIds.includes(assignmentId);
      return {
        ...prev,
        completedAssignmentIds: exists
          ? prev.completedAssignmentIds.filter((id) => id !== assignmentId)
          : [...prev.completedAssignmentIds, assignmentId],
      };
    });
  };

  const activeClassObj = activeClassId ? classMap.get(activeClassId) ?? null : null;

  const activeClassExams = useMemo(() => {
    if (!activeClassObj) return [];
    return exams.filter(
      (ex) =>
        ex.status === 'active' &&
        !ex.isPrivate &&
        ex.privateClassId === activeClassObj.id,
    );
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

  const scrollToSection = (sectionId: StudentHomeSectionId) => {
    onSectionActivated?.(sectionId);
    const el = document.getElementById(`portal-section-${sectionId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    if (!requestedSection) return;
    setActiveClassId(null);
    const timer = window.setTimeout(() => {
      const el = document.getElementById(
        `portal-section-${requestedSection.sectionId}`,
      );
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
    return () => window.clearTimeout(timer);
  }, [requestedSection]);

  const quickNavItems: {
    id: StudentHomeSectionId;
    label: string;
    count: number;
  }[] = [
    { id: 'classes', label: tx('Lớp học', 'Classes'), count: joinedClasses.length },
    { id: 'schedule', label: tx('Lịch học', 'Schedule'), count: joinedClassSchedules.length },
    { id: 'materials', label: tx('Tài liệu', 'Materials'), count: joinedClassMaterials.length },
    { id: 'assignments', label: tx('Bài tập', 'Assignments'), count: joinedClassAssignments.length },
    { id: 'exams', label: tx('Bài thi', 'Exams'), count: joinedClassExams.length },
    { id: 'scores', label: tx('Bảng điểm', 'Grades'), count: submissions.length },
  ];

  // ---------------------------------------------------------------------------
  // RENDER CLASS ROOM PAGE ("Trang lớp học" khi bấm "Vào lớp học")
  // ---------------------------------------------------------------------------
  if (activeClassObj) {
    const classCode = derivePrivateClassCode(activeClassObj);
    const subjectName = localizeSubjectName(
      activeClassObj.subject ?? 'toan',
      getSubjectMeta(activeClassObj.subject ?? 'toan').name,
      language,
    );

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setActiveClassId(null)}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{tx('Quay lại Trang tổng quan', 'Back to Overview')}</span>
          </button>

          <button
            type="button"
            onClick={() => handleLeaveClass(activeClassObj.id)}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{tx('Rời lớp học', 'Leave class')}</span>
          </button>
        </div>

        {/* Class Workspace Banner */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-blue-700 dark:text-blue-400">
              {subjectName}
            </span>
            <span aria-hidden="true">·</span>
            <span>{localizeGradeText(formatGradeLabel(activeClassObj.grade), language)}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
              {tx('Mã lớp', 'Class code')}: {classCode}
            </span>
          </div>

          <h1 className="mt-2 font-display text-2xl font-bold text-slate-900 dark:text-slate-50">
            {activeClassObj.name}
          </h1>

          <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-300">
            {tx('Giáo viên phụ trách:', 'Instructor:')}{' '}
            <strong className="text-slate-900 dark:text-slate-100">
              {activeClassObj.ownerTeacherName}
            </strong>
          </p>

          {activeClassObj.description && (
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {activeClassObj.description}
            </p>
          )}

          {/* Class Sub-navigation Tabs */}
          <div
            role="tablist"
            aria-label={tx('Nội dung trong lớp học', 'Classroom content')}
            className="mt-5 flex flex-wrap items-center gap-1.5 border-t border-slate-200 pt-4 dark:border-slate-800"
          >
            {(
              [
                {
                  id: 'exams',
                  label: tx(
                    `Bài thi của lớp (${activeClassExams.length})`,
                    `Class Exams (${activeClassExams.length})`,
                  ),
                },
                {
                  id: 'materials',
                  label: tx(
                    `Tài liệu (${activeClassMaterials.length})`,
                    `Materials (${activeClassMaterials.length})`,
                  ),
                },
                {
                  id: 'assignments',
                  label: tx(
                    `Bài tập (${activeClassAssignments.length})`,
                    `Assignments (${activeClassAssignments.length})`,
                  ),
                },
                {
                  id: 'schedule',
                  label: tx(
                    `Lịch học (${activeClassSchedules.length})`,
                    `Schedule (${activeClassSchedules.length})`,
                  ),
                },
              ] as { id: ClassRoomTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={classRoomTab === tab.id}
                onClick={() => setClassRoomTab(tab.id)}
                className={`cursor-pointer whitespace-nowrap shrink-0 rounded-lg px-3.5 py-2 text-xs font-semibold tabular-nums transition-colors ${
                  classRoomTab === tab.id
                    ? 'bg-blue-700 text-white dark:bg-blue-600'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {/* Tab Body */}
        {classRoomTab === 'exams' && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              {tx(`Bài thi trong lớp ${activeClassObj.name}`, `Exams in ${activeClassObj.name}`)}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {tx(
                'Chọn bài thi bên dưới để bắt đầu làm bài ngay trong lớp học.',
                'Select an exam below to start right away.',
              )}
            </p>

            {activeClassExams.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {tx(
                    'Giáo viên chưa gửi bài thi nào vào lớp học này.',
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
                  const myAttempts = submissions.filter((s) => s.examId === exam.id).length;

                  return (
                    <article
                      key={exam.id}
                      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/40"
                    >
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>{localizeExamCategory(exam.category, language)}</span>
                          <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                            {tx('Mã bài thi', 'Exam code')}: {exam.roomCode}
                          </span>
                        </div>
                        <h3 className="mt-2 font-display text-base font-bold text-slate-900 dark:text-slate-50">
                          {exam.title}
                        </h3>
                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Clock className="h-3.5 w-3.5" />
                            {getExamDurationMinutes(exam)} {tx('phút', 'min')}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            {totalQ} {tx('câu', 'Q')} ({formatScoreVi(maxRaw)} {tx('điểm', 'pts')})
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            {myAttempts > 0
                              ? tx(`Đã nộp ${myAttempts} lần`, `Submitted ${myAttempts}x`)
                              : tx('Chưa làm bài', 'Not attempted')}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => onOpenPrintableExam(exam)}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>{tx('Xem đề chuẩn A4', 'View A4 Paper')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectExamToStart(exam)}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                        >
                          <span>{tx('Làm bài thi', 'Take Exam')}</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {classRoomTab === 'materials' && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              {tx('Tài liệu giáo viên gửi trong lớp', 'Class Study Materials')}
            </h2>
            {activeClassMaterials.length === 0 ? (
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                {tx(
                  'Giáo viên chưa gửi tài liệu nào trong lớp học này.',
                  'No study materials shared in this class yet.',
                )}
              </p>
            ) : (
              <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {activeClassMaterials.map((mat) => (
                  <div key={mat.id} className="py-4 first:pt-1 last:pb-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {mat.category} · {tx('GV', 'Teacher')} {mat.ownerTeacherName}
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
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>{tx('Đọc nhanh', 'Quick Read')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadClassMaterialTxt(mat)}
                        title={mat.attachmentName}
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>
                          {mat.attachmentDataUrl && mat.attachmentName
                            ? tx(
                                `Tải file (${getMaterialFileExtension(mat.attachmentName) || 'tệp'})`,
                                `Download (${getMaterialFileExtension(mat.attachmentName) || 'file'})`,
                              )
                            : tx('Tải về (.txt)', 'Download (.txt)')}
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {classRoomTab === 'assignments' && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              {tx('Bài tập giáo viên giao trong lớp', 'Class Assignments')}
            </h2>
            {activeClassAssignments.length === 0 ? (
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                {tx(
                  'Giáo viên chưa giao bài tập nào trong lớp học này.',
                  'No assignments posted in this class yet.',
                )}
              </p>
            ) : (
              <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {activeClassAssignments.map((asg) => {
                  const isDone = progress.completedAssignmentIds.includes(asg.id);
                  return (
                    <div key={asg.id} className="py-4 first:pt-1 last:pb-1">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>
                          {tx('Hạn:', 'Due:')} {asg.dueDateLabel} · {tx('GV', 'Teacher')}{' '}
                          {asg.ownerTeacherName}
                          {asg.questions && asg.questions.length > 0 && (
                            <>
                              {' '}
                              ·{' '}
                              <span className="font-semibold text-blue-700 tabular-nums dark:text-blue-400">
                                {asg.questionCount && asg.questionCount < asg.questions.length
                                  ? asg.questionCount
                                  : asg.questions.length}{' '}
                                {tx('câu hỏi', 'questions')}
                              </span>
                            </>
                          )}
                        </span>
                        <span
                          className={`font-semibold ${
                            isDone
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {isDone ? tx('Đã hoàn thành', 'Completed') : tx('Chưa làm', 'Pending')}
                        </span>
                      </div>
                      <h3 className="mt-1 font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                        {asg.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        {asg.description}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openAssignmentPractice(asg)}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                        >
                          <span>{tx('Làm bài tập', 'Practice')}</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleAssignmentCompleted(asg.id)}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>
                            {isDone ? tx('Bỏ đánh dấu', 'Unmark') : tx('Đánh dấu đã xong', 'Mark done')}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {classRoomTab === 'schedule' && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-1 font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              {tx(`Lịch học của lớp ${activeClassObj.name}`, `Schedule for ${activeClassObj.name}`)}
            </h2>
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              {tx(
                'Lịch học tuần từ Thứ 2 đến Chủ nhật do giáo viên cập nhật.',
                'Weekly schedule from Monday to Sunday updated by your teacher.',
              )}
            </p>
            <WeeklyCalendarSchedule
              slots={activeClassSchedules}
              classes={[activeClassObj]}
              canEdit={false}
              currentUser={currentUser}
              emptyNotice={tx(
                'Lớp học này chưa có lịch học tuần được xếp.',
                'No weekly schedule set for this class yet.',
              )}
            />
          </section>
        )}

        {/* Modals remain accessible while inside Class Page */}
        {activeMaterial && (
          <MaterialReaderModal
            material={activeMaterial}
            onClose={() => setActiveMaterial(null)}
          />
        )}
        {activeAssignment && (
          <AssignmentPracticeModal
            assignment={activeAssignment}
            questions={assignmentPracticeQuestions}
            practiceAnswers={practiceAnswers}
            tfAnswers={tfAnswers}
            shortAnswers={shortAnswers}
            practiceSubmitted={practiceSubmitted}
            onSelectAnswer={(qid, optIdx) =>
              setPracticeAnswers((prev) => ({ ...prev, [qid]: optIdx }))
            }
            onToggleTrueFalse={(qid, stmtId, val) =>
              setTfAnswers((prev) => ({
                ...prev,
                [qid]: { ...(prev[qid] ?? {}), [stmtId]: val },
              }))
            }
            onChangeShortAnswer={(qid, val) =>
              setShortAnswers((prev) => ({ ...prev, [qid]: val }))
            }
            onSubmitPractice={() => {
              setPracticeSubmitted(true);
              if (!progress.completedAssignmentIds.includes(activeAssignment.id)) {
                toggleAssignmentCompleted(activeAssignment.id);
              }
            }}
            onClose={() => setActiveAssignment(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ===================================================================== */}
      {/* THANH CHUYỂN NHANH 6 MỤC: LỚP HỌC, BÀI THI, TÀI LIỆU, BẢNG ĐIỂM, BÀI TẬP, LỊCH HỌC */}
      {/* ===================================================================== */}
      <nav
        aria-label={tx('6 mục trang tổng quan học sinh', '6 student overview sections')}
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6"
      >
        {quickNavItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => scrollToSection(item.id)}
            className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-800 dark:hover:bg-slate-800/80"
          >
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {item.label}
            </span>
            <span className="font-mono text-xs font-bold text-blue-700 tabular-nums dark:text-blue-400">
              {item.count}
            </span>
          </button>
        ))}
      </nav>

      {/* ===================================================================== */}
      {/* MỤC 1: LỚP HỌC (Chỉ vào được khi có mã lớp & được giáo viên duyệt)    */}
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
                'Chỉ hiển thị các lớp đã được giáo viên duyệt. Để tham gia lớp mới, bạn phải nhập đúng mã lớp do giáo viên cung cấp và chờ giáo viên duyệt.',
                'Only approved classes are shown here. Enter the class code provided by your teacher to request access.',
              )}
            </p>
          </div>
          <p className="font-mono text-xs font-semibold text-blue-700 tabular-nums dark:text-blue-400">
            {tx(`Đã duyệt ${joinedClasses.length} lớp`, `Approved ${joinedClasses.length} classes`)}
            {pendingOrRejectedRequests.some((r) => r.status === 'pending')
              ? tx(
                  ` · ${pendingOrRejectedRequests.filter((r) => r.status === 'pending').length} chờ duyệt`,
                  ` · ${pendingOrRejectedRequests.filter((r) => r.status === 'pending').length} pending`,
                )
              : ''}
          </p>
        </div>

        {/* Form gộp: Tìm kiếm & Xin tham gia lớp học bằng Mã lớp / Tên giáo viên */}
        <form
          onSubmit={handleUnifiedClassFormSubmit}
          className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50"
        >
          <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
            {tx(
              'Tìm lớp học hoặc Xin tham gia bằng Mã lớp',
              'Find a Class or Request to Join by Code',
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {tx(
              'Nhập chính xác mã lớp do giáo viên cấp (VD: 12A1-HSG) để gửi yêu cầu vào lớp ngay, hoặc nhập tên giáo viên / tên lớp để tìm kiếm.',
              'Enter the exact class code (e.g. 12A1-HSG) to send a join request, or search by teacher / class name.',
            )}
          </p>
          <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                aria-label={tx(
                  'Nhập mã lớp hoặc tìm lớp học theo tên giáo viên, tên lớp',
                  'Enter class code or search by teacher or class name',
                )}
                value={classActionInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setClassActionInput(val);
                  setAppliedClassQuery(val);
                  if (joinFeedback) setJoinFeedback(null);
                }}
                placeholder={tx(
                  'Nhập mã lớp (VD: 12A1-HSG) hoặc tên giáo viên / tên lớp...',
                  'Enter class code (e.g. 12A1-HSG) or teacher / class name...',
                )}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-9 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              {classActionInput && (
                <button
                  type="button"
                  aria-label={tx('Xóa nội dung tìm kiếm', 'Clear search')}
                  onClick={() => {
                    setClassActionInput('');
                    setAppliedClassQuery('');
                    if (joinFeedback) setJoinFeedback(null);
                  }}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer rounded p-1 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              {exactCodeMatchedClass ? (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>{tx('Gửi yêu cầu vào lớp', 'Send Join Request')}</span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  <span>{tx('Tìm / Xin vào lớp', 'Search / Join Class')}</span>
                </>
              )}
            </button>
          </div>
          {joinFeedback && (
            <p
              role={joinFeedback.type === 'error' ? 'alert' : 'status'}
              className={`mt-2.5 text-xs font-medium ${
                joinFeedback.type === 'error'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {joinFeedback.text}
            </p>
          )}
        </form>

        {/* Khi đang tìm kiếm: gộp kết quả tìm lớp và danh sách lớp thành một khối thống nhất */}
        {isSearchingClasses ? (
          <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {tx(
                  `Kết quả tìm lớp học (${searchedTeacherClasses.length})`,
                  `Class search results (${searchedTeacherClasses.length})`,
                )}
              </p>
              <button
                type="button"
                onClick={() => {
                  setClassActionInput('');
                  setAppliedClassQuery('');
                }}
                className="cursor-pointer text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400"
              >
                {tx('Đóng kết quả tìm kiếm', 'Close search results')}
              </button>
            </div>

            {searchedTeacherClasses.length === 0 ? (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {tx(
                  `Không tìm thấy lớp học nào khớp với từ khóa "${appliedClassQuery || classActionInput}".`,
                  `No classes found matching "${appliedClassQuery || classActionInput}".`,
                )}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {searchedTeacherClasses.map((pc) => {
                  const req = requestByClassId.get(pc.id);
                  const isJoined = req?.status === 'approved';
                  const isPending = req?.status === 'pending';
                  const isRejected = req?.status === 'rejected';
                  const code = derivePrivateClassCode(pc);
                  const matchedExactCode = rawUpperQuery === code;
                  const subjectName = localizeSubjectName(
                    pc.subject ?? 'toan',
                    getSubjectMeta(pc.subject ?? 'toan').name,
                    language,
                  );
                  const clsExamCount = exams.filter(
                    (ex) =>
                      ex.status === 'active' &&
                      !ex.isPrivate &&
                      ex.privateClassId === pc.id,
                  ).length;
                  const clsMatCount = classMaterials.filter(
                    (m) => m.classId === pc.id,
                  ).length;
                  const clsAsgCount = classAssignments.filter(
                    (a) => a.classId === pc.id,
                  ).length;

                  return (
                    <article
                      key={pc.id}
                      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60"
                    >
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-400">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {subjectName}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{localizeGradeText(formatGradeLabel(pc.grade), language)}</span>
                          </div>
                          <span className="font-mono font-bold text-blue-700 tabular-nums dark:text-blue-400">
                            {isJoined || isPending || matchedExactCode
                              ? `${tx('Mã lớp', 'Code')}: ${code}`
                              : tx('Cần mã lớp', 'Code required')}
                          </span>
                        </div>

                        <h3 className="mt-2 font-display text-base font-bold text-slate-900 dark:text-slate-50">
                          {pc.name}
                        </h3>

                        <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                          {tx('Giáo viên tạo lớp:', 'Teacher:')}{' '}
                          <strong className="text-slate-900 dark:text-slate-100">
                            {pc.ownerTeacherName}
                          </strong>
                        </p>

                        {pc.description && (
                          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                            {pc.description}
                          </p>
                        )}

                        {isJoined && (
                          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                            <span>{clsExamCount} {tx('bài thi', 'exams')}</span>
                            <span aria-hidden="true">·</span>
                            <span>{clsMatCount} {tx('tài liệu', 'materials')}</span>
                            <span aria-hidden="true">·</span>
                            <span>{clsAsgCount} {tx('bài tập', 'assignments')}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
                        {isJoined ? (
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => handleEnterClassRoom(pc.id, 'exams')}
                              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                            >
                              <DoorOpen className="h-3.5 w-3.5" />
                              <span>{tx('Vào lớp học', 'Enter Class')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleLeaveClass(pc.id)}
                              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
                            >
                              <LogOut className="h-3.5 w-3.5" />
                              <span>{tx('Rời lớp học', 'Leave Class')}</span>
                            </button>
                          </div>
                        ) : isPending && req ? (
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                              {tx('Đang chờ giáo viên duyệt', 'Pending teacher approval')}
                            </span>
                            <button
                              type="button"
                              onClick={() => onCancelJoinRequest(req.id)}
                              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-red-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-red-400"
                            >
                              {tx('Hủy yêu cầu', 'Cancel')}
                            </button>
                          </div>
                        ) : isRejected && req ? (
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                              {tx('Giáo viên đã từ chối', 'Request declined')}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => submitJoinWithExactCode(req.classCode, pc)}
                                className="cursor-pointer rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-400"
                              >
                                {tx('Xin lại', 'Retry')}
                              </button>
                              <button
                                type="button"
                                onClick={() => onCancelJoinRequest(req.id)}
                                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                              >
                                {tx('Xóa', 'Remove')}
                              </button>
                            </div>
                          </div>
                        ) : matchedExactCode ? (
                          <button
                            type="button"
                            onClick={() => submitJoinWithExactCode(code, pc)}
                            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            <span>{tx('Xin vào lớp (chờ duyệt)', 'Request to Join')}</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              aria-label={tx(`Nhập mã lớp của ${pc.name}`, `Enter class code for ${pc.name}`)}
                              value={inlineCardCodeInputs[pc.id] ?? ''}
                              onChange={(e) =>
                                setInlineCardCodeInputs((prev) => ({
                                  ...prev,
                                  [pc.id]: e.target.value,
                                }))
                              }
                              placeholder={tx('Nhập mã lớp để xin vào...', 'Enter class code...')}
                              className="h-8 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 font-mono text-xs text-slate-900 uppercase placeholder:font-sans placeholder:normal-case dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                submitJoinWithExactCode(
                                  inlineCardCodeInputs[pc.id] ?? '',
                                  pc,
                                )
                              }
                              className="inline-flex h-8 cursor-pointer items-center gap-1 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-3 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                              <span>{tx('Xin vào lớp', 'Join')}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Yêu cầu đang chờ giáo viên duyệt / bị từ chối */}
            {pendingOrRejectedRequests.length > 0 && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {tx(
                    `Yêu cầu xin vào lớp (${pendingOrRejectedRequests.length})`,
                    `Class Join Requests (${pendingOrRejectedRequests.length})`,
                  )}
                </p>
                <div className="mt-2.5 divide-y divide-amber-200/70 dark:divide-amber-900/40">
                  {pendingOrRejectedRequests.map((req) => {
                    const cls = classMap.get(req.classId);
                    if (!cls) return null;
                    return (
                      <div
                        key={req.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {cls.name}{' '}
                            <span className="font-mono text-blue-700 dark:text-blue-400">
                              ({req.classCode})
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400">
                            {tx('GV', 'Teacher')} {cls.ownerTeacherName} ·{' '}
                            {req.status === 'pending' ? (
                              <span className="font-semibold text-amber-700 dark:text-amber-400">
                                {tx('Đang chờ giáo viên duyệt', 'Pending teacher approval')}
                              </span>
                            ) : (
                              <span className="font-semibold text-red-600 dark:text-red-400">
                                {tx('Giáo viên đã từ chối', 'Request declined')}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {req.status === 'rejected' && (
                            <button
                              type="button"
                              onClick={() => submitJoinWithExactCode(req.classCode, cls)}
                              className="cursor-pointer rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-400"
                            >
                              {tx('Xin lại', 'Retry')}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onCancelJoinRequest(req.id)}
                            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                          >
                            {req.status === 'pending' ? tx('Hủy yêu cầu', 'Cancel') : tx('Xóa', 'Remove')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Joined Teacher-Created Classes List (Approved Only) */}
            {joinedClasses.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                <Users className="mx-auto h-7 w-7 text-slate-400 dark:text-slate-500" />
                <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {tx('Bạn chưa được duyệt vào lớp học nào.', 'You are not enrolled in any classes yet.')}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {tx(
                    'Hãy nhập mã lớp do giáo viên cung cấp ở ô bên trên để gửi yêu cầu tham gia và chờ giáo viên duyệt.',
                    'Enter the class code provided by your teacher above to submit a join request.',
                  )}
                </p>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                {joinedClasses.map((pc) => {
                  const code = derivePrivateClassCode(pc);
                  const subjectName = localizeSubjectName(
                    pc.subject ?? 'toan',
                    getSubjectMeta(pc.subject ?? 'toan').name,
                    language,
                  );
                  const clsExamCount = exams.filter(
                    (ex) =>
                      ex.status === 'active' &&
                      !ex.isPrivate &&
                      ex.privateClassId === pc.id,
                  ).length;
                  const clsMatCount = classMaterials.filter(
                    (m) => m.classId === pc.id,
                  ).length;
                  const clsAsgCount = classAssignments.filter(
                    (a) => a.classId === pc.id,
                  ).length;

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
                          </div>
                          <span className="font-mono font-bold text-blue-700 tabular-nums dark:text-blue-400">
                            {tx('Mã lớp', 'Code')}: {code}
                          </span>
                        </div>

                        <h3 className="mt-2 font-display text-base font-bold text-slate-900 dark:text-slate-50">
                          {pc.name}
                        </h3>

                        <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                          {tx('Giáo viên tạo lớp:', 'Teacher:')}{' '}
                          <strong className="text-slate-900 dark:text-slate-100">
                            {pc.ownerTeacherName}
                          </strong>
                        </p>

                        {pc.description && (
                          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                            {pc.description}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                          <span>{clsExamCount} {tx('bài thi', 'exams')}</span>
                          <span aria-hidden="true">·</span>
                          <span>{clsMatCount} {tx('tài liệu', 'materials')}</span>
                          <span aria-hidden="true">·</span>
                          <span>{clsAsgCount} {tx('bài tập', 'assignments')}</span>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => handleEnterClassRoom(pc.id, 'exams')}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                        >
                          <DoorOpen className="h-3.5 w-3.5" />
                          <span>{tx('Vào lớp học', 'Enter Class')}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleLeaveClass(pc.id)}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          <span>{tx('Rời lớp học', 'Leave Class')}</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>

      {/* ===================================================================== */}
      {/* MỤC 2: LỊCH HỌC (Dạng lịch 7 cột Thứ 2 – Chủ nhật, chỉ giáo viên sửa) */}
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
                'Lịch học tuần chia theo từng ngày từ Thứ 2 đến Chủ nhật của các lớp bạn đã tham gia (chỉ giáo viên mới có quyền chỉnh sửa).',
                'Weekly schedule from Monday to Sunday across your joined classes (teacher-managed).',
              )}
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {tx('Chế độ chỉ xem · Đồng bộ từ giáo viên', 'Read-only · Synced from teachers')}
          </span>
        </div>

        <WeeklyCalendarSchedule
          slots={joinedClassSchedules}
          classes={joinedClasses}
          canEdit={false}
          currentUser={currentUser}
          emptyNotice={tx(
            'Chưa có lịch học cho các lớp bạn đã tham gia. Hãy tham gia lớp học hoặc chờ giáo viên cập nhật lịch.',
            'No schedule yet for your enrolled classes. Join a class or wait for your teacher to publish one.',
          )}
        />
      </section>

      {/* ===================================================================== */}
      {/* MỤC 3: TÀI LIỆU & MỤC 4: BÀI TẬP (Chỉ từ lớp học đã tham gia)          */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* MỤC 3: TÀI LIỆU */}
        <section
          id="portal-section-materials"
          className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
                  {tx('Tài liệu', 'Materials')}
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {tx(
                  'Chỉ hiển thị tài liệu giáo viên gửi lên từ các lớp học bạn đã tham gia.',
                  'Showing study materials shared by teachers in your enrolled classes.',
                )}
              </p>
            </div>

            <SubjectSearchSelect
              allowAll
              compact
              allLabel={tx('Tất cả môn', 'All subjects')}
              value={materialSubjectFilter}
              onChange={(val) =>
                setMaterialSubjectFilter((val || 'all') as 'all' | SubjectId)
              }
              ariaLabel={tx('Lọc tài liệu theo môn học', 'Filter materials by subject')}
              currentUser={currentUser}
              className="w-48"
            />
          </div>

          {joinedClassMaterials.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
              <FileText className="mx-auto h-6 w-6 text-slate-400 dark:text-slate-500" />
              <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                {tx(
                  'Chưa có tài liệu nào từ các lớp học bạn đã tham gia.',
                  'No study materials yet from your enrolled classes.',
                )}
              </p>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {joinedClassMaterials.map((mat) => {
                const cls = classMap.get(mat.classId);
                return (
                  <div key={mat.id} className="py-4 first:pt-1 last:pb-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-blue-700 dark:text-blue-400">
                        {localizeSubjectName(mat.subject, getSubjectMeta(mat.subject).name, language)}
                      </span>
                      {cls && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {tx('Lớp', 'Class')} {derivePrivateClassCode(cls)}
                          </span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>{tx('GV', 'Teacher')} {mat.ownerTeacherName}</span>
                    </div>

                    <h3 className="mt-1 font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                      {mat.title}
                    </h3>

                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
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
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>{tx('Đọc nhanh', 'Quick Read')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadClassMaterialTxt(mat)}
                        title={mat.attachmentName}
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>
                          {mat.attachmentDataUrl && mat.attachmentName
                            ? tx(
                                `Tải file (${getMaterialFileExtension(mat.attachmentName) || 'tệp'})`,
                                `Download (${getMaterialFileExtension(mat.attachmentName) || 'file'})`,
                              )
                            : tx('Tải về (.txt)', 'Download (.txt)')}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* MỤC 4: BÀI TẬP */}
        <section
          id="portal-section-assignments"
          className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
                  {tx('Bài tập', 'Assignments')}
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {tx(
                  'Chỉ hiển thị bài tập do giáo viên gửi trong các lớp học bạn đã tham gia.',
                  'Showing assignments posted by teachers in your enrolled classes.',
                )}
              </p>
            </div>

            <span className="font-mono text-xs font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">
              {tx('Hoàn thành', 'Completed')}{' '}
              {
                joinedClassAssignments.filter((a) =>
                  progress.completedAssignmentIds.includes(a.id),
                ).length
              }
              /{joinedClassAssignments.length}
            </span>
          </div>

          {joinedClassAssignments.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
              <ClipboardList className="mx-auto h-6 w-6 text-slate-400 dark:text-slate-500" />
              <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                {tx(
                  'Chưa có bài tập nào được giao trong các lớp bạn đã tham gia.',
                  'No assignments posted yet in your enrolled classes.',
                )}
              </p>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {joinedClassAssignments.map((asg) => {
                const isDone = progress.completedAssignmentIds.includes(asg.id);
                const cls = classMap.get(asg.classId);
                return (
                  <div key={asg.id} className="py-4 first:pt-1 last:pb-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {localizeSubjectName(asg.subject, getSubjectMeta(asg.subject).name, language)}
                        </span>
                        {cls && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">
                              {tx('Lớp', 'Class')} {derivePrivateClassCode(cls)}
                            </span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span>{tx('Hạn:', 'Due:')} {asg.dueDateLabel}</span>
                        {asg.questions && asg.questions.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-blue-700 tabular-nums dark:text-blue-400">
                              {asg.questionCount && asg.questionCount < asg.questions.length
                                ? asg.questionCount
                                : asg.questions.length}{' '}
                              {tx('câu hỏi', 'questions')}
                            </span>
                          </>
                        )}
                      </div>
                      <span
                        className={`font-semibold ${
                          isDone
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {isDone ? tx('Đã hoàn thành', 'Completed') : tx('Chưa làm', 'Pending')}
                      </span>
                    </div>

                    <h3 className="mt-1 font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                      {asg.title}
                    </h3>

                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {asg.description}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openAssignmentPractice(asg)}
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                      >
                        <span>{tx('Làm bài tập', 'Practice')}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleAssignmentCompleted(asg.id)}
                        className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          isDone
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>{isDone ? tx('Bỏ đánh dấu', 'Unmark') : tx('Đánh dấu đã xong', 'Mark done')}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ===================================================================== */}
      {/* MỤC 5: BÀI THI (Chỉ hiển thị bài thi trong lớp đã tham gia + vào trang lớp để làm) */}
      {/* ===================================================================== */}
      <section
        id="portal-section-exams"
        className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-end dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
                {tx('Bài thi', 'Exams')}
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {tx(
                'Chỉ hiển thị các bài thi thuộc những lớp học bạn đã tham gia. Bạn có thể bấm Vào lớp học để làm bài thi hoặc làm ngay tại đây.',
                'Showing exams from your enrolled classes. Enter the classroom or start right below.',
              )}
            </p>
          </div>

          <SubjectSearchSelect
            allowAll
            compact
            allLabel={tx('Tất cả môn học', 'All subjects')}
            value={examSubjectFilter}
            onChange={(val) =>
              setExamSubjectFilter((val || 'all') as 'all' | SubjectId)
            }
            ariaLabel={tx('Lọc bài thi theo môn học', 'Filter exams by subject')}
            currentUser={currentUser}
            className="w-48"
          />
        </div>

        {/* Enter Exam Code Form */}
        <form onSubmit={handleRoomSubmit} className="mt-5 space-y-2">
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <div className="relative flex-1">
              <KeyRound className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                aria-label={tx('Nhập mã bài thi', 'Enter exam code')}
                value={roomCodeInput}
                onChange={(e) => {
                  setRoomCodeInput(e.target.value);
                  if (roomError) setRoomError(null);
                }}
                placeholder={tx(
                  'Nhập mã bài thi trong lớp (VD: TOAN2025)',
                  'Enter class exam code (e.g. TOAN2025)',
                )}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white pr-4 pl-10 font-mono text-sm text-slate-900 uppercase placeholder:font-sans placeholder:normal-case placeholder:text-slate-400 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-5 text-xs font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              <span>{tx('Vào làm bài thi', 'Start Exam')}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          {roomError && (
            <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
              {roomError}
            </p>
          )}
        </form>

        {/* Exams strictly scoped to Joined Classes */}
        {joinedClassExams.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <BookOpen className="mx-auto h-7 w-7 text-slate-400 dark:text-slate-500" />
            <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
              {tx(
                'Chưa có bài thi nào trong các lớp học bạn đã tham gia.',
                'No exams available in your enrolled classes yet.',
              )}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {tx(
                'Hãy tham gia lớp học của giáo viên ở mục Lớp học để nhận bài thi từ giáo viên.',
                'Join a teacher class in the Classes section to access exams.',
              )}
            </p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            {joinedClassExams.map((exam) => {
              const subjectMeta = getSubjectMeta(exam.subject);
              const cls = exam.privateClassId ? classMap.get(exam.privateClassId) : null;
              const totalQ =
                exam.part1QuestionIds.length +
                exam.part2QuestionIds.length +
                exam.part3QuestionIds.length;
              const maxRaw = calculateExamMaxRawScore(exam);
              const myAttempts = submissions.filter((s) => s.examId === exam.id).length;

              return (
                <article
                  key={exam.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-800/40"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {localizeSubjectName(exam.subject, subjectMeta.name, language)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {cls
                            ? `${tx('Lớp', 'Class')} ${derivePrivateClassCode(cls)}`
                            : localizeExamCategory(exam.category, language)}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-blue-700 tabular-nums dark:text-blue-400">
                        {exam.roomCode}
                      </span>
                    </div>

                    <h3 className="mt-2 font-display text-base font-bold text-slate-900 dark:text-slate-50">
                      {exam.title}
                    </h3>

                    {cls && (
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        {tx('Thuộc lớp:', 'Class:')}{' '}
                        <strong className="text-slate-800 dark:text-slate-200">{cls.name}</strong>
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock className="h-3.5 w-3.5" />
                        {getExamDurationMinutes(exam)} {tx('phút', 'min')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {totalQ} {tx('câu', 'Q')} ({formatScoreVi(maxRaw)} {tx('điểm', 'pts')})
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {myAttempts > 0
                          ? tx(`Bạn đã nộp ${myAttempts} lần`, `Submitted ${myAttempts}x`)
                          : tx('Chưa làm bài', 'Not attempted')}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-2">
                      {cls && (
                        <button
                          type="button"
                          onClick={() => handleEnterClassRoom(cls.id, 'exams')}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <DoorOpen className="h-3.5 w-3.5" />
                          <span>{tx('Vào lớp học', 'Enter Class')}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenPrintableExam(exam)}
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>{tx('Đề A4', 'A4 Paper')}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectExamToStart(exam)}
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                    >
                      <span>{tx('Làm bài thi', 'Take Exam')}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* MỤC 6: BẢNG ĐIỂM (Chỉ hiển thị bài chính user học sinh đã nộp)       */}
      {/* ===================================================================== */}
      <section
        id="portal-section-scores"
        className="scroll-mt-20 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
                {tx('Bảng điểm', 'Grades')}
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {tx(
                'Chỉ hiển thị bảng điểm và lịch sử bài thi do chính tài khoản của bạn đã nộp.',
                'Showing scores and exam history submitted by your account.',
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-4 text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                {tx('Đã nộp:', 'Submitted:')}{' '}
                <strong className="font-mono text-slate-900 tabular-nums dark:text-slate-100">
                  {scoreStats.count}
                </strong>
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {tx('Điểm TB:', 'Avg:')}{' '}
                <strong className="font-mono text-blue-700 tabular-nums dark:text-blue-400">
                  {scoreStats.count > 0 ? formatScoreVi(scoreStats.avg) : '—'}
                </strong>
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {tx('Cao nhất:', 'Best:')}{' '}
                <strong className="font-mono text-emerald-700 tabular-nums dark:text-emerald-400">
                  {scoreStats.count > 0 ? formatScoreVi(scoreStats.best) : '—'}
                </strong>
              </span>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('results')}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>{tx('Xem chi tiết kết quả', 'View full results')}</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                <th className="px-6 py-3">{tx('Kỳ thi', 'Exam')}</th>
                <th className="px-6 py-3">{tx('Môn học', 'Subject')}</th>
                <th className="px-6 py-3">{tx('Mã phòng · Đề', 'Room · Paper')}</th>
                <th className="px-6 py-3 text-right">{tx('Phần I / II / III', 'Part I / II / III')}</th>
                <th className="px-6 py-3 text-right">{tx('Tổng điểm', 'Total Score')}</th>
                <th className="px-6 py-3">{tx('Xếp loại', 'Rank')}</th>
                <th className="px-6 py-3 text-right">{tx('Chi tiết', 'Details')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {submissions.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-xs text-slate-500 dark:text-slate-400"
                  >
                    {tx(
                      'Bạn chưa nộp bài thi nào. Hãy chọn một bài thi trong mục Bài thi để bắt đầu làm bài.',
                      'You have not submitted any exams yet. Choose an exam in the Exams section to get started.',
                    )}
                  </td>
                </tr>
              ) : (
                submissions.slice(0, 8).map((sub) => {
                  const rank = classifyAcademicRankTT22(sub.totalScore);
                  return (
                    <tr
                      key={sub.id}
                      onClick={() => onViewSubmission(sub)}
                      className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="max-w-xs truncate px-6 py-3.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {sub.examTitle}
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                        {localizeSubjectName(sub.subject, getSubjectMeta(sub.subject).name, language)}
                      </td>
                      <td className="px-6 py-3.5 font-mono text-xs text-slate-600 tabular-nums dark:text-slate-300">
                        {sub.roomCode} · {sub.variantCode}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-xs text-slate-600 tabular-nums dark:text-slate-300">
                        {formatScoreVi(sub.part1Score)} / {formatScoreVi(sub.part2Score)} /{' '}
                        {formatScoreVi(sub.part3Score)}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-sm font-bold text-blue-700 tabular-nums dark:text-blue-400">
                        {formatScoreVi(sub.totalScore)}
                      </td>
                      <td className="px-6 py-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {localizeAcademicRank(rank.label, language)}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400">
                          {tx('Xem phiếu', 'View sheet')}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {activeMaterial && (
        <MaterialReaderModal
          material={activeMaterial}
          onClose={() => setActiveMaterial(null)}
        />
      )}

      {activeAssignment && (
        <AssignmentPracticeModal
          assignment={activeAssignment}
          questions={assignmentPracticeQuestions}
          practiceAnswers={practiceAnswers}
          tfAnswers={tfAnswers}
          shortAnswers={shortAnswers}
          practiceSubmitted={practiceSubmitted}
          onSelectAnswer={(qid, optIdx) =>
            setPracticeAnswers((prev) => ({ ...prev, [qid]: optIdx }))
          }
          onToggleTrueFalse={(qid, stmtId, val) =>
            setTfAnswers((prev) => ({
              ...prev,
              [qid]: { ...(prev[qid] ?? {}), [stmtId]: val },
            }))
          }
          onChangeShortAnswer={(qid, val) =>
            setShortAnswers((prev) => ({ ...prev, [qid]: val }))
          }
          onSubmitPractice={() => {
            setPracticeSubmitted(true);
            if (!progress.completedAssignmentIds.includes(activeAssignment.id)) {
              toggleAssignmentCompleted(activeAssignment.id);
            }
          }}
          onClose={() => setActiveAssignment(null)}
        />
      )}
    </div>
  );
}

function MaterialReaderModal({
  material,
  onClose,
}: {
  material: ClassMaterial;
  onClose: () => void;
}) {
  const { language, tx } = useLanguage();
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
              {localizeSubjectName(material.subject, getSubjectMeta(material.subject).name, language)}{' '}
              · {material.category} · {tx('GV', 'Teacher')} {material.ownerTeacherName}
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

          {material.keyPoints.length > 0 && (
            <div>
              <h4 className="text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                {tx('Điểm trọng tâm cần nắm', 'Key Takeaways')}
              </h4>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-700 dark:text-slate-200">
                {material.keyPoints.map((pt, idx) => (
                  <li key={idx}>{pt}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h4 className="text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              {tx('Nội dung tài liệu', 'Material Content')}
            </h4>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
              {material.contentText}
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 px-6 py-3.5 dark:border-slate-800">
          <button
            type="button"
            onClick={() => downloadClassMaterialTxt(material)}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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
            className="inline-flex cursor-pointer items-center whitespace-nowrap rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            {tx('Đóng', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
}

function isAssignmentQuestionCorrect(
  q: Question,
  mcAnswers: Record<string, number>,
  tfAnswers: Record<string, Partial<Record<'a' | 'b' | 'c' | 'd', boolean>>>,
  shortAnswers: Record<string, string>,
): boolean {
  if (q.type === 'multiple_choice') {
    return mcAnswers[q.id] === q.correctOptionIndex;
  }
  if (q.type === 'true_false') {
    const chosenMap = tfAnswers[q.id] ?? {};
    const stmts = q.statements ?? [];
    return stmts.length > 0 && stmts.every((st) => chosenMap[st.id] === st.isTrue);
  }
  return isShortAnswerCorrect(shortAnswers[q.id] ?? '', q.shortAnswer, q.acceptedAnswers);
}

function AssignmentPracticeModal({
  assignment,
  questions,
  practiceAnswers,
  tfAnswers,
  shortAnswers,
  practiceSubmitted,
  onSelectAnswer,
  onToggleTrueFalse,
  onChangeShortAnswer,
  onSubmitPractice,
  onClose,
}: {
  assignment: ClassAssignment;
  questions: Question[];
  practiceAnswers: Record<string, number>;
  tfAnswers: Record<string, Partial<Record<'a' | 'b' | 'c' | 'd', boolean>>>;
  shortAnswers: Record<string, string>;
  practiceSubmitted: boolean;
  onSelectAnswer: (qid: string, optIdx: number) => void;
  onToggleTrueFalse: (qid: string, stmtId: 'a' | 'b' | 'c' | 'd', val: boolean) => void;
  onChangeShortAnswer: (qid: string, val: string) => void;
  onSubmitPractice: () => void;
  onClose: () => void;
}) {
  const { language, tx } = useLanguage();
  const correctTotal = questions.filter((q) =>
    isAssignmentQuestionCorrect(q, practiceAnswers, tfAnswers, shortAnswers),
  ).length;

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
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
              {localizeSubjectName(assignment.subject, getSubjectMeta(assignment.subject).name, language)}{' '}
              · {tx('GV', 'Teacher')} {assignment.ownerTeacherName} · {tx('Hạn', 'Due')}{' '}
              {assignment.dueDateLabel}
            </p>
            <h3 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              {assignment.title}
            </h3>
          </div>
          <button
            type="button"
            aria-label={tx('Đóng bài tập', 'Close assignment')}
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-6">
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            {assignment.description}
          </p>

          {questions.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {tx(
                'Hiện chưa có câu hỏi luyện tập tự động cho môn này.',
                'No practice questions available yet.',
              )}
            </p>
          ) : (
            questions.map((q, qIdx) => {
              const chosen = practiceAnswers[q.id];
              const tfChosen = tfAnswers[q.id] ?? {};
              const shortVal = shortAnswers[q.id] ?? '';
              const shortOk = isShortAnswerCorrect(shortVal, q.shortAnswer, q.acceptedAnswers);

              return (
                <div
                  key={q.id}
                  className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                >
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {tx(`Câu ${qIdx + 1}.`, `Q${qIdx + 1}.`)} {q.prompt}
                  </p>

                  {q.type === 'multiple_choice' && (
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {(q.options ?? []).map((opt, optIdx) => {
                        const isSelected = chosen === optIdx;
                        const isCorrect = q.correctOptionIndex === optIdx;
                        let style =
                          'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800';
                        if (practiceSubmitted) {
                          if (isCorrect) {
                            style =
                              'border-emerald-500 bg-emerald-50 font-semibold text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-200';
                          } else if (isSelected && !isCorrect) {
                            style =
                              'border-red-400 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300';
                          }
                        } else if (isSelected) {
                          style =
                            'border-blue-700 bg-blue-50 font-semibold text-blue-900 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-200';
                        }

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            disabled={practiceSubmitted}
                            onClick={() => onSelectAnswer(q.id, optIdx)}
                            className={`cursor-pointer rounded-lg border px-3 py-2 text-left text-xs transition-colors ${style}`}
                          >
                            <span className="mr-1.5 font-mono font-bold">
                              {OPTION_LETTERS[optIdx]}.
                            </span>
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {q.type === 'true_false' && (
                    <div className="mt-3 space-y-2">
                      {(q.statements ?? []).map((st) => {
                        const selectedVal = tfChosen[st.id];
                        return (
                          <div
                            key={st.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950/50"
                          >
                            <span className="min-w-0 flex-1 text-slate-800 dark:text-slate-200">
                              <strong className="font-mono">{st.id})</strong> {st.text}
                            </span>
                            <div className="flex shrink-0 items-center gap-1.5">
                              {([true, false] as const).map((boolChoice) => {
                                const isChosen = selectedVal === boolChoice;
                                const isKey = st.isTrue === boolChoice;
                                let cls =
                                  'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
                                if (practiceSubmitted) {
                                  if (isKey) {
                                    cls =
                                      'border-emerald-600 bg-emerald-50 font-bold text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-200';
                                  } else if (isChosen && !isKey) {
                                    cls =
                                      'border-red-400 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300';
                                  }
                                } else if (isChosen) {
                                  cls =
                                    'border-blue-700 bg-blue-50 font-bold text-blue-900 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-200';
                                }
                                return (
                                  <button
                                    key={String(boolChoice)}
                                    type="button"
                                    disabled={practiceSubmitted}
                                    onClick={() => onToggleTrueFalse(q.id, st.id, boolChoice)}
                                    className={`cursor-pointer whitespace-nowrap rounded border px-2.5 py-1 font-mono text-[11px] transition-colors ${cls}`}
                                  >
                                    {boolChoice ? tx('Đúng', 'True') : tx('Sai', 'False')}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {q.type === 'short_answer' && (
                    <div className="mt-3 space-y-2">
                      <input
                        type="text"
                        disabled={practiceSubmitted}
                        value={shortVal}
                        onChange={(e) => onChangeShortAnswer(q.id, e.target.value)}
                        placeholder={tx('Nhập câu trả lời của bạn...', 'Enter your answer...')}
                        className={`h-9 w-full rounded-lg border px-3 font-mono text-xs sm:w-72 ${
                          practiceSubmitted
                            ? shortOk
                              ? 'border-emerald-500 bg-emerald-50 font-bold text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-200'
                              : 'border-red-400 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200'
                            : 'border-slate-300 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
                        }`}
                      />
                      {practiceSubmitted && !shortOk && q.shortAnswer && (
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          {tx('Đáp án đúng:', 'Correct answer:')}{' '}
                          <span className="font-mono">{q.shortAnswer}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {practiceSubmitted && q.explanation && (
                    <p className="mt-2.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      <strong className="text-slate-900 dark:text-slate-100">
                        {tx('Lời giải:', 'Explanation:')}
                      </strong>{' '}
                      {q.explanation}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-3.5 dark:border-slate-800">
          {practiceSubmitted ? (
            <p className="text-xs font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
              {tx('Kết quả:', 'Score:')} {correctTotal}/{questions.length}{' '}
              {tx('câu đúng', 'correct')}
            </p>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {tx(
                'Hoàn thành câu trả lời rồi bấm Kiểm tra & Hoàn thành.',
                'Complete your answers then click Check & Complete.',
              )}
            </p>
          )}

          <div className="flex items-center gap-2">
            {!practiceSubmitted && questions.length > 0 && (
              <button
                type="button"
                onClick={onSubmitPractice}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{tx('Kiểm tra & Hoàn thành', 'Check & Complete')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex cursor-pointer items-center whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {tx('Đóng', 'Close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
