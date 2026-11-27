import { Printer, X } from 'lucide-react';
import type { ExamSubmission } from '../types/exam';
import { localizeAcademicRank, useLanguage } from '../utils/i18n';
import {
  classifyAcademicRankTT22,
  formatDurationMMSS,
  formatScoreVi,
  getSubjectMeta,
} from '../utils/scoring2025';

interface PrintableResultsModalProps {
  submissions: ExamSubmission[];
  examLabel: string;
  classLabel: string;
  stats: {
    avg: number;
    highest: number;
    passRate: number;
    rankData: { label: string; count: number; percent: number }[];
  };
  onClose: () => void;
}

export function PrintableResultsModal({
  submissions,
  examLabel,
  classLabel,
  stats,
  onClose,
}: PrintableResultsModalProps) {
  const { language, tx } = useLanguage();
  const today = new Date();
  const formattedDate =
    language === 'en'
      ? today.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: '2-digit',
        })
      : `Ngày ${String(today.getDate()).padStart(2, '0')} tháng ${String(
          today.getMonth() + 1,
        ).padStart(2, '0')} năm ${today.getFullYear()}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="print-results-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-0 sm:p-6 dark:bg-slate-950/85 print:static print:overflow-visible print:bg-white print:p-0"
    >
      <div className="mx-auto max-w-5xl rounded-none bg-white shadow-2xl sm:rounded-xl print:max-w-none print:rounded-none print:shadow-none">
        {/* Non-print Action Bar */}
        <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4 sm:rounded-t-xl dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2
              id="print-results-title"
              className="font-display text-sm font-bold text-slate-900 dark:text-slate-50"
            >
              {tx(
                'Xem trước Biên bản & Bảng điểm lưu trữ (A4 / PDF)',
                'Preview Official Results & Score Ledger (A4 / PDF)',
              )}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {tx(
                'Chọn "Lưu dưới dạng PDF" (Save as PDF) trong hộp thoại in để tải file PDF chính thức.',
                'Select "Save as PDF" in the print dialog to download the official PDF report.',
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              <Printer className="h-4 w-4" />
              <span>{tx('In / Xuất file PDF', 'Print / Export PDF')}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={tx('Đóng bản xem trước', 'Close preview')}
              className="cursor-pointer rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Vietnamese Archival Report */}
        <div className="p-8 text-slate-900 sm:p-10 print:p-0">
          {/* Official Administrative Header */}
          <div className="grid grid-cols-12 gap-4 border-b-2 border-slate-900 pb-4 text-center text-xs">
            <div className="col-span-5 space-y-1">
              <p className="font-semibold uppercase">
                {tx('SỞ GIÁO DỤC VÀ ĐÀO TẠO', 'DEPARTMENT OF EDUCATION & TRAINING')}
              </p>
              <p className="font-bold uppercase">
                {tx('HỘI ĐỒNG THI TRỰC TUYẾN 2025', '2025 ONLINE EXAMINATION BOARD')}
              </p>
              <p className="text-[11px] text-slate-600">
                {tx(
                  '(Theo Thông tư 24/2024 & TT 22/2021/TT-BGDĐT)',
                  '(Per Circular 24/2024 & Circular 22/2021/TT-BGDDT)',
                )}
              </p>
            </div>
            <div className="col-span-7 space-y-1">
              <p className="font-bold uppercase">
                {tx(
                  'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
                  'SOCIALIST REPUBLIC OF VIETNAM',
                )}
              </p>
              <p className="font-semibold underline underline-offset-4">
                {tx(
                  'Độc lập - Tự do - Hạnh phúc',
                  'Independence - Freedom - Happiness',
                )}
              </p>
              <p className="pt-1 italic text-slate-600">{formattedDate}</p>
            </div>
          </div>

          <div className="mt-6 text-center">
            <h1 className="font-display text-lg font-bold uppercase tracking-tight text-slate-900">
              {tx(
                'BẢNG TỔNG HỢP KẾT QUẢ KIỂM TRA TRẮC NGHIỆM TRỰC TUYẾN',
                'ONLINE OBJECTIVE ASSESSMENT SCORE SUMMARY LEDGER',
              )}
            </h1>
            <p className="mt-1 text-xs text-slate-700">
              <strong>{tx('Phạm vi kỳ thi:', 'Exam scope:')}</strong> {examLabel} ·{' '}
              <strong>{tx('Đơn vị / Lớp:', 'Unit / Class:')}</strong> {classLabel}
            </p>
          </div>

          {/* Class Summary Metrics */}
          <div className="mt-5 grid grid-cols-4 divide-x divide-slate-300 border border-slate-300 text-xs">
            <div className="p-3">
              <span className="block text-slate-600">{tx('Tổng số bài thi', 'Total attempts')}</span>
              <strong className="mt-0.5 block font-mono text-base tabular-nums">
                {submissions.length} {tx('thí sinh', 'candidates')}
              </strong>
            </div>
            <div className="p-3">
              <span className="block text-slate-600">{tx('Điểm trung bình', 'Average score')}</span>
              <strong className="mt-0.5 block font-mono text-base tabular-nums">
                {formatScoreVi(stats.avg)} {tx('điểm', 'pts')}
              </strong>
            </div>
            <div className="p-3">
              <span className="block text-slate-600">{tx('Điểm cao nhất', 'Highest score')}</span>
              <strong className="mt-0.5 block font-mono text-base tabular-nums">
                {formatScoreVi(stats.highest)} {tx('điểm', 'pts')}
              </strong>
            </div>
            <div className="p-3">
              <span className="block text-slate-600">{tx('Tỷ lệ đạt (≥ 5,00)', 'Pass rate (≥ 5.00)')}</span>
              <strong className="mt-0.5 block font-mono text-base tabular-nums">
                {stats.passRate}%
              </strong>
            </div>
          </div>

          {/* TT22 Classification Summary Strip */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-slate-300 bg-slate-50 px-3 py-2 text-[11px]">
            <span className="font-semibold text-slate-800">
              {tx('Phân loại theo Thông tư 22/2021:', 'Classification (Circular 22/2021):')}
            </span>
            <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums">
              {stats.rankData.map((r) => (
                <span key={r.label}>
                  {r.label}: <strong>{r.count}</strong> ({r.percent}%)
                </span>
              ))}
            </div>
          </div>

          {/* Detailed Student Score Table */}
          <table className="mt-5 w-full border-collapse border border-slate-400 text-left text-[11px]">
            <thead>
              <tr className="bg-slate-100 font-bold text-slate-900">
                <th className="border border-slate-400 px-2 py-2 text-center">{tx('STT', '#')}</th>
                <th className="border border-slate-400 px-2 py-2">{tx('SBD', 'ID')}</th>
                <th className="border border-slate-400 px-2 py-2">{tx('Họ và tên', 'Full name')}</th>
                <th className="border border-slate-400 px-2 py-2 text-center">{tx('Lớp', 'Class')}</th>
                <th className="border border-slate-400 px-2 py-2">{tx('Môn / Mã đề', 'Subject / Code')}</th>
                <th className="border border-slate-400 px-2 py-2 text-right">{tx('Phần I', 'Part I')}</th>
                <th className="border border-slate-400 px-2 py-2 text-right">{tx('Phần II', 'Part II')}</th>
                <th className="border border-slate-400 px-2 py-2 text-right">{tx('Phần III', 'Part III')}</th>
                <th className="border border-slate-400 px-2 py-2 text-right">{tx('Tổng điểm', 'Total')}</th>
                <th className="border border-slate-400 px-2 py-2 text-center">{tx('Xếp loại', 'Rank')}</th>
                <th className="border border-slate-400 px-2 py-2 text-center">{tx('Thời gian', 'Duration')}</th>
                <th className="border border-slate-400 px-2 py-2">{tx('Giám sát', 'Proctoring')}</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub, idx) => {
                const rank = classifyAcademicRankTT22(sub.totalScore);
                return (
                  <tr key={sub.id} className="break-inside-avoid">
                    <td className="border border-slate-300 px-2 py-1.5 text-center font-mono tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="border border-slate-300 px-2 py-1.5 font-mono tabular-nums">
                      {sub.studentSbd}
                    </td>
                    <td className="border border-slate-300 px-2 py-1.5 font-medium">
                      {sub.studentName}
                    </td>
                    <td className="border border-slate-300 px-2 py-1.5 text-center">
                      {sub.studentClass}
                    </td>
                    <td className="border border-slate-300 px-2 py-1.5">
                      {getSubjectMeta(sub.subject).shortName} ·{' '}
                      <span className="font-mono">{sub.variantCode}</span>
                    </td>
                    <td className="border border-slate-300 px-2 py-1.5 text-right font-mono tabular-nums">
                      {formatScoreVi(sub.part1Score)}
                    </td>
                    <td className="border border-slate-300 px-2 py-1.5 text-right font-mono tabular-nums">
                      {formatScoreVi(sub.part2Score)}
                    </td>
                    <td className="border border-slate-300 px-2 py-1.5 text-right font-mono tabular-nums">
                      {formatScoreVi(sub.part3Score)}
                    </td>
                    <td className="border border-slate-300 px-2 py-1.5 text-right font-mono font-bold tabular-nums">
                      {formatScoreVi(sub.totalScore)}
                    </td>
                    <td className="border border-slate-300 px-2 py-1.5 text-center font-semibold">
                      {localizeAcademicRank(rank.label, language)}
                    </td>
                    <td className="border border-slate-300 px-2 py-1.5 text-center font-mono tabular-nums">
                      {formatDurationMMSS(sub.elapsedSeconds)}
                    </td>
                    <td className="border border-slate-300 px-2 py-1.5">
                      {sub.violations.length === 0
                        ? tx('Hợp lệ', 'Valid')
                        : `${sub.violations.length} ${tx('cảnh báo', 'alerts')}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Official Signature Block */}
          <div className="mt-8 grid grid-cols-2 gap-8 break-inside-avoid text-center text-xs">
            <div className="space-y-16">
              <div>
                <p className="font-bold uppercase">
                  {tx('GIÁO VIÊN CHỦ NHIỆM / BỘ MÔN', 'HOMEROOM / SUBJECT TEACHER')}
                </p>
                <p className="text-[11px] italic text-slate-600">
                  {tx('(Ký và ghi rõ họ tên)', '(Signature and full name)')}
                </p>
              </div>
              <p className="text-slate-400">................................................</p>
            </div>
            <div className="space-y-16">
              <div>
                <p className="font-bold uppercase">
                  {tx('XÁC NHẬN CỦA HỘI ĐỒNG THI', 'EXAMINATION BOARD CERTIFICATION')}
                </p>
                <p className="text-[11px] italic text-slate-600">
                  {tx('(Ký, đóng dấu)', '(Signature and seal)')}
                </p>
              </div>
              <p className="text-slate-400">................................................</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
