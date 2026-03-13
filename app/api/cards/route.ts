import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

type CardPayload = {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  lat: number;
  lng: number;
  images?: string[];
};

function toCsv(cards: CardPayload[]): string {
  const header = [
    "id",
    "name",
    "company",
    "phone",
    "email",
    "address",
    "notes",
    "lat",
    "lng",
    "images",
  ];

  const rows = cards.map((c) =>
    [
      c.id,
      c.name,
      c.company,
      c.phone,
      c.email,
      c.address,
      c.notes,
      String(c.lat),
      String(c.lng),
      (Array.isArray(c.images) ? c.images : []).join(";"),
    ].map((value) => {
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
    const body = (await req.json()) as { cards?: CardPayload[] };
    const cards = Array.isArray(body.cards) ? body.cards : [];

    const csv = toCsv(cards);
    const filePath = path.join(process.cwd(), "cards.csv");

    await fs.writeFile(filePath, csv, "utf8");

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to write cards.csv", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "cards.csv");
    const content = await fs.readFile(filePath, "utf8");
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  } catch {
    return new NextResponse("", {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  }
}

