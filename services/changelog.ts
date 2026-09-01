export type ChangelogItemType = 'feature' | 'improvement' | 'fix' | 'security';

export interface ChangelogItem {
    type: ChangelogItemType;
    title: string;
    description?: string;
}

export interface VersionRelease {
    version: string;
    releaseDate: string;
    title: string;
    summary?: string;
    highlightBadge?: string;
    isLatest?: boolean;
    items: ChangelogItem[];
}

export const APP_CHANGELOGS: VersionRelease[] = [
    {
        version: '2.8.4',
        releaseDate: '2026-09-01',
        title: 'Củng cố độ ổn định và an toàn hệ thống',
        summary: 'Hoàn thiện xác thực, bảo vệ dữ liệu và sửa các lỗi ngày giờ quan trọng.',
        highlightBadge: 'Bảo mật',
        isLatest: true,
        items: [
            {
                type: 'security',
                title: 'Gia cố xác thực và phân quyền',
                description: 'Không còn xác thực mật khẩu ở phía trình duyệt hoặc tiếp tục đăng nhập khi máy chủ từ chối.'
            },
            {
                type: 'fix',
                title: 'Sửa sai lệch ngày theo múi giờ',
                description: 'Ngày nghiệp vụ được tính theo múi giờ địa phương thay vì ngày UTC.'
            }
        ]
    }
];
