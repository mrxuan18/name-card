import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export const runtime = "nodejs";

function safeExt(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) return ext;
  return "";
}

function getUploadsBaseDir() {
  const fromEnv = process.env.UPLOADS_DIR;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv;
  }
  return path.join(process.cwd(), "uploads");
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cardId = searchParams.get("cardId");
    if (!cardId) {
      return NextResponse.json({ ok: false, error: "Missing cardId" }, { status: 400 });
    }

    const form = await req.formData();
    const files = form.getAll("files");
    if (!files.length) {
      return NextResponse.json({ ok: false, error: "No files" }, { status: 400 });
    }

    const baseDir = getUploadsBaseDir();
    const destDir = path.join(baseDir, cardId);
    await fs.mkdir(destDir, { recursive: true });

    const uploaded: Array<{ url: string; filename: string; originalName: string }> = [];

    for (const item of files) {
      if (!(item instanceof File)) continue;
      const ext = safeExt(item.name);
      if (!ext) continue;

      const id = crypto.randomUUID();
      const filename = `${id}${ext}`;
      const filePath = path.join(destDir, filename);

      const arrayBuffer = await item.arrayBuffer();
      await fs.writeFile(filePath, Buffer.from(arrayBuffer));

      uploaded.push({
        url: `/uploads/${encodeURIComponent(cardId)}/${encodeURIComponent(filename)}`,
        filename,
        originalName: item.name,
      });
    }

    return NextResponse.json({ ok: true, uploaded });
  } catch (error) {
    console.error("Upload failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cardId = searchParams.get("cardId");
    const filenameRaw = searchParams.get("filename");

    if (!cardId || !filenameRaw) {
      return NextResponse.json(
        { ok: false, error: "Missing cardId or filename" },
        { status: 400 }
      );
    }

    const filename = path.basename(filenameRaw);
    if (!safeExt(filename)) {
      return NextResponse.json({ ok: false, error: "Invalid filename" }, { status: 400 });
    }

    const baseDir = getUploadsBaseDir();
    const filePath = path.join(baseDir, cardId, filename);
    await fs.unlink(filePath);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete upload failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

