import { submitOrderAction } from "@/lib/actions/storefront/checkout";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await submitOrderAction(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] checkout error:", error);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  }
}