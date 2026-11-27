import { Keyboard, X } from 'lucide-react';
import { useLanguage } from '../utils/i18n';

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  items: ShortcutItem[];
}

interface KeyboardShortcutsModalProps {
  mode: 'portal' | 'exam';
  onClose: () => void;
}

export function KeyboardShortcutsModal({ mode, onClose }: KeyboardShortcutsModalProps) {
  const { tx } = useLanguage();

  const portalGroups: ShortcutGroup[] = [
    {
      title: tx('Điều hướng nhanh', 'Quick Navigation'),
      items: [
        { keys: ['1'], description: tx('Chuyển tới Phòng thi & Tổng quan', 'Go to Exam Portal & Overview') },
        { keys: ['2'], description: tx('Chuyển tới Tổ chức đề thi', 'Go to Manage Exams') },
        { keys: ['3'], description: tx('Chuyển tới Ngân hàng câu hỏi', 'Go to Question Bank') },
        { keys: ['4'], description: tx('Chuyển tới Kết quả thi & Thống kê', 'Go to Exam Results & Analytics') },
        { keys: ['5'], description: tx('Chuyển tới Trang Quản trị Admin (nếu có quyền)', 'Go to Admin Console (if permitted)') },
      ],
    },
    {
      title: tx('Giao diện & Hộp thoại', 'Appearance & Dialogs'),
      items: [
        { keys: ['M'], description: tx('Thu gọn / mở rộng cột menu bên phải', 'Collapse / expand right sidebar') },
        { keys: ['D'], description: tx('Bật / tắt chế độ giao diện tối (Dark Mode)', 'Toggle Dark Mode') },
        { keys: ['?'], description: tx('Mở hoặc đóng bảng phím tắt', 'Open or close keyboard shortcuts') },
        { keys: ['Esc'], description: tx('Đóng hộp thoại hoặc quay lại trang trước', 'Close dialog or go back') },
      ],
    },
  ];

  const examGroups: ShortcutGroup[] = [
    {
      title: tx('Di chuyển câu hỏi', 'Question Navigation'),
      items: [
        { keys: ['↓', 'J'], description: tx('Chuyển tới câu hỏi tiếp theo', 'Move to next question') },
        { keys: ['↑', 'K'], description: tx('Quay lại câu hỏi trước đó', 'Move to previous question') },
        { keys: ['['], description: tx('Nhảy tới câu đã đánh dấu trước đó', 'Jump to previous flagged question') },
        { keys: [']'], description: tx('Nhảy tới câu đã đánh dấu tiếp theo', 'Jump to next flagged question') },
      ],
    },
    {
      title: tx('Chọn & nhập đáp án nhanh', 'Quick Answer Entry'),
      items: [
        { keys: ['1', '–', '4'], description: tx('Phần I: Chọn đáp án A, B, C, D (hoặc nhấn A–D)', 'Part I: Select A, B, C, D (or press A–D)') },
        { keys: ['1', '–', '4'], description: tx('Phần II: Chuyển Đúng / Sai lần lượt cho ý a), b), c), d)', 'Part II: Toggle True / False for a), b), c), d)') },
        { keys: ['Enter'], description: tx('Phần III: Đưa con trỏ vào ô nhập đáp án ngắn', 'Part III: Focus short-answer input') },
        { keys: ['Esc'], description: tx('Thoát khỏi ô nhập số để tiếp tục điều hướng bằng phím', 'Exit input box to resume keyboard navigation') },
      ],
    },
    {
      title: tx('Điều khiển phòng thi', 'Exam Room Controls'),
      items: [
        { keys: ['Space'], description: tx('Tạm dừng hoặc tiếp tục tính giờ làm bài', 'Pause or resume exam timer') },
        { keys: ['B'], description: tx('Đánh dấu / bỏ đánh dấu xem lại câu hiện tại', 'Flag / unflag current question for review') },
        { keys: ['F'], description: tx('Bật / tắt chế độ toàn màn hình tập trung', 'Toggle focus fullscreen mode') },
        { keys: ['M'], description: tx('Bật / tắt âm báo sắp hết giờ (< 5 phút)', 'Toggle low-time alert chime (< 5 mins)') },
        { keys: ['D'], description: tx('Bật / tắt giao diện tối (Dark Mode)', 'Toggle Dark Mode') },
        { keys: ['Ctrl', 'Enter'], description: tx('Mở hộp thoại xác nhận nộp bài', 'Open submit confirmation dialog') },
        { keys: ['?'], description: tx('Mở hoặc đóng bảng phím tắt này', 'Open or close this shortcuts guide') },
      ],
    },
  ];

  const groups = mode === 'exam' ? examGroups : portalGroups;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-shortcuts-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs dark:bg-slate-950/80"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Keyboard className="h-5 w-5 text-blue-700 dark:text-blue-400" />
            <h2
              id="keyboard-shortcuts-title"
              className="font-display text-base font-bold text-slate-900 sm:text-lg dark:text-slate-50"
            >
              {mode === 'exam'
                ? tx('Phím tắt trong Phòng thi', 'Exam Room Shortcuts')
                : tx('Phím tắt Điều hướng Hệ thống', 'System Navigation Shortcuts')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tx('Đóng bảng phím tắt', 'Close shortcuts modal')}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {groups.map((group) => (
            <section key={group.title}>
              <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                {group.title}
              </h3>
              <ul className="mt-2.5 divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {group.items.map((item, idx) => (
                  <li
                    key={`${group.title}-${idx}`}
                    className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"
                  >
                    <span className="text-slate-700 dark:text-slate-300">{item.description}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {item.keys.map((keyLabel, kIdx) =>
                        keyLabel === '–' ? (
                          <span
                            key={kIdx}
                            className="text-xs text-slate-400 dark:text-slate-500"
                          >
                            –
                          </span>
                        ) : (
                          <kbd
                            key={kIdx}
                            className="inline-flex min-w-[26px] items-center justify-center rounded-md border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            {keyLabel}
                          </kbd>
                        ),
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {tx(
              'Mẹo: Các phím tắt tự động tạm vô hiệu hóa khi bạn đang nhập liệu trong ô tìm kiếm hoặc ô nhập số trả lời ngắn. Nhấn ',
              'Tip: Shortcuts are automatically paused while typing in search fields or short-answer inputs. Press ',
            )}
            <kbd className="rounded border border-slate-300 bg-slate-100 px-1 py-0.5 font-mono text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Esc
            </kbd>
            {tx(' để thoát ô nhập liệu.', ' to exit the input field.')}
          </p>
        </div>

        <div className="flex justify-end border-t border-slate-200 px-6 py-3.5 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            {tx('Đã hiểu (Esc)', 'Got it (Esc)')}
          </button>
        </div>
      </div>
    </div>
  );
}

