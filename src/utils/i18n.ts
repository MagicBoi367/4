import { useEffect, useState } from 'react';
import type { AppLanguage } from '../types/exam';

export type { AppLanguage } from '../types/exam';

const LANGUAGE_STORAGE_KEY = 'kythi2025_language_v1';
const LANGUAGE_CHANGE_EVENT = 'kythi2025:language-updated';

export function getAppLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'vi';
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return saved === 'en' ? 'en' : 'vi';
  } catch {
    return 'vi';
  }
}

export function setAppLanguage(lang: AppLanguage): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // Ignore storage quota errors
  }
  try {
    document.documentElement.lang = lang;
  } catch {
    // Ignore DOM errors
  }
  window.dispatchEvent(new CustomEvent<AppLanguage>(LANGUAGE_CHANGE_EVENT, { detail: lang }));
}

const DICTIONARIES = {
  vi: {
    // Settings Modal
    settingsTitle: 'Cài đặt hệ thống',
    settingsCloseAria: 'Đóng cài đặt',
    settingsCloseBtn: 'Đóng (Esc)',
    sectionAppearance: 'Giao diện & Hiển thị',
    themeLabel: 'Chế độ giao diện',
    themeDarkHint: 'Đang dùng giao diện tối · Phím tắt D',
    themeLightHint: 'Đang dùng giao diện sáng · Phím tắt D',
    sidebarLabel: 'Thu gọn thanh menu bên phải',
    sidebarCollapsedHint: 'Đang thu gọn thành biểu tượng · Phím tắt M',
    sidebarExpandedHint: 'Đang hiển thị đầy đủ · Phím tắt M',
    languageLabel: 'Ngôn ngữ hiển thị',
    languageHint: 'Chọn ngôn ngữ giao diện hệ thống',
    languageVi: 'Tiếng Việt',
    languageEn: 'English',
    fontSizeLabel: 'Kích cỡ chữ',
    fontSizeHint: 'Điều chỉnh kích thước chữ hiển thị trên toàn giao diện',
    fontSizeSmall: 'Nhỏ',
    fontSizeMedium: 'Mặc định',
    fontSizeLarge: 'Lớn',
    sectionNotifications: 'Thông báo & Âm thanh',
    classNotifLabel: 'Thông báo lớp học',
    classNotifHint: 'Nhận thông báo yêu cầu vào lớp, bài tập và tài liệu mới',
    examNotifLabel: 'Thông báo bài thi',
    examNotifHint: 'Nhận cảnh báo giám sát, lịch thi và thông báo nộp bài',
    otherNotifLabel: 'Thông báo tin khác',
    otherNotifHint: 'Nhận tin nhắn hỗ trợ, thông báo hệ thống và cập nhật chung',
    alertSoundLabel: 'Âm thanh cảnh báo trực tiếp',
    alertSoundHint: 'Phát âm báo khi có vi phạm hoặc yêu cầu tham gia lớp mới',
    toggleAllOnBtn: 'Bật tất cả',
    toggleAllOffBtn: 'Tắt tất cả',
    sectionSystemSupport: 'Hệ thống & Hỗ trợ',
    supportChatLabel: 'Hỗ trợ trực tuyến (Chat với Admin)',
    supportChatHintUser: 'Nhắn tin trực tiếp với bộ phận Quản trị viên hệ thống',
    supportChatHintAdmin: 'Xem và trả lời tin nhắn hỗ trợ từ học sinh & giáo viên',
    supportChatOpenBtn: 'Mở khung chat',
    shortcutsLabel: 'Bảng phím tắt hệ thống',
    clearCacheLabel: 'Xóa bộ nhớ đệm (Cache)',
    clearCacheHint: 'Dọn dẹp bản nháp tạm và cache trình duyệt, giữ nguyên tài khoản',
    clearCacheDoneHint: 'Đã xóa sạch bộ nhớ đệm tạm thời.',
    clearCacheBtn: 'Xóa cache',
    resetDemoLabel: 'Khôi phục dữ liệu mẫu',
    resetDemoHint: 'Đưa đề thi, lớp học và kết quả về trạng thái ban đầu',
    resetDemoDoneHint: 'Đã khôi phục toàn bộ dữ liệu mẫu thành công.',
    resetDemoBtn: 'Khôi phục',
    confirmBtn: 'Xác nhận',
    cancelBtn: 'Hủy',
    sectionDangerZone: 'Quản lý tài khoản',
    logoutLabel: 'Đăng xuất tài khoản',
    logoutHint: 'Kết thúc phiên đăng nhập hiện tại và quay lại màn hình đăng nhập',
    logoutGuestHint: 'Bạn đang ở chế độ xem thử (Khách).',
    logoutBtn: 'Đăng xuất',
    loginNowBtn: 'Đăng nhập',
    deleteAccountLabel: 'Xóa tài khoản vĩnh viễn',
    deleteAccountGuestHint: 'Bạn đang ở chế độ xem thử (Khách), chưa có tài khoản đăng nhập để xóa.',
    deleteAccountHint: 'Xóa vĩnh viễn tài khoản đang đăng nhập khỏi hệ thống và đăng xuất ngay lập tức.',
    deleteAccountBtn: 'Xóa tài khoản',
    deleteAccountConfirmTitle: 'Xác nhận xóa tài khoản này?',
    deleteAccountConfirmDesc: 'Hành động này không thể hoàn tác. Tài khoản sẽ bị xóa khỏi hệ thống và bạn sẽ được đưa về màn hình đăng nhập.',
    deleteAccountConfirmBtn: 'Xác nhận xóa vĩnh viễn',
    deleteAccountLastAdminError: 'Không thể xóa tài khoản Quản trị viên duy nhất còn lại trong hệ thống.',
    sectionAppInfo: 'Thông tin phiên bản',
    appVersionLabel: 'NTPEXION · Phiên bản hệ thống',
    appVersionDetail: 'Chuẩn đề thi THPT 2025 · Giao diện web đa vai trò',
    appBuildTag: 'Bản phát hành ổn định',

    // Support Chat Modal & Admin Support Tab
    supportModalTitleUser: 'Hỗ trợ trực tuyến · Bộ phận Admin',
    supportModalTitleAdmin: 'Hộp thư Hỗ trợ trực tuyến (Admin)',
    supportModalSubtitleUser: 'Kết nối trực tiếp theo thời gian thực với Quản trị viên NTPEXION',
    supportModalSubtitleAdmin: 'Phản hồi tin nhắn hỗ trợ từ học sinh, giáo viên và khách theo thời gian thực',
    supportStatusOpen: 'Đang hỗ trợ',
    supportStatusResolved: 'Đã xử lý',
    supportMarkResolved: 'Đánh dấu đã xử lý',
    supportReopenThread: 'Mở lại hội thoại',
    supportEmptyUser: 'Chưa có tin nhắn nào. Hãy gửi câu hỏi hoặc sự cố của bạn để bộ phận Admin hỗ trợ ngay.',
    supportEmptyAdminList: 'Chưa có yêu cầu hỗ trợ nào từ người dùng.',
    supportSelectThreadHint: 'Chọn một hội thoại bên trái để xem và trả lời.',
    supportPlaceholderUser: 'Nhập nội dung cần Admin hỗ trợ... (Enter để gửi)',
    supportPlaceholderAdmin: 'Nhập phản hồi cho người dùng... (Enter để gửi)',
    supportSendBtn: 'Gửi',
    supportAdminSenderName: 'Bộ phận Admin',
    supportGuestPrefix: 'Khách',
    supportRoleStudent: 'Học sinh',
    supportRoleTeacher: 'Giáo viên',
    supportRoleAdmin: 'Admin',
    supportRoleGuest: 'Khách',
    supportUnreadBadge: 'mới',
    supportThreadCountSuffix: 'cuộc hội thoại',
    supportOpenInAdminBtn: 'Mở trang Quản trị',
    supportToastIncomingAdmin: 'Tin nhắn hỗ trợ mới',
    supportToastIncomingReply: 'Phản hồi từ Admin',
    supportToastOpenChat: 'Mở khung chat',
    supportToastQuickReplyPlaceholder: 'Trả lời nhanh...',
    supportToastSendAria: 'Gửi phản hồi nhanh',
    supportToastCloseAria: 'Đóng thông báo tin nhắn',

    // Header & Right Sidebar & Footer
    navPortal: 'Phòng thi',
    navHome: 'Trang chủ',
    navExamManager: 'Tổ chức đề thi',
    navQuestionBank: 'Ngân hàng câu hỏi',
    navResults: 'Kết quả thi',
    navMyResults: 'Kết quả của tôi',
    navIntro: 'Giới thiệu',
    navIntroFull: 'Giới thiệu NTPEXION',
    navAdmin: 'Quản trị Admin',
    navClasses: 'Lớp học',
    navSchedule: 'Lịch học',
    navMaterials: 'Tài liệu',
    navAssignments: 'Bài tập',
    navExams: 'Bài thi',
    navScores: 'Bảng điểm',
    primaryCreateExam: 'Tạo đề thi mới',
    primaryQuickExam: 'Vào thi nhanh',
    authLoginRegister: 'Đăng nhập / Đăng ký',
    menuProfileInfo: 'Thông tin cá nhân & Ảnh đại diện',
    menuProfileInfoShort: 'Thông tin cá nhân',
    menuChangePassword: 'Đổi mật khẩu tài khoản',
    menuChangePasswordShort: 'Mật khẩu',
    menuChangePasswordMobile: 'Đổi mật khẩu',
    menuAdminPage: 'Trang Quản trị Admin',
    menuCreateAccountAdmin: 'Tạo tài khoản (HS / GV / Admin)',
    menuCreateAccountStaff: 'Tạo tài khoản (Học sinh / Giáo viên)',
    menuAccountList: 'Danh sách & Chuyển tài khoản',
    menuLogout: 'Đăng xuất',
    sidebarNavHeading: 'Menu điều hướng',
    sidebarClassMenuHeading: 'Menu lớp học',
    sidebarMainNavHeading: 'Điều hướng chính',
    sidebarStudentSectionHeading: 'Mục học tập',
    sidebarTeacherSectionHeading: 'Mục giảng dạy',
    sidebarUtilitiesHeading: 'Tiện ích',
    sidebarSettingsLabel: 'Cài đặt',
    sidebarGuestPreview: 'Đang xem thử',
    roleStudent: 'Học sinh',
    roleTeacher: 'Giáo viên',
    roleAdmin: 'Quản trị viên',
    footerShortcuts: 'Phím tắt (?)',
    footerResetDone: 'Đã khôi phục dữ liệu mẫu!',
    footerResetBtn: 'Khôi phục dữ liệu mẫu',
    adminTabOverview: 'Thống kê Web & Tổng quan',
    adminTabUsers: 'Quản lý User',
    adminTabContent: 'Đề thi & Bài nộp',
    adminTabSystem: 'Cấu hình & Giám sát',
    adminTabLogs: 'Nhật ký hệ thống',
    adminTabSupport: 'Hỗ trợ trực tuyến',
  },
  en: {
    // Settings Modal
    settingsTitle: 'System Settings',
    settingsCloseAria: 'Close settings',
    settingsCloseBtn: 'Close (Esc)',
    sectionAppearance: 'Appearance & Display',
    themeLabel: 'Theme Mode',
    themeDarkHint: 'Using dark theme · Shortcut D',
    themeLightHint: 'Using light theme · Shortcut D',
    sidebarLabel: 'Collapse right sidebar',
    sidebarCollapsedHint: 'Collapsed to icon rail · Shortcut M',
    sidebarExpandedHint: 'Showing full sidebar · Shortcut M',
    languageLabel: 'Display Language',
    languageHint: 'Switch the interface language',
    languageVi: 'Tiếng Việt',
    languageEn: 'English',
    fontSizeLabel: 'Font Size',
    fontSizeHint: 'Adjust text size across the entire interface',
    fontSizeSmall: 'Small',
    fontSizeMedium: 'Default',
    fontSizeLarge: 'Large',
    sectionNotifications: 'Notifications & Alerts',
    classNotifLabel: 'Classroom notifications',
    classNotifHint: 'Receive class join requests, new assignments, and study materials',
    examNotifLabel: 'Exam notifications',
    examNotifHint: 'Receive proctoring alerts, exam schedules, and submission updates',
    otherNotifLabel: 'Other message notifications',
    otherNotifHint: 'Receive support chat messages, system announcements, and general notices',
    alertSoundLabel: 'Live alert sound',
    alertSoundHint: 'Play an audio chime on violations or new class join requests',
    toggleAllOnBtn: 'Turn on all',
    toggleAllOffBtn: 'Turn off all',
    sectionSystemSupport: 'System & Support',
    supportChatLabel: 'Live Support (Chat with Admin)',
    supportChatHintUser: 'Send a real-time message directly to the Admin team',
    supportChatHintAdmin: 'View and reply to support messages from students & teachers',
    supportChatOpenBtn: 'Open chat',
    shortcutsLabel: 'Keyboard shortcuts',
    clearCacheLabel: 'Clear Cache',
    clearCacheHint: 'Remove temporary drafts and browser cache while keeping your account',
    clearCacheDoneHint: 'Temporary cache cleared successfully.',
    clearCacheBtn: 'Clear cache',
    resetDemoLabel: 'Restore demo data',
    resetDemoHint: 'Reset exams, classes, and results to initial state',
    resetDemoDoneHint: 'Demo data has been restored successfully.',
    resetDemoBtn: 'Restore',
    confirmBtn: 'Confirm',
    cancelBtn: 'Cancel',
    sectionDangerZone: 'Account Management',
    logoutLabel: 'Sign Out',
    logoutHint: 'End the current session and return to the sign-in screen',
    logoutGuestHint: 'You are currently using Guest preview mode.',
    logoutBtn: 'Sign out',
    loginNowBtn: 'Sign in',
    deleteAccountLabel: 'Delete Account Permanently',
    deleteAccountGuestHint: 'You are in Guest preview mode and have no signed-in account to delete.',
    deleteAccountHint: 'Permanently remove your signed-in account from the system and sign out immediately.',
    deleteAccountBtn: 'Delete account',
    deleteAccountConfirmTitle: 'Confirm deleting this account?',
    deleteAccountConfirmDesc: 'This action cannot be undone. Your account will be permanently deleted and you will be signed out.',
    deleteAccountConfirmBtn: 'Confirm permanent deletion',
    deleteAccountLastAdminError: 'Cannot delete the sole remaining Administrator account in the system.',
    sectionAppInfo: 'Version Information',
    appVersionLabel: 'NTPEXION · System Version',
    appVersionDetail: '2025 High School Exam Standard · Multi-role Web Portal',
    appBuildTag: 'Stable Release',

    // Support Chat Modal & Admin Support Tab
    supportModalTitleUser: 'Live Support · Admin Team',
    supportModalTitleAdmin: 'Live Support Inbox (Admin)',
    supportModalSubtitleUser: 'Real-time direct chat with NTPEXION Administrators',
    supportModalSubtitleAdmin: 'Respond in real time to support requests from students, teachers, and guests',
    supportStatusOpen: 'Open',
    supportStatusResolved: 'Resolved',
    supportMarkResolved: 'Mark resolved',
    supportReopenThread: 'Reopen thread',
    supportEmptyUser: 'No messages yet. Describe your question or issue to chat with the Admin team.',
    supportEmptyAdminList: 'No support conversations from users yet.',
    supportSelectThreadHint: 'Select a conversation on the left to view and reply.',
    supportPlaceholderUser: 'Type a message for Admin support... (Enter to send)',
    supportPlaceholderAdmin: 'Type your reply to the user... (Enter to send)',
    supportSendBtn: 'Send',
    supportAdminSenderName: 'Admin Support',
    supportGuestPrefix: 'Guest',
    supportRoleStudent: 'Student',
    supportRoleTeacher: 'Teacher',
    supportRoleAdmin: 'Admin',
    supportRoleGuest: 'Guest',
    supportUnreadBadge: 'new',
    supportThreadCountSuffix: 'conversations',
    supportOpenInAdminBtn: 'Open Admin Console',
    supportToastIncomingAdmin: 'New support message',
    supportToastIncomingReply: 'Reply from Admin',
    supportToastOpenChat: 'Open chat',
    supportToastQuickReplyPlaceholder: 'Quick reply...',
    supportToastSendAria: 'Send quick reply',
    supportToastCloseAria: 'Dismiss message popup',

    // Header & Right Sidebar & Footer
    navPortal: 'Exam Portal',
    navHome: 'Home',
    navExamManager: 'Manage Exams',
    navQuestionBank: 'Question Bank',
    navResults: 'Exam Results',
    navMyResults: 'My Results',
    navIntro: 'About',
    navIntroFull: 'About NTPEXION',
    navAdmin: 'Admin Console',
    navClasses: 'Classes',
    navSchedule: 'Schedule',
    navMaterials: 'Materials',
    navAssignments: 'Assignments',
    navExams: 'Exams',
    navScores: 'Grades',
    primaryCreateExam: 'Create New Exam',
    primaryQuickExam: 'Quick Exam',
    authLoginRegister: 'Sign In / Register',
    menuProfileInfo: 'Profile & Avatar',
    menuProfileInfoShort: 'Profile',
    menuChangePassword: 'Change Password',
    menuChangePasswordShort: 'Password',
    menuChangePasswordMobile: 'Password',
    menuAdminPage: 'Admin Console',
    menuCreateAccountAdmin: 'Create Account (Student / Teacher / Admin)',
    menuCreateAccountStaff: 'Create Account (Student / Teacher)',
    menuAccountList: 'Accounts & Switch User',
    menuLogout: 'Sign Out',
    sidebarNavHeading: 'Navigation',
    sidebarClassMenuHeading: 'Class Menu',
    sidebarMainNavHeading: 'Main Menu',
    sidebarStudentSectionHeading: 'Study',
    sidebarTeacherSectionHeading: 'Teaching',
    sidebarUtilitiesHeading: 'Utilities',
    sidebarSettingsLabel: 'Settings',
    sidebarGuestPreview: 'Guest Preview',
    roleStudent: 'Student',
    roleTeacher: 'Teacher',
    roleAdmin: 'Administrator',
    footerShortcuts: 'Shortcuts (?)',
    footerResetDone: 'Demo data restored!',
    footerResetBtn: 'Restore demo data',
    adminTabOverview: 'Web Analytics & Overview',
    adminTabUsers: 'Users',
    adminTabContent: 'Exams & Submissions',
    adminTabSystem: 'Config & Monitoring',
    adminTabLogs: 'System Logs',
    adminTabSupport: 'Live Support',
  },
} as const;

