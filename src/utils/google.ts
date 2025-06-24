import { Env } from "./env";

export interface GoogleSearchResultItem {
    title: string;
    link: string;
    snippet: string;
}

export interface GoogleSearchResponse {
    items?: GoogleSearchResultItem[];
}

export async function googleCustomSearch(
    query: string,
    cx: string,
    opts?: { start?: number; num?: number },
): Promise<GoogleSearchResponse> {
    const apiKey = Env.string("AP_KEY_GOOGLE_CUSTOM_SEARCH");
    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("cx", cx);
    url.searchParams.set("q", query);
    if (opts?.start) url.searchParams.set("start", `${opts.start}`);
    if (opts?.num) url.searchParams.set("num", `${opts.num}`);

    const res = await fetch(url.toString());
    if (!res.ok) {
        throw new Error(`Failed to fetch from Google Custom Search: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as GoogleSearchResponse;
}
