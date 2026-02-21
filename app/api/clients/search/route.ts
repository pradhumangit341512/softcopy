import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTokenCookie, verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = await getTokenCookie();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = 20;
    const skip = (page - 1) * limit;

    const where: any = {
      companyId: payload.companyId,
      OR: [
        { clientName: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query } },
        { email: { contains: query, mode: 'insensitive' } },
      ],
    };

    const [clients, total] = await Promise.all([
      db.client.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          clientName: true,
          phone: true,
          email: true,
          status: true,
          requirementType: true,
          budget: true,
        },
      }),
      db.client.count({ where }),
    ]);

    return NextResponse.json({
      clients,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}