export type TranslationDict = typeof DICTIONARIES.vi;

export function getTranslations(lang: AppLanguage): TranslationDict {
  return (lang === 'en' ? DICTIONARIES.en : DICTIONARIES.vi) as TranslationDict;
}

export function useLanguage(): {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: TranslationDict;
  tx: (vi: string, en: string) => string;
} {
  const [language, setLangState] = useState<AppLanguage>(() => getAppLanguage());

  useEffect(() => {
    try {
      document.documentElement.lang = language;
    } catch {
      // Ignore DOM errors
    }
  }, [language]);

  useEffect(() => {
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<AppLanguage>).detail;
      if (detail === 'vi' || detail === 'en') {
        setLangState(detail);
      } else {
        setLangState(getAppLanguage());
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === LANGUAGE_STORAGE_KEY) {
        setLangState(getAppLanguage());
      }
    };
    window.addEventListener(LANGUAGE_CHANGE_EVENT, onCustom);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, onCustom);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return {
    language,
    setLanguage: setAppLanguage,
    t: getTranslations(language),
    tx: (vi: string, en: string) => (language === 'en' ? en : vi),
  };
}

const SUBJECT_NAMES_EN: Record<string, string> = {
  toan: 'Mathematics',
  vat_li: 'Physics',
  hoa_hoc: 'Chemistry',
  tin_hoc: 'Computer Science',
  tieng_anh: 'English',
  ngu_van: 'Literature',
  sinh_hoc: 'Biology',
  lich_su: 'History',
  dia_li: 'Geography',
  gdcd: 'Civic Education',
  gdktpl: 'Economics & Law',
  cong_nghe: 'Technology',
};

