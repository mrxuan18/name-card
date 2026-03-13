import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

type ProspectPayload = {
  id: string;
  storeName: string;
  address: string;
  lat: number;
  lng: number;
};

function toCsv(items: ProspectPayload[]): string {
  const header = ["id", "storeName", "address", "lat", "lng"];
  const rows = items.map((p) =>
    [p.id, p.storeName, p.address, String(p.lat), String(p.lng)].map((value) => {
      const safe = value ?? "";
      if (safe.includes(",") || safe.includes('"') || safe.includes("\n")) {
        return `"${safe.replace(/"/g, '""')}"`;
      }
      return safe;
    })
  );
  return [header.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { prospects?: ProspectPayload[] };
    const prospects = Array.isArray(body.prospects) ? body.prospects : [];

    const csv = toCsv(prospects);
    const filePath = path.join(process.cwd(), "prospects.csv");
    await fs.writeFile(filePath, csv, "utf8");

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to write prospects.csv", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "prospects.csv");
    const content = await fs.readFile(filePath, "utf8");
    return new NextResponse(content, {
      status: 200,
      headers: { "Content-Type": "text/csv; charset=utf-8" },
    });
  } catch {
    return new NextResponse("", {
      status: 200,
      headers: { "Content-Type": "text/csv; charset=utf-8" },
    });
  }
}

