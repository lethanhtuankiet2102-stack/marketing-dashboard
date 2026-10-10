import { getChatGPTUser } from './chatgpt-auth';

export async function dashboardRole(): Promise<'owner' | 'viewer' | 'designer' | null> {
  const user = await getChatGPTUser();
  return user?.role ?? null;
}

export async function requireOwnerWrite(): Promise<Response | null> {
  const role = await dashboardRole();
  if (role === 'owner') return null;
  return Response.json({ error: role ? 'Tài khoản chỉ có quyền xem.' : 'Cần đăng nhập để chỉnh sửa.' }, {
    status: role ? 403 : 401,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

