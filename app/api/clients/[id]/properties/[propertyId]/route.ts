import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isValidObjectId } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

const VALID_STATUSES = ['Suggested', 'Interested', 'Visited', 'Rejected'];

/* ==================== PUT — update assignment status/notes ==================== */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; propertyId: string }> }
) {
  try {
    const { authorized, payload } = await requireAuth();
    if (!authorized || !payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, propertyId } = await context.params;
    if (!id || !isValidObjectId(id) || !propertyId || !isValidObjectId(propertyId)) {
      return NextResponse.json({ error: 'Invalid ids' }, { status: 400 });
    }

    const assignment = await db.propertyAssignment.findUnique({
      where: { clientId_propertyId: { clientId: id, propertyId } },
      include: { client: { select: { companyId: true } } },
    });
    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }
    if (assignment.client.companyId !== payload.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = {};

    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
      }
      updateData.status = body.status;
    }
    if (body.notes !== undefined) {
      updateData.notes = body.notes || null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const updated = await db.propertyAssignment.update({
      where: { clientId_propertyId: { clientId: id, propertyId } },
      data: updateData,
      include: {
        property: {
          select: {
            id: true,
            propertyName: true,
            address: true,
            propertyType: true,
            bhkType: true,
            askingRent: true,
            sellingPrice: true,
            area: true,
            status: true,
          },
        },
        assigner: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update assignment error:', error);
    return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 });
  }
}

/* ==================== DELETE — remove assignment ==================== */
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; propertyId: string }> }
) {
  try {
    const { authorized, payload } = await requireAuth();
    if (!authorized || !payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, propertyId } = await context.params;
    if (!id || !isValidObjectId(id) || !propertyId || !isValidObjectId(propertyId)) {
      return NextResponse.json({ error: 'Invalid ids' }, { status: 400 });
    }

    const assignment = await db.propertyAssignment.findUnique({
      where: { clientId_propertyId: { clientId: id, propertyId } },
      include: { client: { select: { companyId: true } } },
    });
    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }
    if (assignment.client.companyId !== payload.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await db.propertyAssignment.delete({
      where: { clientId_propertyId: { clientId: id, propertyId } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete assignment error:', error);
    return NextResponse.json({ error: 'Failed to remove assignment' }, { status: 500 });
  }
}
