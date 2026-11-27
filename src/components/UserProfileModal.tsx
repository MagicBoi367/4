import {
  Camera,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  ImagePlus,
  KeyRound,
  Lock,
  Mail,
  Phone,
  Sparkles,
  Trash2,
  Type,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { resizeAvatarImageFile } from '../data/studentPortalData';
import type { UserAccount } from '../types/exam';
import {
  changeAccountPassword,
  updateStoredAccount,
} from '../utils/authStore';
import { localizeSubjectName, useLanguage } from '../utils/i18n';
import { getSubjectMeta } from '../utils/scoring2025';
import { useSubjects } from '../utils/subjectStore';

interface UserProfileModalProps {
  currentUser: UserAccount;
  initialTab?: 'view_edit' | 'password';
  onClose: () => void;
  onUserUpdated: (user: UserAccount) => void;
}

const WEB_AVATAR_PRESETS = [
  { id: 'scholar', url: '/avatars/scholar.svg', labelVi: 'Học giả', labelEn: 'Scholar' },
  { id: 'owl', url: '/avatars/owl.svg', labelVi: 'Cú tri thức', labelEn: 'Wise Owl' },
  { id: 'astronaut', url: '/avatars/astronaut.svg', labelVi: 'Phi hành gia', labelEn: 'Astronaut' },
  { id: 'fox', url: '/avatars/fox.svg', labelVi: 'Cáo thông minh', labelEn: 'Clever Fox' },
  { id: 'cat', url: '/avatars/cat.svg', labelVi: 'Mèo chăm chỉ', labelEn: 'Study Cat' },
  { id: 'robot', url: '/avatars/robot.svg', labelVi: 'Trợ lý Bot', labelEn: 'Study Bot' },
] as const;

const LETTER_AVATAR_COLORS = [
  { id: 'slate', from: '#64748B', to: '#475569', labelVi: 'Xám trung tính', labelEn: 'Slate' },
  { id: 'blue', from: '#2563EB', to: '#1D4ED8', labelVi: 'Xanh dương', labelEn: 'Blue' },
  { id: 'teal', from: '#14B8A6', to: '#0F766E', labelVi: 'Xanh ngọc', labelEn: 'Teal' },
  { id: 'indigo', from: '#6366F1', to: '#4338CA', labelVi: 'Tím chàm', labelEn: 'Indigo' },
  { id: 'amber', from: '#F59E0B', to: '#D97706', labelVi: 'Hổ phách', labelEn: 'Amber' },
  { id: 'rose', from: '#F43F5E', to: '#BE123C', labelVi: 'Đỏ hồng', labelEn: 'Rose' },
] as const;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'HS';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[parts.length - 2][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function createLetterAvatarDataUrl(
  initials: string,
  fromColor: string,
  toColor: string,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const grad = ctx.createLinearGradient(0, 0, 160, 160);
  grad.addColorStop(0, fromColor);
  grad.addColorStop(1, toColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 160, 160);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 62px "Plus Jakarta Sans", "Be Vietnam Pro", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, 80, 84);
  return canvas.toDataURL('image/png');
}

export function UserProfileModal({
  currentUser,
  initialTab = 'view_edit',
  onClose,
  onUserUpdated,
}: UserProfileModalProps) {
  useSubjects();
  const { language, tx } = useLanguage();
  const [activeTab, setActiveTab] = useState<'view_edit' | 'password'>(initialTab);

  // Profile form state
  const [fullName, setFullName] = useState(currentUser.fullName);
  const [phone, setPhone] = useState(currentUser.phone ?? '');
  const [schoolName, setSchoolName] = useState(currentUser.schoolName ?? '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl ?? '');
  const [facebookUrl, setFacebookUrl] = useState(currentUser.facebookUrl ?? '');
  const [avatarImgFailed, setAvatarImgFailed] = useState(false);
  const [avatarPickerTab, setAvatarPickerTab] = useState<'letter' | 'presets' | 'custom'>(() => {
    const initial = currentUser.avatarUrl ?? '';
    if (!initial) return 'letter';
    if (WEB_AVATAR_PRESETS.some((p) => p.url === initial)) return 'presets';
    return 'custom';
  });
  const [selectedLetterColorId, setSelectedLetterColorId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const nextAvatar = currentUser.avatarUrl ?? '';
    setFullName(currentUser.fullName);
    setPhone(currentUser.phone ?? '');
    setSchoolName(currentUser.schoolName ?? '');
    setAvatarUrl(nextAvatar);
    setFacebookUrl(currentUser.facebookUrl ?? '');
    setAvatarImgFailed(false);
    setSelectedLetterColorId(null);
    if (!nextAvatar) {
      setAvatarPickerTab('letter');
    } else if (WEB_AVATAR_PRESETS.some((p) => p.url === nextAvatar)) {
      setAvatarPickerTab('presets');
    }
    setProfileFeedback(null);
  }, [
    currentUser.id,
    currentUser.fullName,
    currentUser.phone,
    currentUser.schoolName,
    currentUser.avatarUrl,
    currentUser.facebookUrl,
  ]);

  const displayedAvatar =
    activeTab === 'view_edit' ? avatarUrl : currentUser.avatarUrl ?? '';

  const roleLabel =
    currentUser.role === 'admin'
      ? tx('Quản trị viên', 'Administrator')
      : currentUser.role === 'teacher'
        ? tx('Giáo viên', 'Teacher')
        : tx('Học sinh', 'Student');

  const handleAvatarFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const resized = await resizeAvatarImageFile(file);
      setAvatarUrl(resized);
      setSelectedLetterColorId(null);
      setAvatarPickerTab('custom');
      setAvatarImgFailed(false);
      setProfileFeedback(null);
      setActiveTab('view_edit');
    } catch (err) {
      setProfileFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : tx('Không thể tải ảnh đại diện.', 'Unable to load avatar image.'),
      });
    }
  };

  const currentInitials = getInitials(fullName || currentUser.fullName);

  const handleCopyUserId = () => {
    navigator.clipboard?.writeText(currentUser.id).catch(() => {});
    setCopiedId(true);
    window.setTimeout(() => setCopiedId(false), 1800);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const res = updateStoredAccount(currentUser.id, {
      fullName,
      phone,
      schoolName: currentUser.role !== 'student' ? schoolName : undefined,
      avatarUrl,
      facebookUrl,
    });
    if (!res.ok) {
      setProfileFeedback({ type: 'error', text: res.error });
      return;
    }
    onUserUpdated(res.user);
    setAvatarImgFailed(false);
    setProfileFeedback({
      type: 'success',
      text: tx(
        `Đã lưu thông tin cá nhân cho tài khoản ID ${res.user.id}.`,
        `Saved profile details for account ID ${res.user.id}.`,
      ),
    });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({
        type: 'error',
        text: tx('Mật khẩu mới nhập lại không khớp.', 'New passwords do not match.'),
      });
      return;
    }
    setPasswordBusy(true);
    const res = await changeAccountPassword(
      currentUser.id,
      currentPassword,
      newPassword,
    );
    setPasswordBusy(false);
    if (!res.ok) {
      setPasswordFeedback({ type: 'error', text: res.error });
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordFeedback({
      type: 'success',
      text: tx(
        'Đổi mật khẩu thành công. Tài khoản đã được cập nhật bảo mật.',
        'Password updated successfully.',
      ),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-profile-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs dark:bg-slate-950/80"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Title Bar */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <UserCheck className="h-5 w-5 text-blue-700 dark:text-blue-400" />
            <h2
              id="user-profile-modal-title"
              className="font-display text-base font-bold text-slate-900 sm:text-lg dark:text-slate-50"
            >
              {tx('Thông tin cá nhân & Tài khoản', 'Profile & Account')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tx('Đóng cửa sổ thông tin cá nhân', 'Close profile modal')}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-5">
          {/* Compact Summary Card */}
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-950/60">
            <div className="relative shrink-0 self-start sm:self-auto">
              {displayedAvatar && !avatarImgFailed ? (
                <img
                  src={displayedAvatar}
                  alt={currentUser.fullName}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarImgFailed(true)}
                  className="h-18 w-18 rounded-full border border-slate-200 object-cover dark:border-slate-700"
                />
              ) : (
                <div className="flex h-18 w-18 items-center justify-center rounded-full border border-blue-200 bg-blue-50 font-display text-lg font-bold text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/60 dark:text-blue-300">
                  {currentInitials}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setActiveTab('view_edit');
                  window.setTimeout(() => avatarInputRef.current?.click(), 50);
                }}
                title={tx('Tải ảnh đại diện', 'Upload avatar')}
                aria-label={tx('Đổi ảnh đại diện', 'Change avatar')}
                className="absolute -right-1 -bottom-1 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-xs transition-colors hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                  {currentUser.fullName}
                </p>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                  ·
                </span>
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                  {roleLabel}
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                  ·
                </span>
                <button
                  type="button"
                  onClick={handleCopyUserId}
                  title={tx('Sao chép ID tài khoản', 'Copy account ID')}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-xs font-bold text-slate-800 tabular-nums transition-colors hover:border-blue-400 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-blue-500 dark:hover:text-blue-300"
                >
                  <span>ID: {currentUser.id}</span>
                  {copiedId ? (
                    <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3 text-slate-400" />
                  )}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1 font-mono">
                  <Mail className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  <span>{currentUser.email}</span>
                </span>
                {currentUser.role === 'student' ? (
                  <>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                      ·
                    </span>
                    <span className="font-mono tabular-nums">
                      {tx('SBD', 'ID')}:{' '}
                      <strong className="text-slate-900 dark:text-slate-100">
                        {currentUser.studentSbd ?? '—'}
                      </strong>
                    </span>
                  </>
                ) : (
                  <>
                    {currentUser.subject && (
                      <>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                          ·
                        </span>
                        <span>
                          {tx('Môn', 'Subject')}:{' '}
                          <strong className="text-slate-900 dark:text-slate-100">
                            {localizeSubjectName(currentUser.subject, getSubjectMeta(currentUser.subject).name, language)}
                          </strong>
                        </span>
                      </>
                    )}
                    {currentUser.schoolName && (
                      <>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                          ·
                        </span>
                        <span>{currentUser.schoolName}</span>
                      </>
                    )}
                  </>
                )}
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                  ·
                </span>
                <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                  <Phone className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  <span>{tx('SĐT', 'Phone')}:</span>
                  <strong className="text-slate-900 dark:text-slate-100">
                    {currentUser.phone || tx('Chưa cập nhật', 'Not set')}
                  </strong>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                <span className="font-medium text-slate-500 dark:text-slate-400">
                  Facebook:
                </span>
                {currentUser.facebookUrl ? (
                  <a
                    href={currentUser.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline dark:text-blue-400"
                  >
                    <span className="max-w-xs truncate">{currentUser.facebookUrl}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">
                    {tx('Chưa thêm liên kết Facebook', 'No Facebook link added')}
                  </span>
                )}
              </div>
            </div>
          </div>

          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleAvatarFileSelected}
            className="hidden"
          />

          {/* Sub-tabs */}
          <div
            role="tablist"
            aria-label={tx('Chức năng tài khoản cá nhân', 'Personal account tabs')}
            className="relative grid w-full grid-cols-2 rounded-xl border border-slate-200 bg-slate-100/90 p-1 sm:inline-grid sm:w-auto dark:border-slate-800 dark:bg-slate-950/70"
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-blue-700 shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] dark:bg-blue-600 ${
                activeTab === 'password' ? 'translate-x-full' : 'translate-x-0'
              }`}
            />
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'view_edit'}
              onClick={() => setActiveTab('view_edit')}
              className={`relative z-10 inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-300 active:scale-[0.98] ${
                activeTab === 'view_edit'
                  ? 'text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              <UserCheck
                className={`h-3.5 w-3.5 transition-transform duration-300 ${
                  activeTab === 'view_edit' ? 'scale-110' : 'scale-100 opacity-75'
                }`}
              />
              <span>{tx('Chỉnh sửa trang cá nhân', 'Edit Profile')}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'password'}
              onClick={() => setActiveTab('password')}
              className={`relative z-10 inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-300 active:scale-[0.98] ${
                activeTab === 'password'
                  ? 'text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              <KeyRound
                className={`h-3.5 w-3.5 transition-transform duration-300 ${
                  activeTab === 'password' ? 'rotate-[-10deg] scale-110' : 'scale-100 opacity-75'
                }`}
              />
              <span>{tx('Đổi mật khẩu', 'Change Password')}</span>
            </button>
          </div>

          {activeTab === 'view_edit' ? (
            <form
              key="tab-view-edit"
              onSubmit={handleSaveProfile}
              className="animate-tab-from-left space-y-4"
            >
              {/* Avatar Picker moved to the top */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {tx('Chọn ảnh đại diện (Avatar)', 'Choose Profile Avatar')}
                  </span>
                  <div
                    role="group"
                    aria-label={tx('Kiểu ảnh đại diện', 'Avatar type')}
                    className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <button
                      type="button"
                      onClick={() => setAvatarPickerTab('letter')}
                      className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        avatarPickerTab === 'letter'
                          ? 'bg-blue-700 text-white dark:bg-blue-600'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                      }`}
                    >
                      <Type className="h-3 w-3" />
                      <span>{tx('Avt chữ', 'Letter')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvatarPickerTab('presets')}
                      className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        avatarPickerTab === 'presets'
                          ? 'bg-blue-700 text-white dark:bg-blue-600'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                      }`}
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>{tx('Có sẵn của web', 'Web Presets')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvatarPickerTab('custom')}
                      className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        avatarPickerTab === 'custom'
                          ? 'bg-blue-700 text-white dark:bg-blue-600'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                      }`}
                    >
                      <ImagePlus className="h-3 w-3" />
                      <span>{tx('Tự thêm', 'Custom')}</span>
                    </button>
                  </div>
                </div>

                {avatarPickerTab === 'letter' && (
                  <div className="mt-3 flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarUrl('');
                        setSelectedLetterColorId(null);
                        setAvatarImgFailed(false);
                      }}
                      title={tx('Chữ cái mặc định (tự cập nhật theo tên)', 'Default letter avatar')}
                      className={`relative flex h-11 cursor-pointer items-center gap-2 rounded-full border pr-3 pl-1 text-xs font-semibold transition-all ${
                        !avatarUrl
                          ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-600/20 dark:border-blue-400 dark:bg-blue-950/60 dark:text-blue-300'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                      }`}
                    >
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-400 text-xs font-bold text-white dark:bg-slate-600">
                        {currentInitials}
                      </span>
                      <span>{tx('Mặc định', 'Default')}</span>
                    </button>

                    {LETTER_AVATAR_COLORS.map((c) => {
                      const isSelected = selectedLetterColorId === c.id && Boolean(avatarUrl);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          title={language === 'en' ? c.labelEn : c.labelVi}
                          onClick={() => {
                            const generated = createLetterAvatarDataUrl(
                              currentInitials,
                              c.from,
                              c.to,
                            );
                            if (generated) {
                              setAvatarUrl(generated);
                              setSelectedLetterColorId(c.id);
                              setAvatarImgFailed(false);
                            }
                          }}
                          style={{
                            backgroundImage: `linear-gradient(135deg, ${c.from}, ${c.to})`,
                          }}
                          className={`relative inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-xs font-bold text-white shadow-xs transition-transform hover:scale-105 ${
                            isSelected
                              ? 'ring-2 ring-blue-600 ring-offset-2 dark:ring-blue-400 dark:ring-offset-slate-900'
                              : ''
                          }`}
                        >
                          {currentInitials}
                          {isSelected && (
                            <span className="absolute -right-0.5 -bottom-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white ring-2 ring-white dark:ring-slate-900">
                              <Check className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {avatarPickerTab === 'presets' && (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {WEB_AVATAR_PRESETS.map((preset) => {
                      const isSelected = avatarUrl === preset.url;
                      const label = language === 'en' ? preset.labelEn : preset.labelVi;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setAvatarUrl(preset.url);
                            setSelectedLetterColorId(null);
                            setAvatarImgFailed(false);
                          }}
                          className={`group relative flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-2 transition-all ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-600/20 dark:border-blue-400 dark:bg-blue-950/50'
                              : 'border-slate-200 bg-white hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'
                          }`}
                        >
                          <div className="relative">
                            <img
                              src={preset.url}
                              alt={label}
                              className="h-11 w-11 rounded-full object-cover"
                            />
                            {isSelected && (
                              <span className="absolute -right-0.5 -bottom-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white ring-2 ring-white dark:ring-slate-900">
                                <Check className="h-2.5 w-2.5" />
                              </span>
                            )}
                          </div>
                          <span className="max-w-full truncate text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                            {label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {avatarPickerTab === 'custom' && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      id="nav-profile-avatar-url"
                      type="text"
                      value={
                        avatarUrl.startsWith('data:image/')
                          ? tx('(Đã chọn ảnh tùy chỉnh)', '(Custom image selected)')
                          : avatarUrl
                      }
                      readOnly={avatarUrl.startsWith('data:image/')}
                      onChange={(e) => {
                        setAvatarUrl(e.target.value);
                        setSelectedLetterColorId(null);
                        setAvatarImgFailed(false);
                      }}
                      placeholder={tx('Dán link ảnh https://... hoặc bấm Tải ảnh', 'Paste image URL https://... or Upload')}
                      className="h-9 min-w-[180px] flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>{tx('Tải ảnh', 'Upload')}</span>
                    </button>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarUrl('');
                          setSelectedLetterColorId(null);
                          setAvatarImgFailed(false);
                        }}
                        title={tx('Về avt chữ mặc định', 'Reset to letter avatar')}
                        className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-slate-700 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>{tx('Xóa', 'Clear')}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="nav-profile-id"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {tx('ID tài khoản (6 ký tự cố định theo vai trò)', 'Account ID (fixed 6 characters)')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="nav-profile-id"
                      type="text"
                      readOnly
                      value={currentUser.id}
                      className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-100 px-3 font-mono text-sm font-bold tracking-wider text-slate-800 tabular-nums focus:outline-none dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={handleCopyUserId}
                      className="inline-flex h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      {copiedId ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>{tx('Đã chép', 'Copied')}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>{tx('Sao chép ID', 'Copy ID')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="nav-profile-email"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {tx('Email đăng nhập', 'Login email')}
                  </label>
                  <input
                    id="nav-profile-email"
                    type="email"
                    readOnly
                    value={currentUser.email}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 font-mono text-sm text-slate-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"
                  />
                </div>

                <div>
                  <label
                    htmlFor="nav-profile-name"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {tx('Họ và tên', 'Full name')}
                  </label>
                  <input
                    id="nav-profile-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={tx('Nhập họ và tên...', 'Enter full name...')}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="nav-profile-phone"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {tx('Số điện thoại', 'Phone number')}
                  </label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      id="nav-profile-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder={tx('VD: 0912 345 678', 'e.g. 0912 345 678')}
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-9 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                </div>

                {currentUser.role !== 'student' && (
                  <div>
                    <label
                      htmlFor="nav-profile-school"
                      className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      {tx('Trường / Đơn vị công tác', 'School / Institution')}
                    </label>
                    <input
                      id="nav-profile-school"
                      type="text"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      placeholder={tx('VD: THPT Chu Văn An', 'e.g. Chu Van An High School')}
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="nav-profile-facebook"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {tx('Liên kết tài khoản Facebook', 'Facebook profile link')}
                  </label>
                  <input
                    id="nav-profile-facebook"
                    type="text"
                    value={facebookUrl}
                    onChange={(e) => setFacebookUrl(e.target.value)}
                    placeholder="https://www.facebook.com/username"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

              </div>

              {profileFeedback && (
                <p
                  role="status"
                  className={`text-xs font-semibold ${
                    profileFeedback.type === 'success'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {profileFeedback.text}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 cursor-pointer items-center whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {tx('Đóng', 'Close')}
                </button>
                <button
                  type="submit"
                  className="inline-flex h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-5 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{tx('Lưu thông tin cá nhân', 'Save Profile')}</span>
                </button>
              </div>
            </form>
          ) : (
            <form
              key="tab-password"
              onSubmit={handleChangePassword}
              className="animate-tab-from-right space-y-4"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="nav-cur-pw"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {tx('Mật khẩu hiện tại', 'Current password')}
                  </label>
                  <div className="relative">
                    <input
                      id="nav-cur-pw"
                      type={showCurrentPw ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder={tx('Nhập mật khẩu đang dùng', 'Enter current password')}
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-10 pl-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw((v) => !v)}
                      aria-label={showCurrentPw ? tx('Ẩn mật khẩu', 'Hide password') : tx('Hiện mật khẩu', 'Show password')}
                      className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
                    >
                      {showCurrentPw ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="nav-new-pw"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {tx('Mật khẩu mới (≥ 6 ký tự)', 'New password (≥ 6 chars)')}
                  </label>
                  <div className="relative">
                    <input
                      id="nav-new-pw"
                      type={showNewPw ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={tx('Nhập mật khẩu mới', 'Enter new password')}
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-10 pl-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw((v) => !v)}
                      aria-label={showNewPw ? tx('Ẩn mật khẩu mới', 'Hide new password') : tx('Hiện mật khẩu mới', 'Show new password')}
                      className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
                    >
                      {showNewPw ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="nav-confirm-pw"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {tx('Xác nhận mật khẩu mới', 'Confirm new password')}
                  </label>
                  <input
                    id="nav-confirm-pw"
                    type={showNewPw ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={tx('Nhập lại mật khẩu mới', 'Re-enter new password')}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              {passwordFeedback && (
                <p
                  role="status"
                  className={`text-xs font-semibold ${
                    passwordFeedback.type === 'success'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {passwordFeedback.text}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 cursor-pointer items-center whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {tx('Đóng', 'Close')}
                </button>
                <button
                  type="submit"
                  disabled={passwordBusy}
                  className="inline-flex h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>
                    {passwordBusy
                      ? tx('Đang cập nhật...', 'Updating...')
                      : tx('Xác nhận đổi mật khẩu', 'Confirm Password Change')}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
