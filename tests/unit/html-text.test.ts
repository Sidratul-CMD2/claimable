import { describe, expect, test } from "bun:test";
import { decodeEntities, htmlToText } from "@/server/connectors/http";
import { matchMarkers } from "@/server/domain/monitoring";

describe("htmlToText", () => {
  test("decodes named, decimal and hex entities used in prices (found live on ableton.com)", () => {
    expect(decodeEntities("save 50&percnt; on Live &ndash; &euro;10 &#36;5 &#x24;6 &rsquo;s")).toBe("save 50% on Live – €10 $5 $6 ’s");
    expect(decodeEntities("&unknownentity; stays")).toBe("&unknownentity; stays");
  });

  test("drops scripts, styles and comments; keeps visible text", () => {
    const text = htmlToText("<style>.a{}</style><p>Students and teachers: save 50&percnt; on Live</p><script>alert('x')</script><!-- hidden -->");
    expect(text).toBe("Students and teachers: save 50% on Live");
    expect(matchMarkers(text, ["save 50% on Live"]).missing).toEqual([]);
  });
});
