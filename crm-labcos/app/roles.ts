import { getChatGPTUser } from './chatgpt-auth';
import type {UserRole} from './access-policy';

export async function dashboardRole(allowLimited=false): Promise<UserRole | null> {
  const user = await getChatGPTUser(allowLimited);
  return user?.role ?? null;
}

export async function requireAdminWrite(): Promise<Response | null> {
  const role = await dashboardRole();
  if (role === 'owner' || role === 'manager' || role === 'sale_admin') return null;
  return Response.json({ error: role ? 'Tài khoản chỉ có quyền xem.' : 'Cần đăng nhập để chỉnh sửa.' }, {
    status: role ? 403 : 401,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}


