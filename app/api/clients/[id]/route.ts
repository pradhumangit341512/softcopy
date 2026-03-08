// import { NextRequest, NextResponse } from "next/server";
// import { requireAuth } from "@/lib/auth";
// import { db } from "@/lib/db";
// import { UpdateClientRequest } from "@/lib/types";

// /* ==================== GET ==================== */
// export async function GET(
//   req: NextRequest,
//   context: { params: Promise<{ id: string }> }
// ) {
//   try {
//     const { authorized, payload } = await requireAuth();

//     if (!authorized || !payload) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const { id } = await context.params;

//     if (!id) {
//       return NextResponse.json({ error: "Client id missing" }, { status: 400 });
//     }

//     const client = await db.client.findUnique({
//       where: { id },
//       include: {
//         creator: { select: { id: true, name: true } },
//         commissions: true,
//       },
//     });

//     if (!client) {
//       return NextResponse.json({ error: "Client not found" }, { status: 404 });
//     }

//     if (client.companyId !== payload.companyId) {
//       return NextResponse.json(
//         { error: "Unauthorized - wrong company" },
//         { status: 403 }
//       );
//     }

//     return NextResponse.json(client);
//   } catch (error) {
//     console.error("Get client error:", error);
//     return NextResponse.json(
//       { error: "Failed to fetch client" },
//       { status: 500 }
//     );
//   }
// }

// /* ==================== PUT ==================== */
// export async function PUT(
//   req: NextRequest,
//   context: { params: Promise<{ id: string }> }
// ) {
//   try {
//     const { authorized, payload } = await requireAuth();

//     if (!authorized || !payload) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const { id } = await context.params;
//     const body: UpdateClientRequest = await req.json();

//     const existing = await db.client.findUnique({ where: { id } });

//     if (!existing) {
//       return NextResponse.json({ error: "Client not found" }, { status: 404 });
//     }

//     if (existing.companyId !== payload.companyId) {
//       return NextResponse.json(
//         { error: "Unauthorized - wrong company" },
//         { status: 403 }
//       );
//     }

//     // 🔥 FIXED PERMISSION LOGIC
//     // admin & superadmin → update anyone
//     // user → update only their own clients
//     if (
//       payload.role !== "admin" &&
//       payload.role !== "superadmin" &&
//       existing.createdBy !== payload.userId
//     ) {
//       return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//     }

//     const updated = await db.client.update({
//       where: { id },
//       data: {
//         clientName: body.clientName,
//         phone: body.phone,
//         email: body.email,
//         budget: body.budget,
//         preferredLocation: body.preferredLocation,
//         status: body.status,
//         notes: body.notes,
//         visitingDate: body.visitingDate
//           ? new Date(body.visitingDate)
//           : undefined,
//         followUpDate: body.followUpDate
//           ? new Date(body.followUpDate)
//           : undefined,
//       },
//     });

//     return NextResponse.json(updated);
//   } catch (error) {
//     console.error("Update error:", error);
//     return NextResponse.json(
//       { error: "Update failed" },
//       { status: 500 }
//     );
//   }
// }

// /* ==================== DELETE ==================== */
// export async function DELETE(
//   req: NextRequest,
//   context: { params: Promise<{ id: string }> }
// ) {
//   try {
//     const { authorized, payload } = await requireAuth();

//     if (!authorized || !payload) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const { id } = await context.params;

//     const existing = await db.client.findUnique({ where: { id } });

//     if (!existing) {
//       return NextResponse.json({ error: "Client not found" }, { status: 404 });
//     }

//     if (existing.companyId !== payload.companyId) {
//       return NextResponse.json(
//         { error: "Unauthorized - wrong company" },
//         { status: 403 }
//       );
//     }

//     // only admin & superadmin delete
//     if (!["admin", "superadmin"].includes(payload.role)) {
//       return NextResponse.json({ error: "Admin only" }, { status: 403 });
//     }

//     await db.client.delete({ where: { id } });

//     return NextResponse.json({ success: true });
//   } catch (error) {
//     console.error("Delete error:", error);
//     return NextResponse.json(
//       { error: "Delete failed" },
//       { status: 500 }
//     );
//   }
// }

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { UpdateClientRequest } from "@/lib/types";


/* ==================== GET ==================== */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, payload } = await requireAuth();

    if (!authorized || !payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "Client id missing" }, { status: 400 });
    }

    const client = await db.client.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true } },
        commissions: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // 🔐 Keep company protection (important)
    if (client.companyId !== payload.companyId) {
      return NextResponse.json(
        { error: "Unauthorized company access" },
        { status: 403 }
      );
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error("Get client error:", error);
    return NextResponse.json(
      { error: "Failed to fetch client" },
      { status: 500 }
    );
  }
}

/* ==================== PUT ==================== */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, payload } = await requireAuth();

    // Only login required
    if (!authorized || !payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body: UpdateClientRequest = await req.json();

    const existing = await db.client.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // 🔐 Keep company protection
    if (existing.companyId !== payload.companyId) {
      return NextResponse.json(
        { error: "Unauthorized company access" },
        { status: 403 }
      );
    }

    // 🚀 NO ROLE CHECK — ANY LOGGED USER CAN UPDATE

    const updated = await db.client.update({
      where: { id },
      data: {
        clientName: body.clientName,
        phone: body.phone,
        email: body.email,
        budget: body.budget,
        preferredLocation: body.preferredLocation,
        status: body.status,
        notes: body.notes,
        visitingDate: body.visitingDate
          ? new Date(body.visitingDate)
          : null,
        followUpDate: body.followUpDate
          ? new Date(body.followUpDate)
          : null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update error:", error);
    return NextResponse.json(
      { error: "Update failed" },
      { status: 500 }
    );
  }
}

/* ==================== DELETE ==================== */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, payload } = await requireAuth();

    if (!authorized || !payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const existing = await db.client.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // 🔐 Keep company protection
    if (existing.companyId !== payload.companyId) {
      return NextResponse.json(
        { error: "Unauthorized company access" },
        { status: 403 }
      );
    }

    await db.client.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: "Delete failed" },
      { status: 500 }
    );
  }
}