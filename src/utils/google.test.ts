import { expect, test } from "bun:test";
import { googleCustomSearch } from "./google";

// Basic test to ensure URL is constructed with provided parameters

test("googleCustomSearch builds request URL with api key", async () => {
    const originalFetch = global.fetch;
    let calledUrl = "";
    global.fetch = async (url: string) => {
        calledUrl = url.toString();
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
    };

    process.env.AP_KEY_GOOGLE_CUSTOM_SEARCH = "dummy";
    await googleCustomSearch("hello world", "cx-id", { start: 2, num: 5 });

    expect(calledUrl.includes("key=dummy")).toBe(true);
    expect(calledUrl.includes("cx=cx-id")).toBe(true);
    expect(calledUrl.includes("q=hello%20world")).toBe(true);
    expect(calledUrl.includes("start=2")).toBe(true);
    expect(calledUrl.includes("num=5")).toBe(true);

    global.fetch = originalFetch;
});
