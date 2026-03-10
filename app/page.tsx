"use client";

import dynamic from "next/dynamic";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CardWithLocation } from "./components/CardMap";

const DynamicCardMap = dynamic(
  () => import("./components/CardMap").then((m) => m.CardMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        正在加载地图…
      </div>
    ),
  }
);

type CardFormValues = Omit<CardWithLocation, "id" | "lat" | "lng">;

const STORAGE_KEY = "business-card-map";

export default function HomePage() {
  const [cards, setCards] = useState<CardWithLocation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CardFormValues>({
    name: "",
    company: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CardWithLocation[];
      if (Array.isArray(parsed)) {
        setCards(parsed);
      }
    } catch (e) {
      console.error("Failed to load cards from localStorage", e);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    } catch (e) {
      console.error("Failed to save cards to localStorage", e);
    }

    // 同步一份到服务端，写入项目根目录的 cards.csv
    if (cards.length > 0) {
      fetch("/api/cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cards }),
      }).catch((err) => {
        console.error("Failed to sync cards.csv", err);
      });
    } else {
      // 没有名片时也同步一次，清空 CSV
      fetch("/api/cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cards: [] }),
      }).catch((err) => {
        console.error("Failed to sync empty cards.csv", err);
      });
    }
  }, [cards]);

  async function geocode(address: string) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=us&q=${encodeURIComponent(
      address
    )}&limit=1`;

    const res = await fetch(url, {
      headers: {
        "Accept-Language": "en-US",
        "User-Agent": "name-card-map-demo/1.0 (example@example.com)",
        Referer: "http://localhost:3000",
      },
    });

    if (!res.ok) {
      throw new Error("Geocoding request failed");
    }

    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
    }>;

    if (!data.length) {
      return null;
    }

    const loc = {
      lat: Number(data[0].lat),
      lng: Number(data[0].lon),
    };

    console.log("Geocoded location for", address, "=>", loc);

    return loc;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim() || !form.address.trim()) {
      setError("请至少填写姓名和地址");
      return;
    }

    setLoading(true);
    try {
      const loc = await geocode(form.address);
      if (!loc) {
        setError("未找到该地址的坐标，请检查地址是否正确");
        return;
      }

      if (editingId) {
        setCards((prev) =>
          prev.map((card) =>
            card.id === editingId
              ? { ...card, ...form, lat: loc.lat, lng: loc.lng }
              : card
          )
        );
        setSelectedId(editingId);
      } else {
        const newCard: CardWithLocation = {
          id: String(Date.now()),
          ...form,
          lat: loc.lat,
          lng: loc.lng,
        };
        setCards((prev) => [newCard, ...prev]);
        setSelectedId(newCard.id);
      }

      setForm({
        name: "",
        company: "",
        phone: "",
        email: "",
        address: "",
        notes: "",
      });
      setEditingId(null);
    } catch (err) {
      console.error(err);
      setError("地理编码失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  function handleDelete(id: string) {
    setCards((prev) => prev.filter((card) => card.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
    setEditingId((prev) => (prev === id ? null : prev));
  }

  function startEdit(id: string) {
    const target = cards.find((c) => c.id === id);
    if (!target) return;
    setForm({
      name: target.name,
      company: target.company,
      phone: target.phone,
      email: target.email,
      address: target.address,
      notes: target.notes,
    });
    setEditingId(id);
    setSelectedId(id);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({
      name: "",
      company: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
    });
  }

  function exportToCsv() {
    if (cards.length === 0) {
      alert("当前没有名片可以导出。");
      return;
    }

    const header = [
      "name",
      "company",
      "phone",
      "email",
      "address",
      "notes",
      "lat",
      "lng",
    ];

    const rows = cards.map((c) =>
      [
        c.name,
        c.company,
        c.phone,
        c.email,
        c.address,
        c.notes,
        String(c.lat),
        String(c.lng),
      ].map((value) => {
        const safe = value ?? "";
        if (safe.includes(",") || safe.includes('"') || safe.includes("\n")) {
          return `"${safe.replace(/"/g, '""')}"`;
        }
        return safe;
      })
    );

    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const filename = `cards-${ts.getFullYear()}${pad(
      ts.getMonth() + 1
    )}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(
      ts.getMinutes()
    )}${pad(ts.getSeconds())}.csv`;
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleChange<K extends keyof CardFormValues>(
    key: K,
    value: CardFormValues[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  const selectedCard = useMemo(
    () => cards.find((c) => c.id === selectedId) ?? null,
    [cards, selectedId]
  );

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <section className="w-full border-b bg-white p-4 lg:h-screen lg:w-[420px] lg:max-w-md lg:border-b-0 lg:border-r lg:p-6 xl:w-[460px]">
        <div className="mb-4">
          <h1 className="text-xl font-semibold tracking-tight">
            名片地图工具
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            填写名片信息，自动把地址转成坐标，在右侧地图上显示标记。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="col-span-1">
              <label className="mb-1 block text-xs font-medium text-slate-700">
                姓名 *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="John Doe"
              />
            </div>

            <div className="col-span-1">
              <label className="mb-1 block text-xs font-medium text-slate-700">
                公司
              </label>
              <input
                type="text"
                value={form.company}
                onChange={(e) => handleChange("company", e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="Company Inc."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="col-span-1">
              <label className="mb-1 block text-xs font-medium text-slate-700">
                手机
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="+1 (555) 000-0000"
              />
            </div>

            <div className="col-span-1">
              <label className="mb-1 block text-xs font-medium text-slate-700">
                邮箱
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              地址 *（用于地理编码）
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => handleChange("address", e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              placeholder="如：280 Bowery, New York, NY 10012"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              备注
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              rows={3}
              className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              placeholder="可以记录见面场景、合作意向等"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-9 items-center justify-center rounded-md bg-sky-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "正在地理编码…"
                : editingId
                ? "保存修改"
                : "添加到地图"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                取消编辑
              </button>
            )}
          </div>
        </form>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium text-slate-800">名片列表</h2>
              <span className="text-xs text-slate-500">
                共 {cards.length} 条
              </span>
            </div>
            <button
              type="button"
              onClick={exportToCsv}
              className="inline-flex h-7 items-center justify-center rounded-md border border-slate-300 px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            >
              导出 CSV
            </button>
          </div>

          {cards.length === 0 ? (
            <p className="text-xs text-slate-500">
              还没有名片。先在上方表单中添加一条吧。
            </p>
          ) : (
            <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
              {cards.map((card) => {
                const isSelected = card.id === selectedId;
                return (
                  <div
                    key={card.id}
                    className={`flex items-stretch gap-2 rounded-md border px-3 py-2 text-xs transition-colors ${
                      isSelected
                        ? "border-sky-500 bg-sky-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(card.id)}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {card.name}
                          {card.company && (
                            <span className="ml-1 text-[11px] text-slate-600">
                              @{card.company}
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {card.phone || card.email || ""}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-[11px] text-slate-600">
                        {card.address}
                      </div>
                      {card.notes && (
                        <div className="mt-1 line-clamp-2 text-[11px] text-slate-500">
                          {card.notes}
                        </div>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(card.id)}
                      className="inline-flex items-center justify-center self-center rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(card.id)}
                      className="ml-1 inline-flex items-center justify-center self-center rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-100"
                    >
                      删除
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {selectedCard && (
            <p className="mt-2 text-[11px] text-slate-500">
              当前选中：{selectedCard.name}（地图上会高亮并弹出信息框）
            </p>
          )}
        </div>
      </section>

      <section className="flex-1">
        <div className="h-[360px] border-t bg-slate-100 lg:h-screen lg:border-t-0">
          <DynamicCardMap
            cards={cards}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
          />
        </div>
      </section>
    </div>
  );
}
