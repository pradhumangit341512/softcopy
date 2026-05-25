import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isValidObjectId } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminRole } from '@/lib/authorize';

export const runtime = 'nodejs';

/* ==================== GET — list assigned properties for a client ==================== */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, payload } = await requireAuth();
    if (!authorized || !payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid client id' }, { status: 400 });
    }

    // Verify client belongs to same company
    const client = await db.client.findFirst({
      where: { id, companyId: payload.companyId, deletedAt: null },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const assignments = await db.propertyAssignment.findMany({
      where: { clientId: id },
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
            projectName: true,
            sectorNo: true,
            ownerName: true,
            ownerPhone: true,
          },
        },
        assigner: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error('List property assignments error:', error);
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
  }
}

/* ==================== POST — assign a property to a client ==================== */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, payload } = await requireAuth();
    if (!authorized || !payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isAdminRole(payload.role)) {
      return NextResponse.json({ error: 'Only admins can assign properties' }, { status: 403 });
    }

    const { id } = await context.params;
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid client id' }, { status: 400 });
    }

    const body = await req.json();
    const { propertyId, notes } = body;

    if (!propertyId || !isValidObjectId(propertyId)) {
      return NextResponse.json({ error: 'Invalid property id' }, { status: 400 });
    }

    // Verify client belongs to same company
    const client = await db.client.findFirst({
      where: { id, companyId: payload.companyId, deletedAt: null },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Verify property belongs to same company
    const property = await db.property.findFirst({
      where: { id: propertyId, companyId: payload.companyId, deletedAt: null },
      select: { id: true },
    });
    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // Check if already assigned
    const existing = await db.propertyAssignment.findUnique({
      where: { clientId_propertyId: { clientId: id, propertyId } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Property already assigned to this client' }, { status: 409 });
    }

    const assignment = await db.propertyAssignment.create({
      data: {
        clientId: id,
        propertyId,
        assignedBy: payload.userId,
        notes: notes || null,
        status: 'Suggested',
      },
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
            projectName: true,
            sectorNo: true,
            ownerName: true,
            ownerPhone: true,
          },
        },
        assigner: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    console.error('Assign property error:', error);
    return NextResponse.json({ error: 'Failed to assign property' }, { status: 500 });
  }
}
