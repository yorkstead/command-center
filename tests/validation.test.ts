import { describe, expect, test } from "bun:test";
import { moveDealSchema, newTaskSchema, taskPatchSchema } from "@/lib/validation";
import { formatCents, parseDollarsToCents } from "@/lib/money";

describe("task forms", () => {
  test("blank optional fields become null", () => {
    const parsed = newTaskSchema.parse({ title: " Call Acme ", owner_id: "", due_date: "", client_id: "", next_action: "" });
    expect(parsed).toMatchObject({ title: "Call Acme", owner_id: null, due_date: null, client_id: null, next_action: null, priority: "medium" });
  });
  test("rejects an empty title and a bad status", () => {
    expect(newTaskSchema.safeParse({ title: "  " }).success).toBe(false);
    expect(taskPatchSchema.safeParse({ status: "done" }).success).toBe(false);
  });
});

describe("deal stage moves", () => {
  const id = "4b4b8f1e-2f0a-4c1e-9a43-6f8f2d6b9c11";
  test("losing a deal needs a reason", () => {
    expect(moveDealSchema.safeParse({ id, stage: "lost" }).success).toBe(false);
    expect(moveDealSchema.safeParse({ id, stage: "lost", lost_reason: "Went with SaaS" }).success).toBe(true);
    expect(moveDealSchema.safeParse({ id, stage: "won" }).success).toBe(true);
  });
});

describe("money", () => {
  test("parses dollars to whole cents", () => {
    expect(parseDollarsToCents("$7,500")).toBe(750000);
    expect(parseDollarsToCents("19.99")).toBe(1999);
    expect(parseDollarsToCents("")).toBeNull();
    expect(() => parseDollarsToCents("abc")).toThrow();
  });
  test("formats cents as dollars", () => {
    expect(formatCents(750000)).toBe("$7,500");
    expect(formatCents(null)).toBe("—");
  });
});
