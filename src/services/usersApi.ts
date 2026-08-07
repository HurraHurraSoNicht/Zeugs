import { extractFunctionError, getSupabase } from './supabaseClient';

export interface AdminUser {
  id: string;
  email: string;
  createdAt: string;
}

export async function findUserByEmail(email: string): Promise<AdminUser | null> {
  const { data, error } = await getSupabase().functions.invoke('admin-users', {
    body: { email },
  });

  if (error) {
    throw new Error(await extractFunctionError(error));
  }
  return (data as { user: AdminUser | null }).user;
}

export async function deleteUserAccount(id: string): Promise<void> {
  const { error } = await getSupabase().functions.invoke('admin-users', {
    method: 'DELETE',
    body: { id },
  });

  if (error) {
    throw new Error(await extractFunctionError(error));
  }
}
