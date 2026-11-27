import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Moon,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
  User,
  UserPlus,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { SubjectId, UserAccount, UserRole } from '../types/exam';
import {
  confirmPasswordReset,
  loginWithCredentials,
  quickLoginDemoAccount,
  registerAccount,
  requestPasswordResetCode,
  setCurrentSessionUserId,
  type PasswordResetChallenge,
} from '../utils/authStore';
import { useLanguage } from '../utils/i18n';
import { useSubjects } from '../utils/subjectStore';
import { SubjectSearchSelect } from './SubjectSearchSelect';

export const NTPEXION_LOGO_PATH = '/assets/aistudio/logo_dcbecf4a.png';

interface IntroLandingPageProps {
  embedded?: boolean;
  currentUser: UserAccount | null;
  role: UserRole;
  isDark: boolean;
  onToggleTheme: () => void;
  initialAuthMode?: 'login' | 'register';
  allowSelfRegistration?: boolean;
  stats: {
    examsCount: number;
    questionsCount: number;
    classesCount: number;
    submissionsCount: number;
  };
  onAuthenticated?: (user: UserAccount) => void;
  onLogout?: () => void;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
  onEnterWorkspace: (preferredRole?: UserRole) => void;
}

const DEMO_ACCOUNTS: Array<{
  role: UserRole;
  email?: string;
  labelVi: string;
  labelEn: string;
  metaVi: string;
  metaEn: string;
}> = [
  {
    role: 'student',
    email: 'hocsinh@kythi2025.edu.vn',
    labelVi: 'Học sinh 1 · Nguyễn Minh Anh',
    labelEn: 'Student 1 · Nguyen Minh Anh',
    metaVi: 'HV0001 · SBD 0102588',
    metaEn: 'HV0001 · ID 0102588',
  },
  {
    role: 'student',
    email: 'hs.nam@kythi2025.edu.vn',
    labelVi: 'Học sinh 2 · Lê Hoàng Nam',
    labelEn: 'Student 2 · Le Hoang Nam',
    metaVi: 'HV0002 · SBD 0102601',
    metaEn: 'HV0002 · ID 0102601',
  },
  {
    role: 'student',
    email: 'hs.linh@kythi2025.edu.vn',
    labelVi: 'Học sinh 3 · Phạm Thảo Linh',
    labelEn: 'Student 3 · Pham Thao Linh',
    metaVi: 'HV0003 · SBD 0102602',
    metaEn: 'HV0003 · ID 0102602',
  },
  {
    role: 'student',
    email: 'hs.khang@kythi2025.edu.vn',
    labelVi: 'Học sinh 4 · Võ Minh Khang',
    labelEn: 'Student 4 · Vo Minh Khang',
    metaVi: 'HV0004 · SBD 0102603',
    metaEn: 'HV0004 · ID 0102603',
  },
  {
    role: 'teacher',
    email: 'giaovien@kythi2025.edu.vn',
    labelVi: 'Giáo viên 1 · ThS. Trần Quốc Bảo',
    labelEn: 'Teacher 1 · MSc. Tran Quoc Bao',
    metaVi: 'GV0001 · Dữ liệu mẫu',
    metaEn: 'GV0001 · Sample data',
  },
  {
    role: 'teacher',
    email: 'gv.hai@kythi2025.edu.vn',
    labelVi: 'Giáo viên 2 · Cô Nguyễn Thị Hải',
    labelEn: 'Teacher 2 · Ms. Nguyen Thi Hai',
    metaVi: 'GV0002 · Tách quyền',
    metaEn: 'GV0002 · Isolated view',
  },
  {
    role: 'admin',
    labelVi: 'Quản trị viên · Admin hệ thống',
    labelEn: 'Administrator · System Admin',
    metaVi: 'AD0001 · Toàn quyền',
    metaEn: 'AD0001 · Full access',
  },
];

const FOOTER_SPARK_STORAGE_KEY = 'kythi2025_footer_spark_idx_v1';

const FOOTER_STUDY_SPARKS: Array<{ vi: string; en: string }> = [
  {
    vi: 'Bình tĩnh, tự tin — câu dễ ăn chắc, câu khó để sau!',
    en: 'Stay calm and confident — lock in easy points first!',
  },
  {
    vi: 'Mỗi đề luyện tập hôm nay là một bước gần hơn tới điểm 10!',
    en: 'Every practice test today brings you closer to top marks!',
  },
  {
    vi: 'Đọc kỹ đề bài hai lần trước khi chốt đáp án nhé!',
    en: 'Read each question twice before locking your final answer!',
  },
  {
    vi: 'Hít sâu một hơi, bạn làm tốt hơn mình nghĩ đấy!',
    en: 'Take a deep breath — your preparation is ready to shine!',
  },
  {
    vi: 'Chúc bạn làm bài thật mượt, đúng ý và bứt phá điểm số!',
    en: 'Wishing you a smooth session and a personal-best score!',
  },
  {
    vi: 'Phân bổ thời gian hợp lý: đừng dừng quá lâu ở một câu hỏi!',
    en: 'Pace yourself wisely — never get stuck too long on one item!',
  },
  {
    vi: 'Kiểm tra lại các câu đánh dấu cờ trước khi bấm nộp bài!',
    en: 'Review your flagged questions once more before submitting!',
  },
  {
    vi: 'Kiên trì từng ngày nhỏ sẽ tạo nên kết quả lớn trong phòng thi!',
    en: 'Consistent daily practice builds big results on exam day!',
  },
];

function pickDifferentSparkIndex(lastIndex: number | null): number {
  const total = FOOTER_STUDY_SPARKS.length;
  if (total <= 1) return 0;
  if (lastIndex === null || !Number.isInteger(lastIndex) || lastIndex < 0 || lastIndex >= total) {
    return Math.floor(Math.random() * total);
  }
  const step = 1 + Math.floor(Math.random() * (total - 1));
  return (lastIndex + step) % total;
}

