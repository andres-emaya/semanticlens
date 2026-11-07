import { NextResponse } from "next/server";

import type { SearchOptions } from "@/lib/ir-engine";
import { searchOnServer } from "@/lib/search-server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SearchOptions;
    const result = searchOnServer(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Search failed"
      },
      { status: 500 }
    );
  }
}
