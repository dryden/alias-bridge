export interface ChangelogEntry {
    version: string;
    date?: string; // Added date as optional
    content?: string[]; // Made content optional
    changes?: string[]; // Added changes as optional
}

export const CHANGELOGS: ChangelogEntry[] = [
    {
        version: "3.0.0",
        date: "2025-12-08",
        changes: [
            "Full support for Self-Hosted Addy.io instances with dynamic configuration.",
            "Refined User Interface: Enhanced 'Server Generation Mode' with clear instructions and polished visuals.",
            "Stability: Fixed edge cases for shared domains and improved build reliability.",
        ]
    },
    {
        version: "2.2.1",
        date: "2025-12-08",
        changes: [
            Expanded domain parsing support for APAC regions(e.g., .hk, .sg, .kr, .cn) and common platforms(e.g., github.io, vercel.app).
        ]
    },
{
    version: "2.2.0",
        content: [
            "For catch-all disabled domains, aliases generated on Addy.io now include the source website in the description for better tracking."
        ]
},
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
            "Improved alias generation performance.",
            "Fixed issue with clipboard copy on some sites."
        ]
}
];
