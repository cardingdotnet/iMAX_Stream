import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * POST /api/auth/signup
 * Body: { username, password }
 * 
 * Creates account with username + password.
 * We use a fake email format internally since Supabase requires email.
 */
export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { username, password } = body;

  // Validation
  if (!username || typeof username !== 'string') {
    return NextResponse.json(
      { error: 'Username is required' },
      { status: 400 }
    );
  }

  const cleanUsername = username.trim().toLowerCase();

  if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanUsername)) {
    return NextResponse.json(
      { error: 'Username must be 3-30 characters (letters, numbers, underscore only)' },
      { status: 400 }
    );
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return NextResponse.json(
      { error: 'Password must be at least 6 characters' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Check if username exists
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', cleanUsername)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: 'Username already taken' },
      { status: 409 }
    );
  }

  // Use synthetic email since Supabase requires it
  // Format: {username}@users.local
  const syntheticEmail = `${cleanUsername}@users.local`;

  const { data, error } = await supabase.auth.signUp({
    email: syntheticEmail,
    password,
    options: {
      data: {
        username: cleanUsername,
        display_name: username.trim(),
      },
    },
  });

  if (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { 
      success: true, 
      user: { 
        id: data.user?.id, 
        username: cleanUsername 
      } 
    },
    { status: 201 }
  );
}
