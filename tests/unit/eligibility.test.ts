import { describe, expect, test } from "bun:test";
import {
  evaluateCountryEligibility,
  evaluateUserEligibility,
  isConfirmedWorldwide,
  type CountryRule,
} from "@/server/domain/eligibility";

const regions = (code: string) => (["DE", "FR", "IE"].includes(code) ? ["EU"] : []);

describe("evaluateCountryEligibility", () => {
  test("no country selected is its own state, not eligible", () => {
    expect(evaluateCountryEligibility([], "confirmed_eligible", null).status).toBe("not_selected");
  });

  test("most specific rule wins: country beats region beats global", () => {
    const rules: CountryRule[] = [
      { scope: "global", countryCode: null, regionCode: null, status: "confirmed_eligible" },
      { scope: "region", countryCode: null, regionCode: "EU", status: "likely_eligible" },
      { scope: "country", countryCode: "FR", regionCode: null, status: "confirmed_ineligible" },
    ];
    expect(evaluateCountryEligibility(rules, "unknown", "FR", regions)).toMatchObject({ status: "confirmed_ineligible", basis: "country_rule" });
    expect(evaluateCountryEligibility(rules, "unknown", "DE", regions)).toMatchObject({ status: "likely_eligible", basis: "region_rule" });
    expect(evaluateCountryEligibility(rules, "unknown", "BD", regions)).toMatchObject({ status: "confirmed_eligible", basis: "global_rule" });
  });

  test("falls back to the offer default (unknown) when no rule applies", () => {
    const rules: CountryRule[] = [{ scope: "country", countryCode: "US", regionCode: null, status: "confirmed_eligible" }];
    expect(evaluateCountryEligibility(rules, "unknown", "BD")).toMatchObject({ status: "unknown", basis: "default" });
  });

  test("likely eligible is never promoted to confirmed", () => {
    const rules: CountryRule[] = [{ scope: "country", countryCode: "BD", regionCode: null, status: "likely_eligible" }];
    expect(evaluateCountryEligibility(rules, "confirmed_eligible", "bd").status).toBe("likely_eligible");
  });

  test("conflicting rules at the same level resolve conservatively", () => {
    const rules: CountryRule[] = [
      { scope: "country", countryCode: "IN", regionCode: null, status: "confirmed_eligible" },
      { scope: "country", countryCode: "IN", regionCode: null, status: "confirmed_ineligible" },
    ];
    expect(evaluateCountryEligibility(rules, "unknown", "IN").status).toBe("confirmed_ineligible");
  });

  test("worldwide only when global is confirmed and nothing excludes", () => {
    expect(isConfirmedWorldwide([{ scope: "global", countryCode: null, regionCode: null, status: "confirmed_eligible" }])).toBe(true);
    expect(
      isConfirmedWorldwide([
        { scope: "global", countryCode: null, regionCode: null, status: "confirmed_eligible" },
        { scope: "country", countryCode: "CU", regionCode: null, status: "confirmed_ineligible" },
      ]),
    ).toBe(false);
    expect(isConfirmedWorldwide([])).toBe(false);
  });
});

describe("evaluateUserEligibility", () => {
  const eligibleCountry = { status: "confirmed_eligible" as const, basis: "country_rule" as const };

  test("ineligible country means ineligible regardless of other conditions", () => {
    const result = evaluateUserEligibility({
      country: { status: "confirmed_ineligible", basis: "country_rule" },
      studentRequired: true,
      customerEligibility: "all",
    });
    expect(result.status).toBe("ineligible");
  });

  test("unknown and likely countries stay unknown for the visitor", () => {
    for (const status of ["unknown", "likely_eligible", "not_selected"] as const) {
      expect(evaluateUserEligibility({ country: { status, basis: "default" }, studentRequired: false, customerEligibility: "all" }).status).toBe(
        "unknown",
      );
    }
  });

  test("student offers in an eligible country require verification", () => {
    const result = evaluateUserEligibility({ country: eligibleCountry, studentRequired: true, customerEligibility: "new_customers" });
    expect(result.status).toBe("requires_verification");
    expect(result.conditions).toEqual(["student", "new_customers"]);
  });

  test("eligible with conditions listed", () => {
    const result = evaluateUserEligibility({ country: eligibleCountry, studentRequired: false, customerEligibility: "new_customers" });
    expect(result).toMatchObject({ status: "eligible", conditions: ["new_customers"] });
  });
});
