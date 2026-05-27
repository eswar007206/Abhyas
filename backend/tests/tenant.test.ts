import { describe, expect, it } from "vitest";
import {
  parseSubdomainFromAliasEmail,
  parseSubdomainFromHost,
} from "../src/modules/tenant/parse-subdomain.js";

describe("tenant subdomain parsing", () => {
  it("extracts tenant subdomain from production host", () => {
    expect(parseSubdomainFromHost("unacademy.abhyas.in", "abhyas.in")).toBe("unacademy");
  });

  it("returns null for apex domain", () => {
    expect(parseSubdomainFromHost("abhyas.in", "abhyas.in")).toBeNull();
    expect(parseSubdomainFromHost("www.abhyas.in", "abhyas.in")).toBeNull();
  });

  it("returns null for localhost", () => {
    expect(parseSubdomainFromHost("localhost:5173", "abhyas.in")).toBeNull();
  });

  it("parses alias email into subdomain and local part", () => {
    expect(parseSubdomainFromAliasEmail("alakh@unacademy.abhyas.in", "abhyas.in")).toEqual({
      subdomain: "unacademy",
      aliasLocal: "alakh",
    });
  });
});
