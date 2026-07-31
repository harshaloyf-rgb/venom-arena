import { NextResponse } from 'next/server';

// POST /api/chips/pack — chip purchases are temporarily disabled.
export async function POST() {
  return NextResponse.json(
    { error: 'Chip purchases are temporarily disabled.' },
    { status: 503 },
  );
}