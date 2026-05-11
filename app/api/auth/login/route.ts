import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * POST /api/auth/login
 * Body: { username, password }
 */
export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { username, password } = body;

  if (!username || !password) {
    return NextResponse.json(
      { error: 'Username and password required' },
      { status: 400 }
    );
  }

  const cleanUsername = String(username).trim().toLowerCase();
  const syntheticEmail = `${cleanUsername}@users.local`;

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: syntheticEmail,
    password: String(password),
  });

  if (error) {
    return NextResponse.json(
      { error: 'Invalid username or password' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    user: {
      id: data.user.id,
      username: cleanUsername,
    },
  });
}
