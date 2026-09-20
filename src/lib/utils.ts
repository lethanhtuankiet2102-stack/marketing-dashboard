import { type ClassValue, clsx } from 'clsx';

// Simple clsx implementation (no external dep needed)
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function formatDate(date: string | null): string {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleDateString('vi-VN', {
      month: 'short', day: 'numeric',
    });
  } catch {
    return date;
  }
}

export function formatDateTime(date: string | null): string {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleString('vi-VN', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return date;
  }
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function timeAgo(date: string | null): string {
  if (!date) return '—';
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  return `${days} ngày trước`;
}

export const PILLAR_LABELS: Record<number, string> = {
  1: 'Kiến thức & Giá trị',
  2: 'Dịch vụ & Giải pháp',
  3: 'Case Study',
  4: 'Thương hiệu Labcos',
  5: 'Xu hướng & Tin tức',
};

export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-700 text-zinc-300',
  pending_approval: 'bg-amber-900/60 text-amber-300',
  ready: 'bg-blue-900/60 text-blue-300',
  published: 'bg-emerald-900/60 text-emerald-300',
  rejected: 'bg-red-900/60 text-red-300',
  new: 'bg-zinc-700 text-zinc-300',
  validated: 'bg-blue-900/60 text-blue-300',
  contacted: 'bg-indigo-900/60 text-indigo-300',
  replied: 'bg-purple-900/60 text-purple-300',
  interested: 'bg-amber-900/60 text-amber-300',
  booked: 'bg-emerald-900/60 text-emerald-300',
  qualified: 'bg-green-900/60 text-green-300',
  disqualified: 'bg-red-900/60 text-red-300',
  queued: 'bg-zinc-700 text-zinc-300',
  approved: 'bg-blue-900/60 text-blue-300',
  sent: 'bg-emerald-900/60 text-emerald-300',
  cancelled: 'bg-red-900/60 text-red-300',
  pending: 'bg-amber-900/60 text-amber-300',
  proposed: 'bg-zinc-700 text-zinc-300',
  running: 'bg-blue-900/60 text-blue-300',
  completed: 'bg-emerald-900/60 text-emerald-300',
  SCALE: 'bg-emerald-900/60 text-emerald-300',
  ITERATE: 'bg-amber-900/60 text-amber-300',
  KILL: 'bg-red-900/60 text-red-300',
  high: 'bg-red-900/60 text-red-300',
  medium: 'bg-amber-900/60 text-amber-300',
  low: 'bg-zinc-700 text-zinc-300',
  pain: 'bg-red-900/60 text-red-300',
  hiring: 'bg-blue-900/60 text-blue-300',
  launch: 'bg-emerald-900/60 text-emerald-300',
  competitor: 'bg-purple-900/60 text-purple-300',
  brand_mention: 'bg-amber-900/60 text-amber-300',
  opportunity: 'bg-green-900/60 text-green-300',
};


export const STATUS_LABELS: Record<string, string> = {
  draft: 'Bản nháp', pending_approval: 'Chờ duyệt', ready: 'Sẵn sàng',
  published: 'Đã đăng', rejected: 'Từ chối', new: 'Mới',
  validated: 'Đã xác minh', approved: 'Đã duyệt', contacted: 'Đã liên hệ',
  replied: 'Đã phản hồi', interested: 'Quan tâm', booked: 'Đã hẹn',
  qualified: 'Tiềm năng', disqualified: 'Không phù hợp', queued: 'Đang chờ',
  sent: 'Đã gửi', cancelled: 'Đã hủy', pending: 'Đang chờ',
  proposed: 'Đề xuất', running: 'Đang chạy', completed: 'Hoàn tất',
  SCALE: 'Mở rộng', ITERATE: 'Tối ưu', KILL: 'Dừng',
  high: 'Cao', medium: 'Trung bình', low: 'Thấp',
  pain: 'Vấn đề / nhu cầu', hiring: 'Tuyển dụng', launch: 'Ra mắt',
  competitor: 'Đối thủ', brand_mention: 'Nhắc thương hiệu', opportunity: 'Cơ hội',
  reply: 'Trả lời', quote_tweet: 'Trích dẫn', comment: 'Bình luận',
  follow: 'Theo dõi', dm: 'Tin nhắn', opt_out: 'Hủy nhận',
  bounce: 'Email lỗi', domain_block: 'Chặn domain',
};
