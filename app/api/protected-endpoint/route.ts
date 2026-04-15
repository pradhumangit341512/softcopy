// app/api/protected-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, AUTH_ERRORS } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    const payload = await verifyAuth(req);

    if (!payload) {
      return NextResponse.json(
        { error: AUTH_ERRORS.NOT_AUTHENTICATED },
        { status: 401 }
      );
    }

    // Use payload data
    console.log(`User ${payload.userId} from company ${payload.companyId}`);

    return NextResponse.json({
      message: 'Access granted',
      user: payload,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}