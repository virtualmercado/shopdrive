import { describe, it, expect } from "vitest";
import { ADMIN_PAGE_SIZE, getPageRange, getTotalPages, getRangeLabel } from "./adminPagination";

describe("Master campaign pagination", () => {
  it("keeps 50 records per page", () => { expect(ADMIN_PAGE_SIZE).toBe(50); });
  it("requests records 51–100 on page 2", () => { expect(getPageRange(2)).toEqual({ from: 50, to: 99 }); });
  it("uses the real total across four pages", () => { expect(getTotalPages(154)).toBe(4); });
  it("labels the first 50 of 170 nonarchived campaigns", () => { expect(getRangeLabel(1, 170)).toEqual({ start: 1, end: 50 }); });
  it("labels all 30 archived campaigns", () => { expect(getRangeLabel(1, 30)).toEqual({ start: 1, end: 30 }); });
});