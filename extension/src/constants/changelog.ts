export interface ChangelogEntry {
    version: string;
    content: string[];
}

export const CHANGELOGS: ChangelogEntry[] = [
    {
        version: "2.1.0",
        content: [
            "Introduced a changelog section (this one!) to easily track improvements.",
            "Improved warning messages for domains where catch-all is disabled.",
            "Optimized caching to prevent the catch-all status from getting stuck in loading.",
            "Refined the email input icon styling."
        ]
    },
    {
        version: "2.0.1",
        content: [
            "Now you can see what's new in Alias Bridge directly from the popup!",
            "Improved alias generation performance.",
            "Fixed issue with clipboard copy on some sites."
        ]
    }
];
