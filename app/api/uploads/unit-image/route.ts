/**
 * POST /api/uploads/unit-image — Phase 3 (3.1)
 *
 * Stores a single property image in Vercel Blob and returns its public URL.
 * The unit form uploads each picked file here, then keeps the returned URL in
 * the unit's `imageUrls` array on save.
 *
 * Requires BLOB_READ_WRITE_TOKEN in the environment. On Vercel this is injected
 * automatically once a Blob store is linked to the project; locally, add it to
 * .env (from `vercel env pull` or the Vercel dashboard → Storage → Blob).
 */

import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { requireAuth } from '@/lib/auth-middleware';
import { requireFeature } from '@/lib/require-feature';

export const runtime = 'nodejs';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const { authorized, response, payload } = await requireAuth(req);
    if (!authorized || !payload) return response;

    const gate = await requireFeature(payload.companyId, 'feature.projects_working');
    if (!gate.ok) return gate.response;

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: 'Image storage is not configured (BLOB_READ_WRITE_TOKEN missing).' },
        { status: 503 },
      );
    }

    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG, WebP, and GIF images are allowed' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File size must be under 5MB' }, { status: 400 });
    }

    // Namespace by company; addRandomSuffix avoids collisions between same-named files.
    const safeBaseName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const blob = await put(`units/${payload.companyId}/${safeBaseName}`, file, {
      access: 'public',
      addRandomSuffix: true,
      contentType: file.type,
    });

    return NextResponse.json({ imageUrl: blob.url });
  } catch (err) {
    console.error('Unit image upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