export function localizeSubjectName(
  subjectId: string | undefined,
  viName: string,
  lang: AppLanguage,
): string {
  if (lang !== 'en') return viName;
  if (subjectId && SUBJECT_NAMES_EN[subjectId]) return SUBJECT_NAMES_EN[subjectId];
  return viName === 'Môn học khác' ? 'Other Subject' : viName;
}

export function localizeCognitiveLevel(
  level: 'biet' | 'hieu' | 'van_dung',
  lang: AppLanguage,
): string {
  if (lang !== 'en') {
    return level === 'biet' ? 'Nhận biết' : level === 'hieu' ? 'Thông hiểu' : 'Vận dụng';
  }
  return level === 'biet' ? 'Recall' : level === 'hieu' ? 'Comprehension' : 'Application';
}

export function localizeExamCategory(
  category: 'tot_nghiep_2025' | 'cuoi_ky' | 'giua_ky' | 'thuong_xuyen',
  lang: AppLanguage,
): string {
  if (lang !== 'en') {
    switch (category) {
      case 'tot_nghiep_2025':
        return 'Thử Tốt nghiệp THPT 2025';
      case 'cuoi_ky':
        return 'Kiểm tra Cuối kỳ';
      case 'giua_ky':
        return 'Kiểm tra Giữa kỳ';
      case 'thuong_xuyen':
        return 'Kiểm tra Thường xuyên';
    }
  }
  switch (category) {
    case 'tot_nghiep_2025':
      return '2025 High School Mock';
    case 'cuoi_ky':
      return 'Final Term Exam';
    case 'giua_ky':
      return 'Midterm Exam';
    case 'thuong_xuyen':
      return 'Regular Quiz';
  }
}