export function IntroLandingPage({
  embedded = false,
  currentUser,
  role: _role,
  isDark,
  onToggleTheme,
  initialAuthMode = 'login',
  allowSelfRegistration = true,
  stats: _stats,
  onAuthenticated,
  onLogout,
  onOpenAuth,
  onEnterWorkspace,
}: IntroLandingPageProps) {
  useSubjects();
  const { language, setLanguage, tx } = useLanguage();
  const isEn = language === 'en';

  const [logoFailed, setLogoFailed] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>(
    initialAuthMode === 'register' && allowSelfRegistration ? 'register' : 'login',
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [showAllDemoAccounts, setShowAllDemoAccounts] = useState(false);
  const [footerSparkIndex, setFooterSparkIndex] = useState<number>(() => {
    try {
      const savedRaw = localStorage.getItem(FOOTER_SPARK_STORAGE_KEY);
      const savedIdx = savedRaw !== null ? Number.parseInt(savedRaw, 10) : null;
      const nextIdx = pickDifferentSparkIndex(
        savedIdx !== null && !Number.isNaN(savedIdx) ? savedIdx : null,
      );
      localStorage.setItem(FOOTER_SPARK_STORAGE_KEY, String(nextIdx));
      return nextIdx;
    } catch {
      return Math.floor(Math.random() * FOOTER_STUDY_SPARKS.length);
    }
  });

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);

  // Forgot password state
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [resetChallenge, setResetChallenge] = useState<PasswordResetChallenge | null>(null);
  const [resetOtpInput, setResetOtpInput] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPw, setShowResetPw] = useState(false);

  // Register form state
  const [regRole, setRegRole] = useState<UserRole>('student');
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPw, setShowRegPw] = useState(false);
  const [regSbd, setRegSbd] = useState('');
  const [skipRegSbd, setSkipRegSbd] = useState(false);
  const [regPhone, setRegPhone] = useState('');
  const [regSchool, setRegSchool] = useState('THPT Chuyên Chu Văn An');
  const [skipRegSchool, setSkipRegSchool] = useState(false);
  const [regSubject, setRegSubject] = useState<SubjectId>('');

  const authPanelRef = useRef<HTMLDivElement | null>(null);
  const loginInputRef = useRef<HTMLInputElement | null>(null);
  const registerInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setAuthMode(
      initialAuthMode === 'register' && allowSelfRegistration ? 'register' : 'login',
    );
  }, [initialAuthMode, allowSelfRegistration]);

  const focusAuthPanel = (targetMode: 'login' | 'register' = 'login') => {
    if (currentUser) {
      onEnterWorkspace(currentUser.role);
      return;
    }
    if (embedded && onOpenAuth) {
      onOpenAuth(targetMode);
      return;
    }
    const resolved =
      targetMode === 'register' && allowSelfRegistration ? 'register' : 'login';
    setAuthMode(resolved);
    setError(null);
    setSuccessNote(null);
    authPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => {
      if (resolved === 'register') {
        registerInputRef.current?.focus();
      } else {
        loginInputRef.current?.focus();
      }
    }, 220);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNote(null);
    setLoading(true);
    try {
      const result = await loginWithCredentials(loginIdentifier, loginPassword);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onAuthenticated?.(result.user);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNote(null);

    if (regPassword !== regConfirmPassword) {
      setError(
        tx(
          'Mật khẩu xác nhận không khớp. Vui lòng nhập lại.',
          'Password confirmation does not match. Please try again.',
        ),
      );
      return;
    }
    if (regRole === 'teacher' && !regSubject.trim()) {
      setError(
        tx(
          'Vui lòng tìm kiếm và chọn Môn phụ trách chính.',
          'Please search and select your primary teaching subject.',
        ),
      );
      return;
    }

    const safeRole: UserRole = regRole === 'teacher' ? 'teacher' : 'student';

    setLoading(true);
    try {
      const result = await registerAccount({
        email: regEmail,
        password: regPassword,
        fullName: regFullName,
        role: safeRole,
        phone: regPhone,
        studentSbd: safeRole === 'student' && !skipRegSbd ? regSbd : undefined,
        schoolName: safeRole === 'teacher' && !skipRegSchool ? regSchool : undefined,
        subject: safeRole === 'teacher' ? regSubject : undefined,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setCurrentSessionUserId(result.user.id);
      onAuthenticated?.(result.user);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (demoRole: UserRole, email?: string) => {
    setError(null);
    setSuccessNote(null);
    setLoading(true);
    try {
      const user = await quickLoginDemoAccount(demoRole, email);
      onAuthenticated?.(user);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForgot = () => {
    setError(null);
    setSuccessNote(null);
    setForgotIdentifier(loginIdentifier);
    setResetChallenge(null);
    setResetOtpInput('');
    setResetNewPassword('');
    setResetConfirmPassword('');
    setAuthMode('forgot');
  };

  const handleRequestResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNote(null);
    setLoading(true);
    try {
      const res = await requestPasswordResetCode(forgotIdentifier);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResetChallenge(res.challenge);
      setResetOtpInput('');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNote(null);
    if (resetNewPassword !== resetConfirmPassword) {
      setError(
        tx(
          'Mật khẩu mới xác nhận không khớp. Vui lòng nhập lại.',
          'New password confirmation does not match. Please try again.',
        ),
      );
      return;
    }
    setLoading(true);
    try {
      const res = await confirmPasswordReset(
        forgotIdentifier,
        resetOtpInput,
        resetNewPassword,
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setLoginIdentifier(res.user.email);
      setLoginPassword('');
      setResetChallenge(null);
      setAuthMode('login');
      setSuccessNote(
        tx(
          `Đã đặt lại mật khẩu thành công cho ${res.user.fullName} (${res.user.email}). Vui lòng đăng nhập bằng mật khẩu mới.`,
          `Password has been reset for ${res.user.fullName} (${res.user.email}). Please sign in with your new password.`,
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const showUnifiedAuthCard = !embedded && !currentUser;
  const primaryCtaLabel = currentUser
    ? tx('Vào không gian làm việc', 'Enter Workspace')
    : tx('Đăng nhập', 'Sign In');

  const roleBadgeLabel =
    currentUser?.role === 'admin'
      ? tx('Quản trị viên', 'Administrator')
      : currentUser?.role === 'teacher'
        ? tx('Giáo viên', 'Teacher')
        : tx('Học sinh', 'Student');

  return (
    <div
      className={
        embedded
          ? 'bg-slate-50 text-slate-900 dark:bg-[#040D22] dark:text-slate-100'
          : 'flex min-h-screen flex-col bg-slate-50 text-slate-900 transition-colors duration-150 dark:bg-[#040D22] dark:text-slate-100'
      }
    >
      {/* Standalone Top Bar (strict 3-zone contract when viewed before workspace) */}
      {!embedded && (
        <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur-sm dark:border-[#102558] dark:bg-[#061844]/95">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
            <a
              href="#top"
              className="flex shrink-0 items-center gap-2.5 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0057FF]"
            >
              {!logoFailed && (
                <img
                  src={NTPEXION_LOGO_PATH}
                  alt="NTPEXION"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoFailed(true)}
                  className="h-9 w-auto rounded-md border border-slate-200/80 bg-white object-contain px-1 py-0.5"
                />
              )}
              <span className="font-display text-lg font-extrabold tracking-tight text-[#061844] dark:text-white">
                NTPE<span className="text-[#0057FF] dark:text-[#00D4FF]">X</span>ION
              </span>
            </a>

            <p className="hidden whitespace-nowrap text-xs font-semibold tracking-wide text-slate-600 md:block dark:text-cyan-200/90">
              {isEn
                ? 'Innovation in Every Exam · Accuracy & Transparency in Every Assessment'
                : 'Innovation in Every Exam · Chuẩn xác & Minh bạch trong từng kỳ thi'}
            </p>

            <div className="flex shrink-0 items-center gap-2.5">
              <div
                role="group"
                aria-label={isEn ? 'Select display language' : 'Chọn ngôn ngữ hiển thị'}
                className="inline-flex h-9 shrink-0 items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/80"
              >
                <button
                  type="button"
                  onClick={() => setLanguage('vi')}
                  aria-pressed={language === 'vi'}
                  aria-label="Tiếng Việt"
                  title="Tiếng Việt"
                  className={`inline-flex h-full cursor-pointer items-center justify-center rounded-md px-1.5 transition-all ${
                    language === 'vi'
                      ? 'bg-white shadow-xs ring-1 ring-[#0057FF]/30 dark:bg-[#061844] dark:ring-[#22D3EE]/40'
                      : 'opacity-55 hover:bg-white/60 hover:opacity-100 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <svg
                    viewBox="0 0 30 20"
                    aria-hidden="true"
                    className="h-3.5 w-5 rounded-[2px] ring-1 ring-black/10 dark:ring-white/15"
                  >
                    <rect width="30" height="20" fill="#DA251D" />
                    <polygon
                      points="15,4 16.35,8.15 20.71,8.15 17.18,10.71 18.53,14.85 15,12.29 11.47,14.85 12.82,10.71 9.29,8.15 13.65,8.15"
                      fill="#FFFF00"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  aria-pressed={language === 'en'}
                  aria-label="English"
                  title="English"
                  className={`inline-flex h-full cursor-pointer items-center justify-center rounded-md px-1.5 transition-all ${
                    language === 'en'
                      ? 'bg-white shadow-xs ring-1 ring-[#0057FF]/30 dark:bg-[#061844] dark:ring-[#22D3EE]/40'
                      : 'opacity-55 hover:bg-white/60 hover:opacity-100 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <svg
                    viewBox="0 0 60 40"
                    aria-hidden="true"
                    className="h-3.5 w-5 rounded-[2px] ring-1 ring-black/10 dark:ring-white/15"
                  >
                    <rect width="60" height="40" fill="#012169" />
                    <path d="M0,0 L60,40 M60,0 L0,40" stroke="#FFFFFF" strokeWidth="8" />
                    <path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" strokeWidth="4" />
                    <path d="M30,0 L30,40 M0,20 L60,20" stroke="#FFFFFF" strokeWidth="12" />
                    <path d="M30,0 L30,40 M0,20 L60,20" stroke="#C8102E" strokeWidth="7" />
                  </svg>
                </button>
              </div>
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label={
                  isDark
                    ? isEn
                      ? 'Switch to light theme'
                      : 'Chuyển sang giao diện sáng'
                    : isEn
                      ? 'Switch to dark theme'
                      : 'Chuyển sang giao diện tối'
                }
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#1B3A82] dark:bg-[#0B225B] dark:text-slate-200 dark:hover:bg-[#12307A]"
              >
                {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => focusAuthPanel('login')}
                className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#0057FF] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#061844] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0057FF] dark:hover:bg-[#06B6D4] dark:hover:text-[#040D22]"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>{primaryCtaLabel}</span>
              </button>
            </div>
          </div>
        </header>
      )}

      <main
        id="top"
        className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-12"
      >
        {/* ================================================================= */}
        {/* UNIFIED HERO: Editorial Brand Proposition + Integrated Auth Card   */}
        {/* ================================================================= */}
        {showUnifiedAuthCard ? (
          <section className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
            {/* Left Column: Unified Brand Proposition & Official NTPEXION Showcase Card */}
            <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white lg:col-span-6 dark:border-[#132B66] dark:bg-[#08173D]">
              <div className="flex flex-col justify-between gap-5 border-b border-slate-200 bg-gradient-to-br from-[#061844] via-[#0B2B78] to-[#0057FF] p-6 text-white sm:flex-row sm:items-center sm:px-9 sm:py-7 dark:border-[#132B66]">
                <div className="flex h-24 w-full shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white p-3 shadow-sm sm:h-24 sm:w-44">
                  {!logoFailed ? (
                    <img
                      src={NTPEXION_LOGO_PATH}
                      alt="Logo chính thức NTPEXION — Innovation in Every Exam"
                      referrerPolicy="no-referrer"
                      onError={() => setLogoFailed(true)}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="text-center">
                      <span className="font-display text-2xl font-extrabold tracking-tight text-[#061844]">
                        NTPE<span className="text-[#0057FF]">X</span>ION
                      </span>
                      <p className="mt-0.5 text-[11px] font-medium italic text-slate-600">
                        Innovation in Every Exam.
                      </p>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-2 text-xs">
                  <div>
                    <p className="font-display text-base font-bold tracking-tight text-white">
                      NTPEXION
                    </p>
                    <p className="mt-0.5 text-cyan-200/95">Innovation in Every Exam</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-1 flex-col justify-between p-7 sm:p-9">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-[#0057FF] dark:text-[#22D3EE]">
                    NTPEXION · Innovation in Every Exam
                  </p>
                  <h1 className="mt-3.5 font-sans text-[1.9rem] font-bold leading-[1.22] tracking-[-0.025em] text-[#061844] [text-wrap:balance] sm:text-[2.35rem] lg:text-[2.55rem] dark:text-white">
                    {tx('Chào mừng bạn đến với', 'Welcome to')}{' '}
                    <span className="inline-block bg-gradient-to-r from-[#0057FF] via-[#0284C7] to-[#06B6D4] bg-clip-text font-display font-extrabold tracking-tight text-transparent dark:from-[#60A5FA] dark:via-[#22D3EE] dark:to-[#67E8F9]">
                      NTPEXION
                    </span>
                  </h1>
                  <p className="mt-4 border-l-2 border-[#0057FF] pl-3.5 text-sm leading-relaxed text-slate-600 sm:text-base dark:border-[#22D3EE] dark:text-slate-300">
                    {tx(
                      'Đồng hành cùng giáo viên và học sinh trong mọi kỳ kiểm tra — từ tổ chức lớp học, tạo đề thi đến chấm điểm và theo dõi kết quả tức thì.',
                      'Built for teachers and students across every exam — uniting class management, test authoring, live supervision, and instant grading.',
                    )}
                  </p>
                </div>

                <ul className="mt-7 space-y-3 border-t border-slate-100 pt-6 dark:border-[#132B66]">
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#0057FF] dark:bg-[#0B225B] dark:text-[#22D3EE]">
                      <BookOpenCheck className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#061844] sm:text-sm dark:text-white">
                        {tx('Soạn đề & chấm điểm tự động', 'Smart Authoring & Instant Grading')}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {tx(
                          'Tạo ngân hàng câu hỏi, trộn mã đề linh hoạt và trả điểm chính xác ngay khi nộp bài.',
                          'Build question banks, shuffle exam variants, and deliver accurate scores immediately.',
                        )}
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#0057FF] dark:bg-[#0B225B] dark:text-[#22D3EE]">
                      <GraduationCap className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#061844] sm:text-sm dark:text-white">
                        {tx('Không gian lớp học tập trung', 'Unified Classroom Space')}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {tx(
                          'Kết nối thầy và trò qua mã lớp riêng tư để đồng bộ bài tập, tài liệu và lịch thi.',
                          'Connect teachers and students via private class codes for exams, materials, and schedules.',
                        )}
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#0057FF] dark:bg-[#0B225B] dark:text-[#22D3EE]">
                      <ShieldCheck className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#061844] sm:text-sm dark:text-white">
                        {tx('Phòng thi an toàn, minh bạch', 'Fair & Transparent Exam Room')}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {tx(
                          'Giám sát tiến trình làm bài theo thời gian thực và tổng hợp bảng điểm rõ ràng.',
                          'Monitor active exam sessions in real time with clean, exportable score reports.',
                        )}
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>

            {/* Right Column: Redesigned Integrated Login / Register / Recovery Card */}
            <div
              id="auth-panel"
              ref={authPanelRef}
              className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_14px_40px_-18px_rgba(6,24,68,0.14)] lg:col-span-6 dark:border-[#132B66] dark:bg-[#08173D] dark:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.65)]"
            >
              {/* Top Brand Accent Bar */}
              <div
                aria-hidden="true"
                className="h-1 w-full bg-gradient-to-r from-[#061844] via-[#0057FF] to-[#06B6D4] dark:from-[#0057FF] dark:via-[#06B6D4] dark:to-[#22D3EE]"
              />

              <div className="flex flex-1 flex-col justify-between p-6 sm:p-8">
                <div>
                  {/* Auth Card Header & Animated Segmented Switcher */}
                  <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-[#132B66]">
                    <div>
                      <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-[#0057FF] dark:text-[#22D3EE]">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#0057FF] dark:bg-[#22D3EE]" />
                        {tx('Cổng truy cập tài khoản', 'Account Access Portal')}
                      </p>
                      <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-[#061844] dark:text-white">
                        {authMode === 'register'
                          ? tx('Tạo tài khoản mới', 'Create New Account')
                          : authMode === 'forgot'
                            ? tx('Khôi phục mật khẩu', 'Reset Password')
                            : tx('Đăng nhập hệ thống', 'Sign In to NTPEXION')}
                      </h2>
                    </div>

                    {authMode !== 'forgot' && (
                      <div
                        role="tablist"
                        aria-label={tx('Chế độ xác thực', 'Authentication mode')}
                        className={`relative grid shrink-0 gap-1 rounded-xl border border-[#0057FF]/20 bg-gradient-to-r from-blue-50/95 via-slate-100/90 to-cyan-50/95 p-1 shadow-inner dark:border-[#1B3A82] dark:from-[#040D22] dark:via-[#061844] dark:to-[#040D22] ${
                          allowSelfRegistration ? 'grid-cols-2' : 'grid-cols-1'
                        }`}
                      >
                        <button
                          type="button"
                          role="tab"
                          aria-selected={authMode === 'login'}
                          onClick={() => {
                            setAuthMode('login');
                            setError(null);
                            setSuccessNote(null);
                          }}
                          className={`group relative z-10 cursor-pointer whitespace-nowrap rounded-lg px-4 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-[0.96] ${
                            authMode === 'login'
                              ? 'text-white'
                              : 'text-slate-600 hover:bg-white/60 hover:text-[#0057FF] dark:text-slate-300 dark:hover:bg-[#0B225B]/60 dark:hover:text-[#22D3EE]'
                          }`}
                        >
                          {authMode === 'login' && (
                            <motion.span
                              layoutId="auth-mode-indicator"
                              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                              className="absolute inset-0 -z-10 overflow-hidden rounded-lg bg-gradient-to-r from-[#0057FF] via-[#0284C7] to-[#06B6D4] shadow-md shadow-[#0057FF]/30 ring-1 ring-white/25"
                            >
                              <span
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                              />
                            </motion.span>
                          )}
                          {tx('Đăng nhập', 'Sign In')}
                        </button>
                        {allowSelfRegistration && (
                          <button
                            type="button"
                            role="tab"
                            aria-selected={authMode === 'register'}
                            onClick={() => {
                              setAuthMode('register');
                              setError(null);
                              setSuccessNote(null);
                            }}
                            className={`group relative z-10 cursor-pointer whitespace-nowrap rounded-lg px-4 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-[0.96] ${
                              authMode === 'register'
                                ? 'text-white'
                                : 'text-slate-600 hover:bg-white/60 hover:text-[#0891B2] dark:text-slate-300 dark:hover:bg-[#0B225B]/60 dark:hover:text-[#22D3EE]'
                            }`}
                          >
                            {authMode === 'register' && (
                              <motion.span
                                layoutId="auth-mode-indicator"
                                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                                className="absolute inset-0 -z-10 overflow-hidden rounded-lg bg-gradient-to-r from-[#06B6D4] via-[#0284C7] to-[#0057FF] shadow-md shadow-[#06B6D4]/30 ring-1 ring-white/25"
                              >
                                <span
                                  aria-hidden="true"
                                  className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                                />
                              </motion.span>
                            )}
                            {tx('Đăng ký', 'Register')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <AnimatePresence mode="sync">
                    {error && (
                      <motion.div
                        key="auth-error"
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.18 }}
                        role="alert"
                        className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/90 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300"
                      >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{error}</span>
                      </motion.div>
                    )}

                    {successNote && (
                      <motion.div
                        key="auth-success"
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.18 }}
                        className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/90 px-3.5 py-2.5 text-xs font-medium text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{successNote}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence mode="wait">
                    {/* LOGIN FORM */}
                    {authMode === 'login' && (
                      <motion.form
                        key="login-form"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        onSubmit={handleLoginSubmit}
                        className="mt-5 space-y-4"
                      >
                        <div>
                          <label
                            htmlFor="landing-login-id"
                            className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                          >
                            {tx(
                              'Email, ID tài khoản hoặc Số báo danh (SBD)',
                              'Email, Account ID, or Exam Registration ID',
                            )}
                          </label>
                          <div className="group relative mt-1.5">
                            <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors duration-150 group-focus-within:text-[#0057FF] dark:text-slate-500 dark:group-focus-within:text-[#22D3EE]" />
                            <input
                              ref={loginInputRef}
                              id="landing-login-id"
                              type="text"
                              required
                              value={loginIdentifier}
                              onChange={(e) => setLoginIdentifier(e.target.value)}
                              placeholder={tx(
                                'VD: hocsinh@kythi2025.edu.vn, HV0001 hoặc 0102588',
                                'e.g. hocsinh@kythi2025.edu.vn, HV0001 or 0102588',
                              )}
                              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 pr-3.5 pl-10 text-sm text-slate-900 transition-all duration-150 placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0057FF] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#0057FF]/10 dark:border-[#1B3A82] dark:bg-[#040D22] dark:text-slate-100 dark:hover:border-[#2B52AD] dark:focus:border-[#22D3EE] dark:focus:ring-[#22D3EE]/15"
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <label
                              htmlFor="landing-login-pw"
                              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                            >
                              {tx('Mật khẩu', 'Password')}
                            </label>
                            <button
                              type="button"
                              onClick={handleOpenForgot}
                              className="cursor-pointer rounded-md px-1.5 py-0.5 text-xs font-semibold text-[#0057FF] transition-all duration-150 hover:bg-blue-50 hover:text-[#061844] active:scale-95 dark:text-[#22D3EE] dark:hover:bg-[#0B225B] dark:hover:text-white"
                            >
                              {tx('Quên mật khẩu?', 'Forgot password?')}
                            </button>
                          </div>
                          <div className="group relative mt-1.5">
                            <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors duration-150 group-focus-within:text-[#0057FF] dark:text-slate-500 dark:group-focus-within:text-[#22D3EE]" />
                            <input
                              id="landing-login-pw"
                              type={showLoginPw ? 'text' : 'password'}
                              required
                              value={loginPassword}
                              onChange={(e) => setLoginPassword(e.target.value)}
                              placeholder={tx('Nhập mật khẩu tài khoản', 'Enter your password')}
                              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 pr-11 pl-10 text-sm text-slate-900 transition-all duration-150 placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0057FF] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#0057FF]/10 dark:border-[#1B3A82] dark:bg-[#040D22] dark:text-slate-100 dark:hover:border-[#2B52AD] dark:focus:border-[#22D3EE] dark:focus:ring-[#22D3EE]/15"
                            />
                            <button
                              type="button"
                              aria-label={
                                showLoginPw
                                  ? tx('Ẩn mật khẩu', 'Hide password')
                                  : tx('Hiện mật khẩu', 'Show password')
                              }
                              onClick={() => setShowLoginPw((v) => !v)}
                              className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-lg p-1.5 text-slate-400 transition-all duration-150 hover:bg-slate-200/70 hover:text-slate-700 active:scale-90 dark:text-slate-500 dark:hover:bg-[#0B225B] dark:hover:text-slate-200"
                            >
                              {showLoginPw ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={loading}
                          className="group relative mt-2 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-xl bg-gradient-to-r from-[#0057FF] to-[#0284C7] px-5 text-sm font-semibold text-white shadow-md shadow-[#0057FF]/20 transition-all duration-200 hover:-translate-y-0.5 hover:from-[#004AE0] hover:to-[#06B6D4] hover:shadow-lg hover:shadow-[#0057FF]/30 active:translate-y-0 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-60 dark:from-[#0057FF] dark:to-[#0891B2] dark:hover:from-[#0284C7] dark:hover:to-[#22D3EE] dark:hover:text-[#040D22]"
                        >
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
                          />
                          <LogIn className="relative z-10 h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                          <span className="relative z-10">
                            {loading
                              ? tx('Đang xác thực...', 'Signing in...')
                              : tx('Đăng nhập vào hệ thống', 'Sign In to System')}
                          </span>
                          <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                        </button>

                        {!allowSelfRegistration && (
                          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                            {tx(
                              'Tính năng tự đăng ký đang tạm khóa. Vui lòng liên hệ Quản trị viên hoặc Giáo viên để được cấp tài khoản.',
                              'Self-registration is currently disabled. Please contact an Administrator or Teacher for an account.',
                            )}
                          </p>
                        )}
                      </motion.form>
                    )}

                    {/* REGISTER FORM */}
                    {authMode === 'register' && (
                      <motion.form
                        key="register-form"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        onSubmit={handleRegisterSubmit}
                        className="mt-5 space-y-4"
                      >
                        <div>
                          <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {tx('Chọn loại tài khoản muốn tạo', 'Select account type')}
                          </span>
                          <div className="mt-2 grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => setRegRole('student')}
                              className={`group flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] ${
                                regRole === 'student'
                                  ? 'border-[#0057FF] bg-blue-50/80 shadow-sm shadow-[#0057FF]/10 ring-2 ring-[#0057FF]/15 dark:border-[#22D3EE] dark:bg-[#0B225B] dark:ring-[#22D3EE]/20'
                                  : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-white hover:shadow-xs dark:border-[#1B3A82] dark:bg-[#040D22] dark:hover:border-[#2B52AD]'
                              }`}
                            >
                              <span
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200 group-hover:scale-105 ${
                                  regRole === 'student'
                                    ? 'bg-[#0057FF] text-white dark:bg-[#22D3EE] dark:text-[#040D22]'
                                    : 'bg-white text-slate-400 shadow-2xs group-hover:text-[#0057FF] dark:bg-[#08173D] dark:text-slate-400 dark:group-hover:text-[#22D3EE]'
                                }`}
                              >
                                <GraduationCap className="h-4 w-4" />
                              </span>
                              <div>
                                <p className="text-xs font-bold text-[#061844] dark:text-white">
                                  {tx('Học sinh', 'Student')}
                                </p>
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => setRegRole('teacher')}
                              className={`group flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] ${
                                regRole === 'teacher'
                                  ? 'border-[#0057FF] bg-blue-50/80 shadow-sm shadow-[#0057FF]/10 ring-2 ring-[#0057FF]/15 dark:border-[#22D3EE] dark:bg-[#0B225B] dark:ring-[#22D3EE]/20'
                                  : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-white hover:shadow-xs dark:border-[#1B3A82] dark:bg-[#040D22] dark:hover:border-[#2B52AD]'
                              }`}
                            >
                              <span
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200 group-hover:scale-105 ${
                                  regRole === 'teacher'
                                    ? 'bg-[#0057FF] text-white dark:bg-[#22D3EE] dark:text-[#040D22]'
                                    : 'bg-white text-slate-400 shadow-2xs group-hover:text-[#0057FF] dark:bg-[#08173D] dark:text-slate-400 dark:group-hover:text-[#22D3EE]'
                                }`}
                              >
                                <ShieldCheck className="h-4 w-4" />
                              </span>
                              <div>
                                <p className="text-xs font-bold text-[#061844] dark:text-white">
                                  {tx('Giáo viên', 'Teacher')}
                                </p>
                              </div>
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                          <div>
                            <label
                              htmlFor="landing-reg-fullname"
                              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                            >
                              {tx('Họ và tên', 'Full name')}
                            </label>
                            <div className="group relative mt-1.5">
                              <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors duration-150 group-focus-within:text-[#0057FF] dark:text-slate-500 dark:group-focus-within:text-[#22D3EE]" />
                              <input
                                ref={registerInputRef}
                                id="landing-reg-fullname"
                                type="text"
                                required
                                value={regFullName}
                                onChange={(e) => setRegFullName(e.target.value)}
                                placeholder={
                                  regRole === 'student'
                                    ? tx('VD: Lê Hoàng Nam', 'e.g. Le Hoang Nam')
                                    : tx('VD: Cô Nguyễn Thu Hà', 'e.g. Ms. Nguyen Thu Ha')
                                }
                                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 pr-3.5 pl-10 text-sm text-slate-900 transition-all duration-150 hover:border-slate-300 focus:border-[#0057FF] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#0057FF]/10 dark:border-[#1B3A82] dark:bg-[#040D22] dark:text-slate-100 dark:focus:border-[#22D3EE]"
                              />
                            </div>
                          </div>

                          <div>
                            <label
                              htmlFor="landing-reg-email"
                              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                            >
                              {tx('Email đăng nhập', 'Email address')}
                            </label>
                            <div className="group relative mt-1.5">
                              <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors duration-150 group-focus-within:text-[#0057FF] dark:text-slate-500 dark:group-focus-within:text-[#22D3EE]" />
                              <input
                                id="landing-reg-email"
                                type="email"
                                required
                                value={regEmail}
                                onChange={(e) => setRegEmail(e.target.value)}
                                placeholder="name@school.edu.vn"
                                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 pr-3.5 pl-10 text-sm text-slate-900 transition-all duration-150 hover:border-slate-300 focus:border-[#0057FF] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#0057FF]/10 dark:border-[#1B3A82] dark:bg-[#040D22] dark:text-slate-100 dark:focus:border-[#22D3EE]"
                              />
                            </div>
                          </div>

                          {regRole === 'student' ? (
                            <>
                              <div>
                                <div className="flex items-center justify-between gap-2">
                                  <label
                                    htmlFor="landing-reg-sbd"
                                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                                  >
                                    {tx('Số báo danh (tùy chọn)', 'Student ID (optional)')}
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSkipRegSbd((prev) => {
                                        const next = !prev;
                                        if (next) setRegSbd('');
                                        return next;
                                      });
                                    }}
                                    className="cursor-pointer rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[#0057FF] transition-colors hover:bg-blue-50 dark:text-[#22D3EE] dark:hover:bg-[#0B225B]"
                                  >
                                    {skipRegSbd ? tx('Nhập lại', 'Enter ID') : tx('Bỏ qua', 'Skip')}
                                  </button>
                                </div>
                                {skipRegSbd ? (
                                  <div className="mt-1.5 flex h-10 items-center justify-between rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-3.5 text-xs text-slate-500 dark:border-[#1B3A82] dark:bg-[#040D22]/70 dark:text-slate-400">
                                    <span>{tx('Đã bỏ qua (tự động cấp SBD)', 'Skipped (auto-assigned ID)')}</span>
                                  </div>
                                ) : (
                                  <input
                                    id="landing-reg-sbd"
                                    type="text"
                                    value={regSbd}
                                    onChange={(e) => setRegSbd(e.target.value.toUpperCase())}
                                    placeholder={tx('VD: 0102699 (có thể để trống)', 'e.g. 0102699 (optional)')}
                                    className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 font-mono text-sm text-slate-900 uppercase tabular-nums transition-all duration-150 hover:border-slate-300 focus:border-[#0057FF] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#0057FF]/10 dark:border-[#1B3A82] dark:bg-[#040D22] dark:text-slate-100 dark:focus:border-[#22D3EE]"
                                  />
                                )}
                              </div>
                              <div>
                                <label
                                  htmlFor="landing-reg-phone"
                                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                                >
                                  {tx('Số điện thoại', 'Phone number')}
                                </label>
                                <div className="group relative mt-1.5">
                                  <Phone className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors duration-150 group-focus-within:text-[#0057FF] dark:text-slate-500 dark:group-focus-within:text-[#22D3EE]" />
                                  <input
                                    id="landing-reg-phone"
                                    type="tel"
                                    inputMode="tel"
                                    autoComplete="tel"
                                    required
                                    value={regPhone}
                                    onChange={(e) => setRegPhone(e.target.value)}
                                    placeholder={tx('VD: 0912 345 678', 'e.g. 0912 345 678')}
                                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 pr-3.5 pl-10 font-mono text-sm text-slate-900 tabular-nums transition-all duration-150 hover:border-slate-300 focus:border-[#0057FF] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#0057FF]/10 dark:border-[#1B3A82] dark:bg-[#040D22] dark:text-slate-100 dark:focus:border-[#22D3EE]"
                                  />
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div>
                                <div className="flex items-center justify-between gap-2">
                                  <label
                                    htmlFor="landing-reg-school"
                                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                                  >
                                    {tx('Trường / Đơn vị (tùy chọn)', 'School / Institution (optional)')}
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSkipRegSchool((prev) => {
                                        const next = !prev;
                                        if (next) setRegSchool('');
                                        return next;
                                      });
                                    }}
                                    className="cursor-pointer rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[#0057FF] transition-colors hover:bg-blue-50 dark:text-[#22D3EE] dark:hover:bg-[#0B225B]"
                                  >
                                    {skipRegSchool ? tx('Nhập lại', 'Enter') : tx('Bỏ qua', 'Skip')}
                                  </button>
                                </div>
                                {skipRegSchool ? (
                                  <div className="mt-1.5 flex h-10 items-center justify-between rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-3.5 text-xs text-slate-500 dark:border-[#1B3A82] dark:bg-[#040D22]/70 dark:text-slate-400">
                                    <span>{tx('Đã bỏ qua trường / đơn vị', 'Skipped school / unit')}</span>
                                  </div>
                                ) : (
                                  <input
                                    id="landing-reg-school"
                                    type="text"
                                    value={regSchool}
                                    onChange={(e) => setRegSchool(e.target.value)}
                                    placeholder={tx('VD: THPT Chuyên Hà Nội', 'e.g. Hanoi High School')}
                                    className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 text-sm text-slate-900 transition-all duration-150 hover:border-slate-300 focus:border-[#0057FF] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#0057FF]/10 dark:border-[#1B3A82] dark:bg-[#040D22] dark:text-slate-100 dark:focus:border-[#22D3EE]"
                                  />
                                )}
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                  {tx('Môn phụ trách chính', 'Primary subject')}
                                </label>
                                <SubjectSearchSelect
                                  value={regSubject}
                                  onChange={(val) => {
                                    setRegSubject(val);
                                    if (error) setError(null);
                                  }}
                                  placeholder={tx('Tìm tên môn phụ trách...', 'Search subject...')}
                                  ariaLabel={tx(
                                    'Tìm kiếm và chọn môn phụ trách chính',
                                    'Search and select primary teaching subject',
                                  )}
                                  className="mt-1.5"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label
                                  htmlFor="landing-reg-teacher-phone"
                                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                                >
                                  {tx('Số điện thoại', 'Phone number')}
                                </label>
                                <div className="group relative mt-1.5">
                                  <Phone className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors duration-150 group-focus-within:text-[#0057FF] dark:text-slate-500 dark:group-focus-within:text-[#22D3EE]" />
                                  <input
                                    id="landing-reg-teacher-phone"
                                    type="tel"
                                    inputMode="tel"
                                    autoComplete="tel"
                                    required
                                    value={regPhone}
                                    onChange={(e) => setRegPhone(e.target.value)}
                                    placeholder={tx('VD: 0912 345 678', 'e.g. 0912 345 678')}
                                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 pr-3.5 pl-10 font-mono text-sm text-slate-900 tabular-nums transition-all duration-150 hover:border-slate-300 focus:border-[#0057FF] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#0057FF]/10 dark:border-[#1B3A82] dark:bg-[#040D22] dark:text-slate-100 dark:focus:border-[#22D3EE]"
                                  />
                                </div>
                              </div>
                            </>
                          )}

                          <div>
                            <label
                              htmlFor="landing-reg-pw"
                              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                            >
                              {tx('Mật khẩu (tối thiểu 6 ký tự)', 'Password (min. 6 characters)')}
                            </label>
                            <div className="group relative mt-1.5">
                              <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors duration-150 group-focus-within:text-[#0057FF] dark:text-slate-500 dark:group-focus-within:text-[#22D3EE]" />
                              <input
                                id="landing-reg-pw"
                                type={showRegPw ? 'text' : 'password'}
                                required
                                minLength={6}
                                value={regPassword}
                                onChange={(e) => setRegPassword(e.target.value)}
                                placeholder="••••••"
                                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 pr-10 pl-10 text-sm text-slate-900 transition-all duration-150 hover:border-slate-300 focus:border-[#0057FF] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#0057FF]/10 dark:border-[#1B3A82] dark:bg-[#040D22] dark:text-slate-100 dark:focus:border-[#22D3EE]"
                              />
                              <button
                                type="button"
                                aria-label={
                                  showRegPw
                                    ? tx('Ẩn mật khẩu', 'Hide password')
                                    : tx('Hiện mật khẩu', 'Show password')
                                }
                                onClick={() => setShowRegPw((v) => !v)}
                                className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-lg p-1.5 text-slate-400 transition-all duration-150 hover:bg-slate-200/70 hover:text-slate-700 active:scale-90 dark:text-slate-500 dark:hover:bg-[#0B225B] dark:hover:text-slate-200"
                              >
                                {showRegPw ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </div>

                          <div>
                            <label
                              htmlFor="landing-reg-pw2"
                              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                            >
                              {tx('Xác nhận mật khẩu', 'Confirm password')}
                            </label>
                            <div className="group relative mt-1.5">
                              <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors duration-150 group-focus-within:text-[#0057FF] dark:text-slate-500 dark:group-focus-within:text-[#22D3EE]" />
                              <input
                                id="landing-reg-pw2"
                                type={showRegPw ? 'text' : 'password'}
                                required
                                minLength={6}
                                value={regConfirmPassword}
                                onChange={(e) => setRegConfirmPassword(e.target.value)}
                                placeholder="••••••"
                                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 pr-3.5 pl-10 text-sm text-slate-900 transition-all duration-150 hover:border-slate-300 focus:border-[#0057FF] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#0057FF]/10 dark:border-[#1B3A82] dark:bg-[#040D22] dark:text-slate-100 dark:focus:border-[#22D3EE]"
                              />
                            </div>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={loading}
                          className="group relative inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-xl bg-gradient-to-r from-[#0057FF] to-[#0284C7] px-5 text-sm font-semibold text-white shadow-md shadow-[#0057FF]/20 transition-all duration-200 hover:-translate-y-0.5 hover:from-[#004AE0] hover:to-[#06B6D4] hover:shadow-lg hover:shadow-[#0057FF]/30 active:translate-y-0 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-60 dark:from-[#0057FF] dark:to-[#0891B2] dark:hover:from-[#0284C7] dark:hover:to-[#22D3EE] dark:hover:text-[#040D22]"
                        >
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
                          />
                          <UserPlus className="relative z-10 h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                          <span className="relative z-10">
                            {loading
                              ? tx('Đang tạo tài khoản...', 'Creating account...')
                              : regRole === 'student'
                                ? tx('Đăng ký tài khoản Học sinh', 'Register Student Account')
                                : tx('Đăng ký tài khoản Giáo viên', 'Register Teacher Account')}
                          </span>
                          <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                        </button>
                      </motion.form>
                    )}

                    {/* FORGOT PASSWORD FORM */}
                    {authMode === 'forgot' && (
                      <motion.div
                        key="forgot-form"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="mt-5 space-y-4"
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-[#132B66]">
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {tx(
                              'Xác minh tài khoản Học sinh hoặc Giáo viên để đặt lại mật khẩu mới',
                              'Verify your Student or Teacher account to set a new password',
                            )}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setAuthMode('login');
                              setError(null);
                            }}
                            className="group inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all duration-150 hover:border-[#0057FF]/50 hover:bg-blue-50/50 hover:text-[#0057FF] active:scale-95 dark:border-[#1B3A82] dark:bg-[#040D22] dark:text-slate-200 dark:hover:border-[#22D3EE]/50 dark:hover:bg-[#0B225B] dark:hover:text-[#22D3EE]"
                          >
                            <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-x-0.5" />
                            <span>{tx('Đăng nhập', 'Sign In')}</span>
                          </button>
                        </div>

                        {!resetChallenge ? (
                          <form onSubmit={handleRequestResetOtp} className="space-y-4">
                            <div>
                              <label
                                htmlFor="landing-forgot-id"
                                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                              >
                                {tx(
                                  'Email, ID tài khoản hoặc Số báo danh đã đăng ký',
                                  'Registered Email, Account ID, or Student ID',
                                )}
                              </label>
                              <div className="group relative mt-1.5">
                                <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors duration-150 group-focus-within:text-[#0057FF] dark:text-slate-500 dark:group-focus-within:text-[#22D3EE]" />
                                <input
                                  id="landing-forgot-id"
                                  type="text"
                                  required
                                  value={forgotIdentifier}
                                  onChange={(e) => setForgotIdentifier(e.target.value)}
                                  placeholder={tx(
                                    'VD: hocsinh@kythi2025.edu.vn, HV0001 hoặc 0102588',
                                    'e.g. hocsinh@kythi2025.edu.vn, HV0001 or 0102588',
                                  )}
                                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 pr-3.5 pl-10 text-sm text-slate-900 transition-all duration-150 hover:border-slate-300 focus:border-[#0057FF] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#0057FF]/10 dark:border-[#1B3A82] dark:bg-[#040D22] dark:text-slate-100 dark:focus:border-[#22D3EE]"
                                />
                              </div>
                            </div>

                            <button
                              type="submit"
                              disabled={loading}
                              className="group relative inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-xl bg-gradient-to-r from-[#0057FF] to-[#0284C7] px-5 text-sm font-semibold text-white shadow-md shadow-[#0057FF]/20 transition-all duration-200 hover:-translate-y-0.5 hover:from-[#004AE0] hover:to-[#06B6D4] hover:shadow-lg hover:shadow-[#0057FF]/30 active:translate-y-0 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-60 dark:from-[#0057FF] dark:to-[#0891B2] dark:hover:from-[#0284C7] dark:hover:to-[#22D3EE] dark:hover:text-[#040D22]"
                            >
                              <span
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
                              />
                              <KeyRound className="relative z-10 h-4 w-4 transition-transform duration-200 group-hover:rotate-12" />
                              <span className="relative z-10">
                                {loading
                                  ? tx('Đang kiểm tra...', 'Checking...')
                                  : tx('Nhận mã xác nhận 6 số', 'Get 6-digit Verification Code')}
                              </span>
                            </button>
                          </form>
                        ) : (
                          <form onSubmit={handleConfirmResetPassword} className="space-y-4">
                            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs dark:border-[#1B3A82] dark:bg-[#0B225B]/60">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="font-bold text-[#061844] dark:text-white">
                                    {resetChallenge.fullName} (
                                    {resetChallenge.role === 'admin'
                                      ? tx('Quản trị viên', 'Administrator')
                                      : resetChallenge.role === 'teacher'
                                        ? tx('Giáo viên', 'Teacher')
                                        : tx('Học sinh', 'Student')}
                                    )
                                  </p>
                                  <p className="mt-0.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                                    {tx('Email khôi phục:', 'Recovery email:')}{' '}
                                    {resetChallenge.maskedEmail}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResetChallenge(null);
                                    setError(null);
                                  }}
                                  className="cursor-pointer rounded-md px-2 py-1 font-semibold text-[#0057FF] transition-all duration-150 hover:bg-blue-100/70 active:scale-95 dark:text-[#22D3EE] dark:hover:bg-[#040D22]"
                                >
                                  {tx('Đổi tài khoản', 'Switch account')}
                                </button>
                              </div>

                              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-blue-200/80 pt-2.5 dark:border-[#1B3A82]">
                                <span className="text-slate-700 dark:text-slate-300">
                                  {tx('Mã xác nhận cục bộ (5 phút):', 'Local verification code (5 min):')}{' '}
                                  <strong className="font-mono text-sm tracking-widest text-[#0057FF] tabular-nums dark:text-[#22D3EE]">
                                    {resetChallenge.otpCode}
                                  </strong>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setResetOtpInput(resetChallenge.otpCode)}
                                  className="cursor-pointer rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0057FF] shadow-2xs transition-all duration-150 hover:-translate-y-0.5 hover:bg-blue-600 hover:text-white active:translate-y-0 active:scale-95 dark:border-[#2B52AD] dark:bg-[#040D22] dark:text-[#22D3EE] dark:hover:bg-[#22D3EE] dark:hover:text-[#040D22]"
                                >
                                  {tx('Điền nhanh mã', 'Autofill code')}
                                </button>
                              </div>
                            </div>

                            <div>
                              <label
                                htmlFor="landing-reset-otp"
                                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                              >
                                {tx('Nhập mã xác nhận 6 chữ số', 'Enter 6-digit verification code')}
                              </label>
                              <input
                                id="landing-reset-otp"
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                required
                                value={resetOtpInput}
                                onChange={(e) =>
                                  setResetOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                                }
                                placeholder={tx('Nhập 6 chữ số', 'Enter 6 digits')}
                                className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 font-mono text-sm tracking-widest text-slate-900 tabular-nums transition-all duration-150 hover:border-slate-300 focus:border-[#0057FF] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#0057FF]/10 dark:border-[#1B3A82] dark:bg-[#040D22] dark:text-slate-100 dark:focus:border-[#22D3EE]"
                              />
                            </div>

                            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                              <div>
                                <label
                                  htmlFor="landing-reset-pw"
                                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                                >
                                  {tx('Mật khẩu mới (≥ 6 ký tự)', 'New password (≥ 6 chars)')}
                                </label>
                                <div className="group relative mt-1.5">
                                  <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors duration-150 group-focus-within:text-[#0057FF] dark:text-slate-500 dark:group-focus-within:text-[#22D3EE]" />
                                  <input
                                    id="landing-reset-pw"
                                    type={showResetPw ? 'text' : 'password'}
                                    required
                                    minLength={6}
                                    value={resetNewPassword}
                                    onChange={(e) => setResetNewPassword(e.target.value)}
                                    placeholder="••••••"
                                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 pr-10 pl-10 text-sm text-slate-900 transition-all duration-150 hover:border-slate-300 focus:border-[#0057FF] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#0057FF]/10 dark:border-[#1B3A82] dark:bg-[#040D22] dark:text-slate-100 dark:focus:border-[#22D3EE]"
                                  />
                                  <button
                                    type="button"
                                    aria-label={
                                      showResetPw
                                        ? tx('Ẩn mật khẩu', 'Hide password')
                                        : tx('Hiện mật khẩu', 'Show password')
                                    }
                                    onClick={() => setShowResetPw((v) => !v)}
                                    className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-lg p-1.5 text-slate-400 transition-all duration-150 hover:bg-slate-200/70 hover:text-slate-700 active:scale-90 dark:text-slate-500 dark:hover:bg-[#0B225B] dark:hover:text-slate-200"
                                  >
                                    {showResetPw ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              <div>
                                <label
                                  htmlFor="landing-reset-pw2"
                                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                                >
                                  {tx('Xác nhận mật khẩu mới', 'Confirm new password')}
                                </label>
                                <div className="group relative mt-1.5">
                                  <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors duration-150 group-focus-within:text-[#0057FF] dark:text-slate-500 dark:group-focus-within:text-[#22D3EE]" />
                                  <input
                                    id="landing-reset-pw2"
                                    type={showResetPw ? 'text' : 'password'}
                                    required
                                    minLength={6}
                                    value={resetConfirmPassword}
                                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                                    placeholder="••••••"
                                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 pr-3.5 pl-10 text-sm text-slate-900 transition-all duration-150 hover:border-slate-300 focus:border-[#0057FF] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#0057FF]/10 dark:border-[#1B3A82] dark:bg-[#040D22] dark:text-slate-100 dark:focus:border-[#22D3EE]"
                                  />
                                </div>
                              </div>
                            </div>

                            <button
                              type="submit"
                              disabled={loading}
                              className="group relative inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-xl bg-gradient-to-r from-[#0057FF] to-[#0284C7] px-5 text-sm font-semibold text-white shadow-md shadow-[#0057FF]/20 transition-all duration-200 hover:-translate-y-0.5 hover:from-[#004AE0] hover:to-[#06B6D4] hover:shadow-lg hover:shadow-[#0057FF]/30 active:translate-y-0 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-60 dark:from-[#0057FF] dark:to-[#0891B2] dark:hover:from-[#0284C7] dark:hover:to-[#22D3EE] dark:hover:text-[#040D22]"
                            >
                              <span
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
                              />
                              <CheckCircle2 className="relative z-10 h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                              <span className="relative z-10">
                                {loading
                                  ? tx('Đang cập nhật...', 'Updating...')
                                  : tx('Xác nhận đặt lại mật khẩu', 'Confirm Password Reset')}
                              </span>
                            </button>
                          </form>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Compact Quick Demo Access Footer inside Auth Card */}
                <div className="mt-6 border-t border-slate-100 pt-5 dark:border-[#132B66]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {tx('Truy cập nhanh tài khoản mẫu', 'Quick demo access')}{' '}
                      <span className="font-mono font-normal text-slate-500 dark:text-slate-400">
                        ({tx('mật khẩu: 123456', 'password: 123456')})
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowAllDemoAccounts((v) => !v)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#0057FF] transition-all duration-150 hover:bg-blue-50 active:scale-95 dark:text-[#22D3EE] dark:hover:bg-[#0B225B]"
                    >
                      <span>
                        {showAllDemoAccounts
                          ? tx('Thu gọn', 'Collapse')
                          : tx(`Tất cả (${DEMO_ACCOUNTS.length})`, `All (${DEMO_ACCOUNTS.length})`)}
                      </span>
                      {showAllDemoAccounts ? (
                        <ChevronUp className="h-3.5 w-3.5 transition-transform duration-200" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200" />
                      )}
                    </button>
                  </div>

                  {!showAllDemoAccounts ? (
                    <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void handleQuickDemo('student', 'hocsinh@kythi2025.edu.vn')}
                        className="group flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#0057FF] hover:bg-blue-50/70 hover:shadow-md hover:shadow-[#0057FF]/10 active:translate-y-0 active:scale-[0.98] disabled:opacity-60 dark:border-[#1B3A82] dark:bg-[#040D22] dark:hover:border-[#22D3EE] dark:hover:bg-[#0B225B]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[#061844] dark:text-white">
                            {tx('Học sinh', 'Student')}
                          </p>
                          <p className="truncate font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                            HV0001
                          </p>
                        </div>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#0057FF] transition-all duration-200 group-hover:scale-110 group-hover:bg-[#0057FF] group-hover:text-white dark:bg-[#0B225B] dark:text-[#22D3EE] dark:group-hover:bg-[#22D3EE] dark:group-hover:text-[#040D22]">
                          <GraduationCap className="h-3.5 w-3.5" />
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void handleQuickDemo('teacher', 'giaovien@kythi2025.edu.vn')}
                        className="group flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#0891B2] hover:bg-cyan-50/70 hover:shadow-md hover:shadow-[#0891B2]/10 active:translate-y-0 active:scale-[0.98] disabled:opacity-60 dark:border-[#1B3A82] dark:bg-[#040D22] dark:hover:border-[#22D3EE] dark:hover:bg-[#0B225B]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[#061844] dark:text-white">
                            {tx('Giáo viên', 'Teacher')}
                          </p>
                          <p className="truncate font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                            GV0001
                          </p>
                        </div>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-[#0891B2] transition-all duration-200 group-hover:scale-110 group-hover:bg-[#0891B2] group-hover:text-white dark:bg-[#0B225B] dark:text-[#22D3EE] dark:group-hover:bg-[#22D3EE] dark:group-hover:text-[#040D22]">
                          <BookOpenCheck className="h-3.5 w-3.5" />
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void handleQuickDemo('admin')}
                        className="group flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#0057FF] hover:bg-blue-50/70 hover:shadow-md hover:shadow-[#0057FF]/10 active:translate-y-0 active:scale-[0.98] disabled:opacity-60 dark:border-[#1B3A82] dark:bg-[#040D22] dark:hover:border-[#22D3EE] dark:hover:bg-[#0B225B]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[#061844] dark:text-white">
                            {tx('Quản trị viên', 'Admin')}
                          </p>
                          <p className="truncate font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                            AD0001
                          </p>
                        </div>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#0057FF] transition-all duration-200 group-hover:scale-110 group-hover:bg-[#0057FF] group-hover:text-white dark:bg-[#0B225B] dark:text-[#22D3EE] dark:group-hover:bg-[#22D3EE] dark:group-hover:text-[#040D22]">
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"
                    >
                      {DEMO_ACCOUNTS.map((acc) => (
                        <button
                          key={acc.metaVi}
                          type="button"
                          disabled={loading}
                          onClick={() => void handleQuickDemo(acc.role, acc.email)}
                          className="group flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#0057FF] hover:bg-blue-50/70 hover:shadow-sm active:translate-y-0 active:scale-[0.98] disabled:opacity-60 dark:border-[#1B3A82] dark:bg-[#040D22] dark:hover:border-[#22D3EE] dark:hover:bg-[#0B225B]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-[#061844] dark:text-white">
                              {isEn ? acc.labelEn : acc.labelVi}
                            </p>
                            <p className="truncate font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                              {isEn ? acc.metaEn : acc.metaVi}
                            </p>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#0057FF] transition-transform duration-200 group-hover:translate-x-0.5 dark:text-[#22D3EE]" />
                        </button>
                      ))}
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : (
          /* Signed-in OR Embedded Workspace Brand Hero */
          <section className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-7 sm:p-10 lg:col-span-7 dark:border-[#132B66] dark:bg-[#08173D]">
              <div>
                <p className="text-xs font-semibold tracking-wide text-[#0057FF] dark:text-[#22D3EE]">
                  NTPEXION · Innovation in Every Exam
                </p>
                <h1
                  style={{ fontSize: 'clamp(2.1rem, 3.6vw, 3.25rem)', lineHeight: 1.12 }}
                  className="mt-4 max-w-2xl font-display font-extrabold tracking-tight text-[#061844] [text-wrap:balance] dark:text-white"
                >
                  {tx(
                    'Nền tảng Thi Trắc Nghiệm Trực Tuyến Chuẩn Xác & Hiện Đại',
                    'Accurate & Modern Online Assessment Platform',
                  )}
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
                  <strong className="font-semibold text-[#061844] dark:text-white">NTPEXION</strong>{' '}
                  {tx(
                    'hỗ trợ toàn diện từ khâu xây dựng ngân hàng câu hỏi, trộn mã đề tự động theo 3 dạng thức trắc nghiệm 2025, tổ chức lớp học riêng tư bằng mã 5 ký tự đến giám sát phòng thi thời gian thực và xuất bảng điểm chuẩn hành chính.',
                    'supports everything from question bank authoring, automatic exam shuffling across 3 question formats, private 5-character classroom management, real-time exam proctoring to standardized score sheets.',
                  )}
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span>{tx('Phổ thông Khối 1–12', 'K–12 Grades 1–12')}</span>
                  <span aria-hidden="true">·</span>
                  <span>{tx('Cao đẳng & Đại học', 'College & University')}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {tx('Chuẩn Thông tư 24/2024/TT-BGDĐT', '2025 Standardized Assessment')}
                  </span>
                </div>
              </div>

              <div className="mt-9 flex flex-wrap items-center gap-3.5">
                <button
                  type="button"
                  onClick={() => onEnterWorkspace(currentUser?.role ?? _role)}
                  className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-[#0057FF] px-6 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#061844] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0057FF] dark:hover:bg-[#06B6D4] dark:hover:text-[#040D22]"
                >
                  <span>{tx('Vào trang làm việc', 'Enter Workspace')}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                {currentUser && !embedded && onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:border-[#0057FF] hover:text-[#0057FF] dark:border-[#1B3A82] dark:bg-[#040D22] dark:text-slate-200 dark:hover:border-[#22D3EE] dark:hover:text-[#22D3EE]"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>{tx('Đổi tài khoản', 'Switch Account')}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Right Brand Focal Card */}
            <div className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-[#061844] via-[#0B2B78] to-[#0057FF] p-7 text-white sm:p-8 lg:col-span-5">
              <div className="rounded-xl border border-white/15 bg-white p-6 shadow-lg">
                {!logoFailed ? (
                  <img
                    src={NTPEXION_LOGO_PATH}
                    alt="Logo chính thức NTPEXION — Innovation in Every Exam"
                    referrerPolicy="no-referrer"
                    onError={() => setLogoFailed(true)}
                    className="mx-auto h-40 w-full object-contain sm:h-44"
                  />
                ) : (
                  <div className="flex h-40 flex-col items-center justify-center text-center">
                    <span className="font-display text-3xl font-extrabold tracking-tight text-[#061844]">
                      NTPE<span className="text-[#0057FF]">X</span>ION
                    </span>
                    <span className="mt-1 text-xs font-medium italic text-slate-600">
                      Innovation in Every Exam.
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-6 space-y-3 border-t border-white/15 pt-5 text-xs">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-cyan-200/90">{tx('Thương hiệu', 'Brand')}</span>
                  <span className="font-display font-bold tracking-wide text-white">NTPEXION</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-cyan-200/90">{tx('Thông điệp', 'Tagline')}</span>
                  <span className="text-right font-medium text-white">
                    Innovation in Every Exam
                  </span>
                </div>
                {currentUser && (
                  <div className="flex items-start justify-between gap-4 border-t border-white/15 pt-3">
                    <span className="text-cyan-200/90">{tx('Đang đăng nhập', 'Signed in as')}</span>
                    <span className="text-right font-medium text-white">
                      {currentUser.fullName} · {roleBadgeLabel} ({currentUser.id})
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ================================================================= */}
        {/* 3-STEP WORKFLOW + BOTTOM CONVERSION CTA                           */}
        {/* ================================================================= */}
        <section id="quy-trinh" className="mt-16 scroll-mt-24">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-[#132B66] dark:bg-[#08173D]">
              <p className="font-mono text-xs font-bold text-[#0057FF] tabular-nums dark:text-[#22D3EE]">
                {tx('Bước 01', 'Step 01')}
              </p>
              <h3 className="mt-2 font-display text-base font-bold text-[#061844] dark:text-white">
                {tx('Đăng nhập hoặc Tạo tài khoản', 'Sign In or Register')}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {tx(
                  'Chọn vai trò Học sinh hoặc Giáo viên để nhận không gian làm việc và bộ công cụ phù hợp ngay lập tức.',
                  'Choose Student or Teacher to immediately unlock your dedicated workspace and toolkit.',
                )}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-[#132B66] dark:bg-[#08173D]">
              <p className="font-mono text-xs font-bold text-[#0057FF] tabular-nums dark:text-[#22D3EE]">
                {tx('Bước 02', 'Step 02')}
              </p>
              <h3 className="mt-2 font-display text-base font-bold text-[#061844] dark:text-white">
                {tx('Tham gia vào lớp học', 'Join a Class')}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {tx(
                  'Giáo viên mở lớp và chia sẻ mã lớp; học sinh nhập mã để đồng bộ đề thi, tài liệu, bài tập và thời khóa biểu.',
                  'Teachers open classes and share the code; students enter it to sync exams, materials, assignments, and schedules.',
                )}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-[#132B66] dark:bg-[#08173D]">
              <p className="font-mono text-xs font-bold text-[#0057FF] tabular-nums dark:text-[#22D3EE]">
                {tx('Bước 03', 'Step 03')}
              </p>
              <h3 className="mt-2 font-display text-base font-bold text-[#061844] dark:text-white">
                {tx('Tổ chức thi & Phân tích kết quả', 'Run Exams & Analyze Results')}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {tx(
                  'Thí sinh làm bài trong môi trường giám sát nghiêm túc; hệ thống tự động chấm điểm và xuất báo cáo ngay khi kết thúc.',
                  'Candidates complete exams in a monitored room; automated grading and score reports are generated upon submission.',
                )}
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col justify-between gap-6 rounded-2xl bg-gradient-to-r from-[#061844] via-[#0B2B78] to-[#0057FF] p-8 text-white sm:flex-row sm:items-center">
            <div className="max-w-xl">
              <p className="text-xs font-semibold tracking-wide text-cyan-300">
                NTPEXION · Innovation in Every Exam
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight [text-wrap:balance]">
                {tx(
                  'Sẵn sàng tổ chức kỳ thi trực tuyến đầu tiên của bạn',
                  'Ready to launch your first online assessment',
                )}
              </h2>
              <p className="mt-2 text-sm text-slate-200">
                {tx(
                  'Truy cập ngay hệ thống NTPEXION để tạo lớp học, soạn đề thi hoặc vào phòng thi trực tuyến.',
                  'Access NTPEXION now to create classes, author exams, or enter a live exam room.',
                )}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-3">
              {!currentUser && allowSelfRegistration && (
                <button
                  type="button"
                  onClick={() => focusAuthPanel('register')}
                  className="inline-flex h-11 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-cyan-300/60 bg-white/10 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                >
                  <span>{tx('Đăng ký miễn phí', 'Register Free')}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => focusAuthPanel('login')}
                className="inline-flex h-11 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-[#06B6D4] px-6 text-sm font-bold text-[#040D22] transition-colors hover:bg-[#22D3EE]"
              >
                <span>
                  {currentUser
                    ? tx('Mở không gian chính', 'Open Workspace')
                    : tx('Đăng nhập ngay', 'Sign In Now')}
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {!embedded && (
        <footer className="relative mt-8 overflow-hidden border-t border-slate-200 bg-white dark:border-[#102558] dark:bg-[#061844]">
          <div
            aria-hidden="true"
            className="h-0.5 w-full bg-gradient-to-r from-transparent via-[#0057FF]/45 to-transparent dark:via-[#22D3EE]/50"
          />
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 py-6 text-xs text-slate-500 sm:px-6 lg:flex-row lg:items-center lg:px-8 dark:text-slate-300">
            <div className="flex items-center gap-3">
              <motion.div
                whileHover={{ rotate: -8, scale: 1.08 }}
                transition={{ type: 'spring', stiffness: 360, damping: 18 }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0057FF] to-[#06B6D4] text-white shadow-sm shadow-[#0057FF]/25"
              >
                <GraduationCap className="h-4 w-4" />
              </motion.div>
              <div>
                <p className="font-semibold text-[#061844] dark:text-white">
                  NTPE<span className="text-[#0057FF] dark:text-[#22D3EE]">X</span>ION{' '}
                  <span className="font-normal text-slate-400 dark:text-slate-500">·</span>{' '}
                  <span className="font-medium text-slate-600 dark:text-slate-300">
                    Innovation in Every Exam
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {tx('Hệ thống Thi Trắc nghiệm Trực tuyến', 'Online Assessment Platform')}
                </p>
              </div>
            </div>

            <motion.button
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() =>
                setFooterSparkIndex((prev) => {
                  const next = (prev + 1) % FOOTER_STUDY_SPARKS.length;
                  try {
                    localStorage.setItem(FOOTER_SPARK_STORAGE_KEY, String(next));
                  } catch {
                    // Ignore storage error
                  }
                  return next;
                })
              }
              title={tx('Nhấn để đổi câu động lực khác', 'Click for another study spark')}
              className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-slate-50/90 px-3.5 py-2.5 text-left transition-colors hover:border-[#0057FF]/50 hover:bg-blue-50/60 lg:w-auto lg:min-w-[360px] dark:border-[#1B3A82] dark:bg-[#040D22]/80 dark:hover:border-[#22D3EE]/60 dark:hover:bg-[#0B225B]"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100/90 text-amber-600 transition-transform duration-200 group-hover:rotate-12 group-hover:scale-110 dark:bg-amber-500/15 dark:text-amber-300">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 overflow-hidden">
                  <p className="text-[10px] font-bold tracking-wide text-[#0057FF] uppercase dark:text-[#22D3EE]">
                    {tx('Góc tiếp sức ôn thi', 'Study Boost')}
                  </p>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={footerSparkIndex}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                      className="truncate text-xs font-medium text-slate-700 dark:text-slate-200"
                    >
                      {isEn
                        ? FOOTER_STUDY_SPARKS[footerSparkIndex].en
                        : FOOTER_STUDY_SPARKS[footerSparkIndex].vi}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all duration-300 group-hover:border-[#0057FF]/40 group-hover:text-[#0057FF] group-hover:rotate-180 dark:border-[#1B3A82] dark:bg-[#08173D] dark:text-slate-400 dark:group-hover:border-[#22D3EE]/40 dark:group-hover:text-[#22D3EE]">
                <RefreshCw className="h-3.5 w-3.5" />
              </span>
            </motion.button>
          </div>
        </footer>
      )}
    </div>
  );
}
