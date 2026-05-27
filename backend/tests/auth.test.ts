import { describe, expect, it } from "vitest";
import { parseSubdomainFromAliasEmail } from "../src/modules/tenant/parse-subdomain.js";

describe("auth alias parsing", () => {
  it("recognizes tenant alias emails", () => {
    expect(parseSubdomainFromAliasEmail("student@academy.abhyas.in", "abhyas.in")).toEqual({
      subdomain: "academy",
      aliasLocal: "student",
    });
  });

  it("recognizes org admin emails on tenant subdomain (not student aliases)", () => {
    expect(parseSubdomainFromAliasEmail("admin@nw.abhyas.in", "abhyas.in")).toEqual({
      subdomain: "nw",
      aliasLocal: "admin",
    });
  });
});