export function localizeAcademicRank(viLabel: string, lang: AppLanguage): string {
  if (lang !== 'en') return viLabel;
  switch (viLabel) {
    case 'Tốt':
      return 'Excellent';
    case 'Khá':
      return 'Good';
    case 'Đạt':
      return 'Pass';
    case 'Chưa đạt':
      return 'Below Pass';
    default:
      return viLabel;
  }
}

export function localizeGradeText(viLabel: string, lang: AppLanguage): string {
  if (lang !== 'en') return viLabel;
  return viLabel
    .replace(/^Khối\s+/i, 'Grade ')
    .replace(/^Lớp\s+/i, 'Class ')
    .replace(/\bĐại học\b/g, 'University')
    .replace(/\bCao đẳng\b/g, 'College')
    .replace(/\bToàn khối\b/g, 'All classes')
    .replace(/\bLớp\s+/g, 'Class ')
    .replace(/^Khác$/i, 'Other')
    .replace(/\bKhác\b/g, 'Other');
}

export function localizeLogCategory(category: string, lang: AppLanguage): string {
  if (lang !== 'en') {
    switch (category) {
      case 'auth':
        return 'Xác thực & Phiên';
      case 'exam':
        return 'Đề thi & Nộp bài';
      case 'question':
        return 'Ngân hàng câu hỏi';
      case 'class':
        return 'Lớp học & Tài liệu';
      case 'user':
        return 'Tài khoản người dùng';
      case 'security':
        return 'Giám sát phòng thi';
      case 'system':
        return 'Hệ thống & Cấu hình';
      default:
        return category;
    }
  }
  switch (category) {
    case 'auth':
      return 'Auth & Session';
    case 'exam':
      return 'Exams & Submissions';
    case 'question':
      return 'Question Bank';
    case 'class':
      return 'Classes & Materials';
    case 'user':
      return 'User Accounts';
    case 'security':
      return 'Exam Proctoring';
    case 'system':
      return 'System & Config';
    default:
      return category;
  }
}

export function localizeLogLevel(level: string, lang: AppLanguage): string {
  if (lang !== 'en') {
    switch (level) {
      case 'info':
        return 'Thông tin';
      case 'warning':
        return 'Cảnh báo';
      case 'error':
        return 'Lỗi / Vi phạm';
      default:
        return level;
    }
  }
  switch (level) {
    case 'info':
      return 'Info';
    case 'warning':
      return 'Warning';
    case 'error':
      return 'Error / Violation';
    default:
      return level;
  }
}